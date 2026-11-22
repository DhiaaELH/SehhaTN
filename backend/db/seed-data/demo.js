/** Générateur déterministe des données de démonstration : médecins, lieux de soins, patients fictifs et avis.
 *  Même graine => mêmes données : on peut relancer le seed sans créer de doublons (clé `seed_key`).
 *  Toutes les lignes produites ici sont marquées `is_demo = true`. */
const { CITIES, GOVERNORATES } = require('../../lib/tunisia-geo');
const SPECIALTIES = require('./specialties');

function rng(seed) {                       // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MALE = ['Mohamed', 'Ahmed', 'Ali', 'Youssef', 'Karim', 'Sami', 'Hichem', 'Nabil', 'Walid', 'Mehdi', 'Anis', 'Slim', 'Fares',
  'Amine', 'Bilel', 'Riadh', 'Hatem', 'Lotfi', 'Moez', 'Skander', 'Aymen', 'Oussama', 'Habib', 'Khaled', 'Zied', 'Wassim', 'Imed', 'Seif'];
const FEMALE = ['Amira', 'Salma', 'Leila', 'Nadia', 'Rim', 'Ines', 'Sonia', 'Mariem', 'Asma', 'Olfa', 'Hela', 'Sarra', 'Yasmine',
  'Emna', 'Fatma', 'Rania', 'Wafa', 'Nour', 'Sihem', 'Hajer', 'Imen', 'Khadija', 'Meriem', 'Dorra', 'Ameni', 'Molka', 'Chaima', 'Raoudha'];
const LAST = ['Ben Salah', 'Trabelsi', 'Gharbi', 'Jaziri', 'Mansouri', 'Hammami', 'Bouazizi', 'Chaabane', 'Ayari', 'Belhadj', 'Mejri',
  'Sassi', 'Khelifi', 'Dridi', 'Zouari', 'Masmoudi', 'Ben Ammar', 'Karoui', 'Ghannouchi', 'Ferchichi', 'Jlassi', 'Riahi', 'Bouslama',
  'Ben Youssef', 'Mahjoub', 'Chebbi', 'Haddad', 'Kammoun', 'Ellouze', 'Fourati', 'Sfaxi', 'Baccouche', 'Zghal', 'Hamdi', 'Abidi',
  'Ouertani', 'Tlili', 'Mzoughi', 'Bouaziz', 'Saidi', 'Laabidi', 'Toumi', 'Ben Romdhane', 'Nasri', 'Rekik', 'Snoussi', 'Ben Hassine'];
const STREETS = ['Avenue Habib Bourguiba', 'Avenue de la Liberté', 'Rue Ibn Khaldoun', 'Avenue Farhat Hached', 'Rue Mongi Slim',
  'Avenue Hédi Chaker', 'Rue Ali Belhouane', 'Avenue de la République', 'Rue Abou El Kacem Chebbi', 'Avenue Taïeb Mhiri',
  'Rue de Palestine', 'Avenue Mohamed V', 'Rue Ibn Sina', 'Avenue de l’Environnement', 'Rue du 2 Mars 1934', 'Avenue Bourguiba',
  'Rue Tahar Haddad', 'Avenue Ali Belhouane', 'Rue de Marseille', 'Avenue Ibn Rachiq'];
const BUILDINGS = ['Immeuble Les Jasmins', 'Résidence El Amen', 'Immeuble Errahma', 'Centre médical Ennour', 'Immeuble El Mouradi',
  'Résidence Les Palmiers', 'Centre médical Ibn Rochd', 'Immeuble Carthage', 'Espace médical El Kods', 'Immeuble Yasmine'];

