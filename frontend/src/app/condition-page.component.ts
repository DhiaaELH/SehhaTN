import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError, AuthService } from './auth.service';
import { GUIDE_CATEGORIES_AR } from './guide.component';
import { LangService } from './lang.service';

interface Condition {
  slug: string; name_fr: string; name_ar: string; category: string; urgency: string;
  summary_fr: string; summary_ar: string; symptoms_fr: string[]; causes_fr: string | null;
  self_care_fr: string[]; self_care_ar: string[]; when_to_consult_fr: string[]; when_to_consult_ar: string[];
  prevention_fr: string[]; image_url: string | null; reading_minutes: number; updated_at: string;
  specialty_slug: string | null; specialty_fr: string | null; specialty_ar: string | null;
  related: { slug: string; name_fr: string; name_ar: string; image_url: string | null }[];
}

/** Fiche détaillée du Guide santé. */
@Component({
  selector: 'app-condition-page',
  standalone: true,
  template: `
  <section class="page-section cp">
    <button class="cp-back" (click)="router.navigateByUrl('/guide')">← {{ t('Guide santé', 'دليل الصحة') }}</button>
    @if (c(); as c) {
      <header class="cp-hero">
        @if (c.image_url) { <img [src]="c.image_url" alt="" (error)="c.image_url = null"> }
        <div class="cp-hero-copy">
          <span class="section-kicker">{{ lang() === 'fr' ? c.category : (cats[c.category] ?? c.category) }} · {{ c.reading_minutes }} {{ t('min', 'د') }}</span>
          <h1>{{ t(c.name_fr, c.name_ar) }}</h1>
          <p>{{ t(c.summary_fr, c.summary_ar) }}</p>
        </div>
      </header>
      @if (c.urgency === 'emergency') {
        <div class="cp-emergency">☎ {{ t('Urgence vitale : au moindre doute, appelez immédiatement le SAMU au', 'حالة طارئة: عند أدنى شك اتصل فوراً بالإسعاف على') }} <a href="tel:190">190</a></div>
      }
      <div class="cp-layout">
        <div class="cp-main">
          @if (c.symptoms_fr.length) {
            <article><h2>{{ t('Symptômes fréquents', 'الأعراض الشائعة') }}</h2><ul>@for (s of c.symptoms_fr; track s) { <li>{{ s }}</li> }</ul></article>
          }
          @if (c.causes_fr) { <article><h2>{{ t('Causes', 'الأسباب') }}</h2><p>{{ c.causes_fr }}</p></article> }
          <article class="ok"><h2>{{ t('Ce que vous pouvez faire', 'ما يمكنك فعله') }}</h2>
            <ul>@for (s of (lang() === 'ar' && c.self_care_ar.length ? c.self_care_ar : c.self_care_fr); track s) { <li>{{ s }}</li> }</ul></article>
          <article class="warn"><h2>{{ t('Quand consulter ?', 'متى تستشير؟') }}</h2>
            <ul>@for (s of (lang() === 'ar' && c.when_to_consult_ar.length ? c.when_to_consult_ar : c.when_to_consult_fr); track s) { <li>{{ s }}</li> }</ul></article>
          @if (c.prevention_fr.length) {
            <article><h2>{{ t('Prévention', 'الوقاية') }}</h2><ul>@for (s of c.prevention_fr; track s) { <li>{{ s }}</li> }</ul></article>
          }
          @if (lang() === 'ar') { <p class="cp-muted">{{ 'بعض الأقسام التفصيلية متوفرة حالياً بالفرنسية فقط.' }}</p> }
        </div>
        <aside class="cp-side">
          @if (c.specialty_fr) {
            <div class="cp-box">
              <small>{{ t('Spécialiste concerné', 'المختص المعني') }}</small>
              <b>{{ t(c.specialty_fr, c.specialty_ar ?? c.specialty_fr) }}</b>
              <button class="primary-btn" (click)="findDoctors(c.specialty_fr)">{{ t('Trouver un praticien', 'ابحث عن مختص') }} →</button>
            </div>
          }
          <div class="cp-box">
            <small>{{ t('Un doute sur vos symptômes ?', 'هل لديك شك حول أعراضك؟') }}</small>
            <button class="outline-btn" (click)="router.navigateByUrl('/orientation')">{{ t('Orientation guidée', 'التوجيه الموجه') }}</button>
            <button class="outline-btn" (click)="router.navigateByUrl('/assistant')">{{ t('Assistant santé', 'المساعد الصحي') }}</button>
          </div>
          @if (c.related.length) {
            <div class="cp-box"><small>{{ t('Dans la même rubrique', 'في نفس القسم') }}</small>
              @for (r of c.related; track r.slug) { <button class="cp-rel" (click)="open(r.slug)">{{ t(r.name_fr, r.name_ar) }} →</button> }</div>
          }
        </aside>
      </div>
      <div class="medical-note"><span>ⓘ</span><p>{{ t('Information générale, relue avec prudence, qui ne remplace pas l’avis d’un professionnel de santé.', 'معلومات عامة لا تحل محل رأي المختص الصحي.') }}</p></div>
    } @else if (notFound()) {
      <p>{{ t('Fiche introuvable.', 'البطاقة غير موجودة.') }}</p>
    } @else {
      <p>{{ t('Chargement…', 'جارٍ التحميل…') }}</p>
    }
  </section>`,
  styles: [`
    .cp { max-width: 1080px; }
    .cp-back { border: 0; background: none; color: var(--navy); font-weight: 700; padding: 6px 0; margin-bottom: 12px; }
    .cp-hero { position: relative; border-radius: 22px; overflow: hidden; min-height: 280px; display: flex; align-items: flex-end; background:var(--deep-bg); }
    .cp-hero img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .55; }
    .cp-hero-copy { position: relative; padding: 32px; color: #fff; max-width: 720px; }
    .cp-hero-copy .section-kicker { color: #9ee9e0; }
    .cp-hero h1 { margin: 8px 0; font: 800 clamp(26px, 4vw, 40px)/1.1 Montserrat, sans-serif; color: #fff; }
    .cp-hero p { margin: 0; color: #e2edf6; line-height: 1.6; }
    .cp-emergency { margin-top: 14px; padding: 12px 16px; border-radius: 12px; background: #fdecec; color: #8b1515; font-weight: 700; }
    .cp-emergency a { color: #b91c1c; }
    .cp-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 20px; margin-top: 20px; align-items: start; }
    .cp-main { display: grid; gap: 14px; }
    .cp-main article { background:var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 20px 22px; }
    .cp-main article.ok { border-inline-start: 4px solid #0a7a55; } .cp-main article.warn { border-inline-start: 4px solid #c2410c; }
    .cp-main h2 { margin: 0 0 10px; font: 800 16px Montserrat, sans-serif; color: var(--deep); }
    .cp-main ul { margin: 0; padding-inline-start: 18px; display: grid; gap: 6px; color: var(--text2); line-height: 1.55; }
    .cp-main p { margin: 0; color: var(--text2); line-height: 1.6; }
    .cp-muted { color: var(--muted) !important; font-size: 12px; }
    .cp-side { display: grid; gap: 12px; position: sticky; top: 96px; }
    .cp-box { display: grid; gap: 8px; background:var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 18px; }
    .cp-box small { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .05em; font-weight: 700; }
    .cp-box b { font: 800 18px Montserrat, sans-serif; color: var(--deep); }
    .cp-box button { padding: 10px; border-radius: 10px; font-weight: 700; }
    .cp-rel { border: 0; background: var(--pale); color: var(--navy); text-align: start; }
    @media (max-width: 860px) { .cp-layout { grid-template-columns: 1fr; } .cp-side { position: static; } .cp-hero-copy { padding: 22px; } }
  `],
})
export class ConditionPageComponent {
  readonly router = inject(Router);
  private auth = inject(AuthService);
  private langService = inject(LangService);
  readonly slug = input.required<string>();
  readonly c = signal<Condition | null>(null);
  readonly notFound = signal(false);
  readonly cats = GUIDE_CATEGORIES_AR;
  readonly lang = this.langService.lang;

  constructor() {
    effect(() => { const s = this.slug(); untracked(() => this.load(s)); });
  }

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }

  private async load(slug: string) {
    this.c.set(null);
    this.notFound.set(false);
    try { this.c.set(await this.auth.request<Condition>(`/conditions/${encodeURIComponent(slug)}`)); }
    catch (e) { this.notFound.set(true); if (!(e instanceof ApiError)) console.error(e); }
  }
  open(slug: string) { this.router.navigate(['/guide', slug]); }
  findDoctors(specialty: string) { this.router.navigate(['/doctors'], { queryParams: { specialty } }); }
}
