// Public Suffix List resolver. Obsahuje bezpečný vestavěný fallback a umí za běhu načíst
// aktuální PSL jako datový soubor (nikoli spustitelný kód) z publicsuffix.org.
const FALLBACK = `
// common multi-label suffixes
co.uk
org.uk
me.uk
ac.uk
gov.uk
com.au
net.au
org.au
edu.au
co.jp
ne.jp
or.jp
ac.jp
co.nz
org.nz
net.nz
com.br
com.pl
net.pl
org.pl
com.tr
com.cn
net.cn
org.cn
com.tw
com.hk
com.sg
com.my
co.kr
co.in
firm.in
net.in
org.in
co.za
org.za
com.mx
com.ar
com.ua
com.ru
com.de
`.trim();

let rules = null;

function parse(text) {
  const exact = new Set(), wildcard = new Set(), exception = new Set();
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim().toLowerCase();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('!')) exception.add(line.slice(1));
    else if (line.startsWith('*.')) wildcard.add(line.slice(2));
    else exact.add(line);
  }
  return { exact, wildcard, exception };
}

export function setPslText(text) { rules = parse(text || FALLBACK); }
setPslText(FALLBACK);

export function registrableDomain(host) {
  host = String(host || '').toLowerCase().replace(/^\.+|\.+$/g, '');
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 1) return host;
  let publicCount = 1;
  for (let i = 0; i < labels.length; i++) {
    const cand = labels.slice(i).join('.');
    if (rules.exception.has(cand)) { publicCount = labels.length - i - 1; break; }
    if (rules.exact.has(cand)) publicCount = Math.max(publicCount, labels.length - i);
    if (i + 1 < labels.length) {
      const tail = labels.slice(i + 1).join('.');
      if (rules.wildcard.has(tail)) publicCount = Math.max(publicCount, labels.length - i);
    }
  }
  return labels.slice(-Math.min(labels.length, publicCount + 1)).join('.');
}

const PSL_URL = 'https://publicsuffix.org/list/public_suffix_list.dat';
const TTL = 30 * 864e5;
export async function ensurePsl() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
  try {
    const { pslCache } = await chrome.storage.local.get('pslCache');
    if (pslCache?.text) setPslText(pslCache.text);
    if (pslCache?.updated && Date.now() - pslCache.updated < TTL) return;
    const r = await fetch(PSL_URL, { cache: 'no-store' });
    if (!r.ok) return;
    const text = await r.text();
    if (!text.includes('// ===BEGIN ICANN DOMAINS===')) return;
    setPslText(text);
    await chrome.storage.local.set({ pslCache: { updated: Date.now(), text } });
  } catch { /* fallback zůstává aktivní */ }
}
