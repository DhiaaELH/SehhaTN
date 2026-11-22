import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { LangService } from './lang.service';

export interface ConditionSummary {
  slug: string; name_fr: string; name_ar: string; category: string; urgency: string;
  summary_fr: string; summary_ar: string; image_url: string | null; reading_minutes: number;
  specialty_fr: string | null; specialty_ar: string | null;
}

export const GUIDE_CATEGORIES_AR: Record<string, string> = {
  'Santé courante': 'الصحة اليومية', 'Cœur et vaisseaux': 'القلب والأوعية', 'Respiration': 'التنفس', 'Digestion': 'الهضم',
  'Peau': 'الجلد', 'Santé mentale': 'الصحة النفسية', 'Femme et enfant': 'المرأة والطفل', 'Os et articulations': 'العظام والمفاصل',
  'Maladies chroniques': 'الأمراض المزمنة', 'Yeux, ORL et dents': 'العين والأنف والأذن والأسنان',
};

/** Guide santé : fiches maladies et symptômes, alimentées par la base de connaissances. */
@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [FormsModule],
  template: `
  <section class="page-section guide-page">
    <div class="page-intro"><div><span class="section-kicker">{{ t('GUIDE SANTÉ','دليل الصحة') }}</span><h1>{{ t('Mieux comprendre, c’est déjà prendre soin.','الفهم بداية العناية.') }}</h1><p>{{ t('Des fiches claires sur les problèmes de santé les plus fréquents : symptômes, gestes utiles et quand consulter.','بطاقات واضحة حول المشاكل الصحية الأكثر شيوعاً: الأعراض والخطوات المفيدة ومتى تستشير.') }}</p></div><div class="page-intro-icon">✚</div></div>
    <label class="guide-search"><span>⌕</span><input [ngModel]="query()" (ngModelChange)="query.set($event)" [placeholder]="t('Rechercher une maladie ou un symptôme…','ابحث عن مرض أو عرض…')"></label>
    <div class="category-pills">
      <button [class.selected]="category() === ''" (click)="category.set('')">{{ t('Tout','الكل') }}</button>
      @for (c of categories(); track c) { <button [class.selected]="category() === c" (click)="category.set(c)">{{ catLabel(c) }}</button> }
    </div>
    @if (loading()) { <p class="results-line">{{ t('Chargement…','جارٍ التحميل…') }}</p> }
    @if (error()) { <p class="results-line">{{ error() }} <button class="outline-btn" (click)="load()">{{ t('Réessayer','إعادة المحاولة') }}</button></p> }
    <div class="guide-grid">
      @for (c of filtered(); track c.slug) {
        <article class="guide-card" (click)="open(c.slug)" tabindex="0" (keydown.enter)="open(c.slug)">
          <div class="article-art art-blue">
            @if (c.image_url) { <img [src]="c.image_url" [alt]="''" loading="lazy" (error)="c.image_url = null"> } @else { <span>✚</span> }
            <small>{{ catLabel(c.category) }}</small>
          </div>
          <div class="article-copy">
            <span class="article-time">{{ c.reading_minutes }} {{ t('MIN DE LECTURE','دقائق للقراءة') }}@if (c.urgency === 'emergency') { · <b class="gd-urg">{{ t('URGENCE','طارئ') }}</b> }</span>
            <h3>{{ t(c.name_fr, c.name_ar) }}</h3>
            <p>{{ t(c.summary_fr, c.summary_ar) }}</p>
            <button (click)="$event.stopPropagation(); open(c.slug)">{{ t('Lire la fiche','اقرأ البطاقة') }} <span>↗</span></button>
          </div>
        </article>
      }
    </div>
    @if (!loading() && !error() && !filtered().length) {
      <div class="empty-state"><span>⌕</span><h3>{{ t('Aucune fiche ne correspond','لا توجد بطاقة مطابقة') }}</h3>
        <p>{{ t('Décrivez plutôt vos symptômes à l’assistant santé.','صف أعراضك للمساعد الصحي بدلاً من ذلك.') }}</p>
        <button class="outline-btn" (click)="router.navigateByUrl('/assistant')">{{ t('Ouvrir l’assistant','افتح المساعد') }}</button></div>
    }
    <div class="medical-note"><span>ⓘ</span><p><b>{{ t('Une information générale, jamais un diagnostic.','معلومات عامة وليست تشخيصاً.') }}</b><br>{{ t('Ces contenus vous aident à vous informer. Seul un professionnel de santé peut établir un diagnostic adapté à votre situation.','تساعدك هذه المحتويات على المعرفة. وحده المختص يمكنه تشخيص حالتك.') }}</p></div>
  </section>`,
  styles: [`
    .guide-card { cursor: pointer; }
    .gd-urg { color: #b91c1c; }
  `],
})
export class GuideComponent {
  readonly router = inject(Router);
  private auth = inject(AuthService);
  private langService = inject(LangService);
  readonly query = signal('');
  readonly category = signal('');
  readonly items = signal<ConditionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly categories = computed(() => [...new Set(this.items().map((c) => c.category))].sort());
  readonly filtered = computed(() => {
    const q = this.fold(this.query());
    return this.items().filter((c) => (!this.category() || c.category === this.category())
      && (!q || this.fold(`${c.name_fr} ${c.name_ar} ${c.summary_fr} ${c.category} ${c.specialty_fr ?? ''}`).includes(q)));
  });

  constructor() { this.load(); }

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }
  catLabel(c: string) { return this.langService.lang() === 'fr' ? c : GUIDE_CATEGORIES_AR[c] ?? c; }
  private fold(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try { this.items.set(await this.auth.request<ConditionSummary[]>('/conditions')); }
    catch (e) { this.error.set(e instanceof Error ? e.message : 'Erreur'); }
    finally { this.loading.set(false); }
  }
  open(slug: string) { this.router.navigate(['/guide', slug]); }
}
