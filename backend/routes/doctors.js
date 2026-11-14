const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/doctors?specialty=Dentiste&governorate=Sfax&city=Sfax
router.get('/', async (req, res) => {
  const { specialty, governorate, city } = req.query;

  const conditions = [];
  const params = [];
  if (specialty)   { params.push(specialty);   conditions.push(`specialty = $${params.length}`); }
  if (governorate) { params.push(governorate); conditions.push(`governorate = $${params.length}`); }
  if (city)        { params.push(city);        conditions.push(`city = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(`SELECT * FROM doctors ${where} ORDER BY name`, params);
  res.json(rows);
});

// GET /api/doctors/1
router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Identifiant invalide' });

  const { rows } = await pool.query('SELECT * FROM doctors WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Médecin introuvable' });
  res.json(rows[0]);
});

module.exports = router;