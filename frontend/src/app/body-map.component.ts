import { Component, computed, inject, output, signal } from '@angular/core';
import { LangService } from './lang.service';
import { BODY_VIEWS, IMAGE_SIZE } from './body-zones';

/** Une zone cliquable. Son dessin (chemins SVG) est dans body-zones.ts, sous le même `id`. */
type Zone = { id: string; fr: string; ar: string; specs: string[]; feature?: boolean };

const FRONT: Zone[] = [
  { id: 'head', fr: 'Tête', ar: 'الرأس', specs: ['Neurologue', 'Psychiatre', 'Médecin généraliste'] },
  { id: 'eyes', fr: 'Yeux', ar: 'العينان', specs: ['Ophtalmologue'], feature: true },
  { id: 'mouth', fr: 'Bouche et dents', ar: 'الفم والأسنان', specs: ['Dentiste', 'ORL'], feature: true },
  { id: 'neck', fr: 'Cou et gorge', ar: 'الرقبة والحلق', specs: ['ORL', 'Endocrinologue'] },
  { id: 'arms', fr: 'Bras et épaules', ar: 'الذراعان والكتفان', specs: ['Orthopédiste', 'Médecin généraliste'] },
  { id: 'chest', fr: 'Poitrine', ar: 'الصدر', specs: ['Cardiologue', 'Pneumologue'] },
  { id: 'belly', fr: 'Ventre', ar: 'البطن', specs: ['Gastro-entérologue', 'Médecin généraliste'] },
  { id: 'pelvis', fr: 'Bassin', ar: 'الحوض', specs: ['Gynécologue', 'Médecin généraliste'] },
  { id: 'hands', fr: 'Mains', ar: 'اليدان', specs: ['Orthopédiste', 'Dermatologue'] },
  { id: 'legs', fr: 'Jambes et genoux', ar: 'الساقان والركبتان', specs: ['Orthopédiste', 'Médecin généraliste'] },
  { id: 'feet', fr: 'Pieds', ar: 'القدمان', specs: ['Orthopédiste', 'Dermatologue'] },
];

const BACK: Zone[] = [
  { id: 'head', fr: 'Tête', ar: 'الرأس', specs: ['Neurologue', 'Médecin généraliste'] },
  { id: 'neck', fr: 'Nuque', ar: 'الرقبة', specs: ['Orthopédiste', 'Neurologue'] },
  { id: 'arms', fr: 'Bras et épaules', ar: 'الذراعان والكتفان', specs: ['Orthopédiste', 'Médecin généraliste'] },
  { id: 'upper', fr: 'Haut du dos', ar: 'أعلى الظهر', specs: ['Orthopédiste', 'Neurologue', 'Pneumologue'] },
  { id: 'lower', fr: 'Bas du dos', ar: 'أسفل الظهر', specs: ['Orthopédiste', 'Neurologue'] },
  { id: 'glutes', fr: 'Fessiers et hanches', ar: 'الأرداف والورك', specs: ['Orthopédiste', 'Gastro-entérologue'] },
  { id: 'hands', fr: 'Mains', ar: 'اليدان', specs: ['Orthopédiste', 'Dermatologue'] },
  { id: 'legs', fr: 'Jambes et genoux', ar: 'الساقان والركبتان', specs: ['Orthopédiste', 'Médecin généraliste'] },
  { id: 'feet', fr: 'Pieds', ar: 'القدمان', specs: ['Orthopédiste', 'Dermatologue'] },
];

const EXTRA: Zone[] = [
  { id: 'skin', fr: 'Peau', ar: 'الجلد', specs: ['Dermatologue'] },
  { id: 'child', fr: 'Enfant', ar: 'الطفل', specs: ['Pédiatre'] },
  { id: 'mind', fr: 'Santé mentale', ar: 'الصحة النفسية', specs: ['Psychiatre'] },
];

