import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LangService } from './lang.service';
import { GOVERNORATES } from './doctor.service';
import { OutcomeCardComponent } from './outcome-card.component';
import { AgeGroup, Catalog, Duration, Outcome, Severity, TriageService } from './triage.service';

type Step = 'intro' | 'who' | 'alarm' | 'category' | 'symptoms' | 'flags' | 'details' | 'result';
const FLOW: Step[] = ['who', 'alarm', 'category', 'symptoms', 'flags', 'details', 'result'];

/** Orientation guidée : vers le bon niveau de soins et le bon spécialiste, en quelques questions. */
@Component({
  selector: 'app-orientation',
  standalone: true,
  imports: [FormsModule, OutcomeCardComponent],
  template: `
  <section class="page-section or">
    <div class="or-top">
      <span class="section-kicker">{{ t('ORIENTATION SANTÉ', 'التوجيه الصحي') }}</span>
      <h1>{{ t('Le bon soin, au bon endroit, au bon moment.', 'الرعاية المناسبة، في المكان المناسب، في الوقت المناسب.') }}</h1>
      @if (step() !== 'intro' && step() !== 'result') {
        <div class="or-progress" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
          <i [style.width.%]="progress()"></i>
        </div>
      }
    </div>

    @if (error()) { <p class="or-error" role="alert">{{ error() }} <button class="outline-btn" (click)="loadCatalog()">{{ t('Réessayer', 'إعادة المحاولة') }}</button></p> }

    @switch (step()) {
      @case ('intro') {
        <div class="or-card or-intro">
          <p class="or-lead">{{ t('Répondez à quelques questions : nous vous indiquons s’il faut appeler le SAMU, aller aux urgences, consulter aujourd’hui, prendre rendez-vous ou simplement demander conseil à votre pharmacien — et quel spécialiste consulter.', 'أجب عن بعض الأسئلة: سنخبرك إن كان عليك الاتصال بالإسعاف أو التوجه إلى الاستعجالي أو استشارة طبيب اليوم أو حجز موعد أو مجرد طلب نصيحة من الصيدلي — وأي مختص تستشير.') }}</p>
          <ol class="or-method">
            <li><b>1</b><span><strong>{{ t('Les signes d’alerte d’abord', 'علامات الخطر أولاً') }}</strong>{{ t('Les situations vitales sont repérées avant tout le reste.', 'نكتشف الحالات الحرجة قبل أي شيء آخر.') }}</span></li>
            <li><b>2</b><span><strong>{{ t('Vos symptômes et votre situation', 'أعراضك ووضعك') }}</strong>{{ t('Âge, grossesse, durée et intensité ajustent le niveau de soins.', 'العمر والحمل والمدة والشدة تعدّل مستوى الرعاية.') }}</span></li>
            <li><b>3</b><span><strong>{{ t('La bonne porte d’entrée', 'الباب المناسب') }}</strong>{{ t('Le professionnel adapté, près de chez vous.', 'المختص المناسب بالقرب منك.') }}</span></li>
          </ol>
          <div class="or-ladder">
            @for (l of catalog()?.levels ?? []; track l.key) { <span [attr.data-level]="l.level">{{ l.title }}</span> }
          </div>
          <div class="or-row">
            <button class="primary-btn" [disabled]="!catalog()" (click)="go('who')">{{ catalog() ? t('Commencer', 'ابدأ') : t('Chargement…', 'جارٍ التحميل…') }} →</button>
            <button class="outline-btn" (click)="router.navigateByUrl('/assistant')">💬 {{ t('Je préfère décrire avec mes mots', 'أفضل الوصف بكلماتي') }}</button>
          </div>
          <p class="or-note">ⓘ {{ t('Outil d’orientation, pas de diagnostic. Vos réponses ne sont pas enregistrées. Urgence vitale : 190.', 'أداة توجيه وليست تشخيصاً. لا يتم حفظ إجاباتك. في حالة الطوارئ: 190.') }}</p>
        </div>
      }

      @case ('who') {
        <div class="or-card">
          <h2>{{ t('Pour qui demandez-vous conseil ?', 'لمن تطلب النصيحة؟') }}</h2>
          <div class="or-grid">
            @for (a of ages; track a.key) {
              <button class="or-tile" [class.on]="age() === a.key" (click)="age.set(a.key); a.key !== 'adult' && pregnant.set(null)">
                <span>{{ a.icon }}</span><b>{{ t(a.fr, a.ar) }}</b><small>{{ t(a.hintFr, a.hintAr) }}</small>
              </button>
            }
          </div>
          @if (age() === 'adult') {
            <div class="or-inline">
              <span>{{ t('Grossesse en cours ?', 'هل هناك حمل؟') }}</span>
              <button [class.on]="pregnant() === true" (click)="pregnant.set(true)">{{ t('Oui', 'نعم') }}</button>
              <button [class.on]="pregnant() === false" (click)="pregnant.set(false)">{{ t('Non / non concerné(e)', 'لا / غير معني') }}</button>
            </div>
          }
          <div class="or-nav"><button class="outline-btn" (click)="go('intro')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" [disabled]="!age()" (click)="go('alarm')">{{ t('Continuer', 'متابعة') }} →</button></div>
        </div>
      }

      @case ('alarm') {
        <div class="or-card or-alarm">
          <h2>{{ t('D’abord, l’essentiel : l’un de ces signes est-il présent maintenant ?', 'أولاً، الأهم: هل توجد إحدى هذه العلامات الآن؟') }}</h2>
          <div class="or-checks">
            @for (f of catalog()!.global_red_flags; track f.key) {
              <label [class.on]="flags().has(f.key)"><input type="checkbox" [checked]="flags().has(f.key)" (change)="toggleFlag(f.key)"><span>{{ f.question }}</span></label>
            }
          </div>
          <div class="or-nav"><button class="outline-btn" (click)="go('who')">← {{ t('Retour', 'رجوع') }}</button>
            @if (hasGlobalFlag()) {
              <button class="primary-btn danger" (click)="evaluate()">{{ t('Voir que faire maintenant', 'ماذا أفعل الآن') }} →</button>
            } @else {
              <button class="primary-btn" (click)="go('category')">{{ t('Aucun de ces signes', 'لا توجد أي علامة') }} →</button>
            }
          </div>
        </div>
      }

      @case ('category') {
        <div class="or-card">
          <h2>{{ t('Où se situe le problème ?', 'أين تكمن المشكلة؟') }}</h2>
          @if (symptoms().size) { <p class="or-chosen">{{ t('Déjà choisi :', 'تم اختيار:') }} {{ chosenLabels() }}</p> }
          <div class="or-grid cats">
            @for (c of catalog()!.categories; track c.key) {
              <button class="or-tile" [class.on]="category() === c.key" (click)="category.set(c.key); go('symptoms')"><span>{{ c.icon }}</span><b>{{ c.label }}</b></button>
            }
          </div>
          <div class="or-nav"><button class="outline-btn" (click)="go('alarm')">← {{ t('Retour', 'رجوع') }}</button>
            @if (symptoms().size) { <button class="primary-btn" (click)="go('flags')">{{ t('Continuer', 'متابعة') }} →</button> }</div>
        </div>
      }

      @case ('symptoms') {
        <div class="or-card">
          <h2>{{ t('Que ressentez-vous ?', 'بماذا تشعر؟') }} <small>{{ t('(plusieurs choix possibles)', '(يمكن اختيار أكثر من واحد)') }}</small></h2>
          <div class="or-chips">
            @for (s of currentCategory()?.symptoms ?? []; track s.key) {
              <button [class.on]="symptoms().has(s.key)" (click)="toggleSymptom(s.key)">{{ symptoms().has(s.key) ? '✓ ' : '' }}{{ s.label }}</button>
            }
          </div>
          <button class="or-link" (click)="go('category')">＋ {{ t('Ajouter un symptôme d’une autre zone', 'إضافة عرض من منطقة أخرى') }}</button>
          <div class="or-nav"><button class="outline-btn" (click)="go('category')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" [disabled]="!symptoms().size" (click)="go('flags')">{{ t('Continuer', 'متابعة') }} →</button></div>
        </div>
      }

      @case ('flags') {
        <div class="or-card or-alarm">
          <h2>{{ t('Quelques vérifications importantes', 'بعض التحققات المهمة') }}</h2>
          <p class="or-sub">{{ t('Cochez uniquement ce qui est présent.', 'اختر فقط ما هو موجود.') }}</p>
          <div class="or-checks">
            @for (f of specificFlags(); track f.key) {
              <label [class.on]="flags().has(f.key)"><input type="checkbox" [checked]="flags().has(f.key)" (change)="toggleFlag(f.key)"><span>{{ f.question }}</span></label>
            } @empty { <p class="or-sub">{{ t('Pas de vérification particulière pour ces symptômes.', 'لا توجد تحققات خاصة لهذه الأعراض.') }}</p> }
          </div>
          <div class="or-nav"><button class="outline-btn" (click)="go('symptoms')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" (click)="go('details')">{{ specificChecked() ? t('Continuer', 'متابعة') : t('Rien de tout cela', 'لا شيء من ذلك') }} →</button></div>
        </div>
      }

      @case ('details') {
        <div class="or-card">
          <h2>{{ t('Depuis combien de temps ?', 'منذ متى؟') }}</h2>
          <div class="or-chips">
            @for (d of durations; track d.key) { <button [class.on]="duration() === d.key" (click)="duration.set(d.key)">{{ t(d.fr, d.ar) }}</button> }
          </div>
          <h2 class="mt">{{ t('Quelle intensité, de 0 à 10 ?', 'ما الشدة من 0 إلى 10؟') }}</h2>
          <div class="or-scale">
            <input type="range" min="0" max="10" step="1" [ngModel]="intensity()" (ngModelChange)="intensity.set(+$event)" [attr.aria-valuetext]="intensity() + '/10'">
            <output [attr.data-sev]="severity()">{{ intensity() }}/10 · {{ severityLabel() }}</output>
          </div>
          <label class="or-gov">{{ t('Votre gouvernorat (facultatif, pour proposer des praticiens proches)', 'ولايتك (اختياري، لاقتراح مختصين قريبين)') }}
            <select [(ngModel)]="governorate"><option value="">—</option>@for (g of governorates; track g) { <option [value]="g">{{ g }}</option> }</select>
          </label>
          <div class="or-nav"><button class="outline-btn" (click)="go('flags')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" [disabled]="!duration() || loading()" (click)="evaluate()">{{ loading() ? t('Analyse…', 'جارٍ التحليل…') : t('Voir mon orientation', 'عرض التوجيه') }} →</button></div>
        </div>
      }

      @case ('result') {
        @if (outcome(); as o) {
          <div class="or-summary">
            <span>{{ ageLabel() }}</span>@if (pregnant()) { <span>{{ t('Grossesse', 'حمل') }}</span> }
            @for (l of chosenList(); track l) { <span>{{ l }}</span> }
            @if (duration()) { <span>{{ durationLabel() }}</span> }
          </div>
          <app-outcome-card [outcome]="o" [governorate]="governorate" [restartLabel]="t('Nouvelle orientation', 'توجيه جديد')" (restart)="reset()" />
        }
      }
    }
  </section>
  `,
  styles: [`
    .or { max-width: 860px; }
    .or-top h1 { font: 800 clamp(24px, 4vw, 36px)/1.15 Montserrat, sans-serif; color: var(--deep); margin: 8px 0 18px; }
    .or-progress { height: 6px; border-radius: 3px; background: #0b325e14; margin-bottom: 18px; overflow: hidden; }
    .or-progress i { display: block; height: 100%; background: linear-gradient(90deg, var(--teal), var(--mint)); transition: width .3s; }
    .or-card { background:var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 26px; box-shadow: 0 10px 30px #0b325e0d; }
    .or-card h2 { margin: 0 0 16px; font: 800 19px/1.3 Montserrat, sans-serif; color: var(--deep); }
    .or-card h2 small { font: 500 13px 'Roboto Flex', sans-serif; color: var(--muted); }
    .or-card h2.mt { margin-top: 24px; }
    .or-lead { font-size: 16px; line-height: 1.6; color: var(--text2); margin: 0 0 18px; }
    .or-method { list-style: none; padding: 0; margin: 0 0 18px; display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .or-method li { display: flex; gap: 12px; padding: 14px; border-radius: 14px; background: var(--pale); }
    .or-method b { flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background:var(--navy-bg); color: #fff; font-size: 13px; }
    .or-method strong { display: block; color: var(--deep); font-size: 14px; margin-bottom: 2px; }
    .or-method span { font-size: 13px; color: var(--text2); line-height: 1.45; }
    .or-ladder { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
    .or-ladder span { font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: #e8f6ef; color: #0a7a55; }
    .or-ladder [data-level="2"] { background:var(--surface2); color: var(--text2); } .or-ladder [data-level="3"] { background: #fff5e0; color: #9a6200; }
    .or-ladder [data-level="4"] { background: #fff0e8; color: #c2410c; } .or-ladder [data-level="5"] { background: #fdecec; color: #b91c1c; }
    .or-row, .or-nav { display: flex; flex-wrap: wrap; gap: 10px; }
    .or-nav { justify-content: space-between; margin-top: 22px; }
    .or-row button, .or-nav button { padding: 12px 18px; border-radius: 12px; font-weight: 700; }
    .primary-btn.danger { background: #b91c1c; }
    .or-note { margin: 16px 0 0; font-size: 12px; color: var(--muted); }
    .or-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .or-grid.cats { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
    .or-tile { display: grid; gap: 4px; justify-items: start; text-align: start; padding: 14px; border: 1.5px solid var(--line); border-radius: 14px; background:var(--surface); color: var(--deep); transition: border-color .15s, transform .15s; }
    .or-tile:hover { border-color: var(--teal); transform: translateY(-1px); }
    .or-tile.on { border-color: var(--teal); background:var(--surface2); }
    .or-tile span { font-size: 22px; color: var(--teal); }
    .or-tile b { font-size: 14px; } .or-tile small { color: var(--muted); font-size: 12px; }
    .or-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 16px; padding: 12px; border-radius: 12px; background: var(--pale); font-weight: 600; color: var(--deep); }
    .or-inline button, .or-chips button { border: 1.5px solid var(--line); background:var(--surface); color: var(--navy); border-radius: 999px; padding: 8px 14px; font-weight: 600; font-size: 14px; }
    .or-inline button.on, .or-chips button.on { border-color: var(--teal); background: var(--teal); color: #fff; }
    .or-chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .or-checks { display: grid; gap: 8px; }
    .or-checks label { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border: 1.5px solid var(--line); border-radius: 12px; cursor: pointer; font-size: 14px; line-height: 1.45; color: var(--ink); }
    .or-checks label.on { border-color: #c2410c; background: #fff4ee; }
    .or-checks input { width: 18px; height: 18px; margin-top: 1px; accent-color: #c2410c; flex: none; }
    .or-sub, .or-chosen { color: var(--muted); font-size: 13px; margin: -8px 0 12px; }
    .or-link { margin-top: 14px; border: 0; background: none; color: var(--text2); font-weight: 700; padding: 0; }
    .or-scale { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
    .or-scale input { flex: 1 1 240px; accent-color: var(--teal); }
    .or-scale output { font-weight: 800; color: #0a7a55; min-width: 120px; }
    .or-scale output[data-sev="moderate"] { color: #9a6200; } .or-scale output[data-sev="severe"] { color: #c2410c; }
    .or-gov { display: grid; gap: 6px; margin-top: 22px; font-size: 13px; font-weight: 600; color: var(--text2); }
    .or-gov select { max-width: 320px; height: 42px; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; background:var(--surface); }
    .or-summary { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
    .or-summary span { font-size: 12px; padding: 4px 10px; border-radius: 999px; background: var(--pale); color: var(--navy); font-weight: 600; }
    .or-error { color: var(--coral); }
    @media (max-width: 560px) { .or-card { padding: 18px; } .or-nav button { flex: 1; } }
  `],
})
export class OrientationComponent {
  readonly router = inject(Router);
  private triage = inject(TriageService);
  private langService = inject(LangService);

