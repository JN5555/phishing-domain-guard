import { registrable } from './detector.js';
import { REASONS } from './reasons.js';
const p=new URLSearchParams(location.search),url=p.get('url')||'',brand=/^[a-z0-9.-]+$/i.test(p.get('brand')||'')?p.get('brand'):'',name=p.get('name')||'';
document.getElementById('reason').textContent=REASONS[p.get('reason')]||'Adresa vypadá podezřele.';document.getElementById('url').textContent=url;
if(brand){document.getElementById('brand').textContent=name?`${name} — ${brand}`:brand;document.getElementById('brandLine').hidden=false;const safe=document.getElementById('safe');safe.hidden=false;safe.textContent=name?`Přejít bezpečně na ${name}`:'Přejít na oficiální web';safe.onclick=()=>location.replace('https://'+brand);}
document.getElementById('close').onclick=()=>window.close();document.getElementById('go').onclick=async()=>{const host=new URL(url).hostname;const{allowed={}}=await chrome.storage.session.get('allowed');allowed[host]=true;await chrome.storage.session.set({allowed});location.replace(url);};
if(p.get('reason')!=='feed'){const t=document.getElementById('trust');t.hidden=false;t.onclick=async()=>{const reg=registrable(new URL(url).hostname.toLowerCase());const{trusted=[]}=await chrome.storage.sync.get('trusted');if(!trusted.includes(reg))await chrome.storage.sync.set({trusted:[...trusted,reg]});location.replace(url);};}
