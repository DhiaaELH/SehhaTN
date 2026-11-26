import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

interface Review { id: number; rating: number; comment: string | null; doctor_reply: string | null; created_at: string; author: string; }
interface ReviewPage { average: number; total: number; distribution: Record<string, number>; items: Review[]; }

/** Avis des patients sur la page d'un médecin : statistiques, liste paginée et formulaire. */
@Component({
  selector: 'app-doctor-reviews',
  standalone: true,
  imports: [FormsModule],
  template: `
    <article class="dp-card rv">
      <h2>{{ t('Avis des patients', 'آراء المرضى') }}</h2>
      @if (data(); as d) {
        @if (d.total) {
          <div class="rv-stats">
            <div class="rv-avg"><b>{{ d.average.toFixed(1) }}</b><span class="rv-stars" [attr.aria-label]="d.average + '/5'">{{ stars(d.average) }}</span><small>{{ d.total }} {{ t('avis vérifiés', 'رأياً موثقاً') }}</small></div>
            <div class="rv-bars">
              @for (n of [5,4,3,2,1]; track n) {
                <div><span>{{ n }}★</span><i><em [style.width.%]="pct(d.distribution[n], d.total)"></em></i><small>{{ d.distribution[n] }}</small></div>
              }
            </div>
          </div>
          <ul class="rv-list">
            @for (r of items(); track r.id) {
              <li>
                <div class="rv-head"><b>{{ r.author }}</b><span class="rv-stars small">{{ stars(r.rating) }}</span><small>{{ date(r.created_at) }}</small></div>
                @if (r.comment) { <p [attr.dir]="isArabic(r.comment) ? 'rtl' : 'ltr'">{{ r.comment }}</p> }
                @if (r.doctor_reply) { <div class="rv-reply"><small>{{ t('Réponse du praticien', 'رد المختص') }}</small><p>{{ r.doctor_reply }}</p></div> }
              </li>
            }
          </ul>
          @if (items().length < d.total) { <button class="outline-btn rv-more" [disabled]="loading()" (click)="more()">{{ t('Voir plus d’avis', 'عرض المزيد') }}</button> }
        } @else {
          <p class="rv-empty">{{ t('Pas encore d’avis pour ce praticien.', 'لا توجد آراء بعد لهذا المختص.') }}</p>
        }
      } @else { <p class="rv-empty">{{ t('Chargement des avis…', 'جارٍ تحميل الآراء…') }}</p> }

      <div class="rv-form">
        @if (auth.user()?.role === 'patient') {
          <b>{{ t('Votre avis', 'رأيك') }}</b>
          <div class="rv-pick" role="radiogroup" [attr.aria-label]="t('Note', 'التقييم')">
            @for (n of [1,2,3,4,5]; track n) { <button type="button" role="radio" [attr.aria-checked]="rating() === n" [class.on]="n <= rating()" (click)="rating.set(n)">★</button> }
          </div>
          <textarea [(ngModel)]="comment" maxlength="1000" rows="3" [placeholder]="t('Accueil, écoute, ponctualité… (facultatif)', 'الاستقبال، الإصغاء، الالتزام بالموعد… (اختياري)')"></textarea>
          @if (message()) { <p class="rv-msg" [class.err]="isError()">{{ message() }}</p> }
          <button class="primary-btn" [disabled]="!rating() || sending()" (click)="submit()">{{ sending() ? t('Envoi…', 'جارٍ الإرسال…') : t('Publier mon avis', 'نشر رأيي') }}</button>
          <small class="rv-hint">{{ t('Seuls les patients ayant eu un rendez-vous avec ce praticien via SehhaTN peuvent publier un avis. Votre nom apparaît abrégé.', 'يمكن فقط للمرضى الذين حجزوا موعداً مع هذا المختص عبر SehhaTN نشر رأي. يظهر اسمك مختصراً.') }}</small>
        } @else if (!auth.user()) {
          <p class="rv-hint">{{ t('Vous avez consulté ce praticien ?', 'هل استشرت هذا المختص؟') }} <button class="rv-link" (click)="router.navigateByUrl('/account')">{{ t('Connectez-vous pour donner votre avis', 'سجل الدخول لإبداء رأيك') }}</button></p>
        }
      </div>
    </article>
  `,
  styles: [`
    :host { display: block; }
    .rv { background:var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 24px; box-shadow: 0 8px 28px #17395b0d; }
    .rv h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; font: 800 17px Montserrat, sans-serif; color: var(--deep); }
    .rv h2::before { content: ''; width: 5px; height: 18px; border-radius: 3px; background: linear-gradient(var(--teal), var(--mint)); }
    .rv-stats { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 20px; align-items: center; padding-bottom: 14px; border-bottom: 1px dashed var(--line); }
    .rv-avg { display: grid; justify-items: center; gap: 2px; }
    .rv-avg b { font: 800 40px Montserrat, sans-serif; color: var(--deep); }
    .rv-avg small { color: var(--muted); font-size: 12px; }
    .rv-stars { color: #f2a516; letter-spacing: 2px; } .rv-stars.small { font-size: 12px; }
    .rv-bars { display: grid; gap: 5px; }
    .rv-bars div { display: grid; grid-template-columns: 28px 1fr 28px; gap: 8px; align-items: center; font-size: 12px; color: var(--muted); }
    .rv-bars i { height: 8px; border-radius: 4px; background:var(--surface2); overflow: hidden; }
    .rv-bars em { display: block; height: 100%; background: #f2a516; }
    .rv-list { list-style: none; margin: 0; padding: 0; }
    .rv-list li { padding: 14px 0; border-bottom: 1px solid var(--line); }
    .rv-head { display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
    .rv-head b { color: var(--deep); font-size: 13px; } .rv-head small { color: var(--muted); font-size: 11px; margin-inline-start: auto; }
    .rv-list p { margin: 6px 0 0; color: var(--text2); font-size: 14px; line-height: 1.55; }
    .rv-reply { margin-top: 8px; padding: 10px 12px; border-radius: 10px; background: var(--pale); }
    .rv-reply small { font-weight: 700; color: var(--navy); font-size: 11px; }
    .rv-more { margin-top: 12px; padding: 8px 14px; border-radius: 10px; }
    .rv-empty { color: var(--muted); font-size: 13px; margin: 0; }
    .rv-form { display: grid; gap: 8px; margin-top: 18px; padding-top: 16px; border-top: 1px dashed var(--line); }
    .rv-form b { color: var(--deep); }
    .rv-pick button { border: 0; background: none; font-size: 26px; color: #d3dbe5; padding: 0 2px; }
    .rv-pick button.on { color: #f2a516; }
    .rv-form textarea { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font: inherit; resize: vertical; }
    .rv-form .primary-btn { justify-self: start; padding: 10px 16px; border-radius: 10px; }
    .rv-hint { color: var(--muted); font-size: 12px; margin: 0; }
    .rv-link { border: 0; background: none; color: var(--text2); font-weight: 700; padding: 0; }
    .rv-msg { margin: 0; font-size: 13px; color: #0a7a55; } .rv-msg.err { color: var(--coral); }
    @media (max-width: 520px) { .rv-stats { grid-template-columns: 1fr; } }
  `],
})
export class DoctorReviewsComponent {
  readonly auth = inject(AuthService);
  readonly router = inject(Router);
  readonly doctorId = input.required<number>();
  readonly lang = input<'fr' | 'ar'>('fr');
  readonly data = signal<ReviewPage | null>(null);
  readonly items = signal<Review[]>([]);
  readonly loading = signal(false);
  readonly rating = signal(0);
  readonly sending = signal(false);
  readonly message = signal('');
  readonly isError = signal(false);
  comment = '';