// Nombre de médecins de démo par spécialité, frais de consultation (DT), formation, actes.
const PLAN = {
  generaliste:        { n: 14, fee: [30, 45], deg: 'Doctorat en médecine', svc: ['Consultation générale', 'Certificats médicaux', 'Suivi des maladies chroniques', 'Vaccination', 'Bilan de santé', 'Petite chirurgie'] },
  dentiste:           { n: 10, fee: [40, 60], deg: 'Doctorat en médecine dentaire', svc: ['Soins des caries', 'Détartrage', 'Blanchiment', 'Prothèses dentaires', 'Implants', 'Orthodontie', 'Extraction'] },
  pediatre:           { n: 8,  fee: [50, 70], deg: 'Diplôme de spécialité en pédiatrie', svc: ['Suivi du nourrisson', 'Vaccination', 'Croissance et développement', 'Asthme de l’enfant', 'Allergies de l’enfant', 'Certificats scolaires'] },
  gynecologue:        { n: 8,  fee: [60, 80], deg: 'Diplôme de spécialité en gynécologie-obstétrique', svc: ['Suivi de grossesse', 'Échographie obstétricale', 'Contraception', 'Frottis cervico-vaginal', 'Ménopause', 'Infertilité'] },
  cardiologue:        { n: 6,  fee: [70, 90], deg: 'Diplôme de spécialité en cardiologie', svc: ['Électrocardiogramme (ECG)', 'Échographie cardiaque', 'Holter tensionnel', 'Test d’effort', 'Suivi de l’hypertension', 'Bilan cardiovasculaire'] },
  dermatologue:       { n: 6,  fee: [60, 80], deg: 'Diplôme de spécialité en dermatologie', svc: ['Acné', 'Eczéma et psoriasis', 'Dépistage des grains de beauté', 'Dermatoscopie', 'Chute de cheveux', 'Laser dermatologique'] },
  ophtalmologue:      { n: 5,  fee: [60, 80], deg: 'Diplôme de spécialité en ophtalmologie', svc: ['Examen de la vue', 'Fond d’œil', 'Dépistage du glaucome', 'Chirurgie de la cataracte', 'Lentilles de contact', 'Ophtalmologie pédiatrique'] },
  orl:                { n: 5,  fee: [60, 80], deg: 'Diplôme de spécialité en ORL', svc: ['Audiogramme', 'Sinusites', 'Otites', 'Vertiges', 'Ronflement et apnée', 'Endoscopie nasale'] },
  orthopediste:       { n: 4,  fee: [70, 90], deg: 'Diplôme de spécialité en chirurgie orthopédique', svc: ['Traumatologie du sport', 'Chirurgie du genou', 'Chirurgie de l’épaule', 'Fractures', 'Infiltrations', 'Prothèse de hanche'] },
  rhumatologue:       { n: 3,  fee: [60, 80], deg: 'Diplôme de spécialité en rhumatologie', svc: ['Arthrose', 'Polyarthrite', 'Ostéoporose', 'Lombalgies', 'Infiltrations', 'Ostéodensitométrie'] },
  neurologue:         { n: 3,  fee: [70, 90], deg: 'Diplôme de spécialité en neurologie', svc: ['Migraines', 'Épilepsie', 'Électroencéphalogramme (EEG)', 'Électromyogramme (EMG)', 'Troubles de la mémoire', 'Sclérose en plaques'] },
  psychiatre:         { n: 3,  fee: [60, 80], deg: 'Diplôme de spécialité en psychiatrie', svc: ['Dépression', 'Troubles anxieux', 'Troubles du sommeil', 'Addictions', 'Psychiatrie de l’adolescent', 'Psychothérapie'] },
  psychologue:        { n: 3,  fee: [50, 70], deg: 'Master en psychologie clinique', svc: ['Thérapie cognitive et comportementale', 'Gestion du stress', 'Thérapie de couple', 'Accompagnement du deuil', 'Bilan psychologique de l’enfant'], title: '' },
  endocrinologue:     { n: 3,  fee: [60, 80], deg: 'Diplôme de spécialité en endocrinologie', svc: ['Diabète', 'Thyroïde', 'Obésité', 'Troubles hormonaux', 'Éducation thérapeutique'] },
  'gastro-enterologue': { n: 3, fee: [70, 90], deg: 'Diplôme de spécialité en gastro-entérologie', svc: ['Fibroscopie', 'Coloscopie', 'Reflux gastro-œsophagien', 'Maladies du foie', 'Côlon irritable'] },
  pneumologue:        { n: 3,  fee: [60, 80], deg: 'Diplôme de spécialité en pneumologie', svc: ['Asthme', 'Exploration fonctionnelle respiratoire', 'BPCO', 'Apnée du sommeil', 'Sevrage tabagique'] },
  urologue:           { n: 3,  fee: [70, 90], deg: 'Diplôme de spécialité en urologie', svc: ['Calculs rénaux', 'Prostate', 'Infections urinaires', 'Incontinence', 'Andrologie'] },
  nephrologue:        { n: 2,  fee: [60, 80], deg: 'Diplôme de spécialité en néphrologie', svc: ['Insuffisance rénale', 'Hypertension artérielle', 'Suivi de dialyse', 'Calculs rénaux'] },
  allergologue:       { n: 2,  fee: [60, 80], deg: 'Diplôme de spécialité en allergologie', svc: ['Tests cutanés', 'Allergies alimentaires', 'Rhinite allergique', 'Désensibilisation'] },
  nutritionniste:     { n: 2,  fee: [40, 60], deg: 'Licence en nutrition humaine', svc: ['Rééquilibrage alimentaire', 'Perte de poids', 'Nutrition du diabétique', 'Nutrition sportive'], title: '' },
  kinesitherapeute:   { n: 3,  fee: [25, 35], deg: 'Licence en kinésithérapie', svc: ['Rééducation post-opératoire', 'Kinésithérapie respiratoire', 'Lombalgies', 'Rééducation du sportif', 'Drainage lymphatique'], title: '' },
};
const SCHOOLS = ['Faculté de médecine de Tunis', 'Faculté de médecine de Sousse', 'Faculté de médecine de Monastir', 'Faculté de médecine de Sfax'];
const OTHER_SCHOOL = {
  dentiste: 'Faculté de médecine dentaire de Monastir', psychologue: 'Faculté des sciences humaines et sociales de Tunis',
  nutritionniste: 'École supérieure des sciences et techniques de la santé de Tunis', kinesitherapeute: 'École supérieure des sciences et techniques de la santé de Tunis',
};
const EXTRA_CERT = ['Diplôme universitaire d’échographie', 'Certificat en éducation thérapeutique', 'Diplôme interuniversitaire (Paris)',
  'Formation en médecine du sport', 'Attestation en urgences médicales', 'Diplôme universitaire de nutrition clinique'];

