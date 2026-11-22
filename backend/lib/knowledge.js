/** Charge la base de connaissances santé depuis PostgreSQL et la garde en mémoire quelques minutes. */
const pool = require('../db');

const TTL_MS = 10 * 60 * 1000;
let cache = null;
let loading = null;

async function load() {
  const [symptoms, flags, links, conditions, condLinks] = await Promise.all([
    pool.query('SELECT * FROM symptoms ORDER BY sort_order, key'),
    pool.query('SELECT * FROM red_flags ORDER BY level DESC, key'),
    pool.query('SELECT * FROM symptom_red_flags'),
    pool.query('SELECT slug, name_fr, name_ar, summary_fr, summary_ar, urgency, specialty_slug FROM conditions'),
    pool.query('SELECT * FROM condition_symptoms'),
  ]);
  const flagsBySymptom = new Map();
  for (const l of links.rows) flagsBySymptom.set(l.symptom_key, [...(flagsBySymptom.get(l.symptom_key) ?? []), l.red_flag_key]);
  const linksByCondition = new Map();
  for (const l of condLinks.rows) linksByCondition.set(l.condition_slug, [...(linksByCondition.get(l.condition_slug) ?? []), l]);
  return {
    symptoms: symptoms.rows.map((s) => ({ ...s, red_flags: flagsBySymptom.get(s.key) ?? [] })),
    redFlags: flags.rows,
    conditions: conditions.rows.map((c) => ({ ...c, links: linksByCondition.get(c.slug) ?? [] })),
    loadedAt: Date.now(),
  };
}

async function getKnowledge() {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache;
  loading ??= load().then((kb) => { cache = kb; return kb; }).finally(() => { loading = null; });
  // Si le rechargement échoue alors qu'on a déjà une version, on continue avec l'ancienne.
  try { return await loading; } catch (err) { if (cache) return cache; throw err; }
}

function invalidateKnowledge() { cache = null; }

module.exports = { getKnowledge, invalidateKnowledge };
