const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court'),
  email: z.email('Email invalide'),
  password: z.string().min(8, 'Mot de passe : 8 caractères minimum').max(72, 'Mot de passe : 72 caractères maximum'),
  role: z.enum(['patient', 'doctor'], { error: 'Rôle invalide' }).default('patient'),
});

const loginSchema = z.object({
  email: z.email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis').max(72, 'Mot de passe : 72 caractères maximum'),
});

function makeToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const { name, password, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role`,
      [name, email, passwordHash, role]
    );
    const user = rows[0];
    res.status(201).json({ token: makeToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }
    throw err;
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const email = parsed.data.email.toLowerCase();

  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = rows[0];
  const ok = user && (await bcrypt.compare(parsed.data.password, user.password_hash));
  if (!ok) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

  res.json({ token: makeToken(user), user: publicUser(user) });
});

// GET /api/auth/me  (nécessite le token)
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, email, role FROM users WHERE id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json(rows[0]);
});

// GET /api/auth/me/export : toutes mes données (droit d'accès et de portabilité)
router.get('/me/export', requireAuth, async (req, res) => {
  const id = req.user.id;
  const { rows: [user] } = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1', [id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  const q = async (sql, params = [id]) => (await pool.query(sql, params)).rows;
  const [doctor] = await q(
    `SELECT id, name, title, gender, specialty, governorate, city, address, phone, schedule, verified, bio, languages,
            years_experience, consultation_fee, accepts_cnam, slot_minutes, photo_url, latitude, longitude, education,
            services, teleconsultation, created_at, updated_at FROM doctors WHERE user_id = $1`);
  const [card] = await q(
    `SELECT id, to_char(date_of_birth, 'YYYY-MM-DD') AS date_of_birth, sex, blood_type, height_cm, weight_kg::float AS weight_kg,
            cnam_number, cnam_track, insurer, organ_donor, smoker, notes, share_with_doctors, emergency_access_enabled,
            created_at, updated_at FROM health_cards WHERE user_id = $1`);
  let healthCard = null;
  let accessLog = [];
  if (card) {
    const { id: cardId, ...rest } = card;
    const list = (table, cols) => q(`SELECT ${cols} FROM ${table} WHERE card_id = $1 ORDER BY id`, [cardId]);
    healthCard = {
      ...rest,
      allergies: await list('health_card_allergies', 'substance, reaction, severity'),
      conditions: await list('health_card_conditions', 'name, diagnosed_year, notes'),
      medications: await list('health_card_medications', 'name, dosage, frequency'),
      vaccinations: await list('health_card_vaccinations', "vaccine, to_char(dose_date, 'YYYY-MM-DD') AS dose_date, notes"),
      emergency_contacts: await list('health_card_emergency_contacts', 'name, relation, phone'),
    };
    accessLog = await q('SELECT access_type, created_at FROM health_card_access_log WHERE card_id = $1 ORDER BY created_at DESC', [cardId]);
  }
  const data = {
    exported_at: new Date().toISOString(),
    user,
    doctor_profile: doctor ?? null,
    appointments: await q(
      `SELECT a.id, a.starts_at, a.ends_at, a.status, a.note, a.created_at, d.name AS doctor_name, d.specialty
         FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.patient_id = $1 ORDER BY a.starts_at DESC`),
    reviews: await q(
      `SELECT r.id, r.rating, r.comment, r.doctor_reply, r.status, r.created_at, d.name AS doctor_name
         FROM reviews r JOIN doctors d ON d.id = r.doctor_id WHERE r.patient_id = $1 ORDER BY r.created_at DESC`),
    health_card: healthCard,
    health_card_access_log: accessLog,
    contact_messages: await q(
      'SELECT id, topic, message, status, created_at FROM contact_messages WHERE user_id = $1 ORDER BY created_at DESC'),
  };
  res.set('Cache-Control', 'no-store');
  res.set('Content-Disposition', 'attachment; filename="sehhatn-mes-donnees.json"');
  res.json(data);
});

// DELETE /api/auth/me  { "password": "..." } : suppression définitive du compte et des données liées
router.delete('/me', requireAuth, async (req, res) => {
  const parsed = z.object({ password: z.string().min(1, 'Mot de passe requis').max(72) }).safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { rows: [user] } = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });
  if (!(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ error: 'Mot de passe incorrect' });
  }
  // Les clés étrangères suppriment en cascade : profil médecin, rendez-vous, avis, carte santé…
  await pool.query('DELETE FROM users WHERE id = $1', [user.id]);
  res.status(204).end();
});

module.exports = router;