/** Moteur d'orientation de SehhaTN — partagé par l'orientation guidée et par l'assistant (chat).
 *
 *  Méthode (inspirée des protocoles de tri téléphonique type NHS 111 / régulation SAMU) :
 *   1. Les signes d'alerte passent avant tout : un seul signe positif fixe le niveau (SAMU 190, urgences, ou consulter aujourd'hui).
 *   2. Niveau de départ = le plus élevé des niveaux de base des symptômes décrits.
 *   3. Modulateurs : intensité, durée, et vulnérabilité (nourrisson, personne âgée, grossesse) relèvent le niveau,
 *      sans jamais dépasser « consulter aujourd'hui » : seuls les signes d'alerte mènent aux urgences.
 *   4. Orientation vers une spécialité : celle du symptôme principal, ajustée selon l'âge et la grossesse ;
 *      plusieurs symptômes sans lien → médecin généraliste, qui coordonne.
 *   5. Pistes (jamais un diagnostic) : affections de la base de connaissances qui partagent le plus de symptômes.
 *
 *  Aucune donnée n'est envoyée à un service externe ; tout est déterministe et testable. */
const { LEVELS, CATEGORIES } = require('./care-levels');

const MAX_FLAG_QUESTIONS = 4;
const DURATIONS = ['hours', 'days', 'week', 'weeks'];      // < 24 h, 1–3 jours, 4–7 jours, > 1 semaine
const SEVERITIES = ['mild', 'moderate', 'severe'];
const AGE_GROUPS = ['infant', 'child', 'adult', 'senior'];

// Signes d'alerte qui n'ont de sens que dans un contexte précis.
const FLAG_CONTEXT = {
  fever_infant: (s) => s.age_group === 'infant',
  pregnancy_bleeding_pain: (s) => s.pregnant === true,
  reduced_fetal_movement: (s) => s.pregnant === true,
};

/* ------------------------------------------------------------------ texte */

/** Minuscules, sans accents ni signes diacritiques arabes, formes de lettres unifiées. */
function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')               // tashkil, tatweel
    .replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .replace(/[’'`]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NEGATIONS = new Set(['pas', 'sans', 'aucun', 'aucune', 'jamais', 'ni', 'non', 'لا', 'ليس', 'ليست', 'بدون', 'مافماش', 'ماعنديش',
  'معنديش', 'manich', 'ma3andich', 'mafamech', 'mefamech', 'no', 'not', 'without']);
const hasArabic = (s) => /[؀-ۿ]/.test(s);

/** Position de `pattern` dans `text` (déjà normalisés), ou -1. Le latin exige un début de mot. */
function findPattern(text, pattern) {
  if (!pattern) return -1;
  if (hasArabic(pattern)) return text.indexOf(pattern);
  let from = 0;
  for (;;) {
    const i = text.indexOf(pattern, from);
    if (i < 0) return -1;
    if (i === 0 || text[i - 1] === ' ') return i;
    from = i + 1;
  }
}

/** Le terme trouvé est-il nié juste avant (« pas de fièvre », « بدون حمى ») ? */
function negatedAt(text, index) {
  const before = text.slice(0, index).trim().split(' ').slice(-4);
  // « ma … ch » : négation darija (ma3andich, manich, mafamech…)
  return before.some((w) => NEGATIONS.has(w) || (/^ma[a-z0-9]{2,9}(ch|sh)$/.test(w)));
}

function mentions(text, patterns) {
  for (const p of patterns) {
    const np = normalize(p);
    const i = findPattern(text, np);
    if (i >= 0 && !negatedAt(text, i)) return true;
  }
  return false;
}

