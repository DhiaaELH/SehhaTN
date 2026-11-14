const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const text = (label) =>
  z.string({ error: `Champ invalide : ${label}` }).trim()
    .min(2, `Champ invalide : ${label}`).max(100);

const createSchema = z.object({
  specialty: text('spécialité'),
  governorate: text('gouvernorat'),
  city: text('ville'),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  schedule: z.string().trim().max(500).optional(),
  bio: z.string().trim().max(500).optional(),
  languages: z.array(z.enum(['Français', 'Arabe', 'Anglais'])).min(1).max(3).optional(),
  years_experience: z.number().int().min(0).max(60).optional(),
  consultation_fee: z.number().int().min(0).max(1000).optional(),
  accepts_cnam: z.boolean().optional(),
});

// Pour la modification : tous les champs deviennent facultatifs
const updateSchema = createSchema.partial();

// GET /api/doctors?specialty=Dentiste&governorate=Sfax&city=Sfax
router.get('/', async (req, res) => {
  const { specialty, governorate, city } = req.query;

  const conditions = [];
  const params = [];
  if (specialty)   { params.push(specialty);   conditions.push(`specialty = $${params.length}`); }
  if (governorate) { params.push(governorate); conditions.push(`governorate = $${params.length}`); }
  if (city)        { params.push(city);        conditions.push(`city = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM doctors ${where} ORDER BY name`, params);
  res.json(rows);
});

// GET /api/doctors/me : mon profil (médecin connecté)
// (cette route doit rester AVANT /:id, sinon "me" serait pris pour un identifiant)
router.get('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE user_id = $1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  res.json(rows[0]);
});

// POST /api/doctors/me : créer mon profil
router.post('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const d = parsed.data;

  const user = await pool.query('SELECT name FROM users WHERE id = $1', [req.user.id]);
  if (!user.rows[0]) return res.status(401).json({ error: 'Compte introuvable, reconnecte-toi' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO doctors (user_id, name, specialty, governorate, city, address, phone, schedule,
                            bio, languages, years_experience, consultation_fee, accepts_cnam)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.user.id, user.rows[0].name, d.specialty, d.governorate, d.city,
       d.address ?? null, d.phone ?? null, d.schedule ?? null,
       d.bio ?? null, d.languages ?? [], d.years_experience ?? null,
       d.consultation_fee ?? null, d.accepts_cnam ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tu as déjà un profil, utilise la modification' });
    }
    throw err;
  }
});

// PATCH /api/doctors/me : modifier mon profil (seuls les champs envoyés changent)
router.patch('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const d = parsed.data;

  const { rows } = await pool.query(
    `UPDATE doctors SET
       specialty        = COALESCE($1, specialty),
       governorate      = COALESCE($2, governorate),
       city             = COALESCE($3, city),
       address          = COALESCE($4, address),
       phone            = COALESCE($5, phone),
       schedule         = COALESCE($6, schedule),
       bio              = COALESCE($7, bio),
       languages        = COALESCE($8, languages),
       years_experience = COALESCE($9, years_experience),
       consultation_fee = COALESCE($10, consultation_fee),
       accepts_cnam     = COALESCE($11, accepts_cnam)
     WHERE user_id = $12
     RETURNING *`,
    [d.specialty ?? null, d.governorate ?? null, d.city ?? null,
     d.address ?? null, d.phone ?? null, d.schedule ?? null,
     d.bio ?? null, d.languages ?? null, d.years_experience ?? null,
     d.consultation_fee ?? null, d.accepts_cnam ?? null, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  res.json(rows[0]);
});

// GET /api/doctors/1
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });

  const { rows } = await pool.query('SELECT * FROM doctors WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médecin introuvable' });
  res.json(rows[0]);
});

module.exports = router;