  readonly catalog = signal<Catalog | null>(null);
  readonly step = signal<Step>('intro');
  readonly age = signal<AgeGroup | null>(null);
  readonly pregnant = signal<boolean | null>(null);
  readonly flags = signal(new Set<string>());
  readonly category = signal<string | null>(null);
  readonly symptoms = signal(new Set<string>());
  readonly duration = signal<Duration | null>(null);
  readonly intensity = signal(4);
  readonly outcome = signal<Outcome | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  governorate = '';
  readonly governorates = GOVERNORATES;

  readonly ages: { key: AgeGroup; icon: string; fr: string; ar: string; hintFr: string; hintAr: string }[] = [
    { key: 'adult', icon: '●', fr: 'Moi / un adulte', ar: 'أنا / شخص بالغ', hintFr: '15 à 64 ans', hintAr: 'من 15 إلى 64 سنة' },
    { key: 'child', icon: '◔', fr: 'Un enfant', ar: 'طفل', hintFr: '2 à 15 ans', hintAr: 'من 2 إلى 15 سنة' },
    { key: 'infant', icon: '◕', fr: 'Un bébé', ar: 'رضيع', hintFr: 'moins de 2 ans', hintAr: 'أقل من سنتين' },
    { key: 'senior', icon: '◉', fr: 'Une personne âgée', ar: 'شخص مسن', hintFr: '65 ans et plus', hintAr: '65 سنة فأكثر' },
  ];
  readonly durations: { key: Duration; fr: string; ar: string }[] = [
    { key: 'hours', fr: 'Quelques heures', ar: 'بضع ساعات' }, { key: 'days', fr: '1 à 3 jours', ar: 'من يوم إلى 3 أيام' },
    { key: 'week', fr: '4 à 7 jours', ar: 'من 4 إلى 7 أيام' }, { key: 'weeks', fr: 'Plus d’une semaine', ar: 'أكثر من أسبوع' },
  ];