/** Informations utiles repérées dans une phrase libre. */
function extractFacts(kb, raw) {
  const text = normalize(raw);
  const facts = { symptoms: [], red_flags: [] };
  if (!text) return facts;

  for (const f of kb.redFlags) if (f.patterns.length && mentions(text, f.patterns)) facts.red_flags.push(f.key);
  for (const s of kb.symptoms) {
    if (mentions(text, [s.label_fr, s.label_ar, ...s.synonyms])) facts.symptoms.push(s.key);
  }

  // Âge
  const age = text.match(/(\d{1,3})\s*(ans|an|سنه|سنوات|عام|years|yo)\b/) ?? text.match(/(\d{1,3})\s*(ans|an)/);
  const months = text.match(/(\d{1,2})\s*(mois|اشهر|شهر|شهور)/);
  if (months && !age) facts.age_group = 'infant';
  else if (age) {
    const n = Number(age[1]);
    facts.age_group = n < 2 ? 'infant' : n < 15 ? 'child' : n >= 65 ? 'senior' : 'adult';
  } else if (/\b(bebe|nourrisson|nouveau ne)\b/.test(text) || /رضيع|الرضيع|بيبي/.test(text)) facts.age_group = 'infant';
  else if (/\b(mon enfant|mon fils|ma fille|enfant|fillette|garcon|petit)\b/.test(text) || /طفل|ولدي|بنتي|ابني|ابنتي/.test(text)) facts.age_group = 'child';
  else if (/\b(grand mere|grand pere|personne agee|mon pere age)\b/.test(text) || /جدتي|جدي|مسن/.test(text)) facts.age_group = 'senior';

  // Grossesse
  if (/\b(enceinte|grossesse)\b/.test(text) || /حامل|الحمل/.test(text)) facts.pregnant = true;

  // Durée
  const dur = text.match(/depuis\s+(\d+)\s*(heure|h\b|jour|semaine|mois|an)/) ?? text.match(/(\d+)\s*(jour|semaine|mois)s?/);
  if (dur) {
    const n = Number(dur[1]); const unit = dur[2];
    facts.duration = unit.startsWith('h') ? 'hours' : unit === 'jour' ? (n <= 3 ? 'days' : n <= 7 ? 'week' : 'weeks') : 'weeks';
    if (unit === 'semaine' && n === 1) facts.duration = 'week';
  } else if (/\b(ce matin|aujourd hui|depuis quelques heures|cette nuit|tout a l heure)\b/.test(text) || /اليوم|هذا الصباح|منذ ساعات/.test(text)) facts.duration = 'hours';
  else if (/\b(depuis hier|avant hier|depuis 2 jours|quelques jours)\b/.test(text) || /البارحه|امس|منذ يومين|ايام/.test(text)) facts.duration = 'days';
  else if (/\b(semaines|des mois|longtemps|plusieurs mois|chronique)\b/.test(text) || /اسابيع|اشهر|مده طويله/.test(text)) facts.duration = 'weeks';

  // Intensité
  const scale = text.match(/\b(\d{1,2})\s*(sur|\/)\s*10\b/);
  if (scale) { const n = Number(scale[1]); facts.severity = n >= 7 ? 'severe' : n >= 4 ? 'moderate' : 'mild'; }
  else if (/\b(tres fort|tres forte|tres mal|trop mal|insupportable|intense|terrible|atroce|horrible|enorme)\b/.test(text) || /شديد|برشا|لا يطاق/.test(text)) facts.severity = 'severe';
  else if (/\b(leger|legere|un peu|supportable|faible)\b/.test(text) || /خفيف|شويه|بسيط/.test(text)) facts.severity = 'mild';

  return facts;
}

/** Réponse oui / non dans un texte libre (null si on ne sait pas). */
function yesNo(raw) {
  const t = normalize(raw);
  // Seulement pour une réponse courte : « la nuque est raide » ne doit pas être lu comme un « non » darija.
  if (!t || t.split(' ').length > 6) return null;
  const first = t.split(' ')[0];
  if (['oui', 'ouais', 'yes', 'ey', 'eyh', 'aih', 'exact', 'exactement', 'نعم', 'اي', 'ايه', 'ايوه'].includes(first)) return true;
  if (['non', 'no', 'nn', 'aucun', 'aucune', 'jamais', 'لا', 'لالا', 'ابدا'].includes(first) || t.startsWith('pas du tout')) return false;
  return null;
}

