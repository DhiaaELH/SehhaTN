/** Repères géographiques de la Tunisie : gouvernorats et principales villes (coordonnées approximatives
 *  du centre-ville). Sert de solution de repli hors ligne pour le géocodage et à générer les données de démo. */

const GOVERNORATES = [
  { name: 'Tunis', ar: 'تونس', phone: '71', cities: [
    ['Tunis', 'تونس', 36.8008, 10.1800, 3], ['La Marsa', 'المرسى', 36.8782, 10.3247, 2], ['Le Bardo', 'باردو', 36.8092, 10.1406, 1],
    ['Carthage', 'قرطاج', 36.8528, 10.3233, 1], ['El Menzah', 'المنزه', 36.8400, 10.1730, 2], ['Les Berges du Lac', 'ضفاف البحيرة', 36.8380, 10.2410, 2],
    ['La Goulette', 'حلق الوادي', 36.8183, 10.3050, 1] ] },
  { name: 'Ariana', ar: 'أريانة', phone: '70', cities: [
    ['Ariana', 'أريانة', 36.8625, 10.1956, 2], ['La Soukra', 'سكرة', 36.8750, 10.2500, 1], ['Ennasr', 'النصر', 36.8580, 10.1640, 2] ] },
  { name: 'Ben Arous', ar: 'بن عروس', phone: '79', cities: [
    ['Ben Arous', 'بن عروس', 36.7531, 10.2189, 2], ['Hammam Lif', 'حمام الأنف', 36.7300, 10.3400, 1], ['Ezzahra', 'الزهراء', 36.7436, 10.3083, 1],
    ['El Mourouj', 'المروج', 36.7300, 10.2100, 1], ['Mégrine', 'مقرين', 36.7686, 10.2339, 1] ] },
  { name: 'Manouba', ar: 'منوبة', phone: '71', cities: [
    ['Manouba', 'منوبة', 36.8101, 10.0956, 1], ['Den Den', 'الدندان', 36.8031, 10.1131, 1], ['Oued Ellil', 'وادي الليل', 36.8340, 10.0420, 1] ] },
  { name: 'Nabeul', ar: 'نابل', phone: '72', cities: [
    ['Nabeul', 'نابل', 36.4561, 10.7376, 2], ['Hammamet', 'الحمامات', 36.4000, 10.6167, 2], ['Kélibia', 'قليبية', 36.8475, 11.0939, 1],
    ['Korba', 'قربة', 36.5786, 10.8586, 1], ['Grombalia', 'قرمبالية', 36.6000, 10.5000, 1] ] },
  { name: 'Zaghouan', ar: 'زغوان', phone: '72', cities: [
    ['Zaghouan', 'زغوان', 36.4029, 10.1429, 1], ['El Fahs', 'الفحص', 36.3744, 9.9064, 1] ] },
  { name: 'Bizerte', ar: 'بنزرت', phone: '72', cities: [
    ['Bizerte', 'بنزرت', 37.2744, 9.8739, 2], ['Menzel Bourguiba', 'منزل بورقيبة', 37.1536, 9.7856, 1], ['Mateur', 'ماطر', 37.0400, 9.6650, 1] ] },
  { name: 'Béja', ar: 'باجة', phone: '78', cities: [
    ['Béja', 'باجة', 36.7256, 9.1817, 1], ['Medjez el-Bab', 'مجاز الباب', 36.6500, 9.6100, 1] ] },
  { name: 'Jendouba', ar: 'جندوبة', phone: '78', cities: [
    ['Jendouba', 'جندوبة', 36.5011, 8.7802, 1], ['Tabarka', 'طبرقة', 36.9544, 8.7581, 1], ['Aïn Draham', 'عين دراهم', 36.7792, 8.6872, 1] ] },
  { name: 'Le Kef', ar: 'الكاف', phone: '78', cities: [
    ['Le Kef', 'الكاف', 36.1742, 8.7049, 1], ['Dahmani', 'الدهماني', 35.9450, 8.8300, 1] ] },
  { name: 'Siliana', ar: 'سليانة', phone: '78', cities: [
    ['Siliana', 'سليانة', 36.0849, 9.3708, 1], ['Makthar', 'مكثر', 35.8600, 9.2050, 1] ] },
  { name: 'Sousse', ar: 'سوسة', phone: '73', cities: [
    ['Sousse', 'سوسة', 35.8256, 10.6084, 3], ['Hammam Sousse', 'حمام سوسة', 35.8600, 10.6000, 1], ['Msaken', 'مساكن', 35.7300, 10.5800, 1],
    ['Akouda', 'أكودة', 35.8700, 10.5700, 1], ['Kalâa Kebira', 'القلعة الكبرى', 35.8700, 10.5300, 1] ] },
  { name: 'Monastir', ar: 'المنستير', phone: '73', cities: [
    ['Monastir', 'المنستير', 35.7643, 10.8113, 2], ['Moknine', 'المكنين', 35.6300, 10.9000, 1], ['Ksar Hellal', 'قصر هلال', 35.6400, 10.8900, 1],
    ['Jemmal', 'جمال', 35.6200, 10.7600, 1] ] },
  { name: 'Mahdia', ar: 'المهدية', phone: '73', cities: [
    ['Mahdia', 'المهدية', 35.5047, 11.0622, 1], ['El Jem', 'الجم', 35.2967, 10.7128, 1], ['Ksour Essef', 'قصور الساف', 35.4180, 10.9940, 1] ] },
  { name: 'Sfax', ar: 'صفاقس', phone: '74', cities: [
    ['Sfax', 'صفاقس', 34.7406, 10.7603, 3], ['Sakiet Ezzit', 'ساقية الزيت', 34.8000, 10.7700, 1], ['Mahrès', 'المحرس', 34.5300, 10.5000, 1],
    ['Jebiniana', 'جبنيانة', 35.0350, 10.9080, 1] ] },
  { name: 'Kairouan', ar: 'القيروان', phone: '77', cities: [
    ['Kairouan', 'القيروان', 35.6781, 10.0963, 2], ['Haffouz', 'حفوز', 35.6300, 9.6700, 1] ] },
  { name: 'Kasserine', ar: 'القصرين', phone: '77', cities: [
    ['Kasserine', 'القصرين', 35.1676, 8.8365, 1], ['Sbeïtla', 'سبيطلة', 35.2300, 9.1300, 1] ] },
  { name: 'Sidi Bouzid', ar: 'سيدي بوزيد', phone: '76', cities: [
    ['Sidi Bouzid', 'سيدي بوزيد', 35.0382, 9.4849, 1], ['Regueb', 'الرقاب', 34.8600, 9.7900, 1] ] },
  { name: 'Gabès', ar: 'قابس', phone: '75', cities: [
    ['Gabès', 'قابس', 33.8815, 10.0982, 2], ['El Hamma', 'الحامة', 33.8900, 9.8000, 1], ['Mareth', 'مارث', 33.6200, 10.3000, 1] ] },
  { name: 'Médenine', ar: 'مدنين', phone: '75', cities: [
    ['Médenine', 'مدنين', 33.3540, 10.5055, 1], ['Djerba Houmt Souk', 'جربة حومة السوق', 33.8756, 10.8575, 2], ['Zarzis', 'جرجيس', 33.5040, 11.1120, 1],
    ['Ben Gardane', 'بن قردان', 33.1400, 11.2200, 1], ['Djerba Midoun', 'جربة ميدون', 33.8080, 10.9920, 1] ] },
  { name: 'Tataouine', ar: 'تطاوين', phone: '75', cities: [
    ['Tataouine', 'تطاوين', 32.9297, 10.4518, 1] ] },
  { name: 'Gafsa', ar: 'قفصة', phone: '76', cities: [
    ['Gafsa', 'قفصة', 34.4250, 8.7842, 1], ['Metlaoui', 'المتلوي', 34.3200, 8.4000, 1] ] },
  { name: 'Tozeur', ar: 'توزر', phone: '76', cities: [
    ['Tozeur', 'توزر', 33.9197, 8.1335, 1], ['Nefta', 'نفطة', 33.8700, 7.8800, 1] ] },
  { name: 'Kébili', ar: 'قبلي', phone: '75', cities: [
    ['Kébili', 'قبلي', 33.7044, 8.9690, 1], ['Douz', 'دوز', 33.4600, 9.0200, 1] ] },
];

