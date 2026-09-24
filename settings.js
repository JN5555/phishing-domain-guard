import { DEFAULT_PROTECTED } from './protected.js';
import { registrable } from './detector.js';

const DEFAULTS={
  userProtected:[],trusted:[],feeds:{openphish:true,phishingdb:false},pwMode:'young',
  remoteList:{enabled:false,url:'https://raw.githubusercontent.com/JN5555/phishing-domain-guard/main/protected-list.json',intervalHours:24}
};

export async function hardenStorage(){
  try{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});}catch{}
  try{await chrome.storage.sync.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});}catch{}
}

export async function getSettings(){
  const s=await chrome.storage.sync.get({...DEFAULTS,domains:null,custom:[]});
  if(!Array.isArray(s.userProtected)) s.userProtected=[];
  if(!Array.isArray(s.trusted)) s.trusted=[];
  if(!s.remoteList || typeof s.remoteList!=='object') s.remoteList={...DEFAULTS.remoteList};
  s.remoteList={...DEFAULTS.remoteList,...s.remoteList};
  s.remoteList.intervalHours=[6,24,168].includes(Number(s.remoteList.intervalHours))?Number(s.remoteList.intervalHours):24;
  if(Array.isArray(s.domains)){
    const legacy=s.domains.filter(d=>!DEFAULT_PROTECTED.includes(d));
    s.userProtected=[...new Set([...s.userProtected,...legacy,...(s.custom||[])])];
    await chrome.storage.sync.set({userProtected:s.userProtected});
    await chrome.storage.sync.remove(['domains','custom']);
  }
  return s;
}
export function clean(input){
  const n=String(input).trim().toLowerCase().replace(/^[a-z]+:\/\//,'').replace(/[\/?#].*$/,'').replace(/:\d+$/,'').replace(/^www\./,'');
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(n)?registrable(n):null;
}
