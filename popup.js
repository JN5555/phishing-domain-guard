import { analyze, registrable, toUnicodeHost, officialMatch } from './detector.js';
import { feedHit } from './feed.js';
import { domainAgeDays, agoText } from './rdap.js';
import { getSettings, clean, hardenStorage } from './settings.js';
import { CATEGORY_LABELS } from './protected.js';
import { REASONS } from './reasons.js';
import { ensurePsl } from './psl.js';
import { databaseFingerprint } from './security.js';
import { getProtectedEntities, getRemoteRecord, normalizeGithubUrl } from './remote-list.js';

const $=id=>document.getElementById(id);
let state,entities=[],tab,target,category='all';
const ageCache={};
const isIP=h=>/^\d{1,3}(\.\d{1,3}){3}$/.test(h)||h.includes(':');
function el(tag,props={},...kids){const e=document.createElement(tag);Object.assign(e,props);e.append(...kids);return e;}
function toast(text){const t=$('toast');t.textContent=text;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,2600);}
async function save(obj){await chrome.storage.sync.set(obj);}
function resolveTarget(t){const raw=t?.url||'';if(raw.startsWith(chrome.runtime.getURL('warning.html'))){const p=new URL(raw).searchParams;return{url:p.get('url')||'',warning:true,reason:p.get('reason'),brand:p.get('brand')||'',name:p.get('name')||''};}return{url:raw,warning:false};}
function hero(kind,title,text,icon){$('verdict').className='hero '+kind;$('vTitle').textContent=title;$('vText').textContent=text;$('heroIcon').textContent=icon;}
function fact(k,v,cls=''){ $('facts').append(el('dt',{textContent:k}),el('dd',{textContent:v,className:cls})); }

async function reloadEntities(){entities=await getProtectedEntities(state);}

async function renderOverview(){
  $('facts').replaceChildren();$('actions').replaceChildren();let u;try{u=new URL(target.url);}catch{}
  if(!u||!/^https?:$/.test(u.protocol)){hero('neutral','Není běžná webová stránka','Tuto kartu nelze analyzovat.','–');$('ageRow').hidden=true;return;}
  const host=u.hostname.toLowerCase(),uni=toUnicodeHost(host),ip=isIP(host),reg=ip?host:registrable(host);const off=ip?null:officialMatch(host,entities);const custom=!ip&&state.userProtected.includes(reg);const trusted=!ip&&state.trusted.includes(reg);const res=trusted?null:analyze(target.url,state.userProtected,entities);const feed=await feedHit(target.url);
  if(feed)hero('danger','Známá phishingová adresa','URL se nachází ve staženém phishingovém feedu.','!');
  else if(res)hero('danger','Podezřelá napodobenina',REASONS[res.reason]||'Adresa vypadá podezřele.','!');
  else if(off)hero('safe',off.entity.name,off.entity.remote?'Doména odpovídá chráněnému seznamu synchronizovanému z GitHubu.':'Doména odpovídá vestavěné chráněné databázi.','✓');
  else if(custom)hero('safe','Vaše chráněná doména','Doménu jste ručně přidali mezi chráněné.','✓');
  else if(trusted)hero('neutral','Důvěryhodná výjimka','Doménu jste označili jako důvěryhodnou.','✓');
  else hero('neutral','Bez zjevného varování','Doména není v chráněné databázi ani v phishingovém feedu.','?');
  fact('Host',host);if(uni!==host)fact('Unicode',uni,'warnText');if(!ip)fact('Registr. doména',reg);fact('Spojení',u.protocol==='https:'?'HTTPS':'HTTP – nešifrované',u.protocol==='https:'?'':'warnText');if(off)fact('Kategorie',CATEGORY_LABELS[off.entity.category]||off.entity.category);if(off)fact('Zdroj',off.entity.remote?`GitHub · ${off.entity.source}`:off.entity.source);if(res?.entityName)fact('Napodobuje',res.entityName,'warnText');
  $('ageRow').hidden=ip;$('age').textContent=ageCache[reg]||'';$('ageBtn').onclick=async()=>{$('age').textContent='Zjišťuji…';const d=await domainAgeDays(reg);ageCache[reg]=d===null?'Stáří se nepodařilo zjistit.':`Registrována ${agoText(d)}`+(d<30?' · velmi nová':'');$('age').textContent=ageCache[reg];};
  const action=(label,fn,cls='')=>$('actions').append(el('button',{textContent:label,className:cls,onclick:fn}));
  if(res?.brand)action(`Otevřít ${res.entityName||res.brand}`,()=>chrome.tabs.update(tab.id,{url:'https://'+res.brand}).then(()=>window.close()),'primary');
  if(!ip&&!feed&&!off){if(custom)action('Odebrat z mých chráněných',async()=>{state.userProtected=state.userProtected.filter(x=>x!==reg);await save({userProtected:state.userProtected});renderAll();},'danger');else action('Chránit tuto doménu',async()=>{state.userProtected=[...new Set([...state.userProtected,reg])];await save({userProtected:state.userProtected});renderAll();},'primary');}
  if(!ip&&!off){if(trusted)action('Zrušit výjimku',async()=>{state.trusted=state.trusted.filter(x=>x!==reg);await save({trusted:state.trusted});renderAll();});else if(!custom)action('Důvěřovat',async()=>{state.trusted=[...new Set([...state.trusted,reg])];await save({trusted:state.trusted});renderAll();});}
}