  readonly progress = computed(() => Math.round(((FLOW.indexOf(this.step()) + 1) / FLOW.length) * 100));
  readonly currentCategory = computed(() => this.catalog()?.categories.find((c) => c.key === this.category()));
  readonly hasGlobalFlag = computed(() => this.catalog()?.global_red_flags.some((f) => this.flags().has(f.key)) ?? false);
  readonly severity = computed<Severity>(() => (this.intensity() >= 7 ? 'severe' : this.intensity() >= 4 ? 'moderate' : 'mild'));
  readonly specificFlags = computed(() => {
    const cat = this.catalog();
    if (!cat) return [];
    const keys = new Set<string>();
    for (const c of cat.categories) for (const s of c.symptoms) if (this.symptoms().has(s.key)) s.red_flags.forEach((k) => keys.add(k));
    const ok = (k: string) => (k === 'fever_infant' ? this.age() === 'infant'
      : ['pregnancy_bleeding_pain', 'reduced_fetal_movement'].includes(k) ? this.pregnant() === true : true);
    return [...keys].filter(ok).map((k) => ({ key: k, ...cat.red_flags[k] })).filter((f) => f.question)
      .sort((a, b) => b.level - a.level);
  });
  readonly specificChecked = computed(() => this.specificFlags().some((f) => this.flags().has(f.key)));
  readonly chosenList = computed(() => {
    const cat = this.catalog();
    return cat ? cat.categories.flatMap((c) => c.symptoms).filter((s) => this.symptoms().has(s.key)).map((s) => s.label) : [];
  });
  readonly chosenLabels = computed(() => this.chosenList().join(', '));