const FOCUS = {
  generaliste: 'assure le suivi des familles, de l’enfant à la personne âgée, et coordonne le parcours de soins avec les spécialistes',
  dentiste: 'prend en charge les soins dentaires de toute la famille, avec une attention particulière à la prévention et au confort des patients anxieux',
  pediatre: 'accompagne les enfants de la naissance à l’adolescence : croissance, vaccins, maladies courantes et conseils aux parents',
  gynecologue: 'suit les femmes à chaque étape de la vie : contraception, grossesse, ménopause et dépistage',
  cardiologue: 'prend en charge l’hypertension, les troubles du rythme et la prévention cardiovasculaire',
  dermatologue: 'traite les maladies de la peau, des cheveux et des ongles, et assure le dépistage des cancers cutanés',
  ophtalmologue: 'réalise les bilans visuels complets et suit les maladies de l’œil comme le glaucome et la cataracte',
  orl: 'prend en charge les troubles de l’oreille, du nez et de la gorge chez l’adulte et l’enfant',
  orthopediste: 'traite les traumatismes et les maladies des os et des articulations, du sportif à la personne âgée',
  rhumatologue: 'suit les douleurs articulaires et du dos, l’arthrose et les maladies inflammatoires',
  neurologue: 'prend en charge les migraines, l’épilepsie et les maladies du système nerveux',
  psychiatre: 'accompagne les patients souffrant d’anxiété, de dépression ou de troubles du sommeil, dans le respect et la confidentialité',
  psychologue: 'propose un espace d’écoute bienveillant pour traverser les périodes de stress, de deuil ou de doute',
  endocrinologue: 'suit le diabète, les maladies de la thyroïde et les troubles hormonaux, avec une approche d’éducation thérapeutique',
  'gastro-enterologue': 'prend en charge les troubles digestifs et réalise les examens endoscopiques',
  pneumologue: 'suit l’asthme, les maladies respiratoires chroniques et accompagne le sevrage tabagique',
  urologue: 'traite les maladies des voies urinaires et de la prostate',
  nephrologue: 'suit les maladies rénales et l’hypertension, et accompagne les patients dialysés',
  allergologue: 'réalise les bilans allergologiques et propose des traitements de désensibilisation',
  nutritionniste: 'construit avec chaque patient un plan alimentaire réaliste et durable',
  kinesitherapeute: 'accompagne la rééducation après une blessure ou une opération, et la prise en charge des douleurs du dos',
};
const APPROACH = [
  'Ses consultations laissent du temps pour expliquer chaque étape et répondre aux questions.',
  'Le cabinet est accessible aux personnes à mobilité réduite.',
  'Les rendez-vous sont respectés à l’heure, avec un suivi par téléphone si nécessaire.',
  'Une attention particulière est portée à la prévention et à l’éducation à la santé.',
];
const ENGLISH = 'Les consultations peuvent se dérouler en arabe, en français ou en anglais.';