/* ------------------------------------------------------------- évaluation */

const byKey = (list) => new Map(list.map((x) => [x.key, x]));

/** Signes d'alerte à vérifier pour ces symptômes, du plus grave au moins grave. */
function flagsToAsk(kb, state) {
  const sym = byKey(kb.symptoms);
  const flags = byKey(kb.redFlags);
  const keys = new Set();
  for (const k of state.symptoms) for (const f of sym.get(k)?.red_flags ?? []) keys.add(f);
  return [...keys]
    .map((k) => flags.get(k))
    .filter((f) => f && (!FLAG_CONTEXT[f.key] || FLAG_CONTEXT[f.key](state)))
    .sort((a, b) => b.level - a.level);
}

/**
 * input: { symptoms: [key], red_flags: [key positifs], age_group, pregnant, duration, severity, lang }
 * Retourne le niveau de soins, la spécialité conseillée, les explications et les pistes.
 */
function evaluate(kb, input) {
  const lang = input.lang === 'ar' ? 'ar' : 'fr';
  const L = (o, base) => o[`${base}_${lang}`] ?? o[`${base}_fr`];
  const sym = byKey(kb.symptoms);
  const flagMap = byKey(kb.redFlags);
  const symptoms = (input.symptoms ?? []).map((k) => sym.get(k)).filter(Boolean);
  const positive = (input.red_flags ?? []).map((k) => flagMap.get(k)).filter(Boolean).sort((a, b) => b.level - a.level);
  const reasons = [];
  const say = (fr, ar) => reasons.push(lang === 'ar' ? ar : fr);

  let level;
  if (positive.length) {
    level = positive[0].level;
    for (const f of positive.slice(0, 2)) reasons.push(L(f, 'advice'));
  } else {
    level = symptoms.length ? Math.max(...symptoms.map((s) => s.base_level)) : 2;
    if (!symptoms.length) say('Sans symptôme précis, un médecin généraliste est le bon point de départ.', 'في غياب عرض محدد، الطبيب العام هو نقطة البداية المناسبة.');
    const selfCareOk = symptoms.length > 0 && symptoms.every((s) => s.self_care_ok);
    const before = level;

    if (input.severity === 'severe') {
      level = Math.max(level + 1, 2);
      say('Vous décrivez une gêne intense : elle mérite l’avis d’un médecin.', 'تصف انزعاجاً شديداً: يستحق ذلك رأي طبيب.');
    }
    if (input.duration === 'weeks') {
      level = Math.max(level, 2);
      say('Un symptôme qui dure depuis plus d’une semaine doit être examiné.', 'العرض الذي يستمر أكثر من أسبوع يحتاج إلى فحص.');
    } else if (input.duration === 'week' && level < 2) {
      level = selfCareOk ? Math.max(level, 1) : 2;
      say('Le symptôme persiste depuis plusieurs jours sans s’améliorer.', 'يستمر العرض منذ عدة أيام دون تحسن.');
    }
    if (input.age_group === 'infant') {
      level = Math.max(level + 1, 2);
      if (symptoms.some((s) => s.key === 'fever')) level = Math.max(level, 3);
      say('Chez un bébé de moins de 2 ans, il vaut mieux faire examiner l’enfant par un médecin.', 'عند الرضيع دون السنتين، من الأفضل أن يفحصه طبيب.');
    } else if (input.age_group === 'senior' && level >= 1) {
      level += 1;
      say('Après 65 ans, les symptômes peuvent évoluer plus vite : un avis médical est préférable.', 'بعد سن 65، قد تتطور الأعراض بسرعة: يُفضل رأي طبي.');
    }
    if (input.pregnant === true && level >= 1) {
      level = Math.max(level, 2);
      if (symptoms.some((s) => ['belly', 'women', 'urinary'].includes(s.category))) level += 1;
      say('Pendant la grossesse, demandez conseil avant de prendre un médicament et faites-vous examiner.', 'أثناء الحمل، استشر قبل تناول أي دواء واطلب فحصاً.');
    }
    if (!selfCareOk && level < 1) level = 1;
    level = Math.min(level, 3);                     // seuls les signes d'alerte mènent aux urgences
    if (level === before && symptoms.length) {
      const main = symptoms.reduce((a, b) => (b.base_level > a.base_level ? b : a));
      say(level <= 1
        ? `D’après vos réponses, « ${L(main, 'label').toLowerCase()} » ne présente pas de signe de gravité.`
        : `« ${L(main, 'label')} » nécessite un examen par un professionnel pour en trouver la cause.`,
      level <= 1
        ? `حسب إجاباتك، لا يظهر «${main.label_ar}» علامات خطورة.`
        : `«${main.label_ar}» يحتاج إلى فحص من مختص لمعرفة السبب.`);
    }
  }

  // Spécialité conseillée
  let specialty = null;
  if (level <= 3) {
    const main = symptoms.length ? symptoms.reduce((a, b) => (b.base_level > a.base_level ? b : a)) : null;
    specialty = main?.specialty_slug ?? 'generaliste';
    const distinct = new Set(symptoms.map((s) => s.specialty_slug));
    if (distinct.size >= 2 && new Set(symptoms.map((s) => s.category)).size >= 2 && level <= 2) {
      specialty = 'generaliste';
      say('Vos symptômes touchent plusieurs systèmes : un médecin généraliste pourra faire le point et vous orienter.',
        'أعراضك تشمل عدة أجهزة: يمكن للطبيب العام تقييم الحالة وتوجيهك.');
    }
    if (['infant', 'child'].includes(input.age_group) && !['dentiste', 'ophtalmologue'].includes(specialty)) specialty = 'pediatre';
    if (input.pregnant === true && symptoms.some((s) => ['belly', 'women', 'urinary'].includes(s.category))) specialty = 'gynecologue';
  }

  // Pistes : affections partageant le plus de symptômes (jamais présentées comme un diagnostic)
  const keys = new Set(symptoms.map((s) => s.key));
  const related = kb.conditions
    .map((c) => {
      const matched = c.links.filter((l) => keys.has(l.symptom_key));
      const score = matched.reduce((t, l) => t + l.weight, 0);
      const total = c.links.reduce((t, l) => t + l.weight, 0) || 1;
      return { c, score, ratio: score / total };
    })
    .filter((x) => x.score >= 2 || (x.score >= 1 && keys.size === 1))
    .sort((a, b) => b.score - a.score || b.ratio - a.ratio)
    .slice(0, 3)
    .map(({ c }) => ({ slug: c.slug, name: lang === 'ar' ? c.name_ar : c.name_fr, summary: lang === 'ar' ? c.summary_ar : c.summary_fr, urgency: c.urgency }));

  const advice = level >= 4 ? [] : [...new Set(symptoms.flatMap((s) => s[`advice_${lang}`] ?? []))].slice(0, 6);
  const watch = level >= 4 ? [] : flagsToAsk(kb, { ...input, symptoms: symptoms.map((s) => s.key) })
    .filter((f) => !(input.red_flags ?? []).includes(f.key))
    .slice(0, 5)
    .map((f) => ({ key: f.key, text: L(f, 'question'), level: f.level }));

  const info = LEVELS[level];
  return {
    level,
    level_key: info.key,
    color: info.color,
    title: lang === 'ar' ? info.ar : info.fr,
    action: lang === 'ar' ? info.action_ar : info.action_fr,
    reasons: [...new Set(reasons)],
    specialty,
    red_flags: positive.map((f) => f.key),
    advice,
    watch_for: watch,
    related_conditions: related,
    facility_type: level >= 4 ? 'hospital' : level === 1 ? 'pharmacy' : null,
    disclaimer: lang === 'ar'
      ? 'هذا توجيه عام وليس تشخيصاً. إذا ساءت حالتك أو ساورك القلق، اتصل بالرقم 190.'
      : 'Ceci est une orientation générale, pas un diagnostic. Si votre état s’aggrave ou vous inquiète, appelez le 190.',
  };
}

