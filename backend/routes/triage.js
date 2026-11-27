const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { parse, hideDemo } = require('../lib/http');
const { getKnowledge } = require('../lib/knowledge');
const triage = require('../lib/triage');
const ai = require('../lib/ai');

const router = express.Router();

const key = z.string().regex(/^[a-z0-9_]{1,40}$/);
const lang = z.enum(['fr', 'ar']).default('fr');
const context = {
  symptoms: z.array(key).max(10).default([]),
  red_flags: z.array(key).max(30).default([]),
  age_group: z.enum(triage.AGE_GROUPS).nullish(),
  pregnant: z.boolean().nullish(),
  duration: z.enum(triage.DURATIONS).nullish(),
  severity: z.enum(triage.SEVERITIES).nullish(),
  history: z.array(z.enum(triage.HISTORY_KEYS)).max(8).default([]),
};

const evaluateSchema = z.object({ ...context, lang, governorate: z.string().trim().max(60).optional() });

// L'état de la conversation est conservé côté navigateur : on le valide strictement à chaque tour.
const stateSchema = z.object({
  symptoms: z.array(key).max(10),
  age_group: z.enum(triage.AGE_GROUPS).nullable(),
  pregnant: z.boolean().nullable(),
  duration: z.enum(triage.DURATIONS).nullable(),
  severity: z.enum(triage.SEVERITIES).nullable(),
  flags_yes: z.array(key).max(30),
  flags_no: z.array(key).max(30),
  asked_other: z.boolean(),
  pending: z.object({ type: z.string().max(20), key: key.optional() }).nullable(),
  misses: z.number().int().min(0).max(10),
  done: z.boolean(),
  // Derniers échanges, gardés par le navigateur (jamais enregistrés) pour que l'assistant suive la conversation
  history: z.array(z.object({ r: z.enum(['u', 'm']), t: z.string().max(900) })).max(12),
}).partial();
const answerSchema = z.object({
  field: z.enum(['age_group', 'pregnant', 'duration', 'severity', 'flag', 'symptom', 'other']),
  value: z.union([z.string().max(40), z.boolean(), z.object({ key, yes: z.boolean() })]),
});
const chatSchema = z.object({
  message: z.string().trim().max(1000, 'Message trop long (1000 caractères maximum)').optional(),
  answer: answerSchema.optional(),
  state: stateSchema.optional(),
  lang,
  governorate: z.string().trim().max(60).optional(),
});

/** Quelques médecins de la spécialité conseillée (de préférence dans le gouvernorat de l'utilisateur). */
async function suggestDoctors(specialtySlug, governorate) {
  if (!specialtySlug) return [];
  const { rows } = await pool.query(
    `SELECT d.id, d.name, d.specialty, d.city, d.governorate, d.photo_url, d.consultation_fee, d.verified, d.teleconsultation,
            COALESCE(r.rating, 0)::float AS rating, COALESCE(r.n, 0)::int AS review_count
       FROM doctors d
       JOIN specialties s ON s.name_fr = d.specialty AND s.slug = $1
       LEFT JOIN (SELECT doctor_id, ROUND(AVG(rating)::numeric, 1) AS rating, COUNT(*) AS n
                    FROM reviews WHERE status = 'published' GROUP BY doctor_id) r ON r.doctor_id = d.id
      WHERE ($3::boolean OR NOT d.is_demo)
      ORDER BY (d.governorate = $2) DESC, d.verified DESC, COALESCE(r.rating, 0) DESC, COALESCE(r.n, 0) DESC
      LIMIT 3`,
    [specialtySlug, governorate ?? '', !hideDemo()]
  );
  return rows;
}

async function decorate(outcome, lang, governorate) {
  if (!outcome) return outcome;
  const spec = outcome.specialty
    ? (await pool.query('SELECT slug, name_fr, name_ar, icon FROM specialties WHERE slug = $1', [outcome.specialty])).rows[0]
    : null;
  return {
    ...outcome,
    specialty: spec ? { slug: spec.slug, name: lang === 'ar' ? spec.name_ar : spec.name_fr, name_fr: spec.name_fr, icon: spec.icon } : null,
    doctors: await suggestDoctors(spec?.slug, governorate),
  };
}

