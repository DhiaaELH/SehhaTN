import { Component, inject, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { BodyMapComponent } from './body-map.component';
import { ApiDoctor, DoctorService, GOVERNORATES, SPECIALTIES, toDoctor } from './doctor.service';
import type { Doctor } from './doctor.service';
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
        <h1>{{ t('Le Bon Soin,', 'الرعاية المناسبة،') }} <span>{{ t('le Plus Près de Vous.', 'الأقرب إليك.') }}</span></h1>
      </header>

      <nav class="hm-tiles" [attr.aria-label]="t('Accès rapide', 'وصول سريع')">
        @for (tile of tiles; track tile.path; let i = $index) {
          <button type="button" class="hm-tile" [class]="'hm-tile t' + (i + 1)" [style.--i]="i" (click)="open(tile.path)">
            <svg class="hm-tile-art" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="tile.d"/></svg>
            <span class="hm-tile-no" aria-hidden="true">0{{ i + 1 }}</span>
            <span class="hm-tile-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path [attr.d]="tile.d"/></svg></span>
            <span class="hm-tile-tag">{{ t(tile.tag_fr, tile.tag_ar) }}</span>
            <strong class="hm-tile-title">{{ t(tile.fr, tile.ar) }}</strong>
            <span class="hm-tile-desc">{{ t(tile.desc_fr, tile.desc_ar) }}</span>
            <span class="hm-tile-go" aria-hidden="true">→</span>
          </button>
        }
      </nav>

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
          <div class="hm-quick">
            <b>{{ t('Besoin d’être orienté ?', 'هل تحتاج إلى توجيه؟') }}</b>
            <button type="button" (click)="router.navigateByUrl('/orientation')"><span>⌖</span><strong>{{ t('Orientation guidée', 'التوجيه الموجه') }}</strong><small>{{ t('Quel soin, quel spécialiste ?', 'أي رعاية؟ أي مختص؟') }}</small></button>
            <button type="button" (click)="router.navigateByUrl('/assistant')"><span>💬</span><strong>{{ t('Assistant santé', 'المساعد الصحي') }}</strong><small>{{ t('Décrivez vos symptômes', 'صف أعراضك') }}</small></button>
            <button type="button" (click)="router.navigate(['/lieux-de-sante'], { queryParams: { night: 1, near: 1 } })"><span>☾</span><strong>{{ t('Pharmacie de nuit', 'صيدلية ليلية') }}</strong><small>{{ t('La plus proche de moi', 'الأقرب إلي') }}</small></button>
            <button type="button" class="hm-urg" (click)="router.navigate(['/lieux-de-sante'], { queryParams: { type: 'hospital', near: 1 } })"><span>H</span><strong>{{ t('Urgences', 'الاستعجالي') }}</strong><small>{{ t('Hôpitaux à proximité', 'المستشفيات القريبة') }}</small></button>
          </div>
        </form>

      </div>

      @if (doctorService.specialties().length) {
        <section class="hm-sec">
          <div class="hm-news-head"><h2>{{ t('Toutes les spécialités', 'كل التخصصات') }}</h2><span>{{ t('Choisissez le bon interlocuteur', 'اختر المختص المناسب') }}</span></div>
          <div class="hm-specs">
            @for (s of doctorService.specialties(); track s.slug) {
              <button type="button" (click)="go({ specialty: s.name_fr })" [title]="t(s.description_fr ?? '', s.description_ar ?? '')">
                <span>{{ s.icon }}</span><b>{{ t(s.name_fr, s.name_ar) }}</b><small>{{ s.doctor_count }} {{ t('praticiens', 'مختص') }}</small>
              </button>
            }
          </div>
        </section>
      }
      @if (top().length) {
        <section class="hm-sec">
          <div class="hm-news-head"><h2>{{ t('Les mieux notés par les patients', 'الأعلى تقييماً من المرضى') }}</h2><span>{{ t('Avis vérifiés après consultation', 'آراء موثقة بعد الاستشارة') }}</span></div>
          <div class="hm-top">
            @for (d of top(); track d.id) {
              <button type="button" (click)="router.navigate(['/doctors', d.id])">
                @if (d.photo) { <img [src]="d.photo" alt="" loading="lazy"> } @else { <i [style.background]="d.color">{{ d.initials }}</i> }
                <b>{{ d.name }}</b><small>{{ doctorService.specialtyLabel(d.specialty, langService.lang()) }} · {{ d.city }}</small>
                <em>★ {{ d.rating }} <span>({{ d.reviews }} {{ t('avis', 'رأي') }})</span></em>
              </button>
            }
          </div>
        </section>
      }

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
    .hm-tiles { display: flex; gap: 14px; height: 300px; margin: 0 0 26px; }
    .hm-tile { --c1: #0b325e; --c2: #0f5f8a; position: relative; isolation: isolate; overflow: hidden; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; align-items: flex-start; gap: 6px; text-align: start; padding: 22px 22px 20px; border: 0; border-radius: 24px; color: #fff; cursor: pointer; background: linear-gradient(155deg, var(--c1), var(--c2)); box-shadow: 0 14px 30px rgba(11, 50, 94, .18); transition: flex-grow .45s cubic-bezier(.2, .8, .2, 1), transform .3s, box-shadow .3s; animation: hmrise .6s cubic-bezier(.2, .8, .2, 1) both; animation-delay: calc(var(--i) * 90ms); }
    .hm-tile.t1 { --c1: #0b325e; --c2: #14708f; }
    .hm-tile.t2 { --c1: #0f4c75; --c2: #12a6a0; }
    .hm-tile.t3 { --c1: #0e7c86; --c2: #35c2a4; }
    .hm-tile.t4 { --c1: #123d6b; --c2: #2b8f9c; }
    .hm-tile::before { content: ''; position: absolute; inset: 0; z-index: -1; background: radial-gradient(circle at 85% 8%, rgba(255, 255, 255, .28), transparent 46%); transition: opacity .4s; opacity: .6; }
    .hm-tile::after { content: ''; position: absolute; width: 170px; height: 170px; inset-inline-end: -60px; bottom: -70px; z-index: -1; border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, .22); box-shadow: 0 0 0 26px rgba(255, 255, 255, .05), 0 0 0 54px rgba(255, 255, 255, .03); transition: transform .6s; }
    .hm-tiles:hover .hm-tile { flex-grow: .8; }
    .hm-tiles .hm-tile:hover, .hm-tiles .hm-tile:focus-visible { flex-grow: 1.7; transform: translateY(-8px); box-shadow: 0 26px 46px rgba(11, 50, 94, .3); }
    .hm-tile:hover::before { opacity: 1; }
    .hm-tile:hover::after { transform: scale(1.35); }
    .hm-tile:focus-visible { outline: 3px solid #9ee9e0; outline-offset: 3px; }
    .hm-tile-art { position: absolute; inset-inline-end: -14px; top: 10px; width: 150px; height: 150px; z-index: -1; fill: none; stroke: #fff; stroke-width: .8; stroke-linecap: round; stroke-linejoin: round; opacity: .16; transform: rotate(-8deg); transition: transform .6s, opacity .4s; }
    .hm-tile:hover .hm-tile-art { transform: rotate(0) scale(1.12); opacity: .26; }
    .hm-tile-no { position: absolute; inset-inline-start: 22px; top: 18px; font: 800 13px/1 Montserrat, sans-serif; letter-spacing: 2px; color: rgba(255, 255, 255, .6); }
    .hm-tile-ico { position: relative; width: 58px; height: 58px; border-radius: 18px; display: grid; place-items: center; margin-bottom: auto; margin-top: 34px; background: rgba(255, 255, 255, .16); border: 1px solid rgba(255, 255, 255, .35); backdrop-filter: blur(6px); transition: transform .4s; }
    .hm-tile-ico::after { content: ''; position: absolute; inset: -1px; border-radius: 18px; border: 2px solid rgba(255, 255, 255, .55); animation: hmpulse 2.8s infinite; animation-delay: calc(var(--i) * 350ms); }
    .hm-tile-ico svg { width: 28px; height: 28px; fill: none; stroke: #fff; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .hm-tile:hover .hm-tile-ico { transform: scale(1.1) rotate(-6deg); }
    .hm-tile-tag { font-size: 10.5px; font-weight: 800; letter-spacing: 1.3px; text-transform: uppercase; color: #9ee9e0; }
    .hm-tile-title { font: 800 clamp(20px, 2.1vw, 26px)/1.1 Montserrat, sans-serif; color: #fff; }
    .hm-tile-desc { max-width: 30ch; font-size: 13.5px; line-height: 1.5; color: #e6f1f8; max-height: 0; opacity: 0; overflow: hidden; transition: max-height .45s, opacity .35s .05s; }
    .hm-tile:hover .hm-tile-desc, .hm-tile:focus-visible .hm-tile-desc { max-height: 80px; opacity: 1; }
    .hm-tile-go { position: absolute; inset-inline-end: 18px; top: 16px; width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; background:var(--surface); color: var(--navy); font-weight: 800; transform: translateX(-6px); opacity: 0; transition: transform .35s, opacity .3s; }
    .hm-tile:hover .hm-tile-go, .hm-tile:focus-visible .hm-tile-go { transform: none; opacity: 1; }
    :host-context([dir=rtl]) .hm-tile-go { transform: scaleX(-1); }
    @keyframes hmrise { from { opacity: 0; transform: translateY(26px) scale(.97); } to { opacity: 1; transform: none; } }
    @keyframes hmpulse { 0% { transform: scale(1); opacity: .7; } 70%, 100% { transform: scale(1.35); opacity: 0; } }
    .hm-grid { display: grid; grid-template-columns: 1.15fr 1fr; grid-template-areas: "map search"; gap: 20px; align-items: stretch; }
    .hm-card { background:var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 24px; box-shadow: 0 10px 30px rgba(11, 50, 94, .05); }
    .hm-map { grid-area: map; } .hm-search { grid-area: search; }
    h2 { margin: 0; font-size: 22px; color: var(--navy); letter-spacing: -.01em; }
    .hm-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 18px 0; }
    .hm-fields .wide { grid-column: 1 / -1; }
    label { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; font-weight: 700; color: var(--navy); }
    select, input, textarea { border: 1px solid var(--line); border-radius: 12px; padding: 12px 14px; font-size: 15px; background:var(--surface); color: var(--ink); width: 100%; }
    select:focus, input:focus { outline: 2px solid var(--teal); outline-offset: 1px; border-color: transparent; }
    .hm-go { width: 100%; border: 0; border-radius: 14px; background:var(--navy-bg); color: #fff; font-weight: 700; font-size: 16px; padding: 14px; }
    .hm-go:hover { background: var(--teal); }
    .hm-chips { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 14px; font-size: 13px; color: var(--muted); }
    .hm-chips button { border: 1px solid var(--line); background: var(--pale); color: var(--navy); border-radius: 999px; padding: 5px 12px; font-size: 13px; font-weight: 600; }
    .hm-chips button:hover { border-color: var(--teal); }
    .hm-news { margin-top: 44px; }
    .hm-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 22px; padding-top: 18px; border-top: 1px dashed var(--line); }
    .hm-quick > b { grid-column: 1 / -1; color: var(--navy); font-size: 14px; }
    .hm-quick button { display: grid; grid-template-columns: 34px 1fr; grid-template-rows: auto auto; column-gap: 10px; text-align: start; align-items: center; padding: 12px; border: 1px solid var(--line); border-radius: 14px; background: var(--pale); color: var(--navy); }
    .hm-quick button:hover { border-color: var(--teal); background:var(--surface); }
    .hm-quick span { grid-row: 1 / 3; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background:var(--surface); color: var(--teal); font-weight: 800; }
    .hm-quick strong { font-size: 13.5px; } .hm-quick small { color: var(--muted); font-size: 12px; }
    .hm-quick .hm-urg span { color: #c62828; }
    .hm-sec { margin-top: 44px; }
    .hm-specs { display: grid; grid-template-columns: repeat(auto-fill, minmax(165px, 1fr)); gap: 10px; }
    .hm-specs button, .hm-top button { display: grid; gap: 3px; justify-items: start; text-align: start; padding: 14px; border: 1px solid var(--line); border-radius: 16px; background:var(--surface); color: var(--navy); transition: transform .15s, border-color .15s; }
    .hm-specs button:hover, .hm-top button:hover { transform: translateY(-2px); border-color: var(--teal); }
    .hm-specs span { font-size: 20px; color: var(--teal); } .hm-specs b { font-size: 14px; } .hm-specs small, .hm-top small { color: var(--muted); font-size: 12px; }
    .hm-top { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    .hm-top img, .hm-top i { width: 64px; height: 64px; border-radius: 50%; object-fit: cover; margin-bottom: 6px; display: grid; place-items: center; font-style: normal; font-weight: 800; color: var(--deep); }
    .hm-top b { font-size: 14.5px; } .hm-top em { font-style: normal; color: #c98a00; font-weight: 800; font-size: 13px; } .hm-top em span { color: var(--muted); font-weight: 500; }
    .hm-news-head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 16px; }
    .hm-news-head span { color: var(--muted); font-size: 12.5px; }
    .hm-news-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
    .hm-news-card { display: flex; flex-direction: column; background:var(--surface); border: 1px solid var(--line); border-radius: 18px; overflow: hidden; text-decoration: none; color: inherit; transition: transform .15s, box-shadow .15s; }
    .hm-news-card:hover { transform: translateY(-3px); box-shadow: 0 14px 28px rgba(11, 50, 94, .1); }
    .hm-news-card img, .hm-ph { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: var(--pale); }
    .hm-ph { display: grid; place-items: center; font-size: 34px; color: var(--teal); background: var(--surface2); }
    .hm-news-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 8px; }
    .hm-news-body b { color: var(--navy); font-size: 15px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .hm-news-body small { color: var(--muted); font-size: 12px; }
    .hm-skel { height: 250px; border-radius: 18px; background: var(--surface2); background-size: 200% 100%; animation: hmsk 1.4s infinite; }
    @keyframes hmsk { to { background-position: -200% 0; } }
    .hm-news-empty { color: var(--muted); }
    @media (max-width: 1000px) { .hm-news-grid, .hm-top { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 860px) {
      .hm { padding: 24px 16px 44px; }
      .hm-grid { grid-template-columns: 1fr; grid-template-areas: "search" "map"; }
      .hm-tiles { display: grid; grid-template-columns: 1fr 1fr; height: auto; gap: 12px; }
      .hm-tile { min-height: 190px; padding: 16px; border-radius: 20px; }
      .hm-tiles:hover .hm-tile, .hm-tiles .hm-tile:hover { flex-grow: 1; transform: none; }
      .hm-tile-desc { max-height: none; opacity: 1; font-size: 12px; max-width: none; }
      .hm-tile-go { opacity: 1; transform: none; width: 32px; height: 32px; }
      .hm-tile-ico { width: 46px; height: 46px; margin-top: 28px; border-radius: 14px; }
      .hm-tile-art { width: 110px; height: 110px; }
      .hm-card { padding: 18px; }
    }
    @media (max-width: 380px) { .hm-tiles { grid-template-columns: 1fr; } }
    @media (max-width: 520px) { .hm-fields, .hm-quick { grid-template-columns: 1fr; } .hm-news-grid { grid-template-columns: 1fr; } }
    @media (prefers-reduced-motion: reduce) { .hm-skel, .hm-tile, .hm-tile-ico::after { animation: none; } .hm-tile, .hm-tile-desc, .hm-tile-art, .hm-tile::after { transition: none; } .hm-news-card { transition: none; } }
  `],
})
export class HomeComponent {
  private auth = inject(AuthService);
  readonly langService = inject(LangService);
  readonly router = inject(Router);
  readonly doctorService = inject(DoctorService);
  readonly top = signal<Doctor[]>([]);

  readonly tiles = [
    { path: '/doctors', fr: 'Médecins', ar: 'الأطباء', tag_fr: 'Annuaire vérifié', tag_ar: 'دليل موثّق',
      desc_fr: 'Trouvez un médecin par spécialité et par ville, et prenez rendez-vous.', desc_ar: 'ابحث عن طبيب حسب التخصص والمدينة واحجز موعداً.',
      d: 'M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4M22 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0' },
    { path: '/assistant', fr: 'Assistant santé', ar: 'المساعد الصحي', tag_fr: 'Réponse en quelques mots', tag_ar: 'جواب في كلمات',
      desc_fr: 'Décrivez ce que vous ressentez, il vous indique vers qui vous tourner.', desc_ar: 'صف ما تشعر به وسيرشدك إلى الجهة المناسبة.',
      d: 'M7.9 20A9 9 0 1 0 4 16.1L2 22ZM12 8v6M9 11h6' },
    { path: '/lieux-de-sante', fr: 'Lieux de soins', ar: 'أماكن الرعاية', tag_fr: 'Pharmacies et urgences', tag_ar: 'صيدليات وطوارئ',
      desc_fr: 'Pharmacies de nuit, urgences et hôpitaux autour de vous.', desc_ar: 'صيدليات الليل والطوارئ والمستشفيات القريبة منك.',
      d: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' },
    { path: '/guide', fr: 'Guide santé', ar: 'الدليل الصحي', tag_fr: 'Fiches claires', tag_ar: 'بطاقات واضحة',
      desc_fr: 'Comprendre les maladies courantes : signes, conseils, quand consulter.', desc_ar: 'افهم الأمراض الشائعة: الأعراض والنصائح ومتى تستشير.',
      d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  ];
  open(path: string) { this.router.navigateByUrl(path); }

  /** Demande d'ouverture de l'annuaire avec ces filtres. */
  search = output<HomeSearch>();

  specialties = SPECIALTIES;
  governorates = GOVERNORATES;
  specialty = ''; governorate = ''; name = '';

  news = signal<NewsItem[] | null>(null);
  failed = signal<Set<string>>(new Set());

  constructor() {
    this.loadNews();
    this.auth.request<ApiDoctor[]>('/doctors?sort=rating&limit=4').then((d) => this.top.set(d.map(toDoctor))).catch(() => {});
  }

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
