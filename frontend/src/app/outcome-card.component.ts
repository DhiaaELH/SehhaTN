import { Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { LangService } from './lang.service';
import type { Outcome } from './triage.service';

/** Résultat d'orientation : niveau de soins, explications, spécialiste conseillé et prochaines étapes. */
@Component({
  selector: 'app-outcome-card',
  standalone: true,
  template: `
    @let o = outcome();
    <article class="oc" [attr.data-level]="o.level" [class.compact]="compact()">
      <header class="oc-head">
        <div class="oc-ladder" aria-hidden="true">@for (i of [0,1,2,3,4,5]; track i) { <i [class.on]="i <= o.level"></i> }</div>
        <span class="oc-kicker">{{ t('VOTRE ORIENTATION', 'التوجيه المقترح') }}</span>
        <h2>{{ o.title }}</h2>
        <p>{{ o.action }}</p>
        @if (o.level === 5) {
          <a class="oc-call" href="tel:190">☎ {{ t('Appeler le 190 maintenant', 'اتصل بالرقم 190 الآن') }}</a>
        } @else if (o.level === 4) {
          <a class="oc-call alt" href="tel:190">☎ {{ t('Si votre état s’aggrave : appelez le 190', 'إذا ساءت حالتك: اتصل بالرقم 190') }}</a>
        }
      </header>

      @if (o.factors?.length && !compact()) {
        <section>
          <h3>{{ t('Ce qui a compté dans cette orientation', 'ما الذي أثّر في هذا التوجيه') }}</h3>
          <div class="oc-chips">@for (f of o.factors; track f.text) { @if (f.kind !== 'red_flag') { <span [attr.data-kind]="f.kind">{{ f.text }}</span> } }</div>
          @for (f of o.factors; track f.text) { @if (f.kind === 'red_flag') { <p class="oc-flag">⚠ {{ f.text }}</p> } }
        </section>
      }

      @if (o.reasons.length) {
        <section>
          <h3>{{ t('Pourquoi cette orientation ?', 'لماذا هذا التوجيه؟') }}</h3>
          <ul class="oc-list">@for (r of o.reasons; track r) { <li>{{ r }}</li> }</ul>
        </section>
      }

      <section class="oc-actions">
        @if (o.facility_type === 'hospital') {
          <button class="primary-btn" (click)="nearby('hospital')">⌖ {{ t('Urgences les plus proches', 'أقرب قسم استعجالي') }}</button>
        }
        @if (o.facility_type === 'pharmacy') {
          <button class="primary-btn" (click)="nearby('pharmacy')">⌖ {{ t('Pharmacies autour de moi', 'الصيدليات القريبة مني') }}</button>
        }
        @if (o.specialty) {
          <button [class]="o.facility_type ? 'outline-btn' : 'primary-btn'" (click)="findDoctors()">
            {{ o.specialty.icon }} {{ t('Trouver un', 'ابحث عن') }} {{ o.specialty.name }}
          </button>
        }
      </section>

      @if (o.doctors.length && o.level <= 3) {
        <section>
          <h3>{{ t('Disponibles sur SehhaTN', 'متوفرون على SehhaTN') }}</h3>
          <div class="oc-docs">
            @for (d of o.doctors; track d.id) {
              <button class="oc-doc" (click)="openDoctor(d.id)">
                @if (d.photo_url) { <img [src]="d.photo_url" alt="" loading="lazy"> } @else { <span class="oc-ph">⚕</span> }
                <span><b>{{ d.name }}</b><small>{{ d.city }}@if (d.review_count) { · ★ {{ d.rating }} ({{ d.review_count }}) }</small></span>
              </button>
            }
          </div>
        </section>
      }

      @if (o.advice.length && !compact()) {
        <section>
          <h3>{{ o.level <= 1 ? t('Ce que vous pouvez faire', 'ما يمكنك فعله') : t('En attendant la consultation', 'في انتظار الاستشارة') }}</h3>
          <ul class="oc-list ok">@for (a of o.advice; track a) { <li>{{ a }}</li> }</ul>
        </section>
      }

      @if (o.watch_for.length) {
        <section class="oc-watch">
          <h3>⚠ {{ t('Allez aux urgences ou appelez le 190 si l’un de ces signes apparaît', 'توجه إلى الاستعجالي أو اتصل بالرقم 190 إذا ظهرت إحدى هذه العلامات') }}</h3>
          <ul class="oc-list">@for (w of o.watch_for; track w.key) { <li>{{ w.text }}</li> }</ul>
        </section>
      }

      @if (o.related_conditions.length && !compact()) {
        <section>
          <h3>{{ t('Pour en savoir plus', 'لمعرفة المزيد') }}</h3>
          <p class="oc-muted">{{ t('Pistes à évoquer avec un professionnel, pas un diagnostic :', 'احتمالات تناقشها مع مختص، وليست تشخيصاً:') }}</p>
          <div class="oc-links">@for (c of o.related_conditions; track c.slug) { <button (click)="openGuide(c.slug)">{{ c.name }} →</button> }</div>
        </section>
      }

      @if (o.protocol; as pr) {
        <details class="oc-method">
          <summary>{{ t('Méthode et relecture', 'المنهج والمراجعة') }}</summary>
          <p>{{ pr.basis }}</p>
          <p>{{ pr.reviewed_by ? t('Relu par ', 'تمت المراجعة من طرف ') + pr.reviewed_by + (pr.reviewed_on ? ' · ' + pr.reviewed_on : '') : t('Ce contenu n’a pas encore été relu par un professionnel de santé : il ne remplace jamais un avis médical.', 'لم يراجع مختص في الصحة هذا المحتوى بعد: ولا يغني أبداً عن رأي الطبيب.') }}</p>
        </details>
      }

      <footer class="oc-foot">
        <p>ⓘ {{ o.disclaimer }}</p>
        @if (restartLabel()) { <button class="outline-btn" (click)="restart.emit()">↺ {{ restartLabel() }}</button> }
      </footer>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .oc { --c: #0b5d9e; --bg: #eef5fc; background:var(--surface); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; box-shadow: 0 12px 32px #0b325e14; }
    .oc[data-level="0"], .oc[data-level="1"] { --c: #0a7a55; --bg: #e8f6ef; }
    .oc[data-level="3"] { --c: #9a6200; --bg: #fff5e0; }
    .oc[data-level="4"] { --c: #c2410c; --bg: #fff0e8; }
    .oc[data-level="5"] { --c: #b91c1c; --bg: #fdecec; }
    .oc-head { background: var(--bg); padding: 22px 24px; border-bottom: 1px solid var(--line); }
    .oc-ladder { display: flex; gap: 4px; margin-bottom: 12px; }
    .oc-ladder i { flex: 1; height: 6px; border-radius: 3px; background: #0b325e1a; }
    .oc-ladder i.on { background: var(--c); }
    .oc-kicker { font-size: 10px; font-weight: 800; letter-spacing: .12em; color: var(--c); }
    h2 { margin: 6px 0 6px; font: 800 clamp(20px, 3vw, 26px)/1.2 Montserrat, sans-serif; color: var(--c); }
    .oc-head p { margin: 0; color: var(--ink); line-height: 1.55; }
    .oc-call { display: inline-flex; margin-top: 14px; padding: 12px 18px; border-radius: 12px; background: #b91c1c; color: #fff; font-weight: 800; text-decoration: none; font-size: 16px; }
    section { padding: 16px 24px 0; }
    h3 { margin: 0 0 8px; font: 800 13px Montserrat, sans-serif; color: var(--deep); }
    .oc-list { margin: 0; padding-inline-start: 18px; display: grid; gap: 6px; color: var(--text2); font-size: 14px; line-height: 1.5; }
    .oc-list.ok li::marker { color: #0a7a55; }
    .oc-watch .oc-list li::marker { color: #c2410c; }
    .oc-actions { display: flex; flex-wrap: wrap; gap: 10px; }
    .oc-actions button { padding: 11px 16px; border-radius: 10px; font-weight: 700; }
    .oc-docs { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px; }
    .oc-doc { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background:var(--surface); text-align: start; }
    .oc-doc:hover { border-color: var(--teal); }
    .oc-doc img, .oc-ph { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex: none; }
    .oc-ph { display: grid; place-items: center; background: var(--pale); color: var(--navy); }
    .oc-doc b { display: block; color: var(--deep); font-size: 13px; }
    .oc-doc small { color: var(--muted); font-size: 12px; }
    .oc-call.alt { background: transparent; color: var(--c); border: 2px solid var(--c); font-size: 14px; }
    .oc-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .oc-chips span { padding: 5px 11px; background: var(--pale); color: var(--navy); font-size: 13px; font-weight: 600; }
    .oc-chips span[data-kind='history'] { background: var(--bg); color: var(--c); }
    .oc-flag { margin: 8px 0 0; color: var(--c); font-size: 13px; line-height: 1.5; }
    .oc-method { margin: 14px 24px 0; font-size: 12px; color: var(--muted); }
    .oc-method summary { cursor: pointer; font-weight: 700; color: var(--text2); }
    .oc-method p { margin: 6px 0 0; line-height: 1.55; }
    .compact .oc-method { margin-inline: 18px; }
    .oc-muted { margin: 0 0 8px; color: var(--muted); font-size: 12px; }
    .oc-links { display: flex; flex-wrap: wrap; gap: 8px; }
    .oc-links button { border: 1px solid var(--line); background: var(--pale); color: var(--navy); border-radius: 999px; padding: 6px 12px; font-weight: 600; font-size: 13px; }
    .oc-foot { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 24px 20px; margin-top: 16px; border-top: 1px dashed var(--line); }
    .oc-foot p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; flex: 1 1 260px; }
    .compact .oc-head { padding: 16px 18px; } .compact section { padding: 12px 18px 0; } .compact .oc-foot { padding: 12px 18px 16px; }
    @media (max-width: 520px) { .oc-head { padding: 18px; } section { padding: 14px 18px 0; } .oc-foot { padding: 14px 18px 18px; } }
  `],
})
export class OutcomeCardComponent {
  private router = inject(Router);
  private langService = inject(LangService);
  readonly outcome = input.required<Outcome>();
  readonly compact = input(false);
  readonly restartLabel = input('');
  readonly governorate = input('');
  readonly restart = output<void>();

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }
  findDoctors() {
    const s = this.outcome().specialty;
    this.router.navigate(['/doctors'], { queryParams: { specialty: s?.name_fr, governorate: this.governorate() || null } });
  }
  nearby(type: 'hospital' | 'pharmacy') {
    this.router.navigate(['/lieux-de-sante'], { queryParams: { type, near: 1, ...(type === 'hospital' ? { emergency: 1 } : {}) } });
  }
  openDoctor(id: number) { this.router.navigate(['/doctors', id]); }
  openGuide(slug: string) { this.router.navigate(['/guide', slug]); }
}