/* ------------------------------------------------------------------- chat */

const T = {
  fr: {
    hello: 'Bonjour, je suis l’assistant d’orientation SehhaTN. Décrivez ce que vous ressentez, avec vos mots : je vous poserai quelques questions puis je vous dirai quel type de soins semble adapté.',
    notUnderstood: 'Je n’ai pas bien identifié le symptôme. Pouvez-vous le décrire autrement, ou choisir parmi ces propositions ?',
    giveUp: 'Je n’arrive pas à identifier précisément votre symptôme. Le plus sûr est d’en parler à un médecin généraliste, ou à un pharmacien pour un premier conseil.',
    noted: (labels) => `J’ai bien noté : ${labels}.`,
    age: 'Quel âge a la personne concernée ?',
    pregnant: 'La personne est-elle enceinte ?',
    duration: 'Depuis combien de temps ?',
    severity: 'Comment évaluez-vous l’intensité de la gêne ?',
    flagIntro: 'Une vérification importante :',
    other: 'Avez-vous un autre symptôme à signaler ? Sinon, je vous donne mon orientation.',
    restart: 'D’accord, reprenons. Quel est le symptôme qui vous gêne ?',
    after: 'Vous pouvez décrire un autre symptôme, ou recommencer une nouvelle conversation.',
    yes: 'Oui', no: 'Non', notConcerned: 'Non concerné', noOther: 'Non, c’est tout',
    ages: { infant: 'Bébé (moins de 2 ans)', child: 'Enfant (2 à 15 ans)', adult: 'Adulte', senior: '65 ans et plus' },
    durations: { hours: 'Quelques heures', days: '1 à 3 jours', week: '4 à 7 jours', weeks: 'Plus d’une semaine' },
    severities: { mild: 'Légère', moderate: 'Modérée', severe: 'Intense' },
  },
  ar: {
    hello: 'مرحباً، أنا مساعد التوجيه في SehhaTN. صف ما تشعر به بكلماتك: سأطرح عليك بعض الأسئلة ثم أخبرك بنوع الرعاية المناسبة.',
    notUnderstood: 'لم أتعرف جيداً على العرض. هل يمكنك وصفه بطريقة أخرى أو الاختيار من هذه الاقتراحات؟',
    giveUp: 'لم أتمكن من تحديد العرض بدقة. الأسلم أن تتحدث مع طبيب عام، أو مع صيدلي للحصول على نصيحة أولية.',
    noted: (labels) => `سجلت: ${labels}.`,
    age: 'كم عمر الشخص المعني؟',
    pregnant: 'هل الشخص حامل؟',
    duration: 'منذ متى؟',
    severity: 'كيف تقيّم شدة الانزعاج؟',
    flagIntro: 'سؤال مهم للتحقق:',
    other: 'هل لديك عرض آخر؟ وإلا سأقدم لك التوجيه.',
    restart: 'حسناً، لنبدأ من جديد. ما العرض الذي يزعجك؟',
    after: 'يمكنك وصف عرض آخر أو بدء محادثة جديدة.',
    yes: 'نعم', no: 'لا', notConcerned: 'غير معني', noOther: 'لا، هذا كل شيء',
    ages: { infant: 'رضيع (أقل من سنتين)', child: 'طفل (2 إلى 15 سنة)', adult: 'بالغ', senior: '65 سنة فأكثر' },
    durations: { hours: 'بضع ساعات', days: 'من يوم إلى 3 أيام', week: 'من 4 إلى 7 أيام', weeks: 'أكثر من أسبوع' },
    severities: { mild: 'خفيفة', moderate: 'متوسطة', severe: 'شديدة' },
  },
};

