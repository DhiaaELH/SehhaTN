require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant : crée le fichier backend/.env');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;