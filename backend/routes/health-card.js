/** Carte santé du patient.
 *  - Le titulaire lit et modifie sa carte.
 *  - Un médecin ne la voit que si le patient l'a autorisé ET qu'il a un rendez-vous avec ce patient.
 *  - Une fiche d'urgence réduite (groupe sanguin, allergies, traitements, contacts) est accessible par un lien secret,
 *    seulement si le patient l'active. Le lien peut être régénéré (l'ancien cesse de fonctionner).
 *  - Chaque consultation par un tiers est journalisée et visible par le titulaire. */
const crypto = require('crypto');
const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { withTransaction } = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parse, idParam } = require('../lib/http');

const router = express.Router();

const str = (max) => z.string().trim().max(max);
const optStr = (max) => str(max).optional().nullable().transform((v) => (v ? v : null));
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ)')
  .refine((s) => !Number.isNaN(Date.parse(s)) && s <= new Date().toISOString().slice(0, 10), 'Date invalide');

const cardSchema = z.object({
  date_of_birth: isoDate.nullable().optional(),
  sex: z.enum(['f', 'm']).nullable().optional(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).nullable().optional(),
  height_cm: z.number().int().min(30).max(250).nullable().optional(),
  weight_kg: z.number().min(1).max(400).nullable().optional(),
  cnam_number: optStr(30),
  cnam_track: z.enum(['public', 'private', 'reimbursement']).nullable().optional(),
  insurer: optStr(100),
  organ_donor: z.boolean().nullable().optional(),
  smoker: z.boolean().nullable().optional(),
  notes: optStr(1000),
  share_with_doctors: z.boolean().optional(),
  allergies: z.array(z.object({
    substance: str(100).min(1, 'Allergie : précisez la substance'), reaction: optStr(200),
    severity: z.enum(['mild', 'moderate', 'severe']).nullable().optional(),
  })).max(30).default([]),
  conditions: z.array(z.object({
    name: str(120).min(1, 'Antécédent : précisez le nom'), diagnosed_year: z.number().int().min(1900).max(2100).nullable().optional(),
    notes: optStr(300),
  })).max(30).default([]),
  medications: z.array(z.object({
    name: str(120).min(1, 'Traitement : précisez le nom'), dosage: optStr(60), frequency: optStr(60),
  })).max(30).default([]),
  vaccinations: z.array(z.object({
    vaccine: str(120).min(1, 'Vaccin : précisez le nom'), dose_date: isoDate.nullable().optional(), notes: optStr(200),
  })).max(50).default([]),
  emergency_contacts: z.array(z.object({
    name: str(100).min(1, 'Contact : précisez le nom'), relation: optStr(50),
    phone: str(30).min(4, 'Contact : numéro invalide').regex(/^[+\d\s().-]+$/, 'Contact : numéro invalide'),
  })).max(5).default([]),
});

const LISTS = {
  allergies: { table: 'health_card_allergies', cols: ['substance', 'reaction', 'severity'] },
  conditions: { table: 'health_card_conditions', cols: ['name', 'diagnosed_year', 'notes'] },
  medications: { table: 'health_card_medications', cols: ['name', 'dosage', 'frequency'] },
  vaccinations: { table: 'health_card_vaccinations', cols: ['vaccine', 'dose_date', 'notes'] },
  emergency_contacts: { table: 'health_card_emergency_contacts', cols: ['name', 'relation', 'phone'] },
};
const FIELDS = ['date_of_birth', 'sex', 'blood_type', 'height_cm', 'weight_kg', 'cnam_number', 'cnam_track', 'insurer',
  'organ_donor', 'smoker', 'notes', 'share_with_doctors'];

async function loadCard(db, where, value) {
  const { rows: [card] } = await db.query(
    `SELECT id, user_id, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, sex, blood_type, height_cm,
            weight_kg::float AS weight_kg, cnam_number, cnam_track, insurer, organ_donor, smoker, notes,
            share_with_doctors, emergency_access_enabled, emergency_token, updated_at
       FROM health_cards WHERE ${where} = $1`, [value]);
  if (!card) return null;
  for (const [key, { table, cols }] of Object.entries(LISTS)) {
    const select = cols.map((c) => (c === 'dose_date' ? `to_char(dose_date, 'YYYY-MM-DD') AS dose_date` : c)).join(', ');
    card[key] = (await db.query(`SELECT ${select} FROM ${table} WHERE card_id = $1 ORDER BY id`, [card.id])).rows;
  }
  return card;
}

const ageOf = (dob) => {
  if (!dob) return null;
  const d = new Date(dob); const now = new Date();
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
};
const ownerView = ({ id, user_id, emergency_token, ...card }) => ({
  ...card, emergency_token: card.emergency_access_enabled ? emergency_token : null,
});
const EMPTY = { date_of_birth: null, sex: null, blood_type: null, height_cm: null, weight_kg: null, cnam_number: null,
  cnam_track: null, insurer: null, organ_donor: null, smoker: null, notes: null, share_with_doctors: false,
  emergency_access_enabled: false, emergency_token: null, updated_at: null,
  allergies: [], conditions: [], medications: [], vaccinations: [], emergency_contacts: [] };

// GET /api/health-card/me
router.get('/me', requireAuth, requireRole('patient', 'doctor'), async (req, res) => {
  const card = await loadCard(pool, 'user_id', req.user.id);
  res.set('Cache-Control', 'no-store');
  res.json(card ? ownerView(card) : EMPTY);
});