function emptyState() {
  return { symptoms: [], age_group: null, pregnant: null, duration: null, severity: null,
    flags_yes: [], flags_no: [], asked_other: false, pending: null, misses: 0, done: false };
}

const SUGGESTED = ['fever', 'headache', 'abdominal_pain', 'cough', 'sore_throat', 'back_pain', 'rash', 'anxiety'];

/** Applique une réponse structurée (bouton) à l'état. */
function applyAnswer(state, answer) {
  const { field, value } = answer;
  if (field === 'age_group' && AGE_GROUPS.includes(value)) state.age_group = value;
  else if (field === 'pregnant') state.pregnant = value === true;
  else if (field === 'duration' && DURATIONS.includes(value)) state.duration = value;
  else if (field === 'severity' && SEVERITIES.includes(value)) state.severity = value;
  else if (field === 'flag' && value && typeof value.key === 'string') {
    (value.yes ? state.flags_yes : state.flags_no).push(value.key);
  } else if (field === 'symptom' && typeof value === 'string' && !state.symptoms.includes(value)) state.symptoms.push(value);
  else if (field === 'other' && value === false) state.asked_other = true;
}

/**
 * Un tour de conversation. Entrée : { message?, answer?, state?, lang }.
 * Sortie : { messages, quick_replies, state, outcome? }
 */