function renderEntities(){
  const q=$('filter').value.trim().toLowerCase();const rows=$('entityRows');rows.replaceChildren();
  const filtered=entities.filter(e=>{const cat=category==='all'||(category==='other'?!['bank','media'].includes(e.category):e.category===category);const hay=[e.name,...e.domains,...(e.hosts||[]),...(e.brands||[])].join(' ').toLowerCase();return cat&&(!q||hay.includes(q));});
  for(const e of filtered){const tagText=(CATEGORY_LABELS[e.category]||'Ostatní')+(e.remote?' · GitHub':'');rows.append(el('div',{className:'entity'},el('div',{className:'entityTop'},el('span',{className:'entityName',textContent:e.name}),el('span',{className:'tag'+(e.remote?' remote':''),textContent:tagText})),el('div',{className:'entityDomains',textContent:[...e.domains,...(e.hosts||[])].join(' · ')}),el('div',{className:'entitySource',textContent:'Zdroj: '+(e.remote?'GitHub · ':'')+e.source})));}
  if(!filtered.length)rows.append(el('div',{className:'meta',textContent:'Žádné položky neodpovídají filtru.'}));
}
function renderSimpleRows(key,container,count){const box=$(container);box.replaceChildren();for(const d of state[key]){box.append(el('div',{className:'row'},el('span',{textContent:d}),el('button',{textContent:'✕',title:'Odebrat',onclick:async()=>{state[key]=state[key].filter(x=>x!==d);await save({[key]:state[key]});renderAll();}})));}$(count).textContent=`Počet: ${state[key].length}`;}
function addHandler(inputId,buttonId,key){const fn=async()=>{const parts=$(inputId).value.split(/[\s,;]+/).filter(Boolean),good=parts.map(clean).filter(Boolean);if(!good.length)return toast('Zadejte platnou doménu.');state[key]=[...new Set([...state[key],...good])];$(inputId).value='';await save({[key]:state[key]});renderAll();};$(buttonId).onclick=fn;$(inputId).onkeydown=e=>{if(e.key==='Enter')fn();};}
function renderStats(){const banks=entities.filter(e=>e.category==='bank').length,media=entities.filter(e=>e.category==='media').length,domains=new Set(entities.flatMap(e=>e.domains)).size;$('stats').replaceChildren(el('div',{className:'stat'},el('b',{textContent:String(banks)}),el('span',{textContent:'bankovních značek'})),el('div',{className:'stat'},el('b',{textContent:String(media)}),el('span',{textContent:'mediálních značek'})),el('div',{className:'stat'},el('b',{textContent:String(domains)}),el('span',{textContent:'chráněných domén'})));}
async function showFeedStatus(){const{feedStatus}=await chrome.storage.local.get('feedStatus');$('feedStatus').textContent=feedStatus?`Aktualizováno ${new Date(feedStatus.updated).toLocaleString('cs-CZ')}, záznamů ${feedStatus.count}`+(feedStatus.errors?.length?` · chyby: ${feedStatus.errors.join('; ')}`:''):'Zatím nestaženo.';}

async function showRemoteStatus(){
  const {remoteListStatus}=await chrome.storage.local.get('remoteListStatus');
  const rec=await getRemoteRecord();
  const box=$('remoteStatus');box.className='statusBox neutralStatus';
  if(!state.remoteList.enabled){box.textContent=rec?'Synchronizace je vypnutá. Lokální kopie zůstává uložená, ale nepoužívá se.':'GitHub synchronizace není zapnutá.';return;}
  if(!state.remoteList.url){box.textContent='Chybí URL zdroje.';return;}
  const currentUrl=normalizeGithubUrl(state.remoteList.url);
  const statusMatches=!remoteListStatus?.url||remoteListStatus.url===currentUrl;
  if(remoteListStatus?.ok&&statusMatches){box.className='statusBox okStatus';const when=new Date(remoteListStatus.fetchedAt||remoteListStatus.checkedAt).toLocaleString('cs-CZ');const ver=remoteListStatus.version?` · verze ${remoteListStatus.version}`:'';const hash=remoteListStatus.hash?` · SHA-256 ${remoteListStatus.hash.slice(0,10)}…`:'';box.textContent=`Aktualizováno ${when} · ${remoteListStatus.count} položek${ver}${hash}`;return;}
  if(remoteListStatus?.error&&statusMatches){box.className='statusBox badStatus';box.textContent=`Poslední synchronizace selhala: ${remoteListStatus.error}`+(rec&&rec.url===currentUrl?' Poslední platná kopie zůstala zachována.':'');return;}
  if(rec&&rec.url===normalizeGithubUrl(state.remoteList.url)){box.className='statusBox okStatus';box.textContent=`Načtena lokální kopie: ${rec.entities.length} položek · ${new Date(rec.fetchedAt).toLocaleString('cs-CZ')}`;return;}
  box.textContent='Zdroj je nastavený, zatím nebyl synchronizován.';
}