  constructor() {
    effect(() => { const id = this.doctorId(); untracked(() => this.load(id)); });
  }

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  stars(n: number) { const r = Math.round(n); return '★'.repeat(r) + '☆'.repeat(5 - r); }
  pct(n: number, total: number) { return total ? Math.round((n / total) * 100) : 0; }
  isArabic(s: string) { return /[؀-ۿ]/.test(s); }
  date(iso: string) {
    return new Date(iso).toLocaleDateString(this.lang() === 'ar' ? 'ar-TN' : 'fr-FR', { month: 'long', year: 'numeric' });
  }

  private async load(id: number) {
    this.loading.set(true);
    try {
      const page = await this.auth.request<ReviewPage>(`/doctors/${id}/reviews?limit=5`);
      this.data.set(page);
      this.items.set(page.items);
    } catch { this.data.set({ average: 0, total: 0, distribution: {}, items: [] }); }
    finally { this.loading.set(false); }
  }

  async more() {
    this.loading.set(true);
    try {
      const page = await this.auth.request<ReviewPage>(`/doctors/${this.doctorId()}/reviews?limit=10&offset=${this.items().length}`);
      this.items.update((l) => [...l, ...page.items]);
    } finally { this.loading.set(false); }
  }

  async submit() {
    this.sending.set(true);
    this.message.set('');
    try {
      await this.auth.request(`/doctors/${this.doctorId()}/reviews`, {
        method: 'POST', body: JSON.stringify({ rating: this.rating(), comment: this.comment.trim() || undefined }),
      });
      this.isError.set(false);
      this.message.set(this.t('Merci ! Votre avis est publié.', 'شكراً! تم نشر رأيك.'));
      this.comment = '';
      this.rating.set(0);
      await this.load(this.doctorId());
    } catch (e) {
      this.isError.set(true);
      this.message.set(e instanceof Error ? e.message : 'Erreur');
    } finally { this.sending.set(false); }
  }
}
