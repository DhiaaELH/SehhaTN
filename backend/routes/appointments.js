const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const S = require('../lib/schedule');

const router = express.Router();

const bookSchema = z.object({
  doctor_id: z.number({ error: 'Médecin invalide' }).int().positive(),
  starts_at: z.iso.datetime({ offset: true, error: 'Date invalide' }),
  note: z.string().trim().max(500).optional(),
});

const statusSchema = z.object({
  status: z.enum(['cancelled', 'completed', 'no_show'], { error: 'Statut invalide' }),
});

// POST /api/appointments : un patient réserve un créneau
router.post('/', requireAuth, requireRole('patient'), async (req, res) => {
  const parsed = bookSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { doctor_id, note } = parsed.data;
  const startMs = new Date(parsed.data.starts_at).getTime();

  const { rows } = await pool.query('SELECT id, slot_minutes FROM doctors WHERE id = $1', [doctor_id]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Médecin introuvable' });

  if (!S.inBookingWindow(startMs)) {
    return res.status(400).json({ error: 'Ce créneau n’est pas réservable (2 h à l’avance minimum, 30 jours maximum)' });
  }
  const ranges = await S.loadRanges(doc.id);
  if (!S.isGridSlot(ranges, doc.slot_minutes, startMs)) {
    return res.status(400).json({ error: 'Créneau invalide' });
  }

  const dup = await pool.query(
    `SELECT 1 FROM appointments
      WHERE doctor_id = $1 AND patient_id = $2 AND status = 'confirmed' AND starts_at > NOW()`,
    [doc.id, req.user.id]
  );
  if (dup.rowCount > 0) {
    return res.status(409).json({ error: 'Tu as déjà un rendez-vous à venir avec ce médecin' });
  }

  try {
    const ins = await pool.query(
      `INSERT INTO appointments (doctor_id, patient_id, starts_at, ends_at, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [doc.id, req.user.id, new Date(startMs), new Date(startMs + doc.slot_minutes * 60000), note ?? null]
    );
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    if (err.code === '23P01' || err.code === '23505') {      // exclusion / unicité : créneau pris entre-temps
      return res.status(409).json({ error: 'Ce créneau vient d’être pris, choisis-en un autre' });
    }
    throw err;
  }
});

// GET /api/appointments/me : mes rendez-vous (patient ou médecin)
router.get('/me', requireAuth, async (req, res) => {
  if (req.user.role === 'doctor') {
    const { rows } = await pool.query(
      `SELECT a.id, a.starts_at, a.ends_at, a.status, a.note, a.created_at, u.name AS patient_name
         FROM appointments a
         JOIN doctors d ON d.id = a.doctor_id
         JOIN users u ON u.id = a.patient_id
        WHERE d.user_id = $1
        ORDER BY a.starts_at DESC LIMIT 200`,
      [req.user.id]
    );
    return res.json(rows);
  }
  const { rows } = await pool.query(
    `SELECT a.id, a.starts_at, a.ends_at, a.status, a.note, a.created_at,
            d.id AS doctor_id, d.name AS doctor_name, d.specialty, d.address, d.city, d.phone
       FROM appointments a
       JOIN doctors d ON d.id = a.doctor_id
      WHERE a.patient_id = $1
      ORDER BY a.starts_at DESC LIMIT 200`,
    [req.user.id]
  );
  res.json(rows);
});

// PATCH /api/appointments/:id  { "status": "cancelled" | "completed" | "no_show" }
router.patch('/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const parsed = statusSchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const { status } = parsed.data;

  const { rows } = await pool.query(
    `SELECT a.*, d.user_id AS doctor_user_id
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id
      WHERE a.id = $1`,
    [id]
  );
  const appt = rows[0];
  const isPatient = !!appt && appt.patient_id === req.user.id;
  const isDoctor = !!appt && appt.doctor_user_id === req.user.id;
  if (!isPatient && !isDoctor) return res.status(404).json({ error: 'Rendez-vous introuvable' });
  if (appt.status !== 'confirmed') return res.status(409).json({ error: 'Ce rendez-vous n’est plus actif' });

  const started = appt.starts_at.getTime() <= Date.now();
  if (status === 'cancelled' && started) {
    return res.status(409).json({ error: 'Ce rendez-vous a déjà commencé' });
  }
  if (status !== 'cancelled') {
    if (!isDoctor) return res.status(403).json({ error: 'Seul le médecin peut modifier ce statut' });
    if (!started) return res.status(409).json({ error: 'Ce rendez-vous n’a pas encore eu lieu' });
  }

  const upd = await pool.query(
    `UPDATE appointments SET status = $1 WHERE id = $2 AND status = 'confirmed' RETURNING *`,
    [status, id]
  );
  if (!upd.rows[0]) return res.status(409).json({ error: 'Ce rendez-vous n’est plus actif' });
  res.json(upd.rows[0]);
});

module.exports = router;