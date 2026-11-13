const express = require('express');
const db = require('../db');

const router = express.Router();


router.get('/', (req, res) => {
  const { specialty, governorate, city } = req.query;

  let sql = 'SELECT * FROM doctors WHERE 1=1';
  const params = [];

  if (specialty)   { sql += ' AND specialty = ?';   params.push(specialty); }
  if (governorate) { sql += ' AND governorate = ?'; params.push(governorate); }
  if (city)        { sql += ' AND city = ?';        params.push(city); }

  res.json(db.prepare(sql).all(...params));
});


router.get('/:id', (req, res) => {
  const doctor = db.prepare('SELECT * FROM doctors WHERE id = ?').get(req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Médecin introuvable' });
  res.json(doctor);
});

module.exports = router;