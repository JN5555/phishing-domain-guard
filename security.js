import { PROTECTED_ENTITIES } from './protected.js';

export async function databaseFingerprint(){
  const canonical=JSON.stringify(PROTECTED_ENTITIES);
  const bytes=new TextEncoder().encode(canonical);
  const hash=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

export function securityModel(){
  return {
    builtIn:'Vestavěná databáze je součástí balíčku rozšíření a není uložena v chrome.storage.',
    storage:'Úložiště je omezeno na trusted contexts rozšíření.',
    note:'Hash slouží ke kontrole verze/integrity dat, ne jako ochrana proti malwaru s možností měnit soubory rozšíření.'
  };
}
