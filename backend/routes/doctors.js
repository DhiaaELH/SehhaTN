const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parse, idParam, hideDemo } = require('../lib/http');
const { locateAddress } = require('../lib/geocode');
const { inTunisia } = require('../lib/tunisia-geo');

const router = express.Router();

const text = (label) =>
  z.string({ error: `Champ invalide : ${label}` }).trim()
    .min(2, `Champ invalide : ${label}`).max(100);
const httpsUrl = z.string().trim().max(500).regex(/^https:\/\/\S+$/, 'Lien de photo invalide (https:// requis)');

const baseSchema = z.object({
  specialty: text('spécialité'),
  governorate: text('gouvernorat'),
  city: text('ville'),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).regex(/^[+\d\s().-]*$/, 'Numéro de téléphone invalide').optional(),
  schedule: z.string().trim().max(500).optional(),
  bio: z.string().trim().max(1000).optional(),
  languages: z.array(z.enum(['Français', 'Arabe', 'Anglais'])).min(1).max(3).optional(),
  years_experience: z.number().int().min(0).max(60).optional(),
  consultation_fee: z.number().int().min(0).max(1000).optional(),
  accepts_cnam: z.boolean().optional(),
  photo_url: httpsUrl.optional(),
  gender: z.enum(['f', 'm']).optional(),
  education: z.array(z.string().trim().min(2).max(200)).max(8).optional(),
  services: z.array(z.string().trim().min(2).max(80)).max(15).optional(),
  teleconsultation: z.boolean().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
const withPositionChecks = (schema) => schema
  .refine((d) => (d.latitude === undefined) === (d.longitude === undefined), 'Latitude et longitude vont ensemble')
  .refine((d) => d.latitude === undefined || inTunisia(d.latitude, d.longitude), 'La position doit se trouver en Tunisie');
const createSchema = withPositionChecks(baseSchema);
const updateSchema = withPositionChecks(baseSchema.partial());

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(100).optional(),
  governorate: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  cnam: z.enum(['true', 'false']).optional(),
  teleconsultation: z.enum(['true', 'false']).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  sort: z.enum(['name', 'rating', 'distance', 'experience', 'fee']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

// Colonnes publiques d'une fiche + note moyenne (jamais l'identifiant du compte ni la clé de seed).
const PUBLIC_COLUMNS = `
  d.id, d.name, d.title, d.gender, d.specialty, d.governorate, d.city, d.address, d.phone, d.schedule, d.verified,
  d.bio, d.languages, d.years_experience, d.consultation_fee, d.accepts_cnam, d.slot_minutes, d.photo_url,
  d.latitude, d.longitude, d.location_precise, d.education, d.services, d.teleconsultation, d.is_demo, d.created_at,
  COALESCE(r.rating, 0)::float AS rating, COALESCE(r.review_count, 0)::int AS review_count`;
const RATING_JOIN = `
  LEFT JOIN (SELECT doctor_id, ROUND(AVG(rating)::numeric, 1) AS rating, COUNT(*) AS review_count
               FROM reviews WHERE status = 'published' GROUP BY doctor_id) r ON r.doctor_id = d.id`;
const DISTANCE = (latIdx, lngIdx) => `(6371 * 2 * ASIN(SQRT(
  POWER(SIN(RADIANS(d.latitude - $${latIdx}) / 2), 2) +
  COS(RADIANS($${latIdx})) * COS(RADIANS(d.latitude)) * POWER(SIN(RADIANS(d.longitude - $${lngIdx}) / 2), 2))))`;

// GET /api/doctors?q=&specialty=&governorate=&city=&cnam=&teleconsultation=&lat=&lng=&sort=&limit=&offset=
router.get('/', async (req, res) => {
  const f = parse(listQuery, req.query, res);
  if (!f) return;
  const params = [];
  const where = [];
  const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
  if (f.specialty) add('d.specialty = ?', f.specialty);
  if (f.governorate) add('d.governorate = ?', f.governorate);
  if (f.city) add('d.city = ?', f.city);
  if (f.cnam) add('d.accepts_cnam = ?', f.cnam === 'true');
  if (f.teleconsultation) add('d.teleconsultation = ?', f.teleconsultation === 'true');
  if (f.q) add(`(unaccent_lower(d.name) LIKE '%' || unaccent_lower(?) || '%'
             OR unaccent_lower(d.specialty) LIKE '%' || unaccent_lower(?) || '%'
             OR unaccent_lower(d.city) LIKE '%' || unaccent_lower(?) || '%')`, f.q);
  if (hideDemo()) where.push('NOT d.is_demo');

  let distance = 'NULL::float';
  const hasPoint = f.lat !== undefined && f.lng !== undefined;
  if (hasPoint) {
    params.push(f.lat, f.lng);
    distance = DISTANCE(params.length - 1, params.length);
  }
  const order = {
    name: 'd.name',
    // Moyenne bayésienne : 3 avis à 5★ ne passent pas devant 40 avis à 4,8★
    rating: '(COALESCE(r.rating, 0) * COALESCE(r.review_count, 0) + 4.0 * 5) / (COALESCE(r.review_count, 0) + 5) DESC, d.name',
    distance: hasPoint ? 'distance_km NULLS LAST, d.name' : 'd.name',
    experience: 'd.years_experience DESC NULLS LAST, d.name',
    fee: 'd.consultation_fee NULLS LAST, d.name',
  }[f.sort ?? (hasPoint ? 'distance' : 'name')];

  params.push(f.limit, f.offset);
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS}, ROUND(${distance}::numeric, 2)::float AS distance_km
       FROM doctors d ${RATING_JOIN}
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ${order}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  res.set('Cache-Control', 'public, max-age=60');
  res.json(rows);
});

// GET /api/doctors/me : mon profil (médecin connecté)
// (cette route doit rester AVANT /:id, sinon "me" serait pris pour un identifiant)
router.get('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM doctors d ${RATING_JOIN} WHERE d.user_id = $1`, [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  res.json(rows[0]);
});

