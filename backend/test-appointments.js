const pool = require('./db');

const API = 'http://localhost:3000/api';
const stamp = Date.now();
let failures = 0;

async function call(method, path, token, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'OK  ' : 'FAIL'}  ${label} -> ${actual}${ok ? '' : ` (attendu : ${expected})`}`);
}

async function register(role, name) {
  const email = `${role}.${stamp}.${Math.random().toString(36).slice(2, 7)}@example.com`;
  const r = await call('POST', '/auth/register', null, { name, email, password: 'password123', role });
  if (r.status !== 201) throw new Error(`Inscription échouée (${r.status}) : ${r.data.error}`);
  return r.data.token;
}

async function allSlots(doctorId) {
  const r = await call('GET', `/doctors/${doctorId}/slots`);
  return r.data.days.flatMap((d) => d.slots);
}

async function main() {
  const doc = await register('doctor', 'Dr Test Rdv');
  const p1 = await register('patient', 'Patient Un');
  const p2 = await register('patient', 'Patient Deux');
  const p3 = await register('patient', 'Patient Trois');
  const p4 = await register('patient', 'Patient Quatre');

  let r = await call('POST', '/doctors/me', doc, { specialty: 'Dentiste', governorate: 'Tunis', city: 'Tunis' });
  check('créer le profil médecin', r.status, 201);
  const doctorId = r.data.id;

  // Ouvert tous les jours de 09:00 à 12:00 (créneaux de 30 min)
  const ranges = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, start: '09:00', end: '12:00' }));
  r = await call('PUT', '/doctors/me/availability', doc, { slot_minutes: 30, ranges });
  check('enregistrer les horaires', r.status, 200);

  let slots = await allSlots(doctorId);
  check('des créneaux sont proposés', slots.length > 3, true);
  const [A, B, C] = slots;

  r = await call('POST', '/appointments', p1, { doctor_id: doctorId, starts_at: A.starts_at });
  check('patient 1 réserve le créneau A', r.status, 201);
  const apptId = r.data.id;

  r = await call('POST', '/appointments', p2, { doctor_id: doctorId, starts_at: A.starts_at });
  check('patient 2 veut le même créneau A (doit être refusé)', r.status, 409);

  r = await call('POST', '/appointments', p1, { doctor_id: doctorId, starts_at: B.starts_at });
  check('patient 1 veut un 2e rendez-vous avec le même médecin (refusé)', r.status, 409);

  const offGrid = new Date(Date.parse(A.starts_at) + 15 * 60000).toISOString();
  r = await call('POST', '/appointments', p2, { doctor_id: doctorId, starts_at: offGrid });
  check('heure qui ne correspond à aucun créneau (refusé)', r.status, 400);

  slots = await allSlots(doctorId);
  check('le créneau A apparaît comme pris', slots.find((s) => s.starts_at === A.starts_at).taken, true);

  r = await call('PATCH', `/appointments/${apptId}`, doc, { status: 'completed' });
  check('médecin "terminé" sur un rendez-vous futur (refusé)', r.status, 409);

  r = await call('PATCH', `/appointments/${apptId}`, p2, { status: 'cancelled' });
  check('patient 2 annule le rendez-vous de patient 1 (refusé)', r.status, 404);

  r = await call('PATCH', `/appointments/${apptId}`, p1, { status: 'cancelled' });
  check('patient 1 annule son rendez-vous', r.status, 200);

  slots = await allSlots(doctorId);
  check('le créneau A est de nouveau libre', slots.find((s) => s.starts_at === A.starts_at).taken, false);

  r = await call('POST', '/appointments', p2, { doctor_id: doctorId, starts_at: A.starts_at });
  check('patient 2 réserve A maintenant libre', r.status, 201);

  const [r3, r4] = await Promise.all([
    call('POST', '/appointments', p3, { doctor_id: doctorId, starts_at: C.starts_at }),
    call('POST', '/appointments', p4, { doctor_id: doctorId, starts_at: C.starts_at }),
  ]);
  check('2 patients réservent C en même temps : un seul gagne', [r3.status, r4.status].sort().join(','), '201,409');

  r = await call('GET', '/appointments/me', doc);
  check('le médecin voit ses rendez-vous', r.status === 200 && r.data.length >= 2, true);
}

main()
  .catch((e) => {
    failures++;
    console.error('Erreur :', e.message, '— le backend tourne-t-il (npm run dev) ?');
  })
  .finally(async () => {
    // supprime les comptes de test (les rendez-vous partent avec)
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`%.${stamp}.%@example.com`]);
    await pool.end();
    console.log(failures === 0 ? '\nTout est OK' : `\n${failures} échec(s)`);
  });