// PUT /api/health-card/me : enregistre toute la carte (champs + listes)
router.put('/me', requireAuth, requireRole('patient', 'doctor'), async (req, res) => {
  const body = parse(cardSchema, req.body, res);
  if (!body) return;
  const card = await withTransaction(async (db) => {
    const values = FIELDS.map((f) => body[f] ?? (f === 'share_with_doctors' ? false : null));
    const { rows: [{ id }] } = await db.query(
      `INSERT INTO health_cards (user_id, ${FIELDS.join(', ')}, updated_at)
       VALUES ($1, ${FIELDS.map((_, i) => `$${i + 2}`).join(', ')}, NOW())
       ON CONFLICT (user_id) DO UPDATE SET ${FIELDS.map((f) => `${f} = EXCLUDED.${f}`).join(', ')}, updated_at = NOW()
       RETURNING id`,
      [req.user.id, ...values]);
    for (const [key, { table, cols }] of Object.entries(LISTS)) {
      await db.query(`DELETE FROM ${table} WHERE card_id = $1`, [id]);
      const items = body[key].map((it) => ({ card_id: id, ...Object.fromEntries(cols.map((c) => [c, it[c] ?? null])) }));
      if (items.length) {
        await db.query(
          `INSERT INTO ${table} (card_id, ${cols.join(', ')})
           SELECT card_id, ${cols.join(', ')} FROM json_populate_recordset(NULL::${table}, $1)`, [JSON.stringify(items)]);
      }
    }
    await db.query(`INSERT INTO health_card_access_log (card_id, accessor_id, access_type) VALUES ($1, $2, 'owner_update')`, [id, req.user.id]);
    return loadCard(db, 'id', id);
  });
  res.json(ownerView(card));
});

// POST /api/health-card/me/emergency : active la fiche d'urgence et génère un nouveau lien secret
router.post('/me/emergency', requireAuth, requireRole('patient', 'doctor'), async (req, res) => {
  const token = crypto.randomBytes(24).toString('base64url');
  const { rows } = await pool.query(
    `INSERT INTO health_cards (user_id, emergency_access_enabled, emergency_token) VALUES ($1, TRUE, $2)
     ON CONFLICT (user_id) DO UPDATE SET emergency_access_enabled = TRUE, emergency_token = EXCLUDED.emergency_token, updated_at = NOW()
     RETURNING emergency_token`, [req.user.id, token]);
  res.json({ emergency_access_enabled: true, emergency_token: rows[0].emergency_token });
});

// DELETE /api/health-card/me/emergency : désactive la fiche d'urgence (le lien cesse de fonctionner)
router.delete('/me/emergency', requireAuth, requireRole('patient', 'doctor'), async (req, res) => {
  await pool.query(
    'UPDATE health_cards SET emergency_access_enabled = FALSE, emergency_token = NULL, updated_at = NOW() WHERE user_id = $1',
    [req.user.id]);
  res.json({ emergency_access_enabled: false, emergency_token: null });
});

// GET /api/health-card/me/access-log : qui a consulté ma carte
router.get('/me/access-log', requireAuth, requireRole('patient', 'doctor'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT l.access_type, l.created_at, CASE WHEN l.access_type = 'doctor_view' THEN d.name END AS doctor_name
       FROM health_card_access_log l
       JOIN health_cards c ON c.id = l.card_id
       LEFT JOIN doctors d ON d.user_id = l.accessor_id
      WHERE c.user_id = $1 AND l.access_type <> 'owner_update'
      ORDER BY l.created_at DESC LIMIT 30`, [req.user.id]);
  res.set('Cache-Control', 'no-store');
  res.json(rows);
});

// GET /api/health-card/emergency/:token : fiche d'urgence (publique, données minimales)
router.get('/emergency/:token', async (req, res) => {
  const token = String(req.params.token);
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return res.status(404).json({ error: 'Fiche introuvable' });
  const card = await loadCard(pool, 'emergency_token', token);
  if (!card || !card.emergency_access_enabled) return res.status(404).json({ error: 'Fiche introuvable ou désactivée' });
  const { rows: [u] } = await pool.query('SELECT name FROM users WHERE id = $1', [card.user_id]);
  await pool.query(`INSERT INTO health_card_access_log (card_id, access_type) VALUES ($1, 'emergency_view')`, [card.id]);
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.json({
    first_name: String(u?.name ?? '').split(/\s+/)[0], age: ageOf(card.date_of_birth), blood_type: card.blood_type,
    organ_donor: card.organ_donor, allergies: card.allergies, conditions: card.conditions.map(({ name }) => ({ name })),
    medications: card.medications, emergency_contacts: card.emergency_contacts, updated_at: card.updated_at,
  });
});

// GET /api/health-card/patients/:patientId : un médecin consulte la carte d'un de ses patients (si partagée)
router.get('/patients/:patientId', requireAuth, requireRole('doctor'), async (req, res) => {
  const patientId = idParam(req, res, 'patientId');
  if (!patientId) return;
  const { rowCount } = await pool.query(
    `SELECT 1 FROM appointments a JOIN doctors d ON d.id = a.doctor_id
      WHERE d.user_id = $1 AND a.patient_id = $2 AND a.status <> 'cancelled' LIMIT 1`, [req.user.id, patientId]);
  const card = rowCount ? await loadCard(pool, 'user_id', patientId) : null;
  if (!card || !card.share_with_doctors) {
    return res.status(404).json({ error: 'Carte santé non partagée par ce patient' });
  }
  await pool.query(`INSERT INTO health_card_access_log (card_id, accessor_id, access_type) VALUES ($1, $2, 'doctor_view')`,
    [card.id, req.user.id]);
  const { id, user_id, emergency_token, emergency_access_enabled, ...shared } = card;
  res.set('Cache-Control', 'no-store');
  res.json({ ...shared, age: ageOf(card.date_of_birth) });
});

module.exports = router;
