// Tests : export des données personnelles et suppression du compte.
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
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => null) };
}
async function register(role, name) {
  const email = `acct-${role}-${stamp}-${Math.random().toString(36).slice(2, 7)}@test.sehhatn.tn`;
  const r = await api('/auth/register', { method: 'POST', body: { name, email, password: 'motdepasse-test', role } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
}

before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await pool.query(`DELETE FROM users WHERE email LIKE '%@test.sehhatn.tn'`);
  server.close();
  await pool.end();
});

test('mot de passe : 72 caractères maximum', async () => {
  const r = await api('/auth/register', { method: 'POST', body: { name: 'Long', email: `long-${stamp}@test.sehhatn.tn`, password: 'x'.repeat(73) } });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /72/);
});

test('export : toutes mes données, sans le hash du mot de passe', async () => {
  const p = await register('patient', 'Export Patient');
  assert.equal((await api('/auth/me/export')).status, 401);
  await api('/health-card/me', { method: 'PUT', token: p.token, body: {
    blood_type: 'A+', allergies: [{ substance: 'Arachide', severity: 'severe' }],
  } });
  const r = await api('/auth/me/export', { token: p.token });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-disposition'), /sehhatn-mes-donnees\.json/);
  assert.equal(r.body.user.email, p.user.email);
  assert.ok(!('password_hash' in r.body.user));
  assert.equal(JSON.stringify(r.body).includes('password_hash'), false);
  assert.equal(r.body.health_card.blood_type, 'A+');
  assert.equal(r.body.health_card.allergies[0].substance, 'Arachide');
  assert.ok(Array.isArray(r.body.appointments));
  assert.ok(Array.isArray(r.body.reviews));
  assert.equal(r.body.doctor_profile, null);
});

test('suppression : mot de passe exigé, puis compte et données effacés', async () => {
  const p = await register('patient', 'Delete Patient');
  await api('/health-card/me', { method: 'PUT', token: p.token, body: { blood_type: 'B-' } });
  assert.equal((await api('/auth/me', { method: 'DELETE', token: p.token, body: {} })).status, 400);
  const wrong = await api('/auth/me', { method: 'DELETE', token: p.token, body: { password: 'mauvais-mdp' } });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.body.error, 'Mot de passe incorrect');
  const ok = await api('/auth/me', { method: 'DELETE', token: p.token, body: { password: 'motdepasse-test' } });
  assert.equal(ok.status, 204);
  assert.equal((await api('/auth/me', { token: p.token })).status, 404);
  const { rowCount } = await pool.query('SELECT 1 FROM health_cards WHERE user_id = $1', [p.user.id]);
  assert.equal(rowCount, 0, 'carte santé supprimée en cascade');
});

test('suppression d’un médecin : sa fiche disparaît de l’annuaire', async () => {
  const d = await register('doctor', 'Dr Delete');
  const prof = await api('/doctors/me', { method: 'POST', token: d.token, body: { specialty: 'Dentiste', governorate: 'Sfax', city: 'Sfax' } });
  assert.equal(prof.status, 201);
  assert.equal((await api('/auth/me', { method: 'DELETE', token: d.token, body: { password: 'motdepasse-test' } })).status, 204);
  assert.equal((await api(`/doctors/${prof.body.id}`)).status, 404);
});
