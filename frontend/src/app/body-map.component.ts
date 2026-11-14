import { Component, computed, inject, output, signal } from '@angular/core';
import { LangService } from './lang.service';

type Shape = { d: string; mirror?: boolean; tiny?: boolean };
type Zone = { id: string; fr: string; ar: string; specs: string[]; shapes?: Shape[] };

// ── Formes tracées avec précision sur une grille 100x100 pour épouser l'anatomie ──
const HEAD: Shape = { d: 'M 46 4 L 54 4 L 55 10 L 52 14 L 48 14 L 45 10 Z' };
const NECK: Shape = { d: 'M 45 14 L 55 14 L 56 19 L 44 19 Z' };
const CHEST: Shape = { d: 'M 44 19 L 56 19 L 64 24 L 62 35 L 38 35 L 36 24 Z' };
const BELLY: Shape = { d: 'M 38 35 L 62 35 L 58 48 L 42 48 Z' };
const PELVIS: Shape = { d: 'M 42 48 L 58 48 L 60 58 L 50 62 L 40 58 Z' };

// Moitié gauche (tracée à gauche, parfaitement reflétée à droite via transform)
const ARM: Shape = { d: 'M 36 24 L 42 32 L 32 44 L 24 57 L 16 55 L 24 40 L 30 22 Z', mirror: true };
const HAND: Shape = { d: 'M 16 55 L 24 57 L 20 68 L 12 66 Z', mirror: true };
const LEG: Shape = { d: 'M 40 58 L 50 62 L 46 75 L 42 92 L 34 92 L 38 75 L 36 62 Z', mirror: true };
const FOOT: Shape = { d: 'M 34 92 L 42 92 L 44 98 L 32 98 Z', mirror: true };

const COMMON: Zone[] = [
  { id: 'arms', fr: 'Bras et épaules', ar: 'الذراعان والكتفان', specs: ['Orthopédiste', 'Médecin généraliste'], shapes: [ARM] },
  { id: 'hands', fr: 'Mains', ar: 'اليدان', specs: ['Orthopédiste', 'Dermatologue'], shapes: [HAND] },
  { id: 'legs', fr: 'Jambes et genoux', ar: 'الساقان والركبتان', specs: ['Orthopédiste', 'Médecin généraliste'], shapes: [LEG] },
  { id: 'feet', fr: 'Pieds', ar: 'القدمان', specs: ['Orthopédiste', 'Dermatologue'], shapes: [FOOT] },
];

const FRONT: Zone[] = [
  { id: 'head', fr: 'Tête', ar: 'الرأس', specs: ['Neurologue', 'Psychiatre', 'Médecin généraliste'], shapes: [HEAD] },
  { id: 'neck', fr: 'Cou et gorge', ar: 'الرقبة والحلق', specs: ['ORL', 'Endocrinologue'], shapes: [NECK] },
  { id: 'chest', fr: 'Poitrine', ar: 'الصدر', specs: ['Cardiologue', 'Pneumologue'], shapes: [CHEST] },
  { id: 'belly', fr: 'Ventre', ar: 'البطن', specs: ['Gastro-entérologue', 'Médecin généraliste'], shapes: [BELLY] },
  { id: 'pelvis', fr: 'Bassin', ar: 'الحوض', specs: ['Gynécologue', 'Médecin généraliste'], shapes: [PELVIS] },
  ...COMMON,
  // Yeux et Bouche réintégrés
  { id: 'eyes', fr: 'Yeux', ar: 'العينان', specs: ['Ophtalmologue'], shapes: [{ d: 'M 46 8 C 47 7, 49 7, 48 9 C 47 9, 45 9, 46 8 Z', mirror: true, tiny: true }] },
  { id: 'mouth', fr: 'Bouche et dents', ar: 'الفم والأسنان', specs: ['Dentiste', 'ORL'], shapes: [{ d: 'M 48 12 L 52 12 L 50 13 Z', tiny: true }] },
];

