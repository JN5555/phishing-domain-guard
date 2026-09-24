// Stáří domény přes RDAP. Dotaz odchází jen pro doménu (ne celou URL) a jen když se na neznámém webu objeví pole pro heslo.
export function parseCreated(j) {
  const ev = (j?.events || []).find(e => e.eventAction === "registration");
  const t = ev ? Date.parse(ev.eventDate) : NaN;
  return Number.isNaN(t) ? null : t;
}
export function ageDays(created, now = Date.now()) {
  return created == null ? null : Math.max(0, Math.floor((now - created) / 86400000));
}

const TTL = 7 * 864e5, NEG_TTL = 864e5;

export async function domainAgeDays(reg) {
  const { rdap = {} } = await chrome.storage.local.get("rdap");
  const now = Date.now();
  const hit = rdap[reg];
  if (hit && now - hit.t < (hit.created == null ? NEG_TTL : TTL)) return ageDays(hit.created, now);

  let created = null;
  try {
    const tld = reg.split(".").pop();
    const base = tld === "cz" ? "https://rdap.nic.cz/domain/" : "https://rdap.org/domain/";
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(base + encodeURIComponent(reg), { headers: { accept: "application/rdap+json" }, signal: ctrl.signal });
    clearTimeout(to);
    if (r.ok) created = parseCreated(await r.json());
  } catch { /* neznámé */ }

  rdap[reg] = { t: now, created };
  const keys = Object.keys(rdap);
  if (keys.length > 500) for (const k of keys) if (now - rdap[k].t > 30 * 864e5) delete rdap[k];
  await chrome.storage.local.set({ rdap });
  return ageDays(created, now);
}

export function agoText(days) {
  if (days < 1) return "dnes";
  if (days === 1) return "včera";
  if (days < 730) return `před ${days} dny`;
  return `před ${Math.floor(days / 365)} lety`;
}