function bioFor(r, who, slug, languages) {
  const pool = languages.includes('Anglais') ? [...APPROACH, ENGLISH] : APPROACH;
  const first = pick(r, pool);
  const second = r() < 0.5 ? pick(r, pool.filter((x) => x !== first)) : '';
  return `${who} ${FOCUS[slug]}. ${first} ${second}`.trim();
}

const SCHEDULES = [
  { text: 'Lun–Ven 09:00–13:00 · 15:00–18:00 · Sam 09:00–13:00', ranges: [[0, 4, '09:00', '13:00'], [0, 4, '15:00', '18:00'], [5, 5, '09:00', '13:00']] },
  { text: 'Lun–Ven 08:30–13:00 · 14:30–17:30', ranges: [[0, 4, '08:30', '13:00'], [0, 4, '14:30', '17:30']] },
  { text: 'Lun–Sam 09:00–14:00', ranges: [[0, 5, '09:00', '14:00']] },
  { text: 'Lun–Ven 14:00–19:00 · Sam 09:00–12:00', ranges: [[0, 4, '14:00', '19:00'], [5, 5, '09:00', '12:00']] },
  { text: 'Lun–Jeu 09:00–12:30 · 15:00–18:30 · Ven 09:00–12:30', ranges: [[0, 3, '09:00', '12:30'], [0, 3, '15:00', '18:30'], [4, 4, '09:00', '12:30']] },
];

function pick(r, list) { return list[Math.floor(r() * list.length)]; }
function int(r, a, b) { return a + Math.floor(r() * (b - a + 1)); }
function weightedCity(r) {
  const total = CITIES.reduce((s, c) => s + c.weight, 0);
  let x = r() * total;
  for (const c of CITIES) { x -= c.weight; if (x < 0) return c; }
  return CITIES[0];
}
function jitter(r, v, amount = 0.006) { return Math.round((v + (r() - 0.5) * 2 * amount) * 1e6) / 1e6; }
function phoneFor(r, governorate) {
  const prefix = GOVERNORATES.find((g) => g.name === governorate)?.phone ?? '71';
  return `+216 ${prefix} ${int(r, 100, 999)} ${int(r, 100, 999)}`;
}
function address(r) { return `${int(r, 3, 120)}, ${pick(r, STREETS)}${r() < 0.45 ? `, ${pick(r, BUILDINGS)}` : ''}`; }

