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
});


const updateSchema = createSchema.partial();


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


router.get('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM doctors WHERE user_id = $1', [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  res.json(rows[0]);
});


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
      `INSERT INTO doctors (user_id, name, specialty, governorate, city, address, phone, schedule)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, user.rows[0].name, d.specialty, d.governorate, d.city,
       d.address ?? null, d.phone ?? null, d.schedule ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Tu as déjà un profil, utilise la modification' });
    }
    throw err;
  }
});


router.patch('/me', requireAuth, requireRole('doctor'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const d = parsed.data;

  const { rows } = await pool.query(
    `UPDATE doctors SET
       specialty   = COALESCE($1, specialty),
       governorate = COALESCE($2, governorate),
       city        = COALESCE($3, city),
       address     = COALESCE($4, address),
       phone       = COALESCE($5, phone),
       schedule    = COALESCE($6, schedule)
     WHERE user_id = $7
     RETURNING *`,
    [d.specialty ?? null, d.governorate ?? null, d.city ?? null,
     d.address ?? null, d.phone ?? null, d.schedule ?? null, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  res.json(rows[0]);
});


router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });

  const { rows } = await pool.query('SELECT * FROM doctors WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médecin introuvable' });
  res.json(rows[0]);
});

module.exports = router;