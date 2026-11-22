const express = require('express');
const { z } = require('zod');
const { parse } = require('../lib/http');
const { searchPlace } = require('../lib/geocode');
const { GOVERNORATES, inTunisia, nearestCity } = require('../lib/tunisia-geo');

const router = express.Router();

// GET /api/geo/governorates : gouvernorats et villes connues (avec coordonnées)
router.get('/governorates', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.json(GOVERNORATES.map((g) => ({
    name: g.name, ar: g.ar,
    cities: g.cities.map(([name, ar, lat, lng]) => ({ name, ar, lat, lng })),
  })));
});

// GET /api/geo/search?q=Sfax&lang=fr : position d'une ville ou d'une adresse en Tunisie
router.get('/search', async (req, res) => {
  const q = parse(z.object({
    q: z.string().trim().min(2, 'Saisissez au moins 2 caractères').max(120),
    lang: z.enum(['fr', 'ar']).default('fr'),
  }), req.query, res);
  if (!q) return;
  try {
    const place = await searchPlace(q.q, q.lang);
    if (!place) return res.status(404).json({ error: 'Lieu introuvable en Tunisie' });
    res.json(place);
  } catch {
    res.status(503).json({ error: 'Recherche de lieu momentanément indisponible' });
  }
});

// GET /api/geo/reverse?lat=&lng= : ville connue la plus proche (sans service externe)
router.get('/reverse', (req, res) => {
  const q = parse(z.object({ lat: z.coerce.number(), lng: z.coerce.number() }), req.query, res);
  if (!q) return;
  if (!inTunisia(q.lat, q.lng)) return res.status(404).json({ error: 'Position hors de Tunisie' });
  const c = nearestCity(q.lat, q.lng);
  res.json({ city: c.name, city_ar: c.ar, governorate: c.governorate, distance_km: Math.round(c.distance_km * 10) / 10 });
});

module.exports = router;
