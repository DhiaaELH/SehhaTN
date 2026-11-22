const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { parse, hideDemo } = require('../lib/http');
const { getKnowledge } = require('../lib/knowledge');
const triage = require('../lib/triage');

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

// POST /api/triage/chat : un tour de conversation avec l'assistant
router.post('/chat', async (req, res) => {
  const body = parse(chatSchema, req.body, res);
  if (!body) return;
  const kb = await getKnowledge();
  const turn = triage.chatTurn(kb, body);
  if (turn.outcome) turn.outcome = await decorate(turn.outcome, body.lang, body.governorate);
  res.json(turn);
});

module.exports = router;
