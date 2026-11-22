/** Géocodage (adresse → coordonnées) et lieux OpenStreetMap, avec cache et solutions de repli.
 *  Les appels externes passent par le serveur : le navigateur n'a plus à contacter Nominatim / Overpass,
 *  les résultats sont mis en cache et un service indisponible ne casse pas la page. */
const { TtlCache, fetchJson } = require('./http');
const geo = require('./tunisia-geo');

const NOMINATIM = process.env.NOMINATIM_URL || 'https://nominatim.openstreetmap.org';
// Plusieurs instances Overpass : l'instance principale est souvent saturée. On commence par la dernière qui a répondu.
const OVERPASS = (process.env.OVERPASS_URLS || 'https://overpass-api.de/api/interpreter,https://maps.mail.ru/osm/tools/overpass/api/interpreter')
  .split(',').map((s) => s.trim()).filter(Boolean);
let preferred = 0;
const geoCache = new TtlCache(24 * 60 * 60 * 1000, 1000);
const osmCache = new TtlCache(30 * 60 * 1000, 300);

// Nominatim : 1 requête par seconde maximum (règle d'utilisation). On sérialise les appels.
let lastCall = 0;
let queue = Promise.resolve();
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

/** Recherche d'un lieu en Tunisie. Liste locale d'abord (instantané, hors ligne), puis Nominatim. */
async function searchPlace(q, lang = 'fr') {
  const local = geo.findPlace(q);
  if (local) return local;
  const key = `${lang}:${geo.fold(q)}`;
  const cached = geoCache.get(key);
  if (cached !== undefined) return cached;
  const url = `${NOMINATIM}/search?format=jsonv2&countrycodes=tn&limit=1&accept-language=${lang}&q=${encodeURIComponent(q)}`;
  const rows = await throttled(() => fetchJson(url, { timeoutMs: 6000 }));
  const hit = rows?.[0];
  const place = hit && geo.inTunisia(+hit.lat, +hit.lon)
    ? { label: String(hit.name || hit.display_name).split(',')[0], lat: +hit.lat, lng: +hit.lon, source: 'osm',
        governorate: geo.nearestCity(+hit.lat, +hit.lon)?.governorate ?? null }
    : null;
  geoCache.set(key, place);
  return place;
}

/** Coordonnées d'un cabinet : adresse précise si possible, sinon centre de la ville. */
async function locateAddress({ address, city, governorate }) {
  if (address) {
    try {
      const p = await searchPlaceExact(`${address}, ${city}, Tunisie`);
      if (p) return { latitude: p.lat, longitude: p.lng, location_precise: true };
    } catch { /* service indisponible : repli sur le centre-ville */ }
  }
  const c = geo.centerOf(city, governorate);
  return c ? { latitude: c.lat, longitude: c.lng, location_precise: false } : null;
}

async function searchPlaceExact(q) {
  const key = `exact:${geo.fold(q)}`;
  const cached = geoCache.get(key);
  if (cached !== undefined) return cached;
  const url = `${NOMINATIM}/search?format=jsonv2&countrycodes=tn&limit=1&q=${encodeURIComponent(q)}`;
  const rows = await throttled(() => fetchJson(url, { timeoutMs: 5000 }));
  const hit = rows?.[0];
  const place = hit && geo.inTunisia(+hit.lat, +hit.lon) && ['house', 'building', 'street', 'road', 'amenity', 'office', 'residential']
    .some((t) => String(hit.addresstype || hit.type).includes(t)) ? { lat: +hit.lat, lng: +hit.lon } : null;
  geoCache.set(key, place);
  return place;
}

const OSM_FILTERS = {
  pharmacy: ['["amenity"="pharmacy"]'],
  clinic: ['["amenity"="clinic"]'],
  hospital: ['["amenity"="hospital"]'],
  laboratory: ['["healthcare"="laboratory"]'],
  radiology: ['["healthcare"="radiology"]'],
  health_center: ['["healthcare"="centre"]'],
};

/** Lieux réels issus d'OpenStreetMap autour d'un point. Renvoie null si aucune instance n'a répondu. */
async function osmFacilities(lat, lng, types, radiusKm) {
  const rLat = Math.round(lat * 100) / 100;           // ~1 km : mutualise le cache entre voisins
  const rLng = Math.round(lng * 100) / 100;
  const key = `${rLat},${rLng}:${[...types].sort().join(',')}:${radiusKm}`;
  const cached = osmCache.get(key);
  if (cached) return cached;
  const radius = Math.round(radiusKm * 1000);
  const parts = types.flatMap((t) => (OSM_FILTERS[t] ?? []).flatMap((f) =>
    ['node', 'way'].map((kind) => `${kind}${f}(around:${radius},${rLat},${rLng});`)));
  if (!parts.length) return [];
  const query = `[out:json][timeout:20];(${parts.join('')});out center tags 200;`;
  let data = null;
  for (let i = 0; i < OVERPASS.length && !data; i++) {
    const idx = (preferred + i) % OVERPASS.length;
    try {
      data = await fetchJson(OVERPASS[idx], {
        method: 'POST', timeoutMs: 22000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: 'data=' + encodeURIComponent(query),
      });
      preferred = idx;
    } catch (err) {
      console.warn(`[osm] ${new URL(OVERPASS[idx]).hostname} indisponible :`, err.message);
    }
  }
  if (!data) return null;
  {
    const out = (data.elements ?? []).map((e) => {
      const t = e.tags ?? {};
      const la = e.lat ?? e.center?.lat; const lo = e.lon ?? e.center?.lon;
      const type = t.amenity === 'pharmacy' ? 'pharmacy' : t.amenity === 'hospital' ? 'hospital' : t.amenity === 'clinic' ? 'clinic'
        : t.healthcare === 'laboratory' ? 'laboratory' : t.healthcare === 'radiology' ? 'radiology' : 'health_center';
      const name = t.name || t['name:fr'] || t['name:ar'];
      if (!name || la == null || lo == null) return null;
      return {
        id: `osm-${e.type}-${e.id}`, source: 'osm', type, name, name_ar: t['name:ar'] ?? null,
        address: [t['addr:housenumber'], t['addr:street'], t['addr:city'] || t['addr:town'] || t['addr:suburb']].filter(Boolean).join(', ') || null,
        phone: t.phone || t['contact:phone'] || null, website: t.website || t['contact:website'] || null,
        opening_hours: t.opening_hours || null, open_24h: t.opening_hours === '24/7',
        has_emergency: t.emergency === 'yes', latitude: la, longitude: lo,
        osm_url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      };
    }).filter(Boolean);
    osmCache.set(key, out);
    return out;
  }
}

module.exports = { searchPlace, locateAddress, osmFacilities };
