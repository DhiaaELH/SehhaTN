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