import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountComponent } from './account.component';
import { CommonModule, Location as AppLocation } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { LangService } from './lang.service';
import { HomeComponent } from './home.component';
import type { HomeSearch } from './home.component';
import { DoctorService, SPECIALTIES, GOVERNORATES, currentPosition } from './doctor.service';
import type { Doctor } from './doctor.service';
import { AuthService } from './auth.service';

/** Pages du site. Celles marquées « shell » sont dessinées ici ; les autres viennent du routeur (chargement à la demande). */
const PATHS = {
  home: '/', doctors: '/doctors', orientation: '/orientation', assistant: '/assistant', facilities: '/lieux-de-sante',
  guide: '/guide', about: '/about', account: '/account', privacy: '/confidentialite', help: '/aide',
} as const;
type Page = keyof typeof PATHS;
type View = Page | 'doctor' | 'other';

function viewFromUrl(url: string): View {
  const path = url.split(/[?#]/)[0].replace(/^\/+|\/+$/g, '');
  if (path === '') return 'home';
  if (path.startsWith('doctors/')) return 'doctor';
  if (path.startsWith('guide/')) return 'guide';
  const hit = (Object.keys(PATHS) as Page[]).find((k) => PATHS[k].replace(/^\//, '') === path);
  return hit ?? 'other';
}

@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule, AccountComponent, RouterOutlet, HomeComponent], template: `
  <div class="app-shell" [class.arabic-mode]="lang === 'ar'" [attr.dir]="lang === 'ar' ? 'rtl' : 'ltr'">
    <div class="emergency-strip"><span class="pulse"></span><span>{{ t('Besoin d’aide urgente ?','هل تحتاج مساعدة عاجلة؟') }}</span><span class="strip-separator">·</span><span>{{ t('SAMU','الإسعاف') }} <strong>190</strong></span><a href="tel:190">{{ t('Appeler','اتصل') }} <span aria-hidden="true">↗</span></a></div>
    <header class="site-header">
      <a class="brand" href="#accueil" (click)="$event.preventDefault(); go('home')" aria-label="SehhaTN accueil"><span class="brand-mark"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 42S5 30 5 17a10 10 0 0 1 18-6l1 2 1-2a10 10 0 0 1 18 6c0 13-19 25-19 25Z"/><path d="M8 25h9l4-8 6 17 4-9h9"/><path d="M25 5v8m-4-4h8"/></svg></span><span class="brand-type">Sehha<span>TN</span><small>VOTRE SANTÉ, NOTRE PRIORITÉ</small></span></a>
      <nav class="main-nav" aria-label="Navigation principale">@for (n of nav; track n.page) { <button [class.active]="view===n.page" (click)="go(n.page)">{{ t(n.fr, n.ar) }}</button> }</nav>
      <div class="header-actions"><button class="language" (click)="toggleLanguage()" aria-label="Changer la langue">{{ lang==='fr' ? 'FR' : 'عربي' }} <span></span> {{ lang==='fr' ? 'عربي' : 'FR' }}</button><button class="language theme-toggle" (click)="toggleTheme()" [attr.aria-label]="dark() ? 'Mode clair' : 'Mode sombre'" [attr.title]="dark() ? 'Mode clair' : 'Mode sombre'">{{ dark() ? '☀' : '☾' }}</button><button class="account-pill" (click)="go('account')" [attr.aria-label]="auth.user() ? t('Mon compte', 'حسابي') : t('Se connecter ou créer un compte', 'تسجيل الدخول أو إنشاء حساب')"><span class="account-pill-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span><span class="account-pill-text">@if (auth.user(); as u) {<b>{{ firstName(u.name) }}</b><small>{{ t('Mon compte', 'حسابي') }}</small>} @else {<b>{{ t('Se connecter', 'تسجيل الدخول') }}</b><small>{{ t('ou créer un compte', 'أو إنشاء حساب') }}</small>}</span></button><button class="menu-toggle" (click)="mobileOpen=!mobileOpen" [attr.aria-expanded]="mobileOpen" aria-label="Menu">☰</button></div>
    </header>
    <nav class="mobile-nav" *ngIf="mobileOpen">@for (n of nav; track n.page) { <button (click)="go(n.page)">{{ t(n.fr, n.ar) }}</button> }</nav>

    <main>
      <app-home *ngIf="view==='home'" (search)="homeSearch($event)"></app-home>

      <router-outlet />

      <section class="page-section" *ngIf="view==='doctors'"><div class="page-intro"><div><span class="section-kicker">{{ t('ANNUAIRE MÉDICAL','دليل الأطباء') }}</span><h1>{{ t('Un médecin qui vous comprend.','طبيب يفهمك.') }}</h1><p>{{ t('Parcourez les profils vérifiés près de chez vous et choisissez en toute confiance.','استكشف الملفات الموثقة بالقرب منك واختر بثقة.') }}</p></div><div class="page-intro-icon">♧</div></div>
        <div class="doctor-filters"><label class="filter-search"><span>⌕</span><input [(ngModel)]="searchText" [placeholder]="t('Nom, spécialité ou ville…','الاسم أو التخصص أو المدينة…')"></label><select [(ngModel)]="specialtyFilter"><option value="">{{ t('Toutes les spécialités','كل التخصصات') }}</option><option *ngFor="let s of specialties" [value]="s">{{ doctorService.specialtyLabel(s, lang) }}</option></select><select [(ngModel)]="cityFilter"><option value="">{{ t('Tous les gouvernorats','كل الولايات') }}</option><option *ngFor="let c of cities" [value]="c">{{ c }}</option></select></div>
        <div class="dl-tools">
          <button class="dl-near" [class.on]="!!doctorService.near()" (click)="toggleNear()" [disabled]="locating()">⌖ {{ locating() ? t('Localisation…','تحديد الموقع…') : doctorService.near() ? t('Près de moi ✓','بالقرب مني ✓') : t('Près de moi','بالقرب مني') }}</button>
          <label class="dl-check"><input type="checkbox" [(ngModel)]="cnamOnly"> {{ t('Conventionné CNAM','متعاقد مع CNAM') }}</label>
          <label class="dl-check"><input type="checkbox" [(ngModel)]="teleOnly"> {{ t('Téléconsultation','استشارة عن بعد') }}</label>
          <select [(ngModel)]="sortBy" [attr.aria-label]="t('Trier','ترتيب')"><option value="default">{{ doctorService.near() ? t('Les plus proches','الأقرب') : t('Nom','الاسم') }}</option><option value="rating">{{ t('Mieux notés','الأعلى تقييماً') }}</option><option value="fee">{{ t('Tarif croissant','السعر تصاعدياً') }}</option><option value="experience">{{ t('Expérience','الخبرة') }}</option></select>
        </div>
        @if (geoError()) { <p class="results-line">{{ geoError() }}</p> }
        <p class="results-line">{{ filteredDoctors.length }} {{ t('professionnels trouvés','مختصاً تم العثور عليهم') }} <span>·</span> {{ t('Tunisie','تونس') }}</p>@if (doctorService.loading()) {<p class="results-line">{{ t('Chargement des médecins… le premier chargement peut prendre jusqu’à une minute.','جارٍ تحميل الأطباء… قد يستغرق التحميل الأول حتى دقيقة.') }}</p>}@if (doctorService.error()) {<p class="results-line">{{ doctorService.error() }} <button class="outline-btn" (click)="doctorService.load()">{{ t('Réessayer','إعادة المحاولة') }}</button></p>}
        <div class="doctor-grid"><article class="doctor-card" *ngFor="let doctor of visibleDoctors"><div class="doctor-card-top"><div class="doctor-avatar" [style.background]="doctor.color">@if (doctor.photo && !failedPhotos().has(doctor.id)) {<img class="dl-photo" [src]="doctor.photo" alt="" loading="lazy" (error)="photoFailed(doctor.id)">} @else { {{ doctor.initials }} }<span class="avatar-online"></span></div><button class="favorite" (click)="toggleFavorite(doctor.id)" [class.saved]="favorites().includes(doctor.id)" [attr.aria-label]="'Favori ' + doctor.name">{{ favorites().includes(doctor.id) ? '♥' : '♡' }}</button></div>@if (doctor.verified) {<div class="verified-label"><span>✓</span> {{ t('PROFIL VÉRIFIÉ','ملف موثق') }}</div>}<h3>{{ doctor.name }}</h3><p class="doctor-specialty">{{ doctorService.specialtyLabel(doctor.specialty, lang) }}</p><p class="doctor-place">⌖ &nbsp;{{ doctor.city }} <span>·</span> {{ doctor.distanceKm !== null ? formatKm(doctor.distanceKm) : t('Tunisie','تونس') }}</p><div class="doctor-rating">@if (doctor.reviews>0) {<b>★ {{ doctor.rating }}</b><span>{{ doctor.reviews }} {{ t('avis','آراء') }}</span>} @else {<span>{{ t('Pas encore d’avis','لا توجد آراء بعد') }}</span>}<span class="rating-spacer"></span>@if (doctor.consultationFee !== null) {<small><b>{{ doctor.consultationFee }} DT</b></small>}</div><div class="doctor-card-actions"><button class="outline-btn" (click)="openDoctor(doctor)">{{ t('Voir le profil','عرض الملف') }}</button><button class="book-btn" (click)="openDoctor(doctor)">{{ t('Rendez-vous','موعد') }} ↗</button></div></article></div>
        @if (visibleDoctors.length < filteredDoctors.length) { <div class="dl-more"><button class="outline-btn" (click)="pageSize = pageSize + 24">{{ t('Afficher plus','عرض المزيد') }} ({{ filteredDoctors.length - visibleDoctors.length }})</button></div> }
        <div class="empty-state" *ngIf="filteredDoctors.length===0 && !doctorService.loading() && !doctorService.error()"><span>⌕</span><h3>{{ t('Aucun médecin ne correspond','لا يوجد طبيب مطابق') }}</h3><p>{{ t('Essayez une autre spécialité, ville ou recherche.','جرّب تخصصاً أو مدينة أو بحثاً مختلفاً.') }}</p><button class="outline-btn" (click)="resetFilters()">{{ t('Effacer les filtres','مسح المرشحات') }}</button></div></section>

      <section class="page-section about-page" *ngIf="view==='about'"><div class="about-cover"><span class="section-kicker">{{ t('NOTRE CONVICTION','قناعتنا') }}</span><h1>{{ t('Une santé plus accessible, partout en Tunisie.','صحة أكثر سهولة في كل تونس.') }}</h1><p>{{ t('SehhaTN rapproche les patients des professionnels de santé, avec des repères fiables et une expérience pensée pour chacun.','تقرب SehhaTN المرضى من المختصين بمعلومات موثوقة وتجربة تناسب الجميع.') }}</p><div class="tunisia-badge">✦ &nbsp; 24 {{ t('gouvernorats','ولاية') }}</div></div><div class="about-live-stats"><article><span>✚</span><strong>{{ stats()?.doctors ?? doctors.length }}</strong><small>{{ t('professionnels référencés','مختصاً مسجلاً') }}</small></article><article><span>⌖</span><strong>{{ stats()?.facilities ?? '—' }}</strong><small>{{ t('lieux de soins','مكان رعاية') }}</small></article><article><span>♡</span><strong>{{ stats()?.specialties ?? specialties.length }}</strong><small>{{ t('spécialités','تخصصاً') }}</small></article><article><span>★</span><strong>{{ stats()?.reviews ?? '—' }}</strong><small>{{ t('avis de patients','رأي مريض') }}</small></article></div><div class="about-actions"><button class="primary-btn" (click)="go('doctors')">{{ t('Découvrir les médecins','اكتشف الأطباء') }} →</button><button class="outline-btn" (click)="go('orientation')">{{ t('Être orienté','احصل على توجيه') }} ⌖</button></div><div class="about-values"><article><span>01</span><h3>{{ t('Proximité','القرب') }}</h3><p>{{ t('Rendre visibles les professionnels de toutes les régions.','إبراز المختصين في جميع المناطق.') }}</p></article><article><span>02</span><h3>{{ t('Confiance','الثقة') }}</h3><p>{{ t('Privilégier des informations utiles, claires et responsables.','تقديم معلومات واضحة ومسؤولة.') }}</p></article><article><span>03</span><h3>{{ t('Simplicité','البساطة') }}</h3><p>{{ t('Faciliter les premiers pas vers le soin, pour tous.','تسهيل الخطوات الأولى نحو الرعاية للجميع.') }}</p></article></div><div class="medical-note"><span>ⓘ</span><p><b>{{ t('SehhaTN est un outil d’information et d’orientation.','SehhaTN أداة للمعلومات والتوجيه.') }}</b><br>{{ t('Il ne remplace pas une consultation auprès d’un professionnel de santé.','ولا تحل محل استشارة المختص الصحي.') }}</p></div></section>

      <section class="page-section account-page" *ngIf="view==='account'"><app-account [lang]="lang" /></section>
    </main>
    <footer class="site-footer"><div class="footer-main"><div class="footer-brand"><a class="brand" (click)="go('home')"><span class="brand-mark"><svg viewBox="0 0 48 48"><path d="M24 42S5 30 5 17a10 10 0 0 1 18-6l1 2 1-2a10 10 0 0 1 18 6c0 13-19 25-19 25Z"/><path d="M8 25h9l4-8 6 17 4-9h9"/><path d="M25 5v8m-4-4h8"/></svg></span><span class="brand-type">Sehha<span>TN</span><small>VOTRE SANTÉ, NOTRE PRIORITÉ</small></span></a><p>{{ t('La santé, plus proche de vous.','الصحة أقرب إليك.') }}</p></div><div class="footer-column"><b>{{ t('EXPLORER','اكتشف') }}</b><button (click)="go('doctors')">{{ t('Trouver un médecin','ابحث عن طبيب') }}</button><button (click)="go('orientation')">{{ t('Orientation guidée','التوجيه الموجه') }}</button><button (click)="go('assistant')">{{ t('Assistant santé','المساعد الصحي') }}</button><button (click)="go('facilities')">{{ t('Pharmacies & urgences','الصيدليات والاستعجالي') }}</button><button (click)="go('guide')">{{ t('Guide santé','دليل الصحة') }}</button></div><div class="footer-column"><b>{{ t('SEHHATN','SehhaTN') }}</b><button (click)="go('about')">{{ t('À propos','من نحن') }}</button><button (click)="go('help')">{{ t('Aide & contact','المساعدة والتواصل') }}</button><button (click)="go('privacy')">{{ t('Confidentialité','الخصوصية') }}</button><button (click)="go('account')">{{ t('Ma carte santé','بطاقتي الصحية') }}</button></div><div class="footer-emergency"><span>{{ t('BESOIN D’AIDE IMMÉDIATE ?','هل تحتاج مساعدة فورية؟') }}</span><b>{{ t('Les urgences médicales','الطوارئ الطبية') }}</b><a href="tel:190"><span>190</span><i>↗</i></a><small>{{ t('SAMU — appel gratuit en Tunisie','الإسعاف — مكالمة مجانية في تونس') }}</small></div></div><div class="footer-bottom"><span>© 2026 SehhaTN · {{ t('Fait avec soin, en Tunisie.','صنع بعناية في تونس.') }}</span><span>{{ t('Information santé à visée générale.','معلومات صحية عامة.') }} &nbsp; · &nbsp; FR &nbsp; · &nbsp; عربي</span></div></footer>
  </div>
`, styles: [`
  .dl-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: -4px 0 14px; }
  .dl-near { border: 1px solid var(--line); background:var(--surface); color: var(--navy); border-radius: 999px; padding: 8px 14px; font-weight: 700; font-size: 13px; }
  .dl-near.on { background: var(--teal); border-color: var(--teal); color: #fff; }
  .dl-check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text2); font-weight: 600; }
  .dl-check input { accent-color: var(--teal); }
  .dl-tools select { margin-inline-start: auto; height: 36px; border: 1px solid var(--line); border-radius: 10px; padding: 0 10px; background:var(--surface); }
  .dl-photo { width: 100%; height: 100%; object-fit: cover; border-radius: inherit; display: block; }
  .dl-more { display: flex; justify-content: center; margin-top: 20px; }
  .dl-more button { padding: 10px 20px; border-radius: 12px; }
`] })
export class AppComponent {
  firstName(name: string) { return name.trim().split(/\s+/)[0]; }
  mobileOpen = false; searchText = ''; specialtyFilter = ''; cityFilter = ''; cnamOnly = false; teleOnly = false;
  sortBy: 'default' | 'rating' | 'fee' | 'experience' = 'default'; pageSize = 24;
  specialties = SPECIALTIES; cities = GOVERNORATES;
  readonly nav: { page: Page; fr: string; ar: string }[] = [
    { page: 'home', fr: 'Accueil', ar: 'الرئيسية' }, { page: 'doctors', fr: 'Médecins', ar: 'الأطباء' },
    { page: 'orientation', fr: 'Orientation', ar: 'التوجيه' }, { page: 'assistant', fr: 'Assistant santé', ar: 'المساعد الصحي' },
    { page: 'facilities', fr: 'Lieux de soins', ar: 'مراكز الرعاية' }, { page: 'guide', fr: 'Guide santé', ar: 'دليل الصحة' },
  ];
  doctorService = inject(DoctorService);
  auth = inject(AuthService);
  private router = inject(Router);
  langService = inject(LangService);
  readonly dark = signal(this.readTheme());
  toggleTheme() {
    this.dark.update((v) => !v);
    this.applyTheme();
    try { localStorage.setItem('sehhatn_theme', this.dark() ? 'dark' : 'light'); } catch { /* stockage indisponible */ }
  }
  private readTheme(): boolean {
    try { const v = localStorage.getItem('sehhatn_theme'); if (v) return v === 'dark'; } catch { /* ignore */ }
    return false;
  }
  private applyTheme() {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset['theme'] = this.dark() ? 'dark' : 'light';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', this.dark() ? '#08121f' : '#eff4ff');
  }
  readonly locating = signal(false);
  readonly geoError = signal('');
  readonly failedPhotos = signal(new Set<number>());
  readonly favorites = signal<number[]>(this.readFavorites());
  readonly stats = signal<{ doctors: number; facilities: number; specialties: number; reviews: number } | null>(null);

  private url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => { this.applyQuery(e.urlAfterRedirects); return e.urlAfterRedirects; })
    ),
    { initialValue: inject(AppLocation).path() }   // correct page on first paint for deep links
  );

  constructor() {
    this.applyTheme();
    this.applyQuery(inject(AppLocation).path());
    this.auth.request<{ doctors: number; facilities: number; specialties: number; reviews: number }>('/meta/stats')
      .then((s) => this.stats.set(s)).catch(() => {});
  }

  get view(): View { return viewFromUrl(this.url()); }
  get lang(): 'fr' | 'ar' { return this.langService.lang(); }
  set lang(v: 'fr' | 'ar') { this.langService.lang.set(v); }
  get doctors(): Doctor[] { return this.doctorService.doctors(); }

  get filteredDoctors(): Doctor[] {
    const q = this.fold(this.searchText);
    const list = this.doctors.filter((d) => (!q || this.fold(`${d.name} ${d.specialty} ${d.city} ${d.governorate}`).includes(q))
      && (!this.specialtyFilter || d.specialty === this.specialtyFilter)
      && (!this.cityFilter || d.governorate === this.cityFilter)
      && (!this.cnamOnly || d.acceptsCnam === true)
      && (!this.teleOnly || d.teleconsultation));
    const by = this.sortBy;
    if (by === 'rating') return [...list].sort((a, b) => this.score(b) - this.score(a));
    if (by === 'fee') return [...list].sort((a, b) => (a.consultationFee ?? 1e9) - (b.consultationFee ?? 1e9));
    if (by === 'experience') return [...list].sort((a, b) => (b.yearsExperience ?? -1) - (a.yearsExperience ?? -1));
    return list;
  }
  get visibleDoctors(): Doctor[] { return this.filteredDoctors.slice(0, this.pageSize); }
  /** Moyenne bayésienne : peu d'avis = note tirée vers 4. */
  private score(d: Doctor) { return (d.rating * d.reviews + 4 * 5) / (d.reviews + 5); }
  private fold(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }

  t(fr: string, ar: string): string { return this.lang==='fr' ? fr : ar; }
  go(page: Page) {
    this.mobileOpen = false;
    this.router.navigateByUrl(PATHS[page]);
  }
  toggleLanguage() { this.lang=this.lang==='fr'?'ar':'fr'; document.documentElement.lang=this.lang; document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr'; }
  homeSearch(f: HomeSearch) {
    this.router.navigate(['/doctors'], { queryParams: { specialty: f.specialty || null, governorate: f.governorate || null, q: f.name || null } });
  }
  openDoctor(d: Doctor) { this.router.navigate(['/doctors', d.id]); }
  resetFilters() { this.searchText=''; this.specialtyFilter=''; this.cityFilter=''; this.cnamOnly=false; this.teleOnly=false; }
  formatKm(k: number) { return k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(1)} km`; }
  photoFailed(id: number) { this.failedPhotos.update((s) => new Set(s).add(id)); }

  /** /doctors?specialty=…&governorate=…&q=… : filtres venant de l'accueil, du guide ou d'une orientation. */
  private applyQuery(url: string) {
    if (viewFromUrl(url) !== 'doctors') return;
    const qp = this.router.parseUrl(url).queryParams;
    if (!('specialty' in qp || 'governorate' in qp || 'q' in qp)) return;
    this.specialtyFilter = qp['specialty'] ?? '';
    this.cityFilter = qp['governorate'] ?? '';
    this.searchText = qp['q'] ?? '';
    this.pageSize = 24;
  }

  async toggleNear() {
    this.geoError.set('');
    if (this.doctorService.near()) { await this.doctorService.load(null); return; }
    this.locating.set(true);
    try {
      await this.doctorService.load(await currentPosition());
      this.sortBy = 'default';
    } catch (e) {
      this.geoError.set(e instanceof Error && e.message === 'denied'
        ? this.t('Accès à la position refusé : autorisez-le dans le navigateur ou filtrez par gouvernorat.', 'تم رفض الوصول إلى الموقع: اسمح به في المتصفح أو استعمل مرشح الولاية.')
        : this.t('Position indisponible pour le moment.', 'الموقع غير متاح حالياً.'));
    } finally { this.locating.set(false); }
  }

  toggleFavorite(id: number) {
    this.favorites.update((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]));
    try { localStorage.setItem('sehhatn_favorites', JSON.stringify(this.favorites())); } catch { /* stockage indisponible */ }
  }
  private readFavorites(): number[] {
    try { const v = JSON.parse(localStorage.getItem('sehhatn_favorites') ?? '[]'); return Array.isArray(v) ? v.filter(Number.isInteger) : []; }
    catch { return []; }
  }
}
