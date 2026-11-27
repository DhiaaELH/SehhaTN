// Tests du moteur d'orientation, sans base de données : la base de connaissances est construite depuis les fichiers de seed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const triage = require('../lib/triage');
const symptoms = require('../db/seed-data/symptoms');
const redFlags = require('../db/seed-data/red-flags');
const conditions = require('../db/seed-data/conditions');

const kb = {
  symptoms: symptoms.map((s) => ({ ...s, specialty_slug: s.specialty, red_flags: s.red_flags ?? [] })),
  redFlags,
  conditions: conditions.map((c) => ({
    ...c, specialty_slug: c.specialty,
    links: Object.entries(c.symptom_links ?? {}).map(([symptom_key, weight]) => ({ symptom_key, weight })),
  })),
};
const evaluate = (input) => triage.evaluate(kb, { lang: 'fr', ...input });
const facts = (text) => triage.extractFacts(kb, text);

/** Conversation complète : enchaîne des messages libres et/ou des réponses de boutons. */
function converse(steps, lang = 'fr') {
  let state;
  let turn;
  for (const step of steps) {
    turn = triage.chatTurn(kb, { ...(typeof step === 'string' ? { message: step } : { answer: step }), state, lang });
    state = turn.state;
    if (turn.outcome) break;
  }
  return turn;
}

test('compréhension : symptômes en français, arabe et darija', () => {
  assert.ok(facts('J’ai très mal à la tête depuis ce matin').symptoms.includes('headache'));
  assert.equal(facts('J’ai très mal à la tête depuis ce matin').duration, 'hours');
  assert.equal(facts('J’ai très mal à la tête depuis ce matin').severity, 'severe');
  assert.ok(facts('عندي حمى وسعال').symptoms.includes('fever'));
  assert.ok(facts('عندي حمى وسعال').symptoms.includes('cough'));
  assert.ok(facts('kerchi tou93ed barcha').symptoms.includes('abdominal_pain'));
  assert.equal(facts('mon fils de 4 ans tousse').age_group, 'child');
  assert.equal(facts('ma mère a 72 ans').age_group, 'senior');
  assert.equal(facts('bébé de 2 mois').age_group, 'infant');
  assert.equal(facts('je suis enceinte').pregnant, true);
  assert.equal(facts('depuis 10 jours').duration, 'weeks');
});

test('négation : « pas de fièvre » ne déclenche rien', () => {
  assert.ok(!facts('je n’ai pas de fièvre').symptoms.includes('fever'));
  assert.ok(!facts('sans douleur thoracique').red_flags.includes('chest_pain_severe'));
});

test('signes d’alerte vitaux détectés dans le texte libre', () => {
  for (const [text, flag] of [
    ['j’ai une douleur thoracique intense qui serre', 'chest_pain_severe'],
    ['je n’arrive plus à respirer', 'breathing_severe'],
    ['il a perdu connaissance', 'unconscious'],
    ['visage déformé et il n’arrive plus à parler', 'stroke_signs'],
    ['je veux mourir', 'suicidal'],
  ]) {
    assert.ok(facts(text).red_flags.includes(flag), `${text} → ${flag} (trouvé : ${facts(text).red_flags})`);
  }
});

test('un signe d’alerte vital mène au SAMU 190', () => {
  const r = evaluate({ symptoms: ['chest_pain'], red_flags: ['chest_pain_severe'] });
  assert.equal(r.level, 5);
  assert.equal(r.level_key, 'emergency');
  assert.equal(r.specialty, null);
  assert.equal(r.facility_type, 'hospital');
});

test('un rhume léger récent : soins à domicile', () => {
  const r = evaluate({ symptoms: ['nasal_congestion'], age_group: 'adult', duration: 'days', severity: 'mild' });
  assert.ok(r.level <= 1, `niveau ${r.level}`);
  assert.ok(r.advice.length > 0);
});

test('sans signe d’alerte, on ne dépasse jamais « consulter aujourd’hui »', () => {
  for (const s of kb.symptoms) {
    const r = evaluate({ symptoms: [s.key], age_group: 'senior', pregnant: true, duration: 'weeks', severity: 'severe' });
    assert.ok(r.level <= 3, `${s.key} → ${r.level}`);
  }
});

test('modulateurs : intensité, durée, vulnérabilité', () => {
  const base = evaluate({ symptoms: ['headache'], age_group: 'adult', duration: 'hours', severity: 'mild' }).level;
  assert.ok(evaluate({ symptoms: ['headache'], age_group: 'adult', duration: 'hours', severity: 'severe' }).level > base);
  assert.ok(evaluate({ symptoms: ['headache'], age_group: 'adult', duration: 'weeks', severity: 'mild' }).level >= 2);
  assert.ok(evaluate({ symptoms: ['fever'], age_group: 'infant', duration: 'hours', severity: 'mild' }).level >= 3);
});

test('orientation : pédiatre pour un enfant, gynécologue pendant la grossesse, généraliste si plusieurs systèmes', () => {
  assert.equal(evaluate({ symptoms: ['cough'], age_group: 'child', duration: 'week', severity: 'moderate' }).specialty, 'pediatre');
  assert.equal(evaluate({ symptoms: ['toothache'], age_group: 'child', duration: 'days', severity: 'moderate' }).specialty, 'dentiste');
  assert.equal(evaluate({ symptoms: ['abdominal_pain'], age_group: 'adult', pregnant: true, duration: 'days', severity: 'moderate' }).specialty, 'gynecologue');
  assert.equal(evaluate({ symptoms: ['rash', 'joint_pain', 'fatigue'], age_group: 'adult', duration: 'days', severity: 'mild' }).specialty, 'generaliste');
  assert.equal(evaluate({ symptoms: ['toothache'], age_group: 'adult', duration: 'days', severity: 'moderate' }).specialty, 'dentiste');
});

test('pistes : affections liées, jamais présentées comme un diagnostic', () => {
  const r = evaluate({ symptoms: ['fever', 'cough', 'flu_like'], age_group: 'adult', duration: 'days', severity: 'moderate' });
  assert.ok(r.related_conditions.length > 0);
  assert.ok(r.disclaimer.includes('pas un diagnostic'));
});

test('chat : conversation complète jusqu’à une orientation', () => {
  const t = converse([
    'J’ai mal à la gorge depuis hier',
    { field: 'age_group', value: 'adult' },
    ...Array(6).fill({ field: 'flag', value: { key: '__answer_no__', yes: false } }),
  ]);
  // Les réponses « non » génériques ne correspondent à aucun signe : on répond avec les vrais boutons à la place.
  let state; let turn = triage.chatTurn(kb, { message: 'J’ai mal à la gorge depuis hier', lang: 'fr' });
  for (let i = 0; i < 12 && !turn.outcome; i++) {
    state = turn.state;
    const qr = turn.quick_replies;
    const pick = qr.find((q) => q.answer.field === 'flag' && q.answer.value.yes === false)
      ?? qr.find((q) => q.answer.value === 'adult') ?? qr.find((q) => q.answer.value === 'mild')
      ?? qr.find((q) => q.answer.value === false) ?? qr[0];
    turn = triage.chatTurn(kb, { answer: pick.answer, state, lang: 'fr' });
  }
  assert.ok(t);                                  // la conversation simulée ne plante pas
  assert.ok(turn.outcome, 'une orientation est donnée');
  assert.ok(turn.outcome.level <= 2, `angine simple → niveau ${turn.outcome.level}`);
  assert.ok(turn.state.symptoms.includes('sore_throat'));
});

test('chat : un signe vital dans le premier message court-circuite les questions', () => {
  const t = converse(['mon père a une douleur thoracique intense et transpire']);
  assert.ok(t.outcome);
  assert.equal(t.outcome.level, 5);
});

test('chat : réponse « oui » libre à une question d’alerte', () => {
  let turn = triage.chatTurn(kb, { message: 'j’ai de la fièvre', lang: 'fr' });
  turn = triage.chatTurn(kb, { answer: { field: 'age_group', value: 'adult' }, state: turn.state, lang: 'fr' });
  assert.equal(turn.state.pending?.type, 'flag');
  const flag = kb.redFlags.find((f) => f.key === turn.state.pending.key);
  turn = triage.chatTurn(kb, { message: 'oui', state: turn.state, lang: 'fr' });
  assert.ok(turn.state.flags_yes.includes(flag.key));
  if (flag.level >= 4) assert.ok(turn.outcome && turn.outcome.level >= 4);
});

test('chat : « la nuque est raide » n’est pas lu comme un « non »', () => {
  assert.equal(triage.yesNo('la nuque est raide'), null);
  assert.equal(triage.yesNo('Non'), false);
  assert.equal(triage.yesNo('نعم'), true);
});

test('chat : texte incompréhensible deux fois → conseil prudent', () => {
  let turn = triage.chatTurn(kb, { lang: 'fr' });
  turn = triage.chatTurn(kb, { message: 'blablabla', state: turn.state, lang: 'fr' });
  assert.ok(!turn.outcome);
  turn = triage.chatTurn(kb, { message: 'xyz qsdf', state: turn.state, lang: 'fr' });
  assert.ok(turn.outcome, 'abandon après deux incompréhensions');
  assert.equal(turn.outcome.specialty, 'generaliste');
});