function chatTurn(kb, { message, answer, state: incoming, lang = 'fr' }) {
  const t = T[lang] ?? T.fr;
  const L = (o, base) => o[`${base}_${lang}`] ?? o[`${base}_fr`];
  const sym = byKey(kb.symptoms);
  let state = { ...emptyState(), ...(incoming ?? {}) };
  const messages = [];

  if (state.done) {               // nouvelle question après une orientation : on garde l'âge et la grossesse
    state = { ...emptyState(), age_group: state.age_group, pregnant: state.pregnant };
  }

  if (answer) applyAnswer(state, answer);
  if (message) {
    const facts = extractFacts(kb, message);
    const pending = state.pending;
    // Réponse libre à une question oui / non en attente
    const yn = yesNo(message);
    if (pending?.type === 'flag' && yn !== null) (yn ? state.flags_yes : state.flags_no).push(pending.key);
    if (pending?.type === 'pregnant' && yn !== null) state.pregnant = yn;
    if (pending?.type === 'other' && yn === false && !facts.symptoms.length) state.asked_other = true;

    for (const k of facts.red_flags) if (!state.flags_yes.includes(k)) state.flags_yes.push(k);
    const fresh = facts.symptoms.filter((k) => !state.symptoms.includes(k));
    state.symptoms.push(...fresh);
    if (fresh.length) {
      state.misses = 0;
      if (pending?.type === 'other') state.asked_other = false;
      messages.push({ text: t.noted(fresh.map((k) => L(sym.get(k), 'label').toLowerCase()).join(', ')) });
    }
    for (const f of ['age_group', 'duration', 'severity']) if (facts[f] && !state[f]) state[f] = facts[f];
    if (facts.pregnant) state.pregnant = true;
    if (!fresh.length && !facts.red_flags.length && pending?.type === 'symptom') state.misses += 1;
  }
  if (answer?.field === 'symptom') {
    messages.push({ text: t.noted(L(sym.get(answer.value) ?? { label_fr: answer.value }, 'label').toLowerCase()) });
  }

  const finish = () => {
    state.done = true; state.pending = null;
    const outcome = evaluate(kb, { ...state, red_flags: state.flags_yes, lang });
    messages.push({ text: outcome.title, kind: outcome.level >= 4 ? 'urgent' : outcome.level >= 2 ? 'care' : 'normal' });
    return { messages, quick_replies: [], state, outcome };
  };
  const ask = (pending, text, quick_replies) => {
    state.pending = pending;
    messages.push({ text });
    return { messages, quick_replies, state };
  };

  // 1. Un signe d'alerte déclaré : orientation immédiate
  if (state.flags_yes.some((k) => kb.redFlags.find((f) => f.key === k)?.level >= 4)) return finish();

  // 2. Il faut au moins un symptôme
  if (!state.symptoms.length) {
    if (state.misses >= 2) {
      messages.push({ text: t.giveUp, kind: 'care' });
      return finish();
    }
    const suggestions = SUGGESTED.map((k) => sym.get(k)).filter(Boolean)
      .map((s) => ({ label: L(s, 'label'), answer: { field: 'symptom', value: s.key } }));
    if (!message && !answer) return ask({ type: 'symptom' }, t.hello, suggestions);
    if (state.pending?.type !== 'symptom') state.misses = Math.max(state.misses, 1);
    return ask({ type: 'symptom' }, t.notUnderstood, suggestions);
  }

  // 3. Questions de contexte, dans l'ordre
  if (!state.age_group) {
    return ask({ type: 'age_group' }, t.age,
      AGE_GROUPS.map((a) => ({ label: t.ages[a], answer: { field: 'age_group', value: a } })));
  }
  const cats = new Set(state.symptoms.map((k) => sym.get(k)?.category));
  if (state.pregnant === null && state.age_group === 'adult' && ['belly', 'women', 'urinary'].some((c) => cats.has(c))) {
    return ask({ type: 'pregnant' }, t.pregnant, [
      { label: t.yes, answer: { field: 'pregnant', value: true } },
      { label: t.no, answer: { field: 'pregnant', value: false } },
      { label: t.notConcerned, answer: { field: 'pregnant', value: false } },
    ]);
  }
  const answered = new Set([...state.flags_yes, ...state.flags_no]);
  const askedCount = state.flags_no.length + state.flags_yes.length;
  const nextFlag = flagsToAsk(kb, state).find((f) => !answered.has(f.key));
  if (nextFlag && askedCount < MAX_FLAG_QUESTIONS) {
    return ask({ type: 'flag', key: nextFlag.key }, `${t.flagIntro} ${L(nextFlag, 'question')}`, [
      { label: t.yes, answer: { field: 'flag', value: { key: nextFlag.key, yes: true } } },
      { label: t.no, answer: { field: 'flag', value: { key: nextFlag.key, yes: false } } },
    ]);
  }
  if (!state.duration) {
    return ask({ type: 'duration' }, t.duration,
      DURATIONS.map((d) => ({ label: t.durations[d], answer: { field: 'duration', value: d } })));
  }
  if (!state.severity) {
    return ask({ type: 'severity' }, t.severity,
      SEVERITIES.map((s) => ({ label: t.severities[s], answer: { field: 'severity', value: s } })));
  }
  if (!state.asked_other && state.symptoms.length < 3) {
    return ask({ type: 'other' }, t.other, [{ label: t.noOther, answer: { field: 'other', value: false } }]);
  }
  return finish();
}