async function saveRemoteSettings(showToast=true){
  const enabled=$('remoteEnabled').checked;const raw=$('remoteUrl').value.trim();const normalized=raw?normalizeGithubUrl(raw):null;
  if(enabled&&!normalized){toast('Zadejte platný GitHub odkaz na JSON soubor.');return false;}
  state.remoteList={enabled,url:normalized||raw,intervalHours:Number($('remoteInterval').value)||24};
  await save({remoteList:state.remoteList});
  await chrome.runtime.sendMessage({type:'configureProtectedList'});
  await reloadEntities();renderAll();await showRemoteStatus();
  if(showToast)toast('Nastavení synchronizace uloženo.');
  return true;
}

function setupRemote(){
  $('remoteEnabled').checked=!!state.remoteList.enabled;$('remoteUrl').value=state.remoteList.url||'';$('remoteInterval').value=String(state.remoteList.intervalHours||24);
  $('saveRemoteBtn').onclick=()=>saveRemoteSettings(true);
  $('syncRemoteBtn').onclick=async()=>{
    if(!await saveRemoteSettings(false))return;
    if(!state.remoteList.enabled)return toast('Nejdřív zapněte GitHub synchronizaci.');
    $('remoteStatus').className='statusBox neutralStatus';$('remoteStatus').textContent='Synchronizuji z GitHubu…';
    const result=await chrome.runtime.sendMessage({type:'refreshProtectedList'});
    await reloadEntities();renderAll();await showRemoteStatus();
    toast(result?.ok?`Synchronizováno: ${result.count} položek.`:`Synchronizace selhala: ${result?.error||'neznámá chyba'}`);
  };
  $('clearRemoteBtn').onclick=async()=>{await chrome.runtime.sendMessage({type:'clearProtectedListCache'});await reloadEntities();renderAll();await showRemoteStatus();toast('Lokální kopie GitHub seznamu byla vymazána.');};
  showRemoteStatus();
}

function setupSettings(){
  $('openphish').checked=!!state.feeds.openphish;$('phishingdb').checked=!!state.feeds.phishingdb;$('pwMode').value=state.pwMode;
  const saveFeeds=async()=>{state.feeds={openphish:$('openphish').checked,phishingdb:$('phishingdb').checked};await save({feeds:state.feeds});};
  $('openphish').onchange=saveFeeds;$('phishingdb').onchange=saveFeeds;$('pwMode').onchange=async()=>{state.pwMode=$('pwMode').value;await save({pwMode:state.pwMode});};
  $('refreshBtn').onclick=async()=>{await saveFeeds();$('feedStatus').textContent='Aktualizuji…';await chrome.runtime.sendMessage({type:'refreshFeeds'});showFeedStatus();};showFeedStatus();setupRemote();
}
function renderAll(){renderOverview();renderEntities();renderSimpleRows('userProtected','userRows','userCount');renderSimpleRows('trusted','trustedRows','trustedCount');renderStats();}

async function init(){
  await hardenStorage();await ensurePsl();state=await getSettings();await reloadEntities();[tab]=await chrome.tabs.query({active:true,currentWindow:true});target=resolveTarget(tab);$('version').textContent='v'+chrome.runtime.getManifest().version;
  document.querySelectorAll('#tabs button').forEach(b=>{b.onclick=()=>{document.querySelectorAll('#tabs button').forEach(x=>x.classList.toggle('on',x===b));['overview','protected','settings'].forEach(n=>{$('tab-'+n).hidden=n!==b.dataset.tab;});$('mainScroll').scrollTop=0;};});
  document.querySelectorAll('#categoryFilter button').forEach(b=>{b.onclick=()=>{category=b.dataset.cat;document.querySelectorAll('#categoryFilter button').forEach(x=>x.classList.toggle('on',x===b));renderEntities();};});
  $('filter').oninput=renderEntities;addHandler('add','addBtn','userProtected');addHandler('addTrusted','addTrustedBtn','trusted');setupSettings();renderAll();databaseFingerprint().then(h=>$('fingerprint').textContent=h.slice(0,16)+'…'+h.slice(-12));
}
init();
