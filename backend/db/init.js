const fs = require('fs');
const path = require('path');
const pool = require('./index');

async function init() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
  console.log('Tables créées (ou déjà existantes)');
  await pool.end();
}

init().catch((err) => {
  console.error('Erreur :', err.message);
  process.exit(1);
});