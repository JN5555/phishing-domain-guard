// Stahování veřejných seznamů phishingu a lokální porovnávání (nic se neodesílá).
export const FEED_SOURCES = {
  openphish: "https://openphish.com/feed.txt",
  phishingdb: "https://phish.co.za/latest/phishing-links-ACTIVE.txt"
};

function hostPath(u) {
  const host = u.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  return { host, path };
}

export function normalize(str) {
  try {
    const u = new URL(str.includes("://") ? str.trim() : "http://" + str.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const { host, path } = hostPath(u);
    return host + path;
  } catch { return null; }
}

export function parseFeed(text) {
  const out = new Set();
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim();
    if (!l || l.startsWith("#")) continue;
    const n = normalize(l);
    if (n) out.add(n);
  }
  return [...out];
}

// Záznam bez cesty platí pro celou doménu, záznam s cestou pro tuto cestu a její podcesty.
export function matchFeed(set, urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return false; }
  const { host, path } = hostPath(u);
  if (set.has(host)) return true;
  let p = "";
  for (const seg of path.split("/").filter(Boolean)) {
    p += "/" + seg;
    if (set.has(host + p)) return true;
  }
  return false;
}

let cache = null;
if (typeof chrome !== "undefined" && chrome.storage?.onChanged) {
  chrome.storage.onChanged.addListener((c, area) => { if (area === "local" && c.feed) cache = null; });
}
async function load() {
  if (!cache) {
    const { feed } = await chrome.storage.local.get("feed");
    cache = new Set(feed?.entries || []);
  }
  return cache;
}
export async function feedHit(url) { return matchFeed(await load(), url); }

export async function refreshFeeds(urls) {
  if (!urls.length) {
    await chrome.storage.local.remove(["feed", "feedStatus"]);
    return { updated: Date.now(), count: 0, errors: [] };
  }
  const all = new Set();
  const errors = [];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      for (const e of parseFeed(await r.text())) all.add(e);
    } catch (e) { errors.push(new URL(url).hostname + ": " + e.message); }
  }
  const status = { updated: Date.now(), count: all.size, errors };
  if (all.size) await chrome.storage.local.set({ feed: { updated: status.updated, entries: [...all] } });
  await chrome.storage.local.set({ feedStatus: status }); // při úplném selhání zůstane starý seznam
  return status;
}