/** Liste à plat : { name, ar, governorate, lat, lng, weight } (weight = taille relative pour les données de démo). */
const CITIES = GOVERNORATES.flatMap((g) => g.cities.map(([name, ar, lat, lng, weight]) => ({
  name, ar, governorate: g.name, lat, lng, weight,
})));

/** Bornes larges du pays : sert à refuser des coordonnées manifestement hors Tunisie. */
const BOUNDS = { minLat: 30.2, maxLat: 37.6, minLng: 7.4, maxLng: 11.7 };
const inTunisia = (lat, lng) =>
  lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;

/** Minuscules, sans accents ni tirets : « Kalâa-Kébira » → « kalaa kebira ». */
function fold(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[-'’]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Retrouve une ville connue (ou à défaut le chef-lieu d'un gouvernorat) à partir d'un texte libre. */
function findPlace(text) {
  const q = fold(text);
  if (!q) return null;
  const city = CITIES.find((c) => fold(c.name) === q || c.ar === text.trim())
    ?? CITIES.find((c) => q.includes(fold(c.name)) && fold(c.name).length >= 4);
  if (city) return { label: city.name, label_ar: city.ar, governorate: city.governorate, lat: city.lat, lng: city.lng, source: 'local' };
  const gov = GOVERNORATES.find((g) => fold(g.name) === q || g.ar === text.trim());
  if (gov) {
    const [name, ar, lat, lng] = gov.cities[0];
    return { label: name, label_ar: ar, governorate: gov.name, lat, lng, source: 'local' };
  }
  return null;
}

/** Centre approximatif d'une ville (ou du chef-lieu du gouvernorat). */
function centerOf(city, governorate) {
  const c = CITIES.find((x) => fold(x.name) === fold(city))
    ?? CITIES.find((x) => fold(x.governorate) === fold(governorate));
  return c ? { lat: c.lat, lng: c.lng } : null;
}

/** Distance en km entre deux points (formule de haversine). */
function distanceKm(lat1, lng1, lat2, lng2) {
  const r = (x) => (x * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2
    + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Gouvernorat le plus proche d'un point (via la ville connue la plus proche). */
function nearestCity(lat, lng) {
  let best = null;
  for (const c of CITIES) {
    const d = distanceKm(lat, lng, c.lat, c.lng);
    if (!best || d < best.d) best = { d, c };
  }
  return best && { ...best.c, distance_km: best.d };
}

module.exports = { GOVERNORATES, CITIES, BOUNDS, inTunisia, fold, findPlace, centerOf, distanceKm, nearestCity };