function doctors() {
  const r = rng(20261122);
  const usedNames = new Set();
  const usedPhotos = { f: new Set(), m: new Set() };
  const out = [];
  for (const [slug, plan] of Object.entries(PLAN)) {
    const spec = SPECIALTIES.find((s) => s.slug === slug);
    for (let i = 0; i < plan.n; i++) {
      const gender = r() < 0.52 ? 'f' : 'm';
      let first, last;
      do { first = pick(r, gender === 'f' ? FEMALE : MALE); last = pick(r, LAST); } while (usedNames.has(first + last));
      usedNames.add(first + last);
      const city = weightedCity(r);
      const years = int(r, 3, 32);
      const gradYear = 2026 - years - int(r, 1, 4);
      const title = plan.title ?? 'Dr';
      const name = `${title ? title + ' ' : ''}${first} ${last}`;
      const schedule = pick(r, SCHEDULES);
      let photo = null;
      if (r() < 0.9) {
        let n; do { n = int(r, 1, 95); } while (usedPhotos[gender].has(n));
        usedPhotos[gender].add(n);
        photo = `https://randomuser.me/api/portraits/${gender === 'f' ? 'women' : 'men'}/${n}.jpg`;
      }
      const school = OTHER_SCHOOL[slug] ?? pick(r, SCHOOLS);
      const education = [`${plan.deg} — ${school} (${gradYear})`];
      if (r() < 0.5) education.push(`${pick(r, EXTRA_CERT)} (${gradYear + int(r, 2, 6)})`);
      const languages = ['Arabe', 'Français', ...(r() < 0.35 ? ['Anglais'] : [])];
      const services = [...plan.svc].sort(() => r() - 0.5).slice(0, int(r, 3, Math.min(5, plan.svc.length)));
      const who = name;
      out.push({
        seed_key: `demo-doctor-${slug}-${i + 1}`,
        name, title, gender, specialty: spec.name_fr,
        governorate: city.governorate, city: city.name,
        address: `${address(r)}, ${city.name}`,
        phone: phoneFor(r, city.governorate),
        latitude: jitter(r, city.lat), longitude: jitter(r, city.lng),
        schedule: schedule.text, ranges: schedule.ranges,
        slot_minutes: pick(r, slug === 'generaliste' || slug === 'dentiste' ? [20, 30] : [30, 30, 45]),
        bio: bioFor(r, who, slug, languages),
        languages, years_experience: years,
        consultation_fee: Math.round(int(r, plan.fee[0], plan.fee[1]) / 5) * 5,
        accepts_cnam: slug === 'psychologue' || slug === 'nutritionniste' ? false : r() < 0.75,
        verified: r() < 0.8,
        teleconsultation: ['psychiatre', 'psychologue', 'generaliste', 'endocrinologue', 'nutritionniste', 'dermatologue'].includes(slug) && r() < 0.5,
        photo_url: photo, education, services,
      });
    }
  }
  return out;
}

const PHARMA_NAMES = ['Ennour', 'El Amal', 'Essalem', 'Ibn Rochd', 'Pasteur', 'Avicenne', 'Centrale', 'du Marché', 'de la Gare', 'El Yasmine',
  'Errahma', 'Ech-Chifa', 'de la Médina', 'du Lac', 'des Palmiers', 'El Hana', 'Ezzouhour', 'des Orangers', 'de l’Avenue', 'El Wafa', 'Ibn Sina', 'du Port'];
const CLINIC_NAMES = ['Les Orangers', 'El Wafa', 'Ennasr Santé', 'Les Berges', 'Essalama', 'Ibn Zohr', 'La Corniche', 'El Farabi', 'Les Jardins',
  'Méditerranée', 'Errazi', 'El Kods', 'Les Oliviers du Sahel', 'Dar Essaha', 'El Manar Santé'];
