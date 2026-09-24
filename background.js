import { analyze, registrable, officialMatch } from './detector.js';
import { refreshFeeds, feedHit, FEED_SOURCES } from './feed.js';
import { domainAgeDays, agoText as ago } from './rdap.js';
import { getSettings, hardenStorage } from './settings.js';
import { ensurePsl } from './psl.js';
import { getProtectedEntities, getRemoteRecord, syncRemoteList, clearRemoteList } from './remote-list.js';

const REMOTE_ALARM='protected-list-sync';
hardenStorage();
ensurePsl();

function parseHttp(url){try{const u=new URL(url);return /^https?:$/.test(u.protocol)?u:null;}catch{return null;}}
const isIPv4=h=>/^\d{1,3}(\.\d{1,3}){3}$/.test(h);
function isPrivateIPv4(h){const[a,b]=h.split('.').map(Number);return a===10||a===127||(a===192&&b===168)||(a===172&&b>=16&&b<=31);}
function setBadge(tabId,text,color,title){chrome.action.setBadgeText({tabId,text});if(text)chrome.action.setBadgeBackgroundColor({tabId,color});if(title)chrome.action.setTitle({tabId,title});}

async function currentData(){const s=await getSettings();const entities=await getProtectedEntities(s);return{s,entities};}

chrome.webNavigation.onBeforeNavigate.addListener(async d=>{
  if(d.frameId!==0)return; const u=parseHttp(d.url);if(!u)return; await ensurePsl();
  const {allowed={}}=await chrome.storage.session.get('allowed'); if(allowed[u.hostname])return;
  const {s,entities}=await currentData(); const reg=registrable(u.hostname.toLowerCase());
  const trusted=s.trusted.includes(reg); let r=trusted?null:analyze(d.url,s.userProtected,entities);
  if(!r&&await feedHit(d.url))r={reason:'feed',brand:'',entityName:''}; if(!r)return;
  const page=chrome.runtime.getURL('warning.html')+'?'+new URLSearchParams({url:d.url,reason:r.reason,brand:r.brand||'',name:r.entityName||''});
  chrome.tabs.update(d.tabId,{url:page});
});

chrome.webNavigation.onCommitted.addListener(d=>{if(d.frameId===0)chrome.action.setBadgeText({tabId:d.tabId,text:''});});
chrome.webNavigation.onCompleted.addListener(async d=>{
  if(d.frameId!==0)return;const u=parseHttp(d.url);if(!u)return;await ensurePsl();
  const {s,entities}=await currentData();const reg=registrable(u.hostname.toLowerCase());const off=officialMatch(u.hostname,entities);
  if(off)setBadge(d.tabId,'✓','#16803b',`Ověřená chráněná doména: ${off.entity.name}`);
  else if(s.userProtected.includes(reg))setBadge(d.tabId,'✓','#2563eb',`Uživatelsky chráněná doména: ${reg}`);
});

async function handlePassword(tab){
  const {s,entities}=await currentData();if(s.pwMode==='off')return null;const u=parseHttp(tab.url);if(!u)return null;await ensurePsl();
  const host=u.hostname.toLowerCase();if(host.includes(':')||!host.includes('.'))return null;
  if(isIPv4(host)){if(isPrivateIPv4(host))return null;setBadge(tab.id,'!','#b42318','Přihlášení na IP adrese');return{level:'warn',text:`Zadáváte heslo na webu adresovaném IP (${host}).`};}
  const reg=registrable(host);if(officialMatch(host,entities)||s.userProtected.includes(reg)||s.trusted.includes(reg))return null;
  const age=await domainAgeDays(reg);
  if(age!==null&&age<30){setBadge(tab.id,'!','#b42318','Nově registrovaná doména');return{level:'warn',text:`Zadáváte heslo na doméně ${reg}, která byla zaregistrována ${ago(age)}. Nové domény jsou typické pro phishing.`};}
  if(age!==null&&age<90){setBadge(tab.id,'!','#b54708','Nedávno registrovaná doména');return{level:'caution',text:`Zadáváte heslo na doméně ${reg}, která byla zaregistrována ${ago(age)}. Ověřte adresu.`};}
  if(s.pwMode==='always'){setBadge(tab.id,'?','#475467','Neznámá doména s přihlašovacím formulářem');return{level:'info',text:`Zadáváte heslo na neznámé doméně ${reg}.`+(age!==null?` Registrována ${ago(age)}.`:'')};}
  return null;
}

