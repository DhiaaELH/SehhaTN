const pool = require('../db');

const TZ_OFFSET_MIN = 60;                    // Africa/Tunis = UTC+1, sans heure d'été
const MIN_LEAD_MS = 2 * 60 * 60 * 1000;      // réservation : 2 h à l'avance minimum
const MAX_DAYS_AHEAD = 30;                   // ... et 30 jours maximum

function isValidDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function todayTunis() {
  return new Date(Date.now() + TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Lundi = 0 ... Dimanche = 6
function weekdayOf(dateStr) {
  return (new Date(`${dateStr}T00:00:00Z`).getUTCDay() + 6) % 7;
}

// Instant (ms) du minuit tunisien d'un jour
function midnightTunis(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getTime() - TZ_OFFSET_MIN * 60000;
}

const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

// Date et minutes "à la tunisienne" d'un instant
function localParts(ms) {
  const t = new Date(ms + TZ_OFFSET_MIN * 60000);
  return {
    date: t.toISOString().slice(0, 10),
    minutes: t.getUTCHours() * 60 + t.getUTCMinutes(),
    exact: t.getUTCSeconds() === 0 && t.getUTCMilliseconds() === 0,
  };
}

async function loadRanges(doctorId) {
  const { rows } = await pool.query(
    `SELECT weekday, to_char(start_time, 'HH24:MI') AS start, to_char(end_time, 'HH24:MI') AS "end"
       FROM doctor_availability WHERE doctor_id = $1 ORDER BY weekday, start_time`,
    [doctorId]
  );
  return rows;
}

// Tous les créneaux d'un jour, calculés à partir des plages hebdomadaires
function slotsForDate(date, ranges, slotMinutes) {
  const wd = weekdayOf(date);
  const base = midnightTunis(date);
  const out = [];
  for (const r of ranges.filter((x) => x.weekday === wd)) {
    const end = toMinutes(r.end);
    for (let m = toMinutes(r.start); m + slotMinutes <= end; m += slotMinutes) {
      out.push({ time: toHHMM(m), startMs: base + m * 60000, endMs: base + (m + slotMinutes) * 60000 });
    }
  }
  return out.sort((a, b) => a.startMs - b.startMs);
}

// Cet instant est-il bien un créneau réel du médecin ?
function isGridSlot(ranges, slotMinutes, startMs) {
  const { date, minutes, exact } = localParts(startMs);
  if (!exact) return false;
  const wd = weekdayOf(date);
  return ranges.some((r) => {
    const s = toMinutes(r.start);
    return r.weekday === wd && minutes >= s && minutes + slotMinutes <= toMinutes(r.end) && (minutes - s) % slotMinutes === 0;
  });
}

function inBookingWindow(startMs) {
  if (startMs < Date.now() + MIN_LEAD_MS) return false;
  return localParts(startMs).date <= addDays(todayTunis(), MAX_DAYS_AHEAD);
}

module.exports = {
  MIN_LEAD_MS, MAX_DAYS_AHEAD,
  isValidDate, todayTunis, addDays, weekdayOf, midnightTunis, toMinutes,
  loadRanges, slotsForDate, isGridSlot, inBookingWindow,
};