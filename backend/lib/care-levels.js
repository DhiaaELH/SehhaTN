/** Échelle des niveaux de soins utilisée par l'orientation guidée et par l'assistant.
 *  Plus le niveau est élevé, plus la prise en charge doit être rapide. */
const LEVELS = [
  { level: 0, key: 'self_care', color: 'green',
    fr: 'Soins à domicile', ar: 'العناية في المنزل',
    action_fr: 'Vous pouvez probablement gérer cela chez vous, en surveillant l’évolution.',
    action_ar: 'يمكنك على الأرجح التعامل مع ذلك في المنزل مع مراقبة التطور.' },
  { level: 1, key: 'pharmacist', color: 'green',
    fr: 'Conseil du pharmacien', ar: 'استشارة الصيدلي',
    action_fr: 'Un pharmacien peut vous conseiller sans rendez-vous et vous dire s’il faut consulter.',
    action_ar: 'يمكن للصيدلي أن ينصحك دون موعد ويخبرك إن كان عليك استشارة طبيب.' },
  { level: 2, key: 'consult', color: 'blue',
    fr: 'Consultation dans les prochains jours', ar: 'استشارة خلال الأيام القادمة',
    action_fr: 'Prenez rendez-vous avec un médecin dans les prochains jours.',
    action_ar: 'احجز موعداً مع طبيب خلال الأيام القادمة.' },
  { level: 3, key: 'consult_today', color: 'amber',
    fr: 'Consulter aujourd’hui', ar: 'استشر طبيباً اليوم',
    action_fr: 'Voyez un médecin aujourd’hui ou dans les 24 heures.',
    action_ar: 'راجع طبيباً اليوم أو خلال 24 ساعة.' },
  { level: 4, key: 'urgent', color: 'orange',
    fr: 'Urgences hospitalières', ar: 'قسم الاستعجالي بالمستشفى',
    action_fr: 'Rendez-vous aux urgences de l’hôpital le plus proche maintenant. Ne conduisez pas vous-même si vous vous sentez mal.',
    action_ar: 'توجه الآن إلى قسم الاستعجالي في أقرب مستشفى. لا تقد بنفسك إن كنت تشعر بتوعك.' },
  { level: 5, key: 'emergency', color: 'red',
    fr: 'Appelez le SAMU — 190', ar: 'اتصل بالإسعاف — 190',
    action_fr: 'Appelez le 190 immédiatement. Restez avec la personne et suivez les consignes du régulateur.',
    action_ar: 'اتصل بالرقم 190 فوراً. ابقَ مع الشخص واتبع تعليمات المنظم.' },
];

/** Regroupements proposés dans l'orientation guidée (et utilisés pour classer les symptômes). */
const CATEGORIES = [
  { key: 'general', icon: '♨', fr: 'Fièvre, fatigue, état général', ar: 'حمى، إرهاق، الحالة العامة' },
  { key: 'head',    icon: '☊', fr: 'Tête et système nerveux',       ar: 'الرأس والجهاز العصبي' },
  { key: 'ent',     icon: '◐', fr: 'Gorge, nez, oreilles',          ar: 'الحلق والأنف والأذن' },
  { key: 'eyes',    icon: '◉', fr: 'Yeux et vision',                ar: 'العين والنظر' },
  { key: 'mouth',   icon: '◇', fr: 'Dents et bouche',               ar: 'الأسنان والفم' },
  { key: 'chest',   icon: '♡', fr: 'Poitrine, cœur, respiration',   ar: 'الصدر والقلب والتنفس' },
  { key: 'belly',   icon: '◌', fr: 'Ventre et digestion',           ar: 'البطن والهضم' },
  { key: 'urinary', icon: '◑', fr: 'Voies urinaires',               ar: 'المسالك البولية' },
  { key: 'women',   icon: '♀', fr: 'Santé de la femme, grossesse',  ar: 'صحة المرأة والحمل' },
  { key: 'skin',    icon: '✳', fr: 'Peau, cheveux, allergies',      ar: 'الجلد والشعر والحساسية' },
  { key: 'bones',   icon: '⌇', fr: 'Os, articulations, dos',        ar: 'العظام والمفاصل والظهر' },
  { key: 'mind',    icon: '☁', fr: 'Moral, stress, sommeil',        ar: 'المزاج والضغط والنوم' },
];

const AGE_GROUPS = ['infant', 'child', 'adult', 'senior'];   // <2 ans, 2–15 ans, 15–64 ans, 65 ans et +

/** Antécédents et situations qui changent la prudence (question facultative de l'orientation guidée). */
const HISTORY = [
  { key: 'diabetes',        fr: 'Diabète',                                ar: 'السكري' },
  { key: 'hypertension',    fr: 'Hypertension',                           ar: 'ارتفاع ضغط الدم' },
  { key: 'heart',           fr: 'Maladie du cœur',                        ar: 'مرض القلب' },
  { key: 'asthma',          fr: 'Asthme ou bronchite chronique',          ar: 'الربو أو التهاب الشعب المزمن' },
  { key: 'kidney',          fr: 'Maladie des reins',                      ar: 'مرض الكلى' },
  { key: 'immunosuppressed', fr: 'Défenses affaiblies (chimiothérapie, corticoïdes…)', ar: 'ضعف المناعة (علاج كيميائي، كورتيزون…)' },
  { key: 'anticoagulant',   fr: 'Traitement qui fluidifie le sang',       ar: 'علاج يميّع الدم' },
  { key: 'recent_surgery',  fr: 'Opération il y a moins d’un mois',       ar: 'عملية جراحية منذ أقل من شهر' },
];

/** Cadre de la méthode, affiché dans l'application. `review` reste vide tant qu'aucun professionnel de santé n'a relu le contenu :
 *  renseignez reviewed_by et reviewed_on (ex. 'Dr Prénom Nom, médecin généraliste', '2026-12-01') pour afficher la mention de relecture. */
const PROTOCOL = {
  version: '2026-11',
  review: { reviewed_by: null, reviewed_on: null },
  basis_fr: 'Méthode inspirée des protocoles de tri téléphonique (principe NHS 111, régulation médicale du SAMU) : les signes d’alerte d’abord, puis le niveau de soins selon les symptômes, l’âge, la grossesse, la durée, l’intensité et les antécédents.',
  basis_ar: 'منهج مستوحى من بروتوكولات الفرز الهاتفي (مبدأ NHS 111 والتنظيم الطبي للإسعاف): علامات الخطر أولاً، ثم مستوى الرعاية حسب الأعراض والعمر والحمل والمدة والشدة والسوابق.',
};

module.exports = { LEVELS, CATEGORIES, AGE_GROUPS, HISTORY, PROTOCOL };
