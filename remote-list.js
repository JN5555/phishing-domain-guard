import { PROTECTED_ENTITIES } from './protected.js';

const STORAGE_KEY = 'remoteProtectedList';
const MAX_BYTES = 1024 * 1024;
const MAX_ENTITIES = 5000;

function isHost(value) {
  const s = String(value || '').trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(s) ? s : null;
}

function uniq(values) { return [...new Set(values)]; }
function text(value, max = 160) { return String(value || '').trim().slice(0, max); }

export function normalizeGithubUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:') return null;

  if (u.hostname === 'raw.githubusercontent.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length < 4) return null;
    return u.toString();
  }

  if (u.hostname === 'github.com') {
    const parts = u.pathname.split('/').filter(Boolean);
    const blob = parts.indexOf('blob');
    if (blob === 2 && parts.length >= 5) {
      const [owner, repo] = parts;
      const ref = parts[3];
      const path = parts.slice(4).join('/');
      return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${path.split('/').map(encodeURIComponent).join('/')}`;
    }
  }
  return null;
}

function validateEntity(input, index) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`Položka ${index + 1} není objekt.`);
  const id = text(input.id, 80).toLowerCase();
  const name = text(input.name, 160);
  const category = text(input.category || 'other', 40).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,79}$/.test(id)) throw new Error(`Položka ${index + 1} má neplatné id.`);
  if (!name) throw new Error(`Položka ${id} nemá název.`);

  const domains = uniq((Array.isArray(input.domains) ? input.domains : []).map(isHost).filter(Boolean));
  const hosts = uniq((Array.isArray(input.hosts) ? input.hosts : []).map(isHost).filter(Boolean));
  const brands = uniq((Array.isArray(input.brands) ? input.brands : []).map(v => text(v, 100)).filter(Boolean));
  if (!domains.length) throw new Error(`Položka ${id} nemá žádnou platnou doménu.`);
  if (domains.length > 50 || hosts.length > 100 || brands.length > 100) throw new Error(`Položka ${id} překračuje povolený počet hodnot.`);

  return {
    id, name, category,
    source: text(input.source || 'GitHub', 200),
    domains, hosts, brands
  };
}

export function validateRemotePayload(payload) {
  const root = Array.isArray(payload) ? { entities: payload } : payload;
  if (!root || typeof root !== 'object' || !Array.isArray(root.entities)) throw new Error('JSON musí obsahovat pole "entities".');
  if (root.entities.length > MAX_ENTITIES) throw new Error(`Seznam obsahuje více než ${MAX_ENTITIES} položek.`);
  const entities = root.entities.map(validateEntity);
  const ids = new Set();
  for (const e of entities) {
    if (ids.has(e.id)) throw new Error(`Duplicitní id: ${e.id}`);
    ids.add(e.id);
  }
  const disabledIds = uniq((Array.isArray(root.disabledIds) ? root.disabledIds : []).map(v => text(v, 80).toLowerCase()).filter(v => /^[a-z0-9][a-z0-9_-]{1,79}$/.test(v)));
  return {
    schema: Number(root.schema || 1),
    version: text(root.version || '', 80),
    updated: text(root.updated || '', 80),
    entities,
    disabledIds
  };
}

async function sha256(textValue) {
  const data = new TextEncoder().encode(textValue);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function syncRemoteList(urlInput) {
  const url = normalizeGithubUrl(urlInput);
  if (!url) throw new Error('Zadejte platnou Raw GitHub URL nebo GitHub odkaz na JSON soubor.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  // Add a unique query parameter for each request. GitHub Raw is served via a CDN
  // and may briefly return a stale copy immediately after a push. The stored
  // canonical URL remains unchanged; the cache-buster is used only for fetch().
  const fetchUrl = new URL(url);
  fetchUrl.searchParams.set('_pdg', String(Date.now()));

  let response;
  try {
    response = await fetch(fetchUrl.toString(), { cache: 'no-store', credentials: 'omit', signal: controller.signal });
  } finally { clearTimeout(timer); }
  if (!response.ok) throw new Error(`GitHub vrátil HTTP ${response.status}.`);

  const raw = await response.text();
  if (new TextEncoder().encode(raw).length > MAX_BYTES) throw new Error('Soubor je větší než 1 MB.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('Stažený soubor není platný JSON.'); }
  const payload = validateRemotePayload(parsed);
  const record = {
    url,
    fetchedAt: Date.now(),
    hash: await sha256(raw),
    ...payload
  };
  await chrome.storage.local.set({ [STORAGE_KEY]: record });
  return record;
}

export async function getRemoteRecord() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || null;
}

export async function clearRemoteList() {
  await chrome.storage.local.remove(STORAGE_KEY);
}

export async function getProtectedEntities(settings = null) {
  const enabled = !!settings?.remoteList?.enabled;
  if (!enabled) return PROTECTED_ENTITIES;
  const record = await getRemoteRecord();
  const expected = normalizeGithubUrl(settings?.remoteList?.url || '');
  if (!record || !expected || record.url !== expected) return PROTECTED_ENTITIES;

  const disabled = new Set(record.disabledIds || []);
  const merged = new Map(PROTECTED_ENTITIES.filter(e => !disabled.has(e.id)).map(e => [e.id, e]));
  for (const e of record.entities || []) {
    if (!disabled.has(e.id)) merged.set(e.id, { ...e, remote: true });
  }
  return [...merged.values()];
}
