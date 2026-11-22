// Tests d'intégration de l'API : nécessitent une base PostgreSQL initialisée et remplie (npm run db:seed).
// Les comptes créés ici utilisent le domaine @test.sehhatn.tn et sont supprimés à la fin.
process.env.NODE_ENV = 'test';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../app');
const pool = require('../db');

let server;
let base;
const stamp = Date.now();

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function register(role, name) {
  const r = await api('/auth/register', { method: 'POST', body: { name, email: `${role}-${stamp}-${Math.random().toString(36).slice(2, 7)}@test.sehhatn.tn`, password: 'motdepasse-test', role } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await pool.query(`DELETE FROM doctors WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@test.sehhatn.tn')`);
  await pool.query(`DELETE FROM users WHERE email LIKE '%@test.sehhatn.tn'`);
  await pool.query(`DELETE FROM contact_messages WHERE email LIKE '%@test.sehhatn.tn'`);
  server.close();
  await pool.end();
});

test('santé et erreurs propres', async () => {
  assert.equal((await api('/health')).body.database, 'ok');
  assert.equal((await api('/inconnu')).status, 404);
  assert.equal((await api('/doctors/abc')).status, 400);
  assert.equal((await api('/doctors/999999')).status, 404);
});

test('annuaire : filtres, recherche sans accents, tri par distance', async () => {
  const all = (await api('/doctors')).body;
  assert.ok(all.length >= 50);
  assert.ok(all.every((d) => !('user_id' in d) && !('seed_key' in d)), 'pas de champs internes');
  const cardio = (await api('/doctors?specialty=Cardiologue')).body;
  assert.ok(cardio.length > 0 && cardio.every((d) => d.specialty === 'Cardiologue'));
  const q = (await api('/doctors?q=pediatre')).body;
  assert.ok(q.some((d) => d.specialty === 'Pédiatre'), 'recherche insensible aux accents');
  const near = (await api('/doctors?lat=34.7406&lng=10.7603&limit=5')).body;
  assert.ok(near[0].distance_km <= near[4].distance_km);
  assert.equal((await api('/doctors?lat=abc')).status, 400);
});

test('lieux de soins à proximité, triés par distance', async () => {
  const r = await api('/facilities/nearby?lat=36.8008&lng=10.18&types=pharmacy,hospital&radius_km=10&osm=false');
  assert.equal(r.status, 200);
  assert.ok(r.body.items.length > 0);
  assert.ok(r.body.items.every((f) => ['pharmacy', 'hospital'].includes(f.type)));
  const d = r.body.items.map((f) => f.distance_km);
  assert.deepEqual(d, [...d].sort((a, b) => a - b));
  const night = await api('/facilities/nearby?lat=36.8008&lng=10.18&types=pharmacy&open_24h=true&osm=false');
  assert.ok(night.body.items.every((f) => f.open_24h));
  assert.equal((await api('/facilities/nearby?lat=36.8&lng=10.18&types=bar')).status, 400);
});

test('géocodage local hors ligne', async () => {
  const r = await api('/geo/search?q=Kairouan');
  assert.equal(r.status, 200);
  assert.equal(r.body.governorate, 'Kairouan');
  assert.equal((await api('/geo/reverse?lat=35.83&lng=10.6')).body.governorate, 'Sousse');
});

test('orientation : catalogue, évaluation et chat', async () => {
  const cat = await api('/triage/catalog?lang=fr');
  assert.ok(cat.body.categories.length >= 10);
  const ev = await api('/triage/evaluate', { method: 'POST', body: { symptoms: ['toothache'], age_group: 'adult', duration: 'days', severity: 'moderate' } });
  assert.equal(ev.body.specialty.slug, 'dentiste');
  assert.ok(ev.body.doctors.length > 0 && ev.body.doctors.every((d) => d.specialty === 'Dentiste'));
  const urgent = await api('/triage/evaluate', { method: 'POST', body: { red_flags: ['stroke_signs'] } });
  assert.equal(urgent.body.level, 5);
  const chat = await api('/triage/chat', { method: 'POST', body: { message: 'j’ai mal à la gorge', lang: 'fr' } });
  assert.ok(chat.body.state.symptoms.includes('sore_throat'));
  assert.ok(chat.body.quick_replies.length > 0);
  const bad = await api('/triage/chat', { method: 'POST', body: { state: { symptoms: ['DROP TABLE'] } } });
  assert.equal(bad.status, 400);
});

test('guide santé : liste et fiche', async () => {
  const list = (await api('/conditions?q=tension')).body;
  assert.ok(list.some((c) => c.slug.includes('hypertension')));
  const one = await api(`/conditions/${list[0].slug}`);
  assert.equal(one.status, 200);
  assert.ok(one.body.self_care_fr.length > 0);
});

test('carte santé : propriétaire, médecin autorisé, fiche d’urgence, journal', async () => {
  const patient = await register('patient', 'Test Patient');
  const doctor = await register('doctor', 'Dr Test Médecin');
  const other = await register('doctor', 'Dr Autre');

  assert.equal((await api('/health-card/me')).status, 401);
  const empty = await api('/health-card/me', { token: patient.token });
  assert.equal(empty.body.blood_type, null);

  const saved = await api('/health-card/me', { method: 'PUT', token: patient.token, body: {
    date_of_birth: '1990-05-14', blood_type: 'O+', share_with_doctors: true,
    allergies: [{ substance: 'Pénicilline', reaction: 'Urticaire', severity: 'severe' }],
    medications: [{ name: 'Metformine', dosage: '500 mg', frequency: '2 fois par jour' }],
    emergency_contacts: [{ name: 'Sami', relation: 'Frère', phone: '+216 98 000 000' }],
  } });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.allergies[0].substance, 'Pénicilline');
  assert.equal((await api('/health-card/me', { method: 'PUT', token: patient.token, body: { blood_type: 'Z+' } })).status, 400);

  // Médecin sans rendez-vous avec ce patient : refusé
  assert.equal((await api(`/health-card/patients/${patient.user.id}`, { token: doctor.token })).status, 404);
  // On crée le profil du médecin et un rendez-vous (insertion directe : la réservation exige des créneaux réels)
  const prof = await api('/doctors/me', { method: 'POST', token: doctor.token, body: { specialty: 'Médecin généraliste', governorate: 'Tunis', city: 'Tunis' } });
  assert.equal(prof.status, 201, JSON.stringify(prof.body));
  assert.ok(prof.body.latitude, 'position calculée automatiquement');
  await pool.query(`INSERT INTO appointments (doctor_id, patient_id, starts_at, ends_at) VALUES ($1, $2, NOW() + interval '3 days', NOW() + interval '3 days 30 minutes')`,
    [prof.body.id, patient.user.id]);
  const viewed = await api(`/health-card/patients/${patient.user.id}`, { token: doctor.token });
  assert.equal(viewed.status, 200);
  assert.equal(viewed.body.blood_type, 'O+');
  assert.ok(!('emergency_token' in viewed.body));
  assert.equal((await api(`/health-card/patients/${patient.user.id}`, { token: other.token })).status, 404);
  assert.equal((await api(`/health-card/patients/${patient.user.id}`, { token: patient.token })).status, 403);

  // Fiche d'urgence : désactivée par défaut, puis activée, puis lien révoqué
  const on = await api('/health-card/me/emergency', { method: 'POST', token: patient.token });
  const pub = await api(`/health-card/emergency/${on.body.emergency_token}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.first_name, 'Test');
  assert.equal(pub.body.blood_type, 'O+');
  assert.ok(!('cnam_number' in pub.body) && !('notes' in pub.body), 'données minimales seulement');
  await api('/health-card/me/emergency', { method: 'DELETE', token: patient.token });
  assert.equal((await api(`/health-card/emergency/${on.body.emergency_token}`)).status, 404);

  const log = (await api('/health-card/me/access-log', { token: patient.token })).body;
  assert.ok(log.some((l) => l.access_type === 'doctor_view' && l.doctor_name));
  assert.ok(log.some((l) => l.access_type === 'emergency_view'));
});

test('avis : réservé aux patients ayant consulté', async () => {
  const patient = await register('patient', 'Avis Patient');
  const { rows: [doc] } = await pool.query(`SELECT id FROM doctors WHERE is_demo LIMIT 1`);
  const denied = await api(`/doctors/${doc.id}/reviews`, { method: 'POST', token: patient.token, body: { rating: 5 } });
  assert.equal(denied.status, 403);
  await pool.query(`INSERT INTO appointments (doctor_id, patient_id, starts_at, ends_at, status) VALUES ($1, $2, NOW() - interval '30 days', NOW() - interval '30 days' + interval '20 minutes', 'completed')`,
    [doc.id, patient.user.id]);
  const ok = await api(`/doctors/${doc.id}/reviews`, { method: 'POST', token: patient.token, body: { rating: 4, comment: 'Très bien' } });
  assert.equal(ok.status, 201);
  const list = (await api(`/doctors/${doc.id}/reviews`)).body;
  const mine = list.items.find((r) => r.comment === 'Très bien');
  assert.equal(mine.author, 'Avis P.', 'nom abrégé');
  assert.equal((await api(`/doctors/${doc.id}/reviews`, { method: 'POST', token: patient.token, body: { rating: 9 } })).status, 400);
});

test('formulaire de contact', async () => {
  const ok = await api('/contact', { method: 'POST', body: { name: 'Leila', email: `c-${stamp}@test.sehhatn.tn`, topic: 'bug', message: 'La carte ne s’affiche pas sur mobile.' } });
  assert.equal(ok.status, 201);
  assert.match(ok.body.reference, /^SEH-\d{5}$/);
  assert.equal((await api('/contact', { method: 'POST', body: { name: 'L', email: 'x', topic: 'bug', message: 'court' } })).status, 400);
});