@Component({
  selector: 'app-body-map',
  standalone: true,
  template: `
    <div class="bm" [attr.dir]="lang() === 'ar' ? 'rtl' : 'ltr'">
      <div class="bm-top">
        <div>
          <h2>{{ t('Où avez-vous mal ?', 'أين تشعر بالألم؟') }}</h2>
          <p>{{ t('Touchez une zone du corps.', 'اضغط على جزء من الجسم.') }}</p>
        </div>
        <div class="bm-toggle" role="group" [attr.aria-label]="t('Vue du corps', 'عرض الجسم')">
          <button type="button" [class.on]="side() === 'front'" (click)="setSide('front')">{{ t('Face', 'أمام') }}</button>
          <button type="button" [class.on]="side() === 'back'" (click)="setSide('back')">{{ t('Dos', 'خلف') }}</button>
        </div>
      </div>

      <div class="bm-body">
        <div class="bm-figure">
          <!-- Une seule boîte SVG : l'image et les zones partagent exactement les mêmes coordonnées,
               donc elles restent alignées quelle que soit la taille d'affichage. -->
          <svg class="bm-svg" [attr.viewBox]="view().viewBox" preserveAspectRatio="xMidYMid meet"
               role="group" [attr.aria-label]="t('Corps humain', 'جسم الإنسان')">
            <image [attr.href]="view().src" x="0" y="0" [attr.width]="size.width" [attr.height]="size.height" aria-hidden="true" />
            @for (z of drawZones(); track z.id) {
              <g>
                @for (d of view().zones[z.id]; track $index) {
                  <path [attr.d]="d" class="bm-zone"
                        [class.hot]="hover()?.id === z.id" [class.sel]="sel()?.id === z.id"
                        [attr.tabindex]="$first ? 0 : -1" role="button"
                        [attr.aria-label]="label(z)" [attr.aria-pressed]="sel()?.id === z.id"
                        (click)="choose(z)" (keydown.enter)="choose(z)" (keydown.space)="choose(z); $event.preventDefault()"
                        (mouseenter)="hover.set(z)" (mouseleave)="hover.set(null)" (focus)="hover.set(z)" (blur)="hover.set(null)"/>
                }
              </g>
            }
          </svg>
        </div>

        <div class="bm-panel" aria-live="polite">
          <div class="bm-info">
            @if (shown(); as z) {
              <small>{{ t('Zone', 'المنطقة') }}</small>
              <h3>{{ label(z) }}</h3>
              @if (sel()) {
                <p class="bm-lead">{{ t('On consulte souvent :', 'يستشار غالباً:') }}</p>
                <div class="bm-specs">
                  @for (s of z.specs; track s) {
                    <button type="button" (click)="pick.emit(s)">{{ s }} <span aria-hidden="true">→</span></button>
                  }
                </div>
                <p class="bm-note">{{ t('Simple orientation, pas un diagnostic. En cas d’urgence : ', 'مجرد توجيه وليس تشخيصاً. في الحالات العاجلة: ') }}<a href="tel:190">190</a></p>
              } @else {
                <p class="bm-lead">{{ t('Cliquez pour voir les spécialités.', 'اضغط لعرض التخصصات.') }}</p>
              }
            } @else {
              <small>{{ t('Zone', 'المنطقة') }}</small>
              <h3>{{ t('Choisissez une zone', 'اختر منطقة') }}</h3>
              <p class="bm-empty">{{ t('Touchez le corps ou une zone ci-dessous pour voir quels médecins consulter.', 'اضغط على الجسم أو على منطقة أدناه لمعرفة الأطباء المناسبين.') }}</p>
            }
          </div>

          <div class="bm-block">
            <span class="bm-cap">{{ t('Toutes les zones', 'كل المناطق') }}</span>
            <div class="bm-chips">
              @for (z of zones(); track z.id) {
                <button type="button" [class.on]="sel()?.id === z.id" (click)="choose(z)"
                        (mouseenter)="hover.set(z)" (mouseleave)="hover.set(null)">{{ label(z) }}</button>
              }
            </div>
          </div>

          <div class="bm-block bm-last">
            <span class="bm-cap">{{ t('Autres besoins', 'احتياجات أخرى') }}</span>
            <div class="bm-chips">
              @for (z of extra; track z.id) {
                <button type="button" [class.on]="sel()?.id === z.id" (click)="choose(z)">{{ label(z) }}</button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .bm { height: 100%; display: flex; flex-direction: column; gap: 14px; }
    .bm-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .bm h2 { margin: 0; font-size: 22px; color: var(--navy); letter-spacing: -.01em; }
    .bm-top p { margin: 4px 0 0; color: var(--muted); font-size: 13.5px; }
    .bm-toggle { display: inline-flex; background: var(--pale); border-radius: 999px; padding: 3px; flex: none; }
    .bm-toggle button { border: 0; background: none; padding: 7px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--navy); }
    .bm-toggle button.on { background: var(--navy); color: #fff; }

    .bm-body { display: grid; grid-template-columns: minmax(200px, 1fr) minmax(0, 1fr); gap: 20px; align-items: stretch; flex: 1; min-height: 0; }

    /* La figure remplit toute la hauteur disponible ; l'image est recadrée sur le corps (viewBox). */
    .bm-figure { position: relative; min-height: 560px; }
    .bm-svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

    /* Zones : invisibles au repos, surlignées au survol, marquées une fois choisies. */
    .bm-zone { fill: var(--teal); fill-opacity: 0; stroke: var(--navy); stroke-opacity: 0; stroke-width: 2; stroke-linejoin: round;
               vector-effect: non-scaling-stroke; cursor: pointer; outline: none; transition: fill-opacity .15s, stroke-opacity .15s; }
    .bm-zone.hot, .bm-zone:focus-visible { fill-opacity: .3; stroke-opacity: .55; }
    .bm-zone.sel { fill-opacity: .5; stroke-opacity: .95; }

    .bm-panel { background: var(--pale); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 18px; }
    .bm-panel small { color: var(--teal); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 11px; }
    .bm-panel h3 { margin: 4px 0 10px; font-size: 20px; color: var(--navy); }
    .bm-lead { margin: 0 0 10px; color: var(--muted); font-size: 14px; }
    .bm-empty { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.5; }
    .bm-specs { display: flex; flex-direction: column; gap: 8px; }
    .bm-specs button { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 10px 14px; font-weight: 600; color: var(--navy); text-align: start; }
    .bm-specs button:hover { border-color: var(--teal); color: var(--teal); }
    .bm-note { margin: 14px 0 0; font-size: 12px; color: var(--muted); line-height: 1.45; }
    .bm-note a { color: var(--coral); font-weight: 700; }

    .bm-block { display: flex; flex-direction: column; gap: 8px; }
    .bm-last { margin-top: auto; }
    .bm-cap { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
    .bm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .bm-chips button { border: 1px solid var(--line); background: #fff; color: var(--navy); border-radius: 999px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; }
    .bm-chips button:hover { border-color: var(--teal); }
    .bm-chips button.on { background: var(--navy); color: #fff; border-color: var(--navy); }

    @media (max-width: 560px) {
      .bm-body { grid-template-columns: 1fr; }
      .bm-figure { min-height: 480px; max-width: 300px; width: 100%; margin: 0 auto; }
    }
  `],
})
export class BodyMapComponent {
  private langService = inject(LangService);
  lang = this.langService.lang;
  pick = output<string>();

  readonly size = IMAGE_SIZE;
  side = signal<'front' | 'back'>('front');
  sel = signal<Zone | null>(null);
  hover = signal<Zone | null>(null);

  view = computed(() => BODY_VIEWS[this.side()]);
  zones = computed(() => (this.side() === 'front' ? FRONT : BACK));
  /** Les petites zones (yeux, bouche) sont dessinées en dernier pour recevoir les clics au-dessus de la tête. */
  drawZones = computed(() => [...this.zones().filter((z) => !z.feature), ...this.zones().filter((z) => z.feature)]);
  shown = computed(() => this.sel() ?? this.hover());
  extra = EXTRA;

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  label(z: Zone) { return this.lang() === 'fr' ? z.fr : z.ar; }
  setSide(s: 'front' | 'back') { this.side.set(s); this.sel.set(null); this.hover.set(null); }
  choose(z: Zone) { this.sel.set(z); }
}