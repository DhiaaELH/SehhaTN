import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LangService } from './lang.service';
import { GOVERNORATES } from './doctor.service';
import { BodyMapComponent } from './body-map.component';
import { OutcomeCardComponent } from './outcome-card.component';
import { AgeGroup, Catalog, Duration, Outcome, Severity, TriageService } from './triage.service';

type Step = 'intro' | 'who' | 'alarm' | 'symptoms' | 'flags' | 'details' | 'result';
interface Snapshot { step: Step; age: AgeGroup | null; pregnant: boolean | null; flags: string[]; symptoms: string[]; history: string[]; duration: Duration | null; intensity: number }

const STORE_KEY = 'sehhatn_orientation';
/** Catégories pour lesquelles la grossesse change l'orientation. */
const PREGNANCY_CATEGORIES = ['belly', 'women', 'urinary'];
/** Spécialité touchée sur la silhouette → catégorie de symptômes. */
const ZONE_TO_CATEGORY: [RegExp, string][] = [
  [/cardio|pneumo/, 'chest'], [/derma/, 'skin'], [/orl/, 'ent'], [/ophtalmo/, 'eyes'], [/dent/, 'mouth'],
  [/gastro/, 'belly'], [/neuro/, 'head'], [/rhumato|ortho|kin/, 'bones'], [/gyn/, 'women'], [/uro|n[ée]phro/, 'urinary'],
  [/psych/, 'mind'], [/g[ée]n[ée]raliste|endocrino|p[ée]diatre/, 'general'],
];

