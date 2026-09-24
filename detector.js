import { PROTECTED_ENTITIES, DEFAULT_PROTECTED } from './protected.js';
import { registrableDomain } from './psl.js';
export { DEFAULT_PROTECTED };

const CONFUSABLES = {
  'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ј':'j','ѕ':'s','ԁ':'d','ɡ':'g',
  'ο':'o','ν':'v','α':'a','ρ':'p','ı':'i','0':'o','1':'l'
};
const SUSPICIOUS_SUFFIXES = new Set(['login','secure','bank','banka','online','ib','internetbanking','verify','auth','konto','ucet','24']);

function punyDecode(input) {
  const base=36,tMin=1,tMax=26,skew=38,damp=700; let n=128,i=0,bias=72; const out=[];
  let basic=input.lastIndexOf('-'); if (basic<0) basic=0;
  for(let j=0;j<basic;j++) out.push(input.charCodeAt(j));
  const adapt=(delta,num,first)=>{let k=0;delta=first?Math.floor(delta/damp):delta>>1;delta+=Math.floor(delta/num);for(;delta>((base-tMin)*tMax)>>1;k+=base)delta=Math.floor(delta/(base-tMin));return Math.floor(k+((base-tMin+1)*delta)/(delta+skew));};
  for(let idx=basic>0?basic+1:0;idx<input.length;){const oldi=i;let w=1;for(let k=base;;k+=base){const cp=input.charCodeAt(idx++);const digit=cp-48<10?cp-22:cp-65<26?cp-65:cp-97<26?cp-97:base;i+=digit*w;const t=k<=bias?tMin:k>=bias+tMax?tMax:k-bias;if(digit<t)break;w*=base-t;}const len=out.length+1;bias=adapt(i-oldi,len,oldi===0);n+=Math.floor(i/len);i%=len;out.splice(i++,0,n);}return String.fromCodePoint(...out);
}
export function toUnicodeHost(host){return String(host).split('.').map(l=>{if(!l.startsWith('xn--'))return l;try{return punyDecode(l.slice(4));}catch{return l;}}).join('.');}
export function registrable(host){return registrableDomain(toUnicodeHost(host));}

function plain(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/&/g,'');}
function skeleton(s){let r=plain(s);r=[...r].map(c=>CONFUSABLES[c]??c).join('');return r.replace(/rn/g,'m').replace(/vv/g,'w');}
function compact(s){return skeleton(s).replace(/[^a-z0-9]/g,'');}
function tokens(s){return skeleton(s).split(/[^a-z0-9]+/).filter(Boolean);}
function dist(a,b){const d=[];for(let i=0;i<=a.length;i++)d[i]=[i];for(let j=1;j<=b.length;j++)d[0][j]=j;for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++){const c=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);}return d[a.length][b.length];}

export function officialMatch(urlOrHost, entities=PROTECTED_ENTITIES){
  let host;
  try { host = new URL(urlOrHost.includes('://') ? urlOrHost : 'https://'+urlOrHost).hostname.toLowerCase(); } catch { return null; }
  const reg=registrable(host);
  for(const e of entities){if(e.domains.includes(reg))return {entity:e,domain:reg,host};if((e.hosts||[]).includes(host))return {entity:e,domain:reg,host};}
  return null;
}

function targets(userProtected=[], entities=PROTECTED_ENTITIES){
  const out=entities.map(e=>({entity:e,domains:e.domains,brands:e.brands||[]}));
  for(const d of userProtected) out.push({entity:{name:d,category:'user'},domains:[d],brands:[d.split('.')[0]]});
  return out;
}

export function analyze(urlStr,userProtected=[],entities=PROTECTED_ENTITIES){
  let u;try{u=new URL(urlStr);}catch{return null;}if(!/^https?:$/.test(u.protocol))return null;
  const host=toUnicodeHost(u.hostname.replace(/\.$/,'').toLowerCase());
  const reg=registrable(host);
  if(officialMatch(host,entities) || userProtected.includes(reg)) return null;
  if(u.username && u.username.includes('.')) return {reason:'userinfo',brand:'',entityName:''};
  const label=reg.split('.')[0], labelSk=skeleton(label), labelCompact=compact(label), labelTokens=tokens(label);

  for(const t of targets(userProtected,entities)){
    for(const d of t.domains){if(('.'+host+'.').includes('.'+d+'.'))return {reason:'brandInside',brand:d,entityName:t.entity.name};}
    for(const rawBrand of t.brands){
      const b=compact(rawBrand); if(!b) continue;
      const display=t.domains[0]||'';
      if(labelCompact===b) return {reason: plain(label)===plain(rawBrand).replace(/\s+/g,'')?'sameName':'lookalike',brand:display,entityName:t.entity.name};
      if(labelTokens.some(x=>compact(x)===b)) return {reason:'brandInside',brand:display,entityName:t.entity.name};
      if(b.length>=4 && dist(labelCompact,b)<=1) return {reason:'typo',brand:display,entityName:t.entity.name};
      if(b.length>=2 && labelCompact.startsWith(b) && labelCompact!==b){const rest=labelCompact.slice(b.length);if(SUSPICIOUS_SUFFIXES.has(rest)||/^\d{1,3}$/.test(rest))return {reason:'brandInside',brand:display,entityName:t.entity.name};}
      if(b.length>=3 && labelCompact.endsWith(b) && labelCompact!==b){const pre=labelCompact.slice(0,-b.length);if(SUSPICIOUS_SUFFIXES.has(pre))return {reason:'brandInside',brand:display,entityName:t.entity.name};}
    }
  }
  return null;
}
