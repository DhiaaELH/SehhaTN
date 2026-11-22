CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  specialty   TEXT NOT NULL,
  governorate TEXT NOT NULL,
  city        TEXT NOT NULL,
  address     TEXT,
  phone       TEXT,
  schedule    TEXT,
  verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Champs supplémentaires pour la page de profil des médecins
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS bio              TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS languages        TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS years_experience INTEGER;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS consultation_fee INTEGER;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS accepts_cnam     BOOLEAN;

-- Durée d'un créneau (par médecin)
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS slot_minutes INTEGER NOT NULL DEFAULT 30
  CHECK (slot_minutes IN (15, 20, 30, 45, 60));

-- Horaires hebdomadaires (lundi = 0 ... dimanche = 6), plusieurs plages possibles par jour
CREATE TABLE IF NOT EXISTS doctor_availability (
  id         SERIAL PRIMARY KEY,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday    SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS doctor_availability_doctor_idx ON doctor_availability (doctor_id);

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS appointments (
  id         SERIAL PRIMARY KEY,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  starts_at  TIMESTAMPTZ NOT NULL,
  ends_at    TIMESTAMPTZ NOT NULL,
  status     TEXT NOT NULL DEFAULT 'confirmed'
             CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  note       TEXT CHECK (char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at),
  -- Garantie anti double réservation : deux rendez-vous non annulés d'un même médecin ne peuvent pas se chevaucher
  EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at) WITH &&)
    WHERE (status <> 'cancelled')
);
CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments (patient_id, starts_at DESC);

-- =====================================================================
-- Extension de la plateforme (v2) : tout est idempotent, on peut relancer
-- `npm run db:init` sur une base existante sans perte de données.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Recherche insensible aux accents et à la casse, sans dépendre de l'extension unaccent.
CREATE OR REPLACE FUNCTION unaccent_lower(t TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT lower(translate(t,
    'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñŒœ',
    'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnOo'))
$$;

-- ---------- Référentiel des spécialités ----------
CREATE TABLE IF NOT EXISTS specialties (
  slug           TEXT PRIMARY KEY,
  name_fr        TEXT NOT NULL UNIQUE,     -- valeur stockée dans doctors.specialty
  name_ar        TEXT NOT NULL,
  icon           TEXT,
  description_fr TEXT,
  description_ar TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 100
);

-- ---------- Médecins : champs supplémentaires ----------
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS title            TEXT NOT NULL DEFAULT 'Dr';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS gender           TEXT CHECK (gender IN ('f', 'm'));
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS photo_url        TEXT;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS latitude         DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS longitude        DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180);
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS location_precise BOOLEAN NOT NULL DEFAULT FALSE; -- FALSE = centre de la ville
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS education        TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS services         TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS teleconsultation BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS is_demo          BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS seed_key         TEXT UNIQUE;
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS doctors_specialty_idx   ON doctors (specialty);
CREATE INDEX IF NOT EXISTS doctors_governorate_idx ON doctors (governorate);
CREATE INDEX IF NOT EXISTS doctors_name_trgm_idx   ON doctors USING gin (name gin_trgm_ops);

-- ---------- Avis des patients ----------
CREATE TABLE IF NOT EXISTS reviews (
  id             SERIAL PRIMARY KEY,
  doctor_id      INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  patient_id     INTEGER NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment        TEXT CHECK (char_length(comment) <= 1000),
  status         TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('pending', 'published', 'rejected')),
  doctor_reply   TEXT CHECK (char_length(doctor_reply) <= 1000),
  is_demo        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, patient_id)            -- un avis par patient et par médecin
);
CREATE INDEX IF NOT EXISTS reviews_doctor_idx ON reviews (doctor_id, created_at DESC);