/** Minuscules, sans accents ni signes diacritiques arabes : pour comparer ce que l'on tape et les libellés. */
function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[’'`]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Orientation guidée : vers le bon niveau de soins et le bon spécialiste, en quelques questions. */
@Component({
  selector: 'app-orientation',
  standalone: true,
  imports: [FormsModule, OutcomeCardComponent, BodyMapComponent],
  template: `
  <section class="page-section or">
    <div class="or-top">
      <span class="section-kicker">{{ t('ORIENTATION SANTÉ', 'التوجيه الصحي') }}</span>
      <h1>{{ t('Le bon soin, au bon endroit, au bon moment.', 'الرعاية المناسبة، في المكان المناسب، في الوقت المناسب.') }}</h1>
      @if (step() !== 'intro' && step() !== 'result') {
        <p class="or-step">{{ t('Étape', 'الخطوة') }} {{ stepNumber() }} {{ t('sur', 'من') }} {{ flow().length }}</p>
        <div class="or-progress" role="progressbar" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100">
          <i [style.width.%]="progress()"></i>
        </div>
      }
    </div>

    @if (error()) { <p class="or-error" role="alert">{{ error() }} <button class="outline-btn" (click)="loadCatalog()">{{ t('Réessayer', 'إعادة المحاولة') }}</button></p> }

    @switch (step()) {
      @case ('intro') {
        <div class="or-card or-intro">
          <p class="or-lead">{{ t('Quelques questions, puis nous vous indiquons le soin adapté et le spécialiste à consulter.', 'بضعة أسئلة ثم نحدد لك الرعاية المناسبة والمختص الذي تستشيره.') }}</p>
          <div class="or-row">
            <button class="or-go" [disabled]="!catalog()" (click)="start()">{{ catalog() ? t('Commencer', 'ابدأ') : t('Chargement…', 'جارٍ التحميل…') }} →</button>
            <button class="or-chat" (click)="router.navigateByUrl('/assistant')">💬 {{ t('Je préfère décrire avec mes mots', 'أفضل الوصف بكلماتي') }}</button>
          </div>
          @if (saved()) { <button class="or-resume" (click)="resume()">↩ {{ t('Reprendre là où j’en étais', 'متابعة من حيث توقفت') }}</button> }
          <ol class="or-method">
            <li><b>1</b>{{ t('Signes d’alerte', 'علامات الخطر') }}</li>
            <li><b>2</b>{{ t('Symptômes et situation', 'الأعراض والوضع') }}</li>
            <li><b>3</b>{{ t('Bonne porte d’entrée', 'الباب المناسب') }}</li>
          </ol>
          @if (catalog()?.protocol; as pr) {
            <details class="or-method-box"><summary>{{ t('Méthode et relecture', 'المنهج والمراجعة') }}</summary>
              <p>{{ pr.basis }}</p>
              <p>{{ pr.reviewed_by ? t('Relu par ', 'تمت المراجعة من طرف ') + pr.reviewed_by + (pr.reviewed_on ? ' · ' + pr.reviewed_on : '') : t('Ce contenu n’a pas encore été relu par un professionnel de santé : il ne remplace jamais un avis médical.', 'لم يراجع مختص في الصحة هذا المحتوى بعد: ولا يغني أبداً عن رأي الطبيب.') }}</p>
            </details>
          }
          <p class="or-note">ⓘ {{ t('Outil d’orientation, pas de diagnostic. Vos réponses ne sont pas enregistrées sur nos serveurs. Urgence vitale : 190.', 'أداة توجيه وليست تشخيصاً. لا تُحفظ إجاباتك على خوادمنا. في حالة الطوارئ: 190.') }}</p>
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
          <div class="or-nav"><button class="outline-btn" (click)="go('intro')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" [disabled]="!age()" (click)="go('alarm')">{{ t('Continuer', 'متابعة') }} →</button></div>
        </div>
      }

      @case ('alarm') {
        <div class="or-card or-alarm">
          <h2>{{ t('D’abord, l’essentiel : l’un de ces signes est-il présent maintenant ?', 'أولاً، الأهم: هل توجد إحدى هذه العلامات الآن؟') }}</h2>
          <div class="or-checks">
            @for (f of catalog()?.global_red_flags ?? []; track f.key) {
              <label [class.on]="flags().has(f.key)"><input type="checkbox" [checked]="flags().has(f.key)" (change)="toggleFlag(f.key)"><span>{{ f.question }}</span></label>
            }
          </div>
          <div class="or-nav"><button class="outline-btn" (click)="go('who')">← {{ t('Retour', 'رجوع') }}</button>
            @if (hasUrgentFlag()) {
              <button class="primary-btn danger" [disabled]="loading()" (click)="evaluate()">{{ t('Voir que faire maintenant', 'ماذا أفعل الآن') }} →</button>
            } @else {
              <button class="primary-btn" (click)="go('symptoms')">{{ t('Aucun de ces signes', 'لا توجد أي علامة') }} →</button>
            }
          </div>
        </div>
      }

      @case ('symptoms') {
        <div class="or-card">
          <h2>{{ t('Que ressentez-vous ?', 'بماذا تشعر؟') }} <small>{{ t('(plusieurs choix possibles)', '(يمكن اختيار أكثر من واحد)') }}</small></h2>

          <label class="or-search"><span class="sr">{{ t('Rechercher un symptôme', 'ابحث عن عرض') }}</span>
            <input type="search" [ngModel]="query()" (ngModelChange)="query.set($event)" autocomplete="off"
              [placeholder]="t('Rechercher : fièvre, mal au ventre, piqûre, صداع…', 'ابحث: حمى، ألم البطن، لسعة، صداع…')">
          </label>
          @if (query().trim().length >= 2) {
            <div class="or-found">
              @for (r of results(); track r.key) {
                <button class="or-pill" [class.on]="symptoms().has(r.key)" (click)="toggleSymptom(r.key)">{{ symptoms().has(r.key) ? '✓ ' : '' }}{{ r.label }}<small>{{ r.category }}</small></button>
              }
            </div>
          }

          @if (chosenItems().length) {
            <div class="or-chosen-row">{{ t('Choisi :', 'المختار:') }}
              @for (c of chosenItems(); track c.key) { <button (click)="toggleSymptom(c.key)" [attr.aria-label]="t('Retirer', 'إزالة') + ' ' + c.label">{{ c.label }} ✕</button> }
            </div>
          }

          <details class="or-body" [open]="bodyOpen()" (toggle)="bodyOpen.set($any($event.target).open)">
            <summary>{{ t('Montrer sur le corps', 'أشر على الجسم') }}</summary>
            <app-body-map (pick)="pickZone($event)" />
          </details>

          <h3 class="or-h3">{{ t('Ou choisissez une zone', 'أو اختر منطقة') }}</h3>
          <div class="or-grid cats">
            @for (c of catalog()?.categories ?? []; track c.key) {
              <button class="or-tile" [class.on]="category() === c.key" (click)="category.set(category() === c.key ? null : c.key)"><span>{{ c.icon }}</span><b>{{ c.label }}</b></button>
            }
          </div>
          @if (currentCategory(); as cc) {
            <div class="or-chips mt2">
              @for (s of cc.symptoms; track s.key) {
                <button [class.on]="symptoms().has(s.key)" (click)="toggleSymptom(s.key)">{{ symptoms().has(s.key) ? '✓ ' : '' }}{{ s.label }}</button>
              }
            </div>
          }

          <div class="or-other">
            <b>{{ t('Vous ne trouvez pas votre symptôme ?', 'لا تجد عرضك؟') }}</b>
            <div>
              <button (click)="router.navigateByUrl('/assistant')">💬 {{ t('Le décrire avec mes mots', 'وصفه بكلماتي') }}</button>
              <button (click)="skipSymptoms()">{{ t('Je ne sais pas : voir un médecin généraliste', 'لا أعرف: استشارة طبيب عام') }}</button>
            </div>
          </div>

          <div class="or-nav"><button class="outline-btn" (click)="go('alarm')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" [disabled]="!symptoms().size" (click)="afterSymptoms()">{{ t('Continuer', 'متابعة') }} →</button></div>
        </div>
      }

      @case ('flags') {
        <div class="or-card or-alarm">
          <h2>{{ t('Quelques vérifications importantes', 'بعض التحققات المهمة') }}</h2>
          @if (askPregnancy()) {
            <div class="or-inline">
              <span>{{ t('Grossesse en cours ?', 'هل هناك حمل؟') }}</span>
              <button [class.on]="pregnant() === true" (click)="pregnant.set(true)">{{ t('Oui', 'نعم') }}</button>
              <button [class.on]="pregnant() === false" (click)="pregnant.set(false)">{{ t('Non / non concernée', 'لا / غير معنية') }}</button>
            </div>
          }
          @if (specificFlags().length) { <p class="or-sub">{{ t('Cochez uniquement ce qui est présent.', 'اختر فقط ما هو موجود.') }}</p> }
          <div class="or-checks">
            @for (f of specificFlags(); track f.key) {
              <label [class.on]="flags().has(f.key)"><input type="checkbox" [checked]="flags().has(f.key)" (change)="toggleFlag(f.key)"><span>{{ f.question }}</span></label>
            }
          </div>
          <div class="or-nav"><button class="outline-btn" (click)="go('symptoms')">← {{ t('Retour', 'رجوع') }}</button>
            @if (hasUrgentFlag()) {
              <button class="primary-btn danger" [disabled]="loading()" (click)="evaluate()">{{ t('Voir que faire maintenant', 'ماذا أفعل الآن') }} →</button>
            } @else {
              <button class="primary-btn" (click)="go('details')">{{ specificChecked() ? t('Continuer', 'متابعة') : t('Rien de tout cela', 'لا شيء من ذلك') }} →</button>
            }
          </div>
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
          @if (catalog()?.history?.length) {
            <h2 class="mt">{{ t('Votre situation', 'وضعك الصحي') }} <small class="or-optional">{{ t('(facultatif : cochez ce qui vous concerne)', '(اختياري: اختر ما ينطبق عليك)') }}</small></h2>
            <div class="or-chips">
              @for (h of catalog()!.history; track h.key) { <button [class.on]="history().has(h.key)" (click)="toggleHistory(h.key)">{{ history().has(h.key) ? '✓ ' : '' }}{{ h.label }}</button> }
            </div>
          }
          <label class="or-gov">{{ t('Votre gouvernorat (facultatif, pour proposer des praticiens proches)', 'ولايتك (اختياري، لاقتراح مختصين قريبين)') }}
            <select [(ngModel)]="governorate"><option value="">—</option>@for (g of governorates; track g) { <option [value]="g">{{ g }}</option> }</select>
          </label>
          <div class="or-nav"><button class="outline-btn" (click)="go(needsFlags() ? 'flags' : 'symptoms')">← {{ t('Retour', 'رجوع') }}</button>
            <button class="primary-btn" [disabled]="!duration() || loading()" (click)="evaluate()">{{ loading() ? t('Analyse…', 'جارٍ التحليل…') : t('Voir mon orientation', 'عرض التوجيه') }} →</button></div>
        </div>
      }

      @case ('result') {
        @if (outcome(); as o) {
          <div class="or-summary">
            <span>{{ ageLabel() }}</span>@if (pregnant()) { <span>{{ t('Grossesse', 'حمل') }}</span> }
            @for (l of chosenItems(); track l.key) { <span>{{ l.label }}</span> }
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
    .or-method { list-style: none; padding: 0; margin: 22px 0 0; display: flex; flex-wrap: wrap; gap: 6px 18px; font-size: 12px; color: var(--muted); }
    .or-method li { display: flex; align-items: center; gap: 7px; }
    .or-method b { width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: var(--surface2); color: var(--text2); font-size: 10px; }
    .or-go, .or-chat { border: 0; padding: 16px 26px !important; font-size: 16px; font-weight: 800; color: #fff; cursor: pointer; }
    .or-go { background: var(--teal); }
    .or-chat { background: var(--navy-bg); }
    .or-go:hover:not(:disabled) { filter: brightness(.92); } .or-chat:hover { filter: brightness(1.25); }
    .or-go:disabled { opacity: .6; cursor: wait; }
    :host-context(html[data-theme='dark']) .or-go { color: #04202a; }
    @media (max-width: 560px) { .or-go, .or-chat { width: 100%; } }
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
      .or-step { margin: 0 0 12px; font-size: 12px; font-weight: 700; color: var(--muted); letter-spacing: .04em; }
    .or-search { display: block; margin: 0 0 12px; }
    .or-search input { width: 100%; height: 50px; border: 2px solid var(--line); padding: 0 14px; font-size: 16px; background: var(--surface); color: var(--ink); }
    .or-search input:focus { border-color: var(--teal); outline: none; }
    .sr { position: absolute; left: -9999px; }
    .or-found { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 14px; }
    .or-found button small { display: block; font-size: 11px; font-weight: 500; opacity: .7; }
    .or-chosen-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0 14px; font-size: 13px; color: var(--muted); }
    .or-chosen-row button { border: 0; background: var(--teal); color: #fff; padding: 5px 10px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .or-h3 { margin: 18px 0 8px; font: 800 14px Montserrat, sans-serif; color: var(--deep); }
    .or-body { margin: 6px 0 0; border: 1px solid var(--line); padding: 8px 12px; }
    .or-body summary { cursor: pointer; font-weight: 700; color: var(--text2); }
    .or-other { margin-top: 18px; padding: 14px; background: var(--pale); display: grid; gap: 8px; font-size: 13px; color: var(--text2); }
    .or-other div { display: flex; flex-wrap: wrap; gap: 8px; }
    .or-other button { border: 1.5px solid var(--line); background: var(--surface); color: var(--navy); padding: 8px 14px; font-weight: 700; font-size: 13px; cursor: pointer; }
    .or-other button:hover { border-color: var(--teal); }
    .or-method-box { margin-top: 14px; font-size: 12px; color: var(--muted); }
    .or-method-box summary { cursor: pointer; font-weight: 700; color: var(--text2); }
    .or-method-box p { margin: 6px 0 0; line-height: 1.55; }
    .or-resume { margin-top: 12px; border: 1.5px dashed var(--teal); background: none; color: var(--text2); padding: 10px 16px; font-weight: 700; cursor: pointer; }
    .or-optional { font-weight: 500; font-size: 13px; color: var(--muted); }
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
  readonly history = signal(new Set<string>());
  readonly duration = signal<Duration | null>(null);
  readonly intensity = signal(4);
  readonly query = signal('');
  readonly bodyOpen = signal(false);
  readonly outcome = signal<Outcome | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly saved = signal<Snapshot | null>(null);
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

  readonly allSymptoms = computed(() => (this.catalog()?.categories ?? []).flatMap((c) => c.symptoms.map((s) => ({ ...s, category: c.label, categoryKey: c.key }))));
  readonly currentCategory = computed(() => this.catalog()?.categories.find((c) => c.key === this.category()));
  readonly severity = computed<Severity>(() => (this.intensity() >= 7 ? 'severe' : this.intensity() >= 4 ? 'moderate' : 'mild'));

  /** Un signe d'alerte de niveau 4 ou 5 coché : on passe directement au résultat, sans poser d'autres questions. */
  readonly hasUrgentFlag = computed(() => {
    const defs = this.catalog()?.red_flags ?? {};
    return [...this.flags()].some((k) => (defs[k]?.level ?? 0) >= 4);
  });
  readonly askPregnancy = computed(() => {
    if (this.age() !== 'adult') return false;
    const keys = new Set(this.allSymptoms().filter((s) => this.symptoms().has(s.key)).map((s) => s.categoryKey));
    return PREGNANCY_CATEGORIES.some((c) => keys.has(c));
  });
  readonly specificFlags = computed(() => {
    const cat = this.catalog();
    if (!cat) return [];
    const keys = new Set<string>();
    for (const s of this.allSymptoms()) if (this.symptoms().has(s.key)) s.red_flags.forEach((k) => keys.add(k));
    const ok = (k: string) => (k === 'fever_infant' ? this.age() === 'infant'
      : ['pregnancy_bleeding_pain', 'reduced_fetal_movement'].includes(k) ? this.pregnant() === true : true);
    return [...keys].filter(ok).map((k) => ({ key: k, ...cat.red_flags[k] })).filter((f) => f.question)
      .sort((a, b) => b.level - a.level);
  });
  readonly specificChecked = computed(() => this.specificFlags().some((f) => this.flags().has(f.key)));
  /** L'étape des vérifications n'apparaît que s'il y a quelque chose à demander. */
  readonly needsFlags = computed(() => this.askPregnancy() || this.specificFlags().length > 0);
  readonly flow = computed<Step[]>(() => ['who', 'alarm', 'symptoms', ...(this.needsFlags() ? ['flags' as Step] : []), 'details']);
  readonly stepNumber = computed(() => Math.max(1, this.flow().indexOf(this.step()) + 1));
  readonly progress = computed(() => Math.round((this.stepNumber() / this.flow().length) * 100));
  readonly chosenItems = computed(() => this.allSymptoms().filter((s) => this.symptoms().has(s.key)).map((s) => ({ key: s.key, label: s.label })));

  /** Recherche tolérante : sans accents, par libellé ou synonyme (français, arabe, darija). */
  readonly results = computed(() => {
    const tokens = norm(this.query()).split(' ').filter(Boolean);
    if (!tokens.length) return [];
    return this.allSymptoms()
      .map((s) => {
        const label = norm(s.label);
        const hay = `${label} | ${s.synonyms.map(norm).join(' | ')}`;
        return { s, hit: tokens.every((t) => hay.includes(t)), top: tokens.every((t) => label.includes(t)) };
      })
      .filter((x) => x.hit)
      .sort((a, b) => Number(b.top) - Number(a.top))
      .slice(0, 10)
      .map((x) => x.s);
  });

  constructor() {
    this.saved.set(this.read());
    // Recharge le catalogue (et le résultat) quand la langue change
    effect(() => {
      this.langService.lang();
      untracked(() => { this.loadCatalog(); if (this.step() === 'result') this.evaluate(); });
    });
    // Garde les réponses pour la durée de l'onglet : un rechargement de page ne fait pas tout perdre
    effect(() => {
      const snap: Snapshot = {
        step: this.step(), age: this.age(), pregnant: this.pregnant(), flags: [...this.flags()], symptoms: [...this.symptoms()],
        history: [...this.history()], duration: this.duration(), intensity: this.intensity(),
      };
      untracked(() => this.write(snap));
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
  start() { this.clearAnswers(); this.go('who'); }
  resume() {
    const s = this.saved();
    if (!s) return;
    this.age.set(s.age); this.pregnant.set(s.pregnant); this.flags.set(new Set(s.flags)); this.symptoms.set(new Set(s.symptoms));
    this.history.set(new Set(s.history)); this.duration.set(s.duration); this.intensity.set(s.intensity);
    this.go(s.step === 'intro' || s.step === 'result' ? 'who' : s.step);
  }
  afterSymptoms() { this.go(this.needsFlags() ? 'flags' : 'details'); }
  /** « Je ne sais pas » : aucun symptôme précis, le médecin généraliste est le bon point de départ. */
  skipSymptoms() { this.symptoms.set(new Set()); this.go('details'); }

  toggleFlag(key: string) { this.flags.update((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; }); }
  toggleSymptom(key: string) { this.symptoms.update((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; }); }
  toggleHistory(key: string) { this.history.update((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; }); }

  /** Zone touchée sur la silhouette → catégorie de symptômes correspondante. */
  pickZone(specialty: string) {
    const s = specialty.toLowerCase();
    const hit = ZONE_TO_CATEGORY.find(([re]) => re.test(s));
    if (hit) { this.category.set(hit[1]); this.bodyOpen.set(false); }
  }

  async evaluate() {
    this.loading.set(true);
    this.error.set('');
    try {
      const urgent = this.hasUrgentFlag();
      this.outcome.set(await this.triage.evaluate({
        symptoms: urgent ? [] : [...this.symptoms()],
        red_flags: [...this.flags()],
        age_group: this.age(), pregnant: this.pregnant(),
        duration: urgent ? null : this.duration() ?? 'days', severity: urgent ? null : this.severity(),
        history: urgent ? [] : [...this.history()],
        lang: this.langService.lang(), governorate: this.governorate || undefined,
      }));
      this.go('result');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur');
    } finally {
      this.loading.set(false);
    }
  }

  reset() { this.clearAnswers(); this.go('who'); }

  private clearAnswers() {
    this.age.set(null); this.pregnant.set(null); this.flags.set(new Set()); this.category.set(null); this.query.set('');
    this.symptoms.set(new Set()); this.history.set(new Set()); this.duration.set(null); this.intensity.set(4); this.outcome.set(null);
    this.saved.set(null);
  }

  private read(): Snapshot | null {
    try {
      const raw = globalThis.sessionStorage?.getItem(STORE_KEY);
      const s = raw ? (JSON.parse(raw) as Snapshot) : null;
      return s && (s.age || s.symptoms?.length) && s.step !== 'intro' ? s : null;
    } catch { return null; }
  }
  private write(snap: Snapshot) {
    try {
      if (snap.step === 'intro' && !snap.age && !snap.symptoms.length) return;   // ne pas effacer une saisie à reprendre
      if (!snap.age && !snap.symptoms.length) { globalThis.sessionStorage?.removeItem(STORE_KEY); return; }
      if (snap.step === 'intro') return;
      globalThis.sessionStorage?.setItem(STORE_KEY, JSON.stringify(snap));
    } catch { /* stockage indisponible : on continue sans */ }
  }
}