const PHOTOS = {
  pharmacy: ['1765031092161-a9ebe556117e', '1471864190281-a93a3070b6de', '1587854692152-cbe660dbde88', '1607619056574-7b8d3ee536b2', '1628771065518-0d82f1938462'],
  clinic: ['1519494026892-80bbd2d6fd0d', '1550831107-1553da8c8464', '1516549655169-df83a0774514'],
  hospital: ['1538108149393-fbbd81895907', '1519494026892-80bbd2d6fd0d', '1504439468489-c8920d796a29'],
  laboratory: ['1579154204601-01588f351e67', '1602052577122-f73b9710adba', '1606206873764-fd15e242df52'],
  radiology: ['1530497610245-94d3c16cda28', '1581595219315-a187dd40c322', '1666214280557-f1b5022eb634'],
  health_center: ['1631217868264-e5b90bb7e133', '1550831107-1553da8c8464'],
};
const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=900&q=80`;
const SERVICES = {
  pharmacy: ['Conseil pharmaceutique', 'Préparations magistrales', 'Matériel médical', 'Produits pour bébé', 'Dermocosmétique', 'Mesure de la tension', 'Test de glycémie'],
  clinic: ['Urgences 24h/24', 'Maternité', 'Chirurgie générale', 'Imagerie médicale', 'Laboratoire', 'Réanimation', 'Hémodialyse', 'Cardiologie interventionnelle'],
  hospital: ['Urgences 24h/24', 'Maternité', 'Pédiatrie', 'Chirurgie', 'Médecine interne', 'Imagerie', 'Laboratoire', 'Consultations externes'],
  laboratory: ['Analyses de sang', 'Bilan hormonal', 'Sérologies', 'Prélèvement à domicile', 'Résultats en ligne', 'Bactériologie'],
  radiology: ['Radiographie', 'Échographie', 'Scanner', 'IRM', 'Mammographie', 'Panoramique dentaire'],
  health_center: ['Consultations de médecine générale', 'Vaccination', 'Suivi de grossesse', 'Planning familial', 'Soins infirmiers', 'Suivi des maladies chroniques'],
};
const HOURS = {
  pharmacy: 'Lun–Sam 08:00–20:00', clinic: 'Ouvert 24 h/24 · consultations Lun–Sam 08:00–19:00', hospital: 'Urgences 24 h/24 · consultations Lun–Ven 08:00–14:00',
  laboratory: 'Lun–Sam 07:00–18:00', radiology: 'Lun–Ven 08:00–19:00 · Sam 08:00–13:00', health_center: 'Lun–Sam 08:00–17:00',
};

function facilities() {
  const r = rng(7300);
  const out = [];
  const used = new Set();
  const add = (type, city, name, extra = {}) => {
    const key = `demo-${type}-${city.name}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    if (used.has(key)) return;
    used.add(key);
    const services = [...SERVICES[type]].sort(() => r() - 0.5).slice(0, int(r, 3, 5));
    out.push({
      seed_key: key, type, name, governorate: city.governorate, city: city.name,
      address: `${address(r)}, ${city.name}`, phone: phoneFor(r, city.governorate),
      latitude: jitter(r, city.lat, 0.012), longitude: jitter(r, city.lng, 0.012),
      opening_hours: HOURS[type], services, accepts_cnam: type === 'pharmacy' ? true : r() < 0.7,
      photo_url: img(pick(r, PHOTOS[type])), open_24h: false, has_emergency: false, is_public: false, ...extra,
    });
  };
  for (const g of GOVERNORATES) {
    const capital = CITIES.find((c) => c.name === g.cities[0][0]);
    // Un hôpital public avec urgences par gouvernorat, et un CHU dans les grandes villes
    add('hospital', capital, `Centre hospitalier de ${capital.name}`, { is_public: true, has_emergency: true, open_24h: true,
      accepts_cnam: true, opening_hours: HOURS.hospital,
      description: `Établissement public de référence du gouvernorat de ${g.name}, avec un service d’urgences ouvert jour et nuit.` });
    // Une pharmacie de nuit par gouvernorat
    add('pharmacy', capital, `Pharmacie de nuit ${pick(r, PHARMA_NAMES)}`, { open_24h: true, opening_hours: 'Ouvert 24 h/24 et 7 j/7',
      description: 'Pharmacie de garde ouverte la nuit, les dimanches et jours fériés.' });
  }
  for (const city of CITIES) {
    const w = city.weight;
    for (let i = 0; i < 1 + w; i++) {
      const own = r() < 0.5;
      add('pharmacy', city, own ? `Pharmacie ${pick(r, LAST)}` : `Pharmacie ${pick(r, PHARMA_NAMES)}`,
        { description: 'Pharmacie d’officine : délivrance des ordonnances, conseils et produits de parapharmacie.' });
    }
    add('health_center', city, `Centre de santé de base ${city.name}${w > 1 ? ' ' + pick(r, ['Centre', 'Nord', 'Sud', 'Médina']) : ''}`,
      { is_public: true, accepts_cnam: true, description: 'Structure publique de première ligne : consultations, vaccinations et suivi de proximité.' });
    if (w >= 1 && r() < 0.75) add('laboratory', city, `Laboratoire d’analyses médicales ${pick(r, LAST)}`,
      { description: 'Laboratoire de biologie médicale : prélèvements sans rendez-vous le matin.' });
    if (w >= 2) {
      add('clinic', city, `Clinique ${pick(r, CLINIC_NAMES)}`, { has_emergency: r() < 0.6, open_24h: true,
        description: 'Clinique pluridisciplinaire privée avec hospitalisation, bloc opératoire et consultations spécialisées.' });
      add('radiology', city, `Centre d’imagerie médicale ${pick(r, ['El Amen', 'Ibn Sina', 'Pasteur', 'Ennour', 'Les Jasmins', 'Carthage', 'El Menzah'])}`,
        { description: 'Imagerie médicale : radiographie, échographie, scanner et IRM sur rendez-vous.' });
      add('laboratory', city, `Laboratoire ${pick(r, ['Bio', 'Labo', 'Analyses'])} ${pick(r, LAST)}`,
        { description: 'Analyses de biologie médicale, résultats disponibles en ligne.' });
    }
    if (w >= 3) {
      add('clinic', city, `Polyclinique ${pick(r, CLINIC_NAMES)}`, { has_emergency: true, open_24h: true,
        description: 'Polyclinique avec service d’urgences, maternité et plateau technique complet.' });
      add('pharmacy', city, `Pharmacie de nuit ${pick(r, PHARMA_NAMES)}`, { open_24h: true, opening_hours: 'Ouvert 24 h/24 et 7 j/7',
        description: 'Pharmacie de garde ouverte la nuit, les dimanches et jours fériés.' });
    }
  }
  return out;
}