// GET /api/triage/catalog?lang=fr : catégories, symptômes et signes d'alerte de l'orientation guidée
router.get('/catalog', async (req, res) => {
  const q = parse(z.object({ lang }), req.query, res);
  if (!q) return;
  const kb = await getKnowledge();
  res.set('Cache-Control', 'public, max-age=300');
  res.json(triage.catalog(kb, q.lang));
});

// POST /api/triage/evaluate : résultat de l'orientation guidée
router.post('/evaluate', async (req, res) => {
  const body = parse(evaluateSchema, req.body, res);
  if (!body) return;
  const kb = await getKnowledge();
  const outcome = triage.evaluate(kb, body);
  res.json(await decorate(outcome, body.lang, body.governorate));
});

/** Tour de conversation avec le modèle d'IA. Les signes d'alerte sont vérifiés par nos règles AVANT tout appel,
 *  puis le niveau de soins est calculé par nos règles APRÈS : l'IA ne fait que converser.
 *  Renvoie null si l'IA est indisponible : le moteur de règles répond alors seul. */
async function aiTurn(kb, body, ip) {
  let state = { ...triage.emptyState(), ...(body.state ?? {}) };
  if (state.done) state = { ...triage.emptyState(), age_group: state.age_group, pregnant: state.pregnant, history: [] };
  const history = Array.isArray(state.history) ? state.history : [];
  const isAlert = (keys) => keys.some((k) => kb.redFlags.find((f) => f.key === k)?.level >= 4);

  // 1. Sécurité : les règles lisent le message en premier. Signe grave → orientation immédiate, sans appeler l'IA.
  const det = triage.chatTurn(kb, { message: body.message, state, lang: body.lang });
  if (det.outcome && det.outcome.level >= 4) return { ...det, state: { ...det.state, history: [] } };

  // 2. Conversation avec l'IA (avec garde-fous de quota)
  if (!ai.allow(ip)) return null;
  const out = await ai.converse(kb, { lang: body.lang, history, message: body.message, state: det.state });

  // 3. On fusionne ce que l'IA a compris dans l'état de la conversation
  const s = { ...det.state, pending: null, misses: 0, done: false };
  for (const k of out.symptoms) if (!s.symptoms.includes(k)) s.symptoms.push(k);
  for (const f of ['age_group', 'duration', 'severity']) if (!s[f] && out[f]) s[f] = out[f];
  if (s.pregnant == null && out.pregnant != null) s.pregnant = out.pregnant;
  for (const k of out.red_flags) if (!s.flags_yes.includes(k)) s.flags_yes.push(k);

  const nextHistory = [...history, { r: 'u', t: body.message.slice(0, 700) }, { r: 'm', t: out.reply.slice(0, 700) }].slice(-10);
  const userTurns = nextHistory.filter((h) => h.r === 'u').length;
  const emergency = isAlert(s.flags_yes);

  // 4. Conclusion : le niveau de soins, la spécialité et les médecins viennent des règles
  if (emergency || (s.symptoms.length && (out.ready || userTurns >= 6))) {
    s.done = true;
    const outcome = triage.evaluate(kb, { ...s, red_flags: s.flags_yes, lang: body.lang });
    const kind = outcome.level >= 4 ? 'urgent' : outcome.level >= 2 ? 'care' : 'normal';
    const messages = emergency ? [] : [{ text: out.reply }];
    messages.push({ text: outcome.title, kind });
    return { messages, quick_replies: [], state: { ...s, history: [] }, outcome };
  }
  return { messages: [{ text: out.reply }], quick_replies: [], state: { ...s, history: nextHistory } };
}

// POST /api/triage/chat : un tour de conversation avec l'assistant
router.post('/chat', async (req, res) => {
  const body = parse(chatSchema, req.body, res);
  if (!body) return;
  const kb = await getKnowledge();
  let turn = null;
  if (body.message && ai.enabled()) {
    try { turn = await aiTurn(kb, body, req.ip); }
    catch (err) { console.error('Assistant IA indisponible, repli sur les règles :', err.message); }
  }
  turn ??= triage.chatTurn(kb, body);
  if (turn.outcome) turn.outcome = await decorate(turn.outcome, body.lang, body.governorate);
  res.json(turn);
});

module.exports = router;
