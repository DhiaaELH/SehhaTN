import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { BodyMapComponent } from './body-map.component';
import { GOVERNORATES, SPECIALTIES } from './doctor.service';
import { LangService } from './lang.service';

export interface HomeSearch { specialty?: string; governorate?: string; name?: string; }
interface NewsItem { title: string; link: string; source: string; image: string | null; date: string | null; }

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [FormsModule, BodyMapComponent],
  template: `
    <div class="hm">
      <header class="hm-head">
        <h1>{{ t('Le bon soin,', 'الرعاية المناسبة،') }} <span>{{ t('plus près de vous.', 'أقرب إليك.') }}</span></h1>
        <p>{{ t('Trouvez un médecin en Tunisie, ou montrez-nous où ça fait mal.', 'ابحث عن طبيب في تونس، أو أرنا مكان الألم.') }}</p>
      </header>

      <section class="hm-photo-hero">
        <img src="/assets/home-tunisia-healthcare-banner.png" [alt]="t('Bannière SehhaTN : une médecin et les services de santé en Tunisie', 'SehhaTN: طبيبة وخدمات صحية في تونس')" fetchpriority="high">
        <div class="hm-photo-shade"></div>
        <div class="hm-photo-copy"><span>{{ t('SEHHA TN · AU PLUS PRÈS DE VOUS', 'صحتك في تونس · أقرب إليك') }}</span><h2>{{ t('Votre santé mérite un bon point de départ.', 'صحتك تستحق بداية موفقة.') }}</h2><p>{{ t('Médecins, conseils santé et services utiles, réunis au même endroit.', 'الأطباء والإرشادات الصحية والخدمات المفيدة في مكان واحد.') }}</p></div>
      </section>

      <div class="hm-grid">
        <div class="hm-card hm-map"><app-body-map (pick)="go({ specialty: $event })"/></div>

        <form class="hm-card hm-search" (submit)="$event.preventDefault(); submit()">
          <h2>{{ t('Trouver un médecin', 'ابحث عن طبيب') }}</h2>
          <div class="hm-fields">
            <label>{{ t('Spécialité', 'التخصص') }}
              <select [(ngModel)]="specialty" name="specialty">
                <option value="">{{ t('Toutes', 'الكل') }}</option>
                @for (s of specialties; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </label>
            <label>{{ t('Gouvernorat', 'الولاية') }}
              <select [(ngModel)]="governorate" name="governorate">
                <option value="">{{ t('Toute la Tunisie', 'كل تونس') }}</option>
                @for (g of governorates; track g) { <option [value]="g">{{ g }}</option> }
              </select>
            </label>
            <label class="wide">{{ t('Nom du médecin', 'اسم الطبيب') }}
              <input [(ngModel)]="name" name="name" [placeholder]="t('Facultatif', 'اختياري')" autocomplete="off">
            </label>
          </div>
          <button class="hm-go" type="submit">{{ t('Rechercher', 'بحث') }} <span aria-hidden="true">→</span></button>
          <div class="hm-chips">
            <span>{{ t('Populaire :', 'الأكثر بحثاً:') }}</span>
            <button type="button" (click)="specialty = 'Cardiologue'">Cardiologue</button>
            <button type="button" (click)="specialty = 'Pédiatre'">Pédiatre</button>
            <button type="button" (click)="governorate = 'Tunis'">Tunis</button>
          </div>
        </form>

      </div>

      <section class="hm-news">
        <div class="hm-news-head">
          <h2>{{ t('Actualités santé', 'أخبار صحية') }}</h2>
          <span>{{ t('Dernières nouvelles · sources officielles', 'آخر الأخبار · مصادر رسمية') }}</span>
        </div>
        @if (news() === null) {
          <div class="hm-news-grid">@for (i of [1,2,3,4]; track i) { <div class="hm-skel"></div> }</div>
        } @else if (news()!.length) {
          <div class="hm-news-grid">
            @for (n of news()!; track n.link) {
              <a class="hm-news-card" [href]="n.link" target="_blank" rel="noopener noreferrer">
                @if (n.image && !failed().has(n.link)) {
                  <img [src]="n.image" alt="" loading="lazy" (error)="markFailed(n.link)">
                } @else {
                  <div class="hm-ph" aria-hidden="true">✚</div>
                }
                <div class="hm-news-body">
                  <b>{{ n.title }}</b>
                  <small>{{ n.source }}@if (n.date) { · {{ fmt(n.date) }} }</small>
                </div>
              </a>
            }
          </div>
        } @else {
          <div class="hm-news-empty"><p>{{ t('Les actualités sont momentanément indisponibles.', 'الأخبار غير متاحة حالياً.') }}</p><button type="button" (click)="loadNews()">{{ t('Réessayer', 'إعادة المحاولة') }}</button></div>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .hm { max-width: 1180px; margin: 0 auto; padding: 36px 24px 56px; }
    .hm-head { text-align: center; margin-bottom: 30px; }
    .hm-head h1 { margin: 0; font-size: clamp(34px, 5vw, 54px); line-height: 1.08; letter-spacing: -.02em; color: var(--navy); font-weight: 800; }
    .hm-head h1 span { color: var(--teal); }
    .hm-head p { margin: 12px 0 0; color: var(--muted); font-size: 16.5px; }
    .hm-photo-hero { aspect-ratio: 1932 / 825; height: auto; position: relative; overflow: hidden; border-radius: 22px; margin: 0 0 22px; background: #0b325e; }
    .hm-photo-hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; object-position:center 35%; }
    .hm-photo-shade { position:absolute; inset:0; background:linear-gradient(90deg,rgba(5,31,58,.08),transparent 63%); }
    .hm-photo-copy { position:absolute; left:7%; top:50%; transform:translateY(-50%); max-width:43%; color:#fff; }
    .hm-photo-copy>span { font-size:10px; font-weight:800; letter-spacing:1.6px; color:#9ee9e0; }
    .hm-photo-copy h2 { margin:12px 0 8px; color:white; font-size:clamp(24px,3.1vw,38px); line-height:1.15; }
    .hm-photo-copy p { margin:0; color:#e2edf6; font-size:14px; line-height:1.6; }
    .hm-grid { display: grid; grid-template-columns: 1.15fr 1fr; grid-template-areas: "map search"; gap: 20px; align-items: stretch; }
    .hm-card { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 24px; box-shadow: 0 10px 30px rgba(11, 50, 94, .05); }
    .hm-map { grid-area: map; } .hm-search { grid-area: search; }
    h2 { margin: 0; font-size: 22px; color: var(--navy); letter-spacing: -.01em; }
    .hm-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 18px 0; }
    .hm-fields .wide { grid-column: 1 / -1; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--navy); }
    select, input, textarea { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-size: 15px; background: #fff; color: var(--ink); width: 100%; }
    select:focus, input:focus { outline: 2px solid var(--teal); outline-offset: 1px; border-color: transparent; }
    .hm-go { width: 100%; border: 0; border-radius: 14px; background: var(--navy); color: #fff; font-weight: 700; font-size: 16px; padding: 14px; }
    .hm-go:hover { background: var(--teal); }
    .hm-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; font-size: 13px; color: var(--muted); }
    .hm-chips button { border: 1px solid var(--line); background: var(--pale); color: var(--navy); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 600; }
    .hm-chips button:hover { border-color: var(--teal); }
    .hm-news { margin-top: 44px; }
    .hm-news-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 16px; }
    .hm-news-head span { color: var(--muted); font-size: 12.5px; }
    .hm-news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .hm-news-card { display: flex; flex-direction: column; background: #fff; border: 1px solid var(--line); border-radius: 18px; overflow: hidden; text-decoration: none; color: inherit; transition: transform .15s, box-shadow .15s; }
    .hm-news-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px rgba(11, 50, 94, .1); }
    .hm-news-card img, .hm-ph { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: var(--pale); }
    .hm-ph { display: grid; place-items: center; font-size: 34px; color: var(--teal); background: linear-gradient(135deg, var(--pale), #d9f2f4); }
    .hm-news-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
    .hm-news-body b { color: var(--navy); font-size: 15px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .hm-news-body small { color: var(--muted); font-size: 12px; }
    .hm-skel { height: 250px; border-radius: 18px; background: linear-gradient(90deg, #eef3fa, #f8fbff, #eef3fa); background-size: 200% 100%; animation: hmsk 1.4s infinite; }
    @keyframes hmsk { to { background-position: -200% 0; } }
    .hm-news-empty { color: var(--muted); }
    @media (max-width: 1000px) { .hm-news-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 860px) {
      .hm { padding: 24px 16px 44px; }
      .hm-grid { grid-template-columns: 1fr; grid-template-areas: "search" "map"; }
      .hm-photo-hero { height:auto; aspect-ratio:1932 / 825; border-radius:16px; }
      .hm-photo-copy { left:6%; right:auto; max-width:46%; }
      .hm-photo-copy>span { font-size:8px; letter-spacing:.8px; }
      .hm-photo-copy h2 { font-size:clamp(14px,4vw,24px); margin:7px 0 5px; }
      .hm-photo-copy p { font-size:10px; }
      .hm-card { padding: 18px; }
    }
    @media (max-width: 520px) { .hm-fields { grid-template-columns: 1fr; } .hm-news-grid { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .hm-skel { animation: none; } .hm-news-card { transition: none; } }
  `],
})
export class HomeComponent {
  private auth = inject(AuthService);
  private langService = inject(LangService);

  /** Demande d'ouverture de l'annuaire avec ces filtres. */
  search = output<HomeSearch>();

  specialties = SPECIALTIES;
  governorates = GOVERNORATES;
  specialty = ''; governorate = ''; name = '';

  news = signal<NewsItem[] | null>(null);
  failed = signal<Set<string>>(new Set());

  constructor() { this.loadNews(); }

  loadNews() {
    this.news.set(null);
    this.auth.request<{ items: NewsItem[] }>('/news')
      .then((r) => this.news.set((r.items ?? []).slice(0, 6)))
      .catch(() => this.news.set([]));
  }

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }
  go(s: HomeSearch) { this.search.emit(s); }
  submit() { this.search.emit({ specialty: this.specialty, governorate: this.governorate, name: this.name.trim() }); }
  markFailed(link: string) { this.failed.update((s) => new Set(s).add(link)); }
  fmt(iso: string) {
    return new Date(iso).toLocaleDateString(this.langService.lang() === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