const REVIEW_TEXT = {
  5: ['Médecin très à l’écoute, qui prend le temps d’expliquer. Je recommande vivement.', 'Excellent accueil, ponctuel et très professionnel.',
    'Diagnostic précis et traitement efficace. Merci docteur !', 'Très rassurant avec mon enfant, une vraie pédagogie.',
    'Cabinet propre, secrétariat aimable et rendez-vous à l’heure.', 'طبيب ممتاز ويشرح كل شيء بوضوح. أنصح به بشدة.',
    'Je suis suivie depuis deux ans, toujours aussi satisfaite.', 'Très humain et compétent, on se sent en confiance.'],
  4: ['Bonne consultation, un peu d’attente mais le médecin est très compétent.', 'Médecin sérieux, explications claires.',
    'Très bien dans l’ensemble, cabinet facile à trouver.', 'استقبال جيد وطبيب كفء، الانتظار كان قليلاً طويلاً.',
    'Bon suivi, je recommande.'],
  3: ['Correct, mais l’attente était longue malgré le rendez-vous.', 'Consultation un peu rapide à mon goût.'],
  2: ['Retard important et peu d’explications.'],
};

function patients() {
  const r = rng(5150);
  const out = [];
  for (let i = 1; i <= 40; i++) {
    const f = r() < 0.5;
    out.push({ email: `patient${i}@demo.sehhatn.tn`, name: `${pick(r, f ? FEMALE : MALE)} ${pick(r, LAST)}` });
  }
  return out;
}

/** Avis : pour chaque médecin, 0 à 12 avis d'auteurs distincts, note plutôt positive. */
function reviews(doctorKeys, patientCount) {
  const r = rng(99);
  const out = [];
  for (const key of doctorKeys) {
    const n = r() < 0.12 ? 0 : int(r, 2, 12);
    const authors = [...Array(patientCount).keys()].sort(() => r() - 0.5).slice(0, n);
    for (const a of authors) {
      const x = r();
      const rating = x < 0.58 ? 5 : x < 0.88 ? 4 : x < 0.97 ? 3 : 2;
      out.push({
        doctor_key: key, patient_index: a, rating,
        comment: r() < 0.85 ? pick(r, REVIEW_TEXT[rating]) : null,
        days_ago: int(r, 3, 540),
      });
    }
  }
  return out;
}

module.exports = { doctors, facilities, patients, reviews, rng };