const BACK: Zone[] = [
  { id: 'head', fr: 'Tête', ar: 'الرأس', specs: ['Neurologue', 'Médecin généraliste'], shapes: [HEAD] },
  { id: 'neck', fr: 'Nuque', ar: 'الرقبة', specs: ['Orthopédiste', 'Neurologue'], shapes: [NECK] },
  { id: 'upper', fr: 'Haut du dos', ar: 'أعلى الظهر', specs: ['Orthopédiste', 'Neurologue', 'Pneumologue'], shapes: [CHEST] },
  { id: 'lower', fr: 'Bas du dos', ar: 'أسفل الظهر', specs: ['Orthopédiste', 'Neurologue'], shapes: [BELLY] },
  { id: 'glutes', fr: 'Fessiers et hanches', ar: 'الأرداف والورك', specs: ['Orthopédiste', 'Gastro-entérologue'], shapes: [PELVIS] },
  ...COMMON,
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
        
        <div class="bm-image-wrapper">
          <!-- Ce conteneur zoom l'image pour éliminer les bords vides -->
          <div class="bm-scale-box">
            <img [src]="side() === 'front' ? 'assets/front.svg' : 'assets/back.svg'" alt="Corps humain" class="bm-base-image" />
            
            <!-- ViewBox 100x100 permet un placement au pourcentage très précis -->
            <svg viewBox="0 0 100 100" class="bm-svg-overlay" role="group" [attr.aria-label]="t('Corps humain', 'جسم الإنسان')">
              @for (z of zones(); track z.id) {
                <g>
                  @for (s of z.shapes; track $index) {
                    <path [attr.d]="s.d" class="bm-zone" [class.sel]="sel()?.id === z.id" [class.tiny]="s.tiny"
                          tabindex="0" role="button" [attr.aria-label]="label(z)" [attr.aria-pressed]="sel()?.id === z.id"
                          (click)="choose(z)" (keydown.enter)="choose(z)" (keydown.space)="choose(z); $event.preventDefault()"
                          (mouseenter)="hover.set(z)" (mouseleave)="hover.set(null)" (focus)="hover.set(z)" (blur)="hover.set(null)"/>
                    
                    @if (s.mirror) {
                      <!-- Symétrie parfaite sur le point central X=50 (100 de largeur) -->
                      <path [attr.d]="s.d" transform="translate(100 0) scale(-1 1)" class="bm-zone" [class.sel]="sel()?.id === z.id" [class.tiny]="s.tiny"
                            tabindex="0" role="button" [attr.aria-label]="label(z)" [attr.aria-pressed]="sel()?.id === z.id"
                            (click)="choose(z)" (keydown.enter)="choose(z)" (keydown.space)="choose(z); $event.preventDefault()"
                            (mouseenter)="hover.set(z)" (mouseleave)="hover.set(null)" (focus)="hover.set(z)" (blur)="hover.set(null)"/>
                    }
                  }
                </g>
              }
            </svg>
          </div>
        </div>

        <div class="bm-panel" aria-live="polite">
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
            <p class="bm-empty">{{ t('Choisissez une zone du corps pour voir quels médecins consulter.', 'اختر جزءاً من الجسم لمعرفة الأطباء المناسبين.') }}</p>
          }
        </div>
      </div>

      <div class="bm-extra">
        @for (z of extra; track z.id) {
          <button type="button" [class.on]="sel()?.id === z.id" (click)="choose(z)">{{ label(z) }}</button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .bm { height: 100%; display: flex; flex-direction: column; gap: 14px; }
    .bm-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .bm h2 { margin: 0; font-size: 22px; color: var(--navy); letter-spacing: -.01em; }
    .bm-top p { margin: 4px 0 0; color: var(--muted); font-size: 13.5px; }
    .bm-toggle { display: inline-flex; background: var(--pale); border-radius: 999px; padding: 3px; flex: none; }
    .bm-toggle button { border: 0; background: none; padding: 7px 16px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--navy); }
    .bm-toggle button.on { background: var(--navy); color: #fff; }
   .bm-body { display: grid; grid-template-columns: minmax(150px, 1fr) 1.1fr; gap: 20px; align-items: stretch; flex: 1; }
    
    /* Layout pour la taille - Expand to fill vertical space */
    .bm-image-wrapper { position: relative; width: 100%; height: 100%; min-height: 450px; display: flex; justify-content: center; }
    .bm-scale-box { position: relative; width: 100%; height: 100%; max-width: 450px; transform: scale(1.25); transform-origin: center 5%; } 
    .bm-base-image { width: 100%; height: 100%; object-fit: contain; display: block; }
    .bm-svg-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 2; }
    
    /* Styles des zones interactives */
    .bm-zone { fill: var(--teal); fill-opacity: 0; stroke: transparent; cursor: pointer; outline: none; transition: fill-opacity .15s; }
    .bm-zone:hover, .bm-zone:focus-visible { fill-opacity: 0.35; }
    .bm-zone.sel { fill-opacity: 0.65; stroke: var(--navy); stroke-width: 0.5; stroke-opacity: 0.8; }
    
    /* Styles pour les petits élements (Yeux/Bouche) */
    .bm-zone.tiny { stroke: transparent; stroke-width: 2; pointer-events: all; fill: var(--navy); fill-opacity: .55; }
    .bm-zone.tiny:hover, .bm-zone.tiny:focus-visible, .bm-zone.tiny.sel { fill: var(--teal); fill-opacity: 1; stroke: transparent; }
    
    .bm-panel { background: var(--pale); border-radius: 16px; padding: 18px; min-height: 180px; }
    .bm-panel small { color: var(--teal); font-weight: 700; letter-spacing: .08em; text-transform: uppercase; font-size: 11px; }
    .bm-panel h3 { margin: 4px 0 10px; font-size: 20px; color: var(--navy); }
    .bm-lead { margin: 0 0 10px; color: var(--muted); font-size: 14px; }
    .bm-empty { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.5; }
    .bm-specs { display: flex; flex-direction: column; gap: 8px; }
    .bm-specs button { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--line); background: #fff; border-radius: 12px; padding: 10px 14px; font-weight: 600; color: var(--navy); text-align: start; }
    .bm-specs button:hover { border-color: var(--teal); color: var(--teal); }
    .bm-note { margin: 14px 0 0; font-size: 12px; color: var(--muted); line-height: 1.45; }
    .bm-note a { color: var(--coral); font-weight: 700; }
    .bm-extra { display: flex; flex-wrap: wrap; gap: 8px; }
    .bm-extra button { border: 1px solid var(--line); background: #fff; color: var(--navy); border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 600; }
    .bm-extra button:hover { border-color: var(--teal); }
    .bm-extra button.on { background: var(--navy); color: #fff; border-color: var(--navy); }
    @media (max-width: 560px) { .bm-body { grid-template-columns: 1fr; } .bm-image-wrapper { max-width: 280px; } }
  `],
})
export class BodyMapComponent {
  private langService = inject(LangService);
  lang = this.langService.lang;
  pick = output<string>();

  side = signal<'front' | 'back'>('front');
  sel = signal<Zone | null>(null);
  hover = signal<Zone | null>(null);
  zones = computed(() => (this.side() === 'front' ? FRONT : BACK));
  shown = computed(() => this.sel() ?? this.hover());
  extra = EXTRA;

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  label(z: Zone) { return this.lang() === 'fr' ? z.fr : z.ar; }
  setSide(s: 'front' | 'back') { this.side.set(s); this.sel.set(null); }
  choose(z: Zone) { this.sel.set(z); }
}