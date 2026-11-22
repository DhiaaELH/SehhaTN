const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { parse } = require('../lib/http');

const router = express.Router();

// GET /api/conditions?q=&category= : fiches du Guide santé (résumé)
router.get('/', async (req, res) => {
  const q = parse(z.object({
    q: z.string().trim().max(100).optional(),
    category: z.string().trim().max(60).optional(),
  }), req.query, res);
  if (!q) return;
  const params = [];
  const where = [];
  if (q.category) { params.push(q.category); where.push(`c.category = $${params.length}`); }
  if (q.q) {
    params.push(q.q);
    where.push(`(unaccent_lower(c.name_fr) LIKE '%' || unaccent_lower($${params.length}) || '%'
              OR c.name_ar LIKE '%' || $${params.length} || '%'
              OR unaccent_lower(c.summary_fr) LIKE '%' || unaccent_lower($${params.length}) || '%'
              OR EXISTS (SELECT 1 FROM unnest(c.symptoms_fr) s WHERE unaccent_lower(s) LIKE '%' || unaccent_lower($${params.length}) || '%'))`);
  }
  const { rows } = await pool.query(
    `SELECT c.slug, c.name_fr, c.name_ar, c.category, c.urgency, c.summary_fr, c.summary_ar, c.image_url, c.reading_minutes,
            s.name_fr AS specialty_fr, s.name_ar AS specialty_ar
       FROM conditions c LEFT JOIN specialties s ON s.slug = c.specialty_slug
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY c.category, c.name_fr`, params);
  res.set('Cache-Control', 'public, max-age=300');
  res.json(rows);
});

// GET /api/conditions/:slug : fiche complète
router.get('/:slug', async (req, res) => {
  const slug = String(req.params.slug);
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return res.status(400).json({ error: 'Identifiant invalide' });
  const { rows } = await pool.query(
    `SELECT c.*, s.slug AS specialty_slug, s.name_fr AS specialty_fr, s.name_ar AS specialty_ar
       FROM conditions c LEFT JOIN specialties s ON s.slug = c.specialty_slug WHERE c.slug = $1`, [slug]);
  if (!rows[0]) return res.status(404).json({ error: 'Fiche introuvable' });
  const related = await pool.query(
    `SELECT slug, name_fr, name_ar, image_url FROM conditions WHERE category = $1 AND slug <> $2 ORDER BY name_fr LIMIT 3`,
    [rows[0].category, slug]);
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ ...rows[0], related: related.rows });
});

module.exports = router;
