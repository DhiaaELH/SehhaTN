const express = require('express');
const pool = require('../db');
const { hideDemo } = require('../lib/http');

const router = express.Router();

// GET /api/meta/specialties : référentiel des spécialités, avec le nombre de praticiens
router.get('/specialties', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.slug, s.name_fr, s.name_ar, s.icon, s.description_fr, s.description_ar,
            COUNT(d.id)::int AS doctor_count
       FROM specialties s LEFT JOIN doctors d ON d.specialty = s.name_fr AND ($1::boolean OR NOT d.is_demo)
      GROUP BY s.slug ORDER BY s.sort_order, s.name_fr`, [!hideDemo()]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json(rows);
});

// GET /api/meta/stats : chiffres clés affichés sur le site
router.get('/stats', async (req, res) => {
  const demo = !hideDemo();
  const { rows: [s] } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM doctors WHERE $1::boolean OR NOT is_demo)::int AS doctors,
            (SELECT COUNT(DISTINCT governorate) FROM doctors WHERE $1::boolean OR NOT is_demo)::int AS governorates,
            (SELECT COUNT(DISTINCT specialty) FROM doctors WHERE $1::boolean OR NOT is_demo)::int AS specialties,
            (SELECT COUNT(*) FROM facilities WHERE $1::boolean OR NOT is_demo)::int AS facilities,
            (SELECT COUNT(*) FROM facilities WHERE type = 'pharmacy' AND ($1::boolean OR NOT is_demo))::int AS pharmacies,
            (SELECT COUNT(*) FROM reviews WHERE status = 'published' AND ($1::boolean OR NOT is_demo))::int AS reviews,
            (SELECT COUNT(*) FROM conditions)::int AS conditions`, [demo]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json(s);
});

module.exports = router;