async function trustTab(tab){const u=parseHttp(tab.url);if(!u)return;const s=await getSettings();const reg=registrable(u.hostname.toLowerCase());if(!s.trusted.includes(reg))await chrome.storage.sync.set({trusted:[...s.trusted,reg]});setBadge(tab.id,'','');}
async function refresh(){const s=await getSettings();const urls=Object.entries(s.feeds).filter(([k,on])=>on&&FEED_SOURCES[k]).map(([k])=>FEED_SOURCES[k]);return refreshFeeds(urls);}

async function setRemoteStatus(ok, extra={}){
  const record=await getRemoteRecord();
  await chrome.storage.local.set({remoteListStatus:{ok,checkedAt:Date.now(),fetchedAt:record?.fetchedAt||null,url:record?.url||'',version:record?.version||'',count:record?.entities?.length||0,hash:record?.hash||'',...extra}});
}

async function refreshRemote(){
  const s=await getSettings();
  if(!s.remoteList.enabled||!s.remoteList.url){await setRemoteStatus(false,{disabled:true,error:''});return{ok:false,disabled:true};}
  try{
    const rec=await syncRemoteList(s.remoteList.url);
    await setRemoteStatus(true,{disabled:false,error:'',fetchedAt:rec.fetchedAt,url:rec.url,version:rec.version,count:rec.entities.length,hash:rec.hash});
    return{ok:true,count:rec.entities.length,version:rec.version,hash:rec.hash};
  }catch(e){
    await setRemoteStatus(false,{disabled:false,error:e?.message||String(e),url:s.remoteList.url});
    return{ok:false,error:e?.message||String(e)};
  }
}

async function configureRemoteAlarm(syncIfDue=false){
  const s=await getSettings();
  await chrome.alarms.clear(REMOTE_ALARM);
  if(s.remoteList.enabled&&s.remoteList.url){
    await chrome.alarms.create(REMOTE_ALARM,{periodInMinutes:s.remoteList.intervalHours*60});
    if(syncIfDue){
      const rec=await getRemoteRecord();
      const due=!rec||rec.url!==s.remoteList.url||Date.now()-rec.fetchedAt>=s.remoteList.intervalHours*3600e3;
      if(due) await refreshRemote();
    }
  }
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg.type==='passwordField'&&sender.tab){handlePassword(sender.tab).then(sendResponse,()=>sendResponse(null));return true;}
  if(msg.type==='trust'&&sender.tab){trustTab(sender.tab).then(()=>sendResponse(true));return true;}
  if(msg.type==='refreshFeeds'){refresh().then(sendResponse);return true;}
  if(msg.type==='refreshProtectedList'){refreshRemote().then(sendResponse);return true;}
  if(msg.type==='configureProtectedList'){configureRemoteAlarm(true).then(()=>sendResponse({ok:true}));return true;}
  if(msg.type==='clearProtectedListCache'){clearRemoteList().then(async()=>{await chrome.storage.local.remove('remoteListStatus');sendResponse({ok:true});});return true;}
});

chrome.runtime.onInstalled.addListener(async()=>{
  await hardenStorage();await ensurePsl();
  await chrome.alarms.create('feeds',{periodInMinutes:360});
  await configureRemoteAlarm(true);
  refresh();
});
chrome.runtime.onStartup.addListener(async()=>{
  await hardenStorage();await ensurePsl();
  await chrome.alarms.create('feeds',{periodInMinutes:360});
  await configureRemoteAlarm(true);
});
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='feeds')refresh();if(a.name===REMOTE_ALARM)refreshRemote();});
