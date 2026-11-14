const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const S = require('../lib/schedule');

const router = express.Router();

const SLOT_CHOICES = [15, 20, 30, 45, 60];
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure invalide (format HH:MM)');

const availabilitySchema = z.object({
  slot_minutes: z.number().int()
    .refine((v) => SLOT_CHOICES.includes(v), 'Durée de créneau invalide').optional(),
  ranges: z.array(z.object({
    weekday: z.number().int().min(0).max(6),
    start: timeStr,
    end: timeStr,
  })).max(28, 'Trop de plages horaires'),
});

const slotsQuery = z.object({
  from: z.string().refine(S.isValidDate, 'Date de début invalide (AAAA-MM-JJ)').optional(),
  to: z.string().refine(S.isValidDate, 'Date de fin invalide (AAAA-MM-JJ)').optional(),
});

function checkRanges(ranges) {
  const byDay = new Map();
  for (const r of ranges) {
    if (S.toMinutes(r.end) <= S.toMinutes(r.start)) return "L'heure de fin doit être après l'heure de début";
    byDay.set(r.weekday, [...(byDay.get(r.weekday) ?? []), r]);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => S.toMinutes(a.start) - S.toMinutes(b.start));
    for (let i = 1; i < list.length; i++) {
      if (S.toMinutes(list[i].start) < S.toMinutes(list[i - 1].end)) return 'Des plages horaires se chevauchent';
    }
  }
  return null;
}

async function myDoctor(userId) {
  const { rows } = await pool.query('SELECT id, slot_minutes FROM doctors WHERE user_id = $1', [userId]);
  return rows[0];
}

// GET /api/doctors/me/availability
router.get('/me/availability', requireAuth, requireRole('doctor'), async (req, res) => {
  const doc = await myDoctor(req.user.id);
  if (!doc) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });
  res.json({ slot_minutes: doc.slot_minutes, ranges: await S.loadRanges(doc.id) });
});

// PUT /api/doctors/me/availability : remplace tout le planning hebdomadaire
router.put('/me/availability', requireAuth, requireRole('doctor'), async (req, res) => {
  const parsed = availabilitySchema.safeParse(req.body ?? {});
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  const problem = checkRanges(parsed.data.ranges);
  if (problem) return res.status(400).json({ error: problem });

  const doc = await myDoctor(req.user.id);
  if (!doc) return res.status(404).json({ error: "Tu n'as pas encore créé ton profil" });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM doctor_availability WHERE doctor_id = $1', [doc.id]);
    for (const r of parsed.data.ranges) {
      await client.query(
        'INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time) VALUES ($1, $2, $3, $4)',
        [doc.id, r.weekday, r.start, r.end]
      );
    }
    if (parsed.data.slot_minutes) {
      await client.query('UPDATE doctors SET slot_minutes = $1 WHERE id = $2', [parsed.data.slot_minutes, doc.id]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updated = await myDoctor(req.user.id);
  res.json({ slot_minutes: updated.slot_minutes, ranges: await S.loadRanges(doc.id) });
});

// GET /api/doctors/:id/slots?from=2026-11-16&to=2026-11-22  (public)
router.get('/:id/slots', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });
  const parsed = slotsQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const { rows } = await pool.query('SELECT id, slot_minutes FROM doctors WHERE id = $1', [id]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Médecin introuvable' });

  const today = S.todayTunis();
  const lastDay = S.addDays(today, S.MAX_DAYS_AHEAD);
  let from = parsed.data.from ?? today;
  let to = parsed.data.to ?? S.addDays(from, 13);
  if (from < today) from = today;
  if (to > lastDay) to = lastDay;

  const days = [];
  if (from <= to) {
    const ranges = await S.loadRanges(doc.id);
    const booked = await pool.query(
      `SELECT starts_at, ends_at FROM appointments
        WHERE doctor_id = $1 AND status <> 'cancelled' AND starts_at < $3 AND ends_at > $2`,
      [doc.id, new Date(S.midnightTunis(from)), new Date(S.midnightTunis(S.addDays(to, 1)))]
    );
    const taken = booked.rows.map((r) => [r.starts_at.getTime(), r.ends_at.getTime()]);
    const minStart = Date.now() + S.MIN_LEAD_MS;

    for (let d = from; d <= to; d = S.addDays(d, 1)) {
      const slots = S.slotsForDate(d, ranges, doc.slot_minutes)
        .filter((s) => s.startMs >= minStart)
        .map((s) => ({
          starts_at: new Date(s.startMs).toISOString(),
          time: s.time,
          taken: taken.some(([a, b]) => s.startMs < b && s.endMs > a),   // jamais le nom du patient
        }));
      days.push({ date: d, weekday: S.weekdayOf(d), slots });
    }
  }
  res.json({ doctor_id: doc.id, slot_minutes: doc.slot_minutes, timezone: 'Africa/Tunis', days });
});

module.exports = router;