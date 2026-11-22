const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { parse, idParam } = require('../lib/http');

const router = express.Router();

const reviewSchema = z.object({
  rating: z.number({ error: 'Note invalide' }).int().min(1, 'Note de 1 à 5').max(5, 'Note de 1 à 5'),
  comment: z.string().trim().max(1000, 'Commentaire : 1000 caractères maximum').optional(),
});
const replySchema = z.object({ reply: z.string().trim().min(2, 'Réponse trop courte').max(1000) });
const listQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  offset: z.coerce.number().int().min(0).default(0),
});

/** « Amira Ben Salah » → « Amira B. » : on ne publie jamais le nom complet d'un patient. */
const shortName = (name) => {
  const [first, ...rest] = String(name).trim().split(/\s+/);
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first;
};

// GET /api/doctors/:id/reviews : avis publiés + répartition des notes
router.get('/:id/reviews', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const q = parse(listQuery, req.query, res);
  if (!q) return;
  const [list, stats] = await Promise.all([
    pool.query(
      `SELECT r.id, r.rating, r.comment, r.doctor_reply, r.created_at, u.name AS author
         FROM reviews r JOIN users u ON u.id = r.patient_id
        WHERE r.doctor_id = $1 AND r.status = 'published'
        ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`, [id, q.limit, q.offset]),
    pool.query(
      `SELECT rating, COUNT(*)::int AS n FROM reviews WHERE doctor_id = $1 AND status = 'published' GROUP BY rating`, [id]),
  ]);
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of stats.rows) distribution[r.rating] = r.n;
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const average = total ? Math.round((Object.entries(distribution).reduce((s, [k, n]) => s + k * n, 0) / total) * 10) / 10 : 0;
  res.json({
    average, total, distribution,
    items: list.rows.map(({ author, ...r }) => ({ ...r, author: shortName(author) })),
  });
});

// POST /api/doctors/:id/reviews : un patient note un médecin qu'il a consulté (un avis par médecin, modifiable)
router.post('/:id/reviews', requireAuth, requireRole('patient'), async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const body = parse(reviewSchema, req.body, res);
  if (!body) return;

  // Avis « vérifié » : il faut un rendez-vous passé et non annulé avec ce médecin.
  const { rows: [appt] } = await pool.query(
    `SELECT id FROM appointments
      WHERE doctor_id = $1 AND patient_id = $2 AND status IN ('confirmed', 'completed') AND starts_at < NOW()
      ORDER BY starts_at DESC LIMIT 1`, [id, req.user.id]);
  if (!appt) {
    return res.status(403).json({ error: 'Seuls les patients ayant consulté ce médecin via SehhaTN peuvent laisser un avis.' });
  }
  const { rows: [review] } = await pool.query(
    `INSERT INTO reviews (doctor_id, patient_id, appointment_id, rating, comment)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (doctor_id, patient_id) DO UPDATE
       SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, appointment_id = EXCLUDED.appointment_id,
           created_at = NOW(), status = 'published'
     RETURNING id, rating, comment, doctor_reply, created_at`,
    [id, req.user.id, appt.id, body.rating, body.comment || null]
  );
  res.status(201).json(review);
});

// PUT /api/doctors/me/reviews/:reviewId/reply : le médecin répond publiquement à un avis
router.put('/me/reviews/:reviewId/reply', requireAuth, requireRole('doctor'), async (req, res) => {
  const reviewId = idParam(req, res, 'reviewId');
  if (!reviewId) return;
  const body = parse(replySchema, req.body, res);
  if (!body) return;
  const { rows } = await pool.query(
    `UPDATE reviews r SET doctor_reply = $1
       FROM doctors d
      WHERE r.id = $2 AND d.id = r.doctor_id AND d.user_id = $3
      RETURNING r.id, r.doctor_reply`, [body.reply, reviewId, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Avis introuvable' });
  res.json(rows[0]);
});

module.exports = router;
