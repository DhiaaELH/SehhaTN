const path = require('path');
// Le fichier .env est lu à côté du backend, quel que soit le dossier d'où l'on lance la commande.
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant : crée le fichier backend/.env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

// Une connexion inactive coupée par le serveur (Neon met en veille) ne doit pas faire planter l'API.
pool.on('error', (err) => {
  console.error('[db] connexion inactive perdue :', err.message);
});

/** Exécute `fn(client)` dans une transaction ; ROLLBACK automatique en cas d'erreur. */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = pool;
module.exports.withTransaction = withTransaction;
