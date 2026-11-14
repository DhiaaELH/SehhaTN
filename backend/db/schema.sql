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