  constructor() {
    // Recharge le catalogue (et le résultat) quand la langue change
    effect(() => {
      this.langService.lang();
      untracked(() => { this.loadCatalog(); if (this.step() === 'result') this.evaluate(); });
    });
  }

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }
  severityLabel() { return { mild: this.t('légère', 'خفيفة'), moderate: this.t('modérée', 'متوسطة'), severe: this.t('intense', 'شديدة') }[this.severity()]; }
  ageLabel() { const a = this.ages.find((x) => x.key === this.age()); return a ? this.t(a.fr, a.ar) : ''; }
  durationLabel() { const d = this.durations.find((x) => x.key === this.duration()); return d ? this.t(d.fr, d.ar) : ''; }

  async loadCatalog() {
    this.error.set('');
    try { this.catalog.set(await this.triage.catalog(this.langService.lang())); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Erreur'); }
  }

  go(step: Step) {
    this.step.set(step);
    globalThis.scrollTo?.({ top: 0, behavior: 'smooth' });
  }
  toggleFlag(key: string) { this.flags.update((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; }); }
  toggleSymptom(key: string) { this.symptoms.update((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; }); }

  async evaluate() {
    this.loading.set(true);
    this.error.set('');
    try {
      const urgent = this.hasGlobalFlag();
      this.outcome.set(await this.triage.evaluate({
        symptoms: urgent ? [] : [...this.symptoms()],
        red_flags: [...this.flags()],
        age_group: this.age(), pregnant: this.pregnant(),
        duration: urgent ? null : this.duration(), severity: urgent ? null : this.severity(),
        lang: this.langService.lang(), governorate: this.governorate || undefined,
      }));
      this.go('result');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur');
    } finally {
      this.loading.set(false);
    }
  }

  reset() {
    this.age.set(null); this.pregnant.set(null); this.flags.set(new Set()); this.category.set(null);
    this.symptoms.set(new Set()); this.duration.set(null); this.intensity.set(4); this.outcome.set(null);
    this.go('who');
  }
}
