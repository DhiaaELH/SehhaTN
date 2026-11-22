/** Remplit la base : référentiels (spécialités, base de connaissances santé) et données de démonstration.
 *
 *   npm run db:seed                 schéma + référentiels + démo
 *   npm run db:seed -- --no-demo    schéma + référentiels seulement (production avec de vrais utilisateurs)
 *   npm run db:seed -- --remove-demo   supprime toutes les données marquées is_demo
 *
 *  Idempotent : chaque ligne a une clé stable (slug, key, seed_key, email), on peut relancer sans doublons.
 *  Comptes de connexion de démo : créés seulement si SEED_DEMO_PASSWORD est défini. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('./index');
const { withTransaction } = require('./index');
const specialties = require('./seed-data/specialties');
const demo = require('./seed-data/demo');

const args = new Set(process.argv.slice(2));

function optional(file) {
  try { return require(file); } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') { console.warn(`  (fichier absent : ${path.basename(file)}, ignoré)`); return []; }
    throw e;
  }
}

async function applySchema() {
  await pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('✓ schéma à jour');
}

async function seedReference(client) {
  await client.query(
    `INSERT INTO specialties (slug, name_fr, name_ar, icon, description_fr, description_ar, sort_order)
     SELECT slug, name_fr, name_ar, icon, description_fr, description_ar, sort_order
       FROM json_populate_recordset(NULL::specialties, $1)
     ON CONFLICT (slug) DO UPDATE SET name_fr = EXCLUDED.name_fr, name_ar = EXCLUDED.name_ar, icon = EXCLUDED.icon,
       description_fr = EXCLUDED.description_fr, description_ar = EXCLUDED.description_ar, sort_order = EXCLUDED.sort_order`,
    [JSON.stringify(specialties)]
  );
  console.log(`✓ ${specialties.length} spécialités`);

  const redFlags = optional('./seed-data/red-flags');
  const symptoms = optional('./seed-data/symptoms');
  const conditions = optional('./seed-data/conditions');

  await client.query(
    `INSERT INTO red_flags (key, question_fr, question_ar, level, is_global, patterns, advice_fr, advice_ar)
     SELECT key, question_fr, question_ar, level, is_global, patterns, advice_fr, advice_ar
       FROM json_populate_recordset(NULL::red_flags, $1)
     ON CONFLICT (key) DO UPDATE SET question_fr = EXCLUDED.question_fr, question_ar = EXCLUDED.question_ar,
       level = EXCLUDED.level, is_global = EXCLUDED.is_global, patterns = EXCLUDED.patterns,
       advice_fr = EXCLUDED.advice_fr, advice_ar = EXCLUDED.advice_ar`,
    [JSON.stringify(redFlags)]
  );

  const symptomRows = symptoms.map((s) => ({ ...s, specialty_slug: s.specialty }));
  await client.query(
    `INSERT INTO symptoms (key, label_fr, label_ar, category, specialty_slug, base_level, self_care_ok, synonyms, advice_fr, advice_ar, sort_order)
     SELECT key, label_fr, label_ar, category, specialty_slug, base_level, self_care_ok, synonyms, advice_fr, advice_ar, sort_order
       FROM json_populate_recordset(NULL::symptoms, $1)
     ON CONFLICT (key) DO UPDATE SET label_fr = EXCLUDED.label_fr, label_ar = EXCLUDED.label_ar, category = EXCLUDED.category,
       specialty_slug = EXCLUDED.specialty_slug, base_level = EXCLUDED.base_level, self_care_ok = EXCLUDED.self_care_ok,
       synonyms = EXCLUDED.synonyms, advice_fr = EXCLUDED.advice_fr, advice_ar = EXCLUDED.advice_ar, sort_order = EXCLUDED.sort_order`,
    [JSON.stringify(symptomRows)]
  );
  // Liens symptôme → signes d'alerte : on remplace l'ensemble pour refléter le fichier source.
  const links = symptoms.flatMap((s) => (s.red_flags ?? []).map((k) => ({ symptom_key: s.key, red_flag_key: k })));
  await client.query('DELETE FROM symptom_red_flags WHERE symptom_key = ANY($1)', [symptoms.map((s) => s.key)]);
  await client.query(
    `INSERT INTO symptom_red_flags SELECT * FROM json_populate_recordset(NULL::symptom_red_flags, $1) ON CONFLICT DO NOTHING`,
    [JSON.stringify(links)]
  );

  const conditionRows = conditions.map((c) => ({ ...c, specialty_slug: c.specialty }));
  await client.query(
    `INSERT INTO conditions (slug, name_fr, name_ar, category, specialty_slug, urgency, summary_fr, summary_ar, symptoms_fr, causes_fr,
                             self_care_fr, self_care_ar, when_to_consult_fr, when_to_consult_ar, prevention_fr, image_url, reading_minutes, updated_at)
     SELECT slug, name_fr, name_ar, category, specialty_slug, urgency, summary_fr, summary_ar, symptoms_fr, causes_fr,
            self_care_fr, self_care_ar, when_to_consult_fr, when_to_consult_ar, prevention_fr, image_url, COALESCE(reading_minutes, 4), NOW()
       FROM json_populate_recordset(NULL::conditions, $1)
     ON CONFLICT (slug) DO UPDATE SET name_fr = EXCLUDED.name_fr, name_ar = EXCLUDED.name_ar, category = EXCLUDED.category,
       specialty_slug = EXCLUDED.specialty_slug, urgency = EXCLUDED.urgency, summary_fr = EXCLUDED.summary_fr, summary_ar = EXCLUDED.summary_ar,
       symptoms_fr = EXCLUDED.symptoms_fr, causes_fr = EXCLUDED.causes_fr, self_care_fr = EXCLUDED.self_care_fr, self_care_ar = EXCLUDED.self_care_ar,
       when_to_consult_fr = EXCLUDED.when_to_consult_fr, when_to_consult_ar = EXCLUDED.when_to_consult_ar, prevention_fr = EXCLUDED.prevention_fr,
       image_url = EXCLUDED.image_url, reading_minutes = EXCLUDED.reading_minutes, updated_at = NOW()`,
    [JSON.stringify(conditionRows)]
  );
  const condLinks = conditions.flatMap((c) =>
    Object.entries(c.symptom_links ?? {}).map(([k, w]) => ({ condition_slug: c.slug, symptom_key: k, weight: w })));
  await client.query('DELETE FROM condition_symptoms WHERE condition_slug = ANY($1)', [conditions.map((c) => c.slug)]);
  await client.query(
    `INSERT INTO condition_symptoms SELECT * FROM json_populate_recordset(NULL::condition_symptoms, $1) ON CONFLICT DO NOTHING`,
    [JSON.stringify(condLinks)]
  );
  console.log(`✓ base de connaissances : ${redFlags.length} signes d’alerte, ${symptoms.length} symptômes, ${conditions.length} affections`);
}

async function seedDemo(client) {
  // Patients fictifs (auteurs des avis). Mot de passe aléatoire jamais communiqué : ces comptes ne servent pas à se connecter.
  const unusable = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
  const patients = demo.patients();
  const { rows: patientRows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role, is_demo)
     SELECT p.name, p.email, $2, 'patient', TRUE FROM json_to_recordset($1) AS p(name TEXT, email TEXT)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, email`,
    [JSON.stringify(patients), unusable]
  );
  const patientId = new Map(patientRows.map((r) => [r.email, r.id]));

  const doctors = demo.doctors();
  const { rows: docRows } = await client.query(
    `INSERT INTO doctors (seed_key, name, title, gender, specialty, governorate, city, address, phone, schedule, verified, bio, languages,
                          years_experience, consultation_fee, accepts_cnam, slot_minutes, photo_url, latitude, longitude, location_precise,
                          education, services, teleconsultation, is_demo, updated_at)
     SELECT seed_key, name, title, gender, specialty, governorate, city, address, phone, schedule, verified, bio, languages,
            years_experience, consultation_fee, accepts_cnam, slot_minutes, photo_url, latitude, longitude, TRUE,
            education, services, teleconsultation, TRUE, NOW()
       FROM json_populate_recordset(NULL::doctors, $1)
     ON CONFLICT (seed_key) DO UPDATE SET name = EXCLUDED.name, title = EXCLUDED.title, gender = EXCLUDED.gender,
       specialty = EXCLUDED.specialty, governorate = EXCLUDED.governorate, city = EXCLUDED.city, address = EXCLUDED.address,
       phone = EXCLUDED.phone, schedule = EXCLUDED.schedule, verified = EXCLUDED.verified, bio = EXCLUDED.bio,
       languages = EXCLUDED.languages, years_experience = EXCLUDED.years_experience, consultation_fee = EXCLUDED.consultation_fee,
       accepts_cnam = EXCLUDED.accepts_cnam, slot_minutes = EXCLUDED.slot_minutes, photo_url = EXCLUDED.photo_url,
       latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, location_precise = TRUE, education = EXCLUDED.education,
       services = EXCLUDED.services, teleconsultation = EXCLUDED.teleconsultation, is_demo = TRUE, updated_at = NOW()
     RETURNING id, seed_key`,
    [JSON.stringify(doctors)]
  );
  const doctorId = new Map(docRows.map((r) => [r.seed_key, r.id]));

  // Horaires hebdomadaires : on remplace ceux des médecins de démo.
  const ranges = doctors.flatMap((d) => d.ranges.flatMap(([from, to, start, end]) => {
    const out = [];
    for (let wd = from; wd <= to; wd++) out.push({ doctor_id: doctorId.get(d.seed_key), weekday: wd, start_time: start, end_time: end });
    return out;
  }));
  await client.query('DELETE FROM doctor_availability WHERE doctor_id = ANY($1)', [[...doctorId.values()]]);
  await client.query(
    `INSERT INTO doctor_availability (doctor_id, weekday, start_time, end_time)
     SELECT doctor_id, weekday, start_time, end_time FROM json_populate_recordset(NULL::doctor_availability, $1)`,
    [JSON.stringify(ranges)]
  );

  const reviews = demo.reviews(doctors.map((d) => d.seed_key), patients.length).map((r) => ({
    doctor_id: doctorId.get(r.doctor_key),
    patient_id: patientId.get(patients[r.patient_index].email),
    rating: r.rating, comment: r.comment,
    created_at: new Date(Date.now() - r.days_ago * 86400000).toISOString(),
  }));
  await client.query(
    `INSERT INTO reviews (doctor_id, patient_id, rating, comment, status, is_demo, created_at)
     SELECT doctor_id, patient_id, rating, comment, 'published', TRUE, created_at FROM json_populate_recordset(NULL::reviews, $1)
     ON CONFLICT (doctor_id, patient_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = EXCLUDED.created_at
       WHERE reviews.is_demo`,
    [JSON.stringify(reviews)]
  );

  const facilities = demo.facilities();
  await client.query(
    `INSERT INTO facilities (seed_key, type, name, governorate, city, address, phone, latitude, longitude, open_24h, has_emergency,
                             opening_hours, services, accepts_cnam, photo_url, description, is_public, is_demo)
     SELECT seed_key, type, name, governorate, city, address, phone, latitude, longitude, open_24h, has_emergency,
            opening_hours, services, accepts_cnam, photo_url, description, is_public, TRUE
       FROM json_populate_recordset(NULL::facilities, $1)
     ON CONFLICT (seed_key) DO UPDATE SET type = EXCLUDED.type, name = EXCLUDED.name, governorate = EXCLUDED.governorate,
       city = EXCLUDED.city, address = EXCLUDED.address, phone = EXCLUDED.phone, latitude = EXCLUDED.latitude,
       longitude = EXCLUDED.longitude, open_24h = EXCLUDED.open_24h, has_emergency = EXCLUDED.has_emergency,
       opening_hours = EXCLUDED.opening_hours, services = EXCLUDED.services, accepts_cnam = EXCLUDED.accepts_cnam,
       photo_url = EXCLUDED.photo_url, description = EXCLUDED.description, is_public = EXCLUDED.is_public, is_demo = TRUE`,
    [JSON.stringify(facilities)]
  );
  console.log(`✓ démo : ${doctors.length} médecins, ${reviews.length} avis, ${facilities.length} lieux de soins, ${patients.length} patients fictifs`);

  // Comptes de connexion de démonstration (facultatifs)
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password) {
    console.log('  (SEED_DEMO_PASSWORD non défini : aucun compte de connexion de démo créé)');
    return;
  }
  if (password.length < 8) throw new Error('SEED_DEMO_PASSWORD : 8 caractères minimum');
  const hash = await bcrypt.hash(password, 10);
  await client.query(
    `INSERT INTO users (name, email, password_hash, role, is_demo) VALUES ('Patient Démo', 'patient@demo.sehhatn.tn', $1, 'patient', TRUE)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash`, [hash]);
  const docKey = 'demo-doctor-generaliste-1';
  const { rows: [docUser] } = await client.query(
    `INSERT INTO users (name, email, password_hash, role, is_demo)
     SELECT name, 'medecin@demo.sehhatn.tn', $1, 'doctor', TRUE FROM doctors WHERE seed_key = $2
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id`, [hash, docKey]);
  await client.query('UPDATE doctors SET user_id = $1 WHERE seed_key = $2', [docUser.id, docKey]);
  console.log('✓ comptes de démo : patient@demo.sehhatn.tn et medecin@demo.sehhatn.tn (mot de passe : SEED_DEMO_PASSWORD)');
}

async function removeDemo(client) {
  const d = await client.query('DELETE FROM doctors WHERE is_demo');
  const f = await client.query('DELETE FROM facilities WHERE is_demo');
  const u = await client.query('DELETE FROM users WHERE is_demo');
  console.log(`✓ données de démo supprimées : ${d.rowCount} médecins, ${f.rowCount} lieux, ${u.rowCount} utilisateurs (avis et RDV associés inclus)`);
}

async function main() {
  await applySchema();
  if (args.has('--remove-demo')) {
    await withTransaction(removeDemo);
  } else {
    await withTransaction(seedReference);
    if (!args.has('--no-demo')) await withTransaction(seedDemo);
  }
  await pool.end();
}

main().catch(async (err) => {
  console.error('Erreur :', err.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
