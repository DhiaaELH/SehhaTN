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

        <div class="hm-card hm-ai">
          <div class="hm-ai-top"><h2>{{ t('Consultation rapide', 'استشارة سريعة') }}</h2><span class="hm-soon">{{ t('Bientôt disponible', 'قريباً') }}</span></div>
          <textarea disabled rows="3" [placeholder]="t('Décrivez ce que vous ressentez…', 'صف ما تشعر به…')"></textarea>
          <button class="hm-ai-btn" type="button" disabled>{{ t('Obtenir une orientation', 'احصل على توجيه') }}</button>
          <p>{{ t('Un assistant vous orientera vers la bonne spécialité. Il ne remplace pas un médecin. Urgence : ', 'مساعد يوجهك إلى التخصص المناسب. لا يغني عن الطبيب. في الحالات العاجلة: ') }}<a href="tel:190">190</a></p>
        </div>
      </div>

      <section class="hm-news">
        <div class="hm-news-head">
          <h2>{{ t('Actualités santé', 'أخبار صحية') }}</h2>
          <span>{{ t('Sources : flux officiels', 'المصادر: مواقع رسمية') }}</span>
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
          <p class="hm-news-empty">{{ t('Les actualités sont momentanément indisponibles.', 'الأخبار غير متاحة حالياً.') }}</p>
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
    .hm-grid { display: grid; grid-template-columns: 1.15fr 1fr; grid-template-areas: "map search" "map ai"; gap: 20px; align-items: stretch; }
    .hm-card { background: #fff; border: 1px solid var(--line); border-radius: 22px; padding: 24px; box-shadow: 0 10px 30px rgba(11, 50, 94, .05); }
    .hm-map { grid-area: map; } .hm-search { grid-area: search; } .hm-ai { grid-area: ai; }
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
    .hm-ai { background: linear-gradient(160deg, #f4fbfc, #fff); }
    .hm-ai-top { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px; }
    .hm-soon { background: var(--pale); color: var(--teal); font-size: 11.5px; font-weight: 700; padding: 5px 10px; border-radius: 999px; white-space: nowrap; }
    textarea { resize: none; background: #f4f7fb; }
    .hm-ai-btn { margin-top: 10px; width: 100%; border: 0; border-radius: 12px; padding: 11px; background: #cfd9e6; color: #fff; font-weight: 700; cursor: not-allowed; }
    .hm-ai p { margin: 12px 0 0; font-size: 12px; color: var(--muted); line-height: 1.45; }
    .hm-ai a { color: var(--coral); font-weight: 700; }
    .hm-news { margin-top: 44px; }
    .hm-news-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 16px; }
    .hm-news-head span { color: var(--muted); font-size: 12.5px; }
    .hm-news-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 18px; }
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
      .hm-grid { grid-template-columns: 1fr; grid-template-areas: "search" "map" "ai"; }
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

  constructor() {
    this.auth.request<{ items: NewsItem[] }>('/news')
      .then((r) => this.news.set((r.items ?? []).slice(0, 4)))
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