/** Position du cabinet : celle fournie par le médecin, sinon géocodage de l'adresse (ou centre-ville). */
async function position(d, previous) {
  if (d.latitude !== undefined) return { latitude: d.latitude, longitude: d.longitude, location_precise: true };
  const changed = !previous || ['address', 'city', 'governorate'].some((k) => d[k] !== undefined && d[k] !== previous[k]);
  if (!changed) return null;
  return locateAddress({
    address: d.address ?? previous?.address, city: d.city ?? previous?.city, governorate: d.governorate ?? previous?.governorate,
  });
}

// POST /api/doctors/me : créer mon profil
router.post('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const d = parse(createSchema, req.body, res);
  if (!d) return;
  const user = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
  if (!user.rows[0]) return res.status(401).json({ error: 'Compte introuvable, reconnecte-toi' });
  const pos = await position(d, null);

  try {
    const { rows } = await pool.query(
      `INSERT INTO doctors (user_id, name, specialty, governorate, city, address, phone, schedule, bio, languages,
                            years_experience, consultation_fee, accepts_cnam, photo_url, gender, education, services,
                            teleconsultation, latitude, longitude, location_precise)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING id`,
      [req.user.id, user.rows[0].name, d.specialty, d.governorate, d.city,
       d.address ?? null, d.phone ?? null, d.schedule ?? null, d.bio ?? null, d.languages ?? [],
       d.years_experience ?? null, d.consultation_fee ?? null, d.accepts_cnam ?? null, d.photo_url ?? null,
       d.gender ?? null, d.education ?? [], d.services ?? [], d.teleconsultation ?? false,
       pos?.latitude ?? null, pos?.longitude ?? null, pos?.location_precise ?? false]
    );
    const full = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM doctors d ${RATING_JOIN} WHERE d.id = $1`, [rows[0].id]);
    res.status(201).json(full.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Tu as déjà un profil, utilise la modification' });
    throw err;
  }
});

// PATCH /api/doctors/me : modifier mon profil (seuls les champs envoyés changent)
router.patch('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const d = parse(updateSchema, req.body, res);
  if (!d) return;
  const prev = await pool.query('SELECT id, address, city, governorate FROM doctors WHERE user_id = $1', [req.user.id]);
  if (!prev.rows[0]) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  const pos = await position(d, prev.rows[0]);

  const fields = ['specialty', 'governorate', 'city', 'address', 'phone', 'schedule', 'bio', 'languages', 'years_experience',
    'consultation_fee', 'accepts_cnam', 'photo_url', 'gender', 'education', 'services', 'teleconsultation'];
  const sets = [];
  const params = [];
  for (const k of fields) if (d[k] !== undefined) { params.push(d[k]); sets.push(`${k} = $${params.length}`); }
  if (pos) for (const [k, v] of Object.entries(pos)) { params.push(v); sets.push(`${k} = $${params.length}`); }
  sets.push('updated_at = NOW()');
  params.push(req.user.id);
  await pool.query(`UPDATE doctors SET ${sets.join(', ')} WHERE user_id = $${params.length}`, params);

  const { rows } = await pool.query(`SELECT ${PUBLIC_COLUMNS} FROM doctors d ${RATING_JOIN} WHERE d.user_id = $1`, [req.user.id]);
  res.json(rows[0]);
});

// GET /api/doctors/:id
router.get('/:id', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows } = await pool.query(
    `SELECT ${PUBLIC_COLUMNS} FROM doctors d ${RATING_JOIN} WHERE d.id = $1 ${hideDemo() ? 'AND NOT d.is_demo' : ''}`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médecin introuvable' });
  res.json(rows[0]);
});

module.exports = router;
