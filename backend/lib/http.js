/** Petits utilitaires HTTP partagés par les routes. */

/** Valide `data` avec un schéma zod ; renvoie les données, ou répond 400 et renvoie null. */
function parse(schema, data, res) {
  const r = schema.safeParse(data ?? {});
  if (!r.success) {
    const issue = r.error.issues[0];
    res.status(400).json({ error: issue.message, field: issue.path.join('.') || undefined });
    return null;
  }
  return r.data;
}

/** Identifiant entier positif dans l'URL, ou réponse 400. */
function idParam(req, res, name = 'id') {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: 'Identifiant invalide' }); return null; }
  return id;
}

/** Les données de démonstration doivent-elles être masquées ? (HIDE_DEMO_DATA=true en production réelle) */
const hideDemo = () => /^(1|true|yes)$/i.test(process.env.HIDE_DEMO_DATA ?? '');

/** Petit cache mémoire à durée de vie limitée et taille bornée. */
class TtlCache {
  constructor(ttlMs, max = 500) { this.ttl = ttlMs; this.max = max; this.map = new Map(); }
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.exp) { this.map.delete(key); return undefined; }
    return hit.value;
  }
  set(key, value) {
    if (this.map.size >= this.max) this.map.delete(this.map.keys().next().value);
    this.map.set(key, { value, exp: Date.now() + this.ttl });
  }
}

/** fetch avec délai maximal et User-Agent identifiable (exigé par Nominatim / Overpass). */
async function fetchJson(url, { timeoutMs = 8000, ...options } = {}) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': 'SehhaTN/2.0 (annuaire de sante)', Accept: 'application/json', ...(options.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

module.exports = { parse, idParam, hideDemo, TtlCache, fetchJson };