test('chat en arabe', () => {
  const t = triage.chatTurn(kb, { message: 'عندي صداع شديد', lang: 'ar' });
  assert.ok(t.state.symptoms.includes('headache'));
  assert.match(t.messages.map((m) => m.text).join(' '), /[؀-ۿ]/);
});

test('catalogue de l’orientation guidée', () => {
  const c = triage.catalog(kb, 'fr');
  assert.ok(c.global_red_flags.length >= 5);
  assert.ok(c.categories.length >= 10);
  assert.ok(c.categories.every((cat) => cat.symptoms.length > 0));
});

/* ------------------------------------------------ orientation étendue : antécédents, nouveaux cas, méthode */

test('base de connaissances : les nouveaux symptômes référencent des signes d’alerte et une spécialité qui existent', () => {
  const specialties = require('../db/seed-data/specialties').map((s) => s.slug);
  const flagKeys = new Set(kb.redFlags.map((f) => f.key));
  const keys = kb.symptoms.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, 'clés de symptômes uniques');
  for (const s of kb.symptoms) {
    assert.ok(specialties.includes(s.specialty_slug), `${s.key} : spécialité ${s.specialty_slug}`);
    for (const f of s.red_flags) assert.ok(flagKeys.has(f), `${s.key} : signe d’alerte ${f}`);
    assert.ok(s.advice_fr.length && s.advice_ar.length, `${s.key} : conseils fr et ar`);
  }
});

test('intoxication : signe d’alerte vital global, orientation SAMU', () => {
  assert.ok(facts('mon enfant a avalé un produit toxique').red_flags.includes('poisoning'));
  assert.ok(!facts('j’ai eu une intoxication alimentaire hier').red_flags.includes('poisoning'));
  assert.equal(evaluate({ symptoms: [], red_flags: ['poisoning'] }).level, 5);
});

test('piqûre de scorpion : urgences, pas de spécialité', () => {
  const r = evaluate({ symptoms: ['bite_sting'], red_flags: ['scorpion_snake'], age_group: 'child' });
  assert.equal(r.level, 4);
  assert.equal(r.specialty, null);
});

test('antécédents : un traitement anticoagulant relève le niveau après un choc à la tête', () => {
  const sans = evaluate({ symptoms: ['head_injury'], age_group: 'adult', duration: 'hours', severity: 'mild' });
  const avec = evaluate({ symptoms: ['head_injury'], age_group: 'adult', duration: 'hours', severity: 'mild', history: ['anticoagulant'] });
  assert.ok(avec.level >= 3 && avec.level > sans.level);
  assert.ok(avec.reasons.some((r) => r.includes('fluidifie')));
  assert.ok(avec.factors.some((f) => f.kind === 'history'));
});

test('antécédents : défenses affaiblies + fièvre, diabète + plaie', () => {
  assert.equal(evaluate({ symptoms: ['fever'], age_group: 'adult', duration: 'hours', severity: 'mild', history: ['immunosuppressed'] }).level, 3);
  assert.ok(evaluate({ symptoms: ['wound_burn'], age_group: 'adult', duration: 'days', severity: 'mild', history: ['diabetes'] }).level >= 2);
});

test('antécédents : sans signe d’alerte, jamais au-delà de « consulter aujourd’hui »', () => {
  const all = ['diabetes', 'hypertension', 'heart', 'asthma', 'kidney', 'immunosuppressed', 'anticoagulant', 'recent_surgery'];
  for (const s of kb.symptoms) {
    const r = evaluate({ symptoms: [s.key], age_group: 'senior', duration: 'weeks', severity: 'severe', history: all });
    assert.ok(r.level <= 3, `${s.key} → ${r.level}`);
  }
});

test('les antécédents ne changent pas un signe d’alerte vital', () => {
  assert.equal(evaluate({ symptoms: ['chest_pain'], red_flags: ['chest_pain_severe'], history: ['diabetes'] }).level, 5);
});

test('résultat : explications, facteurs décisifs et cadre de la méthode', () => {
  const r = evaluate({ symptoms: ['headache'], age_group: 'adult', duration: 'days', severity: 'moderate' });
  assert.ok(r.factors.some((f) => f.kind === 'symptom'));
  assert.ok(r.protocol.version && r.protocol.basis.length > 20);
  assert.equal(r.protocol.reviewed_by, null, 'aucune relecture déclarée tant qu’elle n’a pas eu lieu');
});

test('catalogue : synonymes pour la recherche, antécédents et méthode', () => {
  const c = triage.catalog(kb, 'fr');
  const fever = c.categories.flatMap((x) => x.symptoms).find((s) => s.key === 'fever');
  assert.ok(fever.synonyms.length > 3);
  assert.ok(c.history.length >= 8);
  assert.ok(c.protocol.basis);
  assert.ok(c.categories.flatMap((x) => x.symptoms).some((s) => s.key === 'renal_colic'));
});
