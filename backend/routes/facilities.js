const express = require('express');
const { z } = require('zod');
const pool = require('../db');
const { parse, idParam, hideDemo } = require('../lib/http');
const { osmFacilities } = require('../lib/geocode');
const { distanceKm } = require('../lib/tunisia-geo');

const router = express.Router();

const TYPES = ['pharmacy', 'clinic', 'hospital', 'laboratory', 'radiology', 'health_center'];
const typesParam = z.string().trim().optional()
  .transform((s) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : TYPES))
  .refine((list) => list.length && list.every((t) => TYPES.includes(t)), 'Type de lieu invalide');

const nearbyQuery = z.object({
  lat: z.coerce.number({ error: 'Position requise' }).min(-90).max(90),
  lng: z.coerce.number({ error: 'Position requise' }).min(-180).max(180),
  types: typesParam,
  radius_km: z.coerce.number().min(0.5).max(50).default(15),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  open_24h: z.enum(['true', 'false']).optional(),
  emergency: z.enum(['true', 'false']).optional(),
  osm: z.enum(['true', 'false']).default('true'),
});
const listQuery = z.object({
  governorate: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  types: typesParam,
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

const COLUMNS = `id, type, name, name_ar, governorate, city, address, phone, website, latitude, longitude, open_24h, has_emergency,
  opening_hours, services, accepts_cnam, photo_url, description, is_public, is_demo`;

// GET /api/facilities/nearby?lat=&lng=&types=pharmacy,hospital&radius_km=&open_24h=&emergency=&osm=
// Lieux les plus proches : annuaire SehhaTN + (facultatif) données ouvertes OpenStreetMap, triés par distance.
router.get('/nearby', async (req, res) => {
  const q = parse(nearbyQuery, req.query, res);
  if (!q) return;
  // Pré-filtre rectangulaire (index) puis distance exacte.
  const dLat = q.radius_km / 111;
  const dLng = q.radius_km / (111 * Math.cos((q.lat * Math.PI) / 180));
  const conds = ['type = ANY($1)', 'latitude BETWEEN $2 AND $3', 'longitude BETWEEN $4 AND $5'];
  if (q.open_24h === 'true') conds.push('open_24h');
  if (q.emergency === 'true') conds.push('has_emergency');
  if (hideDemo()) conds.push('NOT is_demo');
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM facilities WHERE ${conds.join(' AND ')}`,
    [q.types, q.lat - dLat, q.lat + dLat, q.lng - dLng, q.lng + dLng]
  );
  let items = rows.map((f) => ({ ...f, source: 'sehhatn', distance_km: distanceKm(q.lat, q.lng, f.latitude, f.longitude) }));

  let osmStatus = 'skipped';
  if (q.osm === 'true') {
    const osm = await osmFacilities(q.lat, q.lng, q.types, Math.min(q.radius_km, 25));
    osmStatus = osm ? 'ok' : 'unavailable';
    for (const o of osm ?? []) {
      if (q.open_24h === 'true' && !o.open_24h) continue;
      if (q.emergency === 'true' && !o.has_emergency) continue;
      // Doublon probable : même type à moins de 80 m d'un lieu déjà connu
      const dup = items.some((f) => f.type === o.type && distanceKm(f.latitude, f.longitude, o.latitude, o.longitude) < 0.08);
      if (!dup) items.push({ ...o, distance_km: distanceKm(q.lat, q.lng, o.latitude, o.longitude) });
    }
  }
  items = items
    .filter((f) => f.distance_km <= q.radius_km)
    .sort((a, b) => a.distance_km - b.distance_km)
    .slice(0, q.limit)
    .map((f) => ({ ...f, distance_km: Math.round(f.distance_km * 100) / 100 }));
  res.json({ center: { lat: q.lat, lng: q.lng }, radius_km: q.radius_km, osm: osmStatus, items });
});

// GET /api/facilities?governorate=&city=&types=&q=
router.get('/', async (req, res) => {
  const q = parse(listQuery, req.query, res);
  if (!q) return;
  const params = [q.types];
  const conds = ['type = ANY($1)'];
  if (q.governorate) { params.push(q.governorate); conds.push(`governorate = $${params.length}`); }
  if (q.city) { params.push(q.city); conds.push(`city = $${params.length}`); }
  if (q.q) { params.push(q.q); conds.push(`unaccent_lower(name) LIKE '%' || unaccent_lower($${params.length}) || '%'`); }
  if (hideDemo()) conds.push('NOT is_demo');
  params.push(q.limit);
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM facilities WHERE ${conds.join(' AND ')} ORDER BY governorate, city, name LIMIT $${params.length}`, params);
  res.json(rows);
});

// GET /api/facilities/:id
router.get('/:id', async (req, res) => {
  const id = idParam(req, res);
  if (!id) return;
  const { rows } = await pool.query(`SELECT ${COLUMNS} FROM facilities WHERE id = $1 ${hideDemo() ? 'AND NOT is_demo' : ''}`, [id]);
  if (!rows[0]) return res.status(404).json({ error: 'Lieu introuvable' });
  res.json(rows[0]);
});

module.exports = router;