/** Premier message de l'assistant. */
function greeting(kb, lang = 'fr') {
  return chatTurn(kb, { lang });
}

/** Catalogue pour l'orientation guidée. */
function catalog(kb, lang = 'fr') {
  const L = (o, base) => o[`${base}_${lang}`] ?? o[`${base}_fr`];
  return {
    levels: LEVELS.map((l) => ({ level: l.level, key: l.key, color: l.color, title: lang === 'ar' ? l.ar : l.fr })),
    global_red_flags: kb.redFlags.filter((f) => f.is_global).map((f) => ({ key: f.key, question: L(f, 'question'), level: f.level })),
    categories: CATEGORIES.map((c) => ({
      key: c.key, icon: c.icon, label: lang === 'ar' ? c.ar : c.fr,
      symptoms: kb.symptoms.filter((s) => s.category === c.key).map((s) => ({
        key: s.key, label: L(s, 'label'),
        red_flags: (s.red_flags ?? []).filter((k) => kb.redFlags.some((f) => f.key === k)),
      })),
    })).filter((c) => c.symptoms.length),
    red_flags: Object.fromEntries(kb.redFlags.map((f) => [f.key, { question: L(f, 'question'), level: f.level, context: FLAG_CONTEXT[f.key] ? f.key : null }])),
  };
}

module.exports = { normalize, extractFacts, yesNo, evaluate, chatTurn, greeting, catalog, flagsToAsk, emptyState,
  DURATIONS, SEVERITIES, AGE_GROUPS };