-- ---------- Lieux de soins (pharmacies, cliniques, hôpitaux, laboratoires…) ----------
CREATE TABLE IF NOT EXISTS facilities (
  id            SERIAL PRIMARY KEY,
  seed_key      TEXT UNIQUE,
  type          TEXT NOT NULL CHECK (type IN ('pharmacy', 'clinic', 'hospital', 'laboratory', 'radiology', 'health_center')),
  name          TEXT NOT NULL,
  name_ar       TEXT,
  governorate   TEXT NOT NULL,
  city          TEXT NOT NULL,
  address       TEXT,
  phone         TEXT,
  website       TEXT,
  latitude      DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude     DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  open_24h      BOOLEAN NOT NULL DEFAULT FALSE,
  has_emergency BOOLEAN NOT NULL DEFAULT FALSE,
  opening_hours TEXT,
  services      TEXT[] NOT NULL DEFAULT '{}',
  accepts_cnam  BOOLEAN,
  photo_url     TEXT,
  description   TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT FALSE,  -- établissement public (CHU, hôpital régional, CSB)
  is_demo       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS facilities_type_idx ON facilities (type);
CREATE INDEX IF NOT EXISTS facilities_geo_idx  ON facilities (latitude, longitude);

-- ---------- Base de connaissances santé (guide + moteur d'orientation) ----------
-- Maladies / affections : alimentent le Guide santé et les « pistes » du moteur d'orientation.
CREATE TABLE IF NOT EXISTS conditions (
  slug               TEXT PRIMARY KEY,
  name_fr            TEXT NOT NULL,
  name_ar            TEXT NOT NULL,
  category           TEXT NOT NULL,
  specialty_slug     TEXT REFERENCES specialties(slug) ON UPDATE CASCADE,
  urgency            TEXT NOT NULL DEFAULT 'consult' CHECK (urgency IN ('self_care', 'consult', 'urgent', 'emergency')),
  summary_fr         TEXT NOT NULL,
  summary_ar         TEXT NOT NULL,
  symptoms_fr        TEXT[] NOT NULL DEFAULT '{}',
  causes_fr          TEXT,
  self_care_fr       TEXT[] NOT NULL DEFAULT '{}',
  self_care_ar       TEXT[] NOT NULL DEFAULT '{}',
  when_to_consult_fr TEXT[] NOT NULL DEFAULT '{}',
  when_to_consult_ar TEXT[] NOT NULL DEFAULT '{}',
  prevention_fr      TEXT[] NOT NULL DEFAULT '{}',
  image_url          TEXT,
  reading_minutes    SMALLINT NOT NULL DEFAULT 4,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS conditions_category_idx ON conditions (category);

-- Symptômes reconnus par l'assistant et proposés dans l'orientation guidée.
CREATE TABLE IF NOT EXISTS symptoms (
  key            TEXT PRIMARY KEY,
  label_fr       TEXT NOT NULL,
  label_ar       TEXT NOT NULL,
  category       TEXT NOT NULL,            -- regroupement de l'orientation (tete, thorax, ventre…)
  specialty_slug TEXT REFERENCES specialties(slug) ON UPDATE CASCADE,
  base_level     SMALLINT NOT NULL DEFAULT 2 CHECK (base_level BETWEEN 0 AND 5),
  self_care_ok   BOOLEAN NOT NULL DEFAULT FALSE,
  synonyms       TEXT[] NOT NULL DEFAULT '{}',   -- français, arabe et darija (lettres latines)
  advice_fr      TEXT[] NOT NULL DEFAULT '{}',
  advice_ar      TEXT[] NOT NULL DEFAULT '{}',
  sort_order     INTEGER NOT NULL DEFAULT 100
);

-- Signes d'alerte : toujours vérifiés en premier.
CREATE TABLE IF NOT EXISTS red_flags (
  key         TEXT PRIMARY KEY,
  question_fr TEXT NOT NULL,
  question_ar TEXT NOT NULL,
  level       SMALLINT NOT NULL CHECK (level IN (3, 4, 5)), -- 3 = consulter aujourd'hui, 4 = urgences, 5 = SAMU 190
  is_global   BOOLEAN NOT NULL DEFAULT FALSE,              -- proposé à tout le monde dès le début
  patterns    TEXT[] NOT NULL DEFAULT '{}',                -- détection dans le texte libre du chat
  advice_fr   TEXT NOT NULL,
  advice_ar   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS symptom_red_flags (
  symptom_key  TEXT NOT NULL REFERENCES symptoms(key)  ON DELETE CASCADE,
  red_flag_key TEXT NOT NULL REFERENCES red_flags(key) ON DELETE CASCADE,
  PRIMARY KEY (symptom_key, red_flag_key)
);

CREATE TABLE IF NOT EXISTS condition_symptoms (
  condition_slug TEXT NOT NULL REFERENCES conditions(slug) ON DELETE CASCADE,
  symptom_key    TEXT NOT NULL REFERENCES symptoms(key)    ON DELETE CASCADE,
  weight         SMALLINT NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 3),
  PRIMARY KEY (condition_slug, symptom_key)
);

-- ---------- Carte santé du patient ----------
CREATE TABLE IF NOT EXISTS health_cards (
  id                       SERIAL PRIMARY KEY,
  user_id                  INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth            DATE,
  sex                      TEXT CHECK (sex IN ('f', 'm')),
  blood_type               TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  height_cm                SMALLINT CHECK (height_cm BETWEEN 30 AND 250),
  weight_kg                NUMERIC(5,1) CHECK (weight_kg BETWEEN 1 AND 400),
  cnam_number              TEXT CHECK (char_length(cnam_number) <= 30),
  cnam_track               TEXT CHECK (cnam_track IN ('public', 'private', 'reimbursement')),
  insurer                  TEXT CHECK (char_length(insurer) <= 100),    -- mutuelle / assurance complémentaire
  organ_donor              BOOLEAN,
  smoker                   BOOLEAN,
  notes                    TEXT CHECK (char_length(notes) <= 1000),
  share_with_doctors       BOOLEAN NOT NULL DEFAULT FALSE,  -- visible par les médecins chez qui j'ai un RDV
  emergency_access_enabled BOOLEAN NOT NULL DEFAULT FALSE,  -- fiche d'urgence accessible par lien / QR code
  emergency_token          TEXT UNIQUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS health_card_allergies (
  id        SERIAL PRIMARY KEY,
  card_id   INTEGER NOT NULL REFERENCES health_cards(id) ON DELETE CASCADE,
  substance TEXT NOT NULL CHECK (char_length(substance) BETWEEN 1 AND 100),
  reaction  TEXT CHECK (char_length(reaction) <= 200),
  severity  TEXT CHECK (severity IN ('mild', 'moderate', 'severe'))
);
CREATE TABLE IF NOT EXISTS health_card_conditions (
  id             SERIAL PRIMARY KEY,
  card_id        INTEGER NOT NULL REFERENCES health_cards(id) ON DELETE CASCADE,
  name           TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  diagnosed_year SMALLINT CHECK (diagnosed_year BETWEEN 1900 AND 2100),
  notes          TEXT CHECK (char_length(notes) <= 300)
);
CREATE TABLE IF NOT EXISTS health_card_medications (
  id        SERIAL PRIMARY KEY,
  card_id   INTEGER NOT NULL REFERENCES health_cards(id) ON DELETE CASCADE,
  name      TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  dosage    TEXT CHECK (char_length(dosage) <= 60),
  frequency TEXT CHECK (char_length(frequency) <= 60)
);
CREATE TABLE IF NOT EXISTS health_card_vaccinations (
  id        SERIAL PRIMARY KEY,
  card_id   INTEGER NOT NULL REFERENCES health_cards(id) ON DELETE CASCADE,
  vaccine   TEXT NOT NULL CHECK (char_length(vaccine) BETWEEN 1 AND 120),
  dose_date DATE,
  notes     TEXT CHECK (char_length(notes) <= 200)
);
CREATE TABLE IF NOT EXISTS health_card_emergency_contacts (
  id       SERIAL PRIMARY KEY,
  card_id  INTEGER NOT NULL REFERENCES health_cards(id) ON DELETE CASCADE,
  name     TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  relation TEXT CHECK (char_length(relation) <= 50),
  phone    TEXT NOT NULL CHECK (char_length(phone) BETWEEN 4 AND 30)
);
-- Traçabilité : qui a consulté la carte, et quand (exigence de base pour des données de santé).
CREATE TABLE IF NOT EXISTS health_card_access_log (
  id          BIGSERIAL PRIMARY KEY,
  card_id     INTEGER NOT NULL REFERENCES health_cards(id) ON DELETE CASCADE,
  accessor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  access_type TEXT NOT NULL CHECK (access_type IN ('owner_update', 'doctor_view', 'emergency_view')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS health_card_access_log_card_idx ON health_card_access_log (card_id, created_at DESC);

-- ---------- Messages du formulaire « Aide & contact » ----------
CREATE TABLE IF NOT EXISTS contact_messages (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  email      TEXT NOT NULL CHECK (char_length(email) <= 200),
  topic      TEXT NOT NULL CHECK (topic IN ('account', 'appointment', 'doctor', 'data', 'bug', 'other')),
  message    TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 3000),
  status     TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Utilisateurs de démonstration (patients fictifs auteurs des avis de démo)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
