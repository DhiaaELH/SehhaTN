import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Appointment, AppointmentService, formatWhen } from './appointment.service';

@Component({
  selector: 'app-my-appointments',
  standalone: true,
  imports: [NgTemplateOutlet],
  styles: [`
    :host { display: block; }
    .error { color: var(--coral); font-size: 11px; margin: 0 0 14px; }
    .sub { margin: 18px 0 8px; font: 800 11px Montserrat, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #455a6e; }
    .empty { margin: 0 0 8px; color: #748395; font-size: 11px; }
    .appt { padding: 12px 0; border-top: 1px dashed #dce4eb; display: grid; gap: 4px; }
    .appt.off { opacity: .6; }
    .when { font-weight: 800; font-size: 12px; color: var(--deep); text-transform: capitalize; }
    .who { font-size: 12px; color: #17395b; }
    .meta { font-size: 11px; color: #748395; }
    .foot { display: flex; align-items: center; gap: 12px; margin-top: 4px; flex-wrap: wrap; }
    .badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: #e7f5f4; color: #078b98; }
    .badge[data-s='cancelled'] { background: #fdeaea; color: var(--coral); }
    .badge[data-s='no_show'] { background: #fff3dc; color: #8a5a00; }
    .badge[data-s='completed'] { background: #e6f2ea; color: #0a7a55; }
    .mini { border: 0; background: none; color: #078b98; font-weight: 700; font-size: 11px; cursor: pointer; padding: 2px 0; }
    .mini.danger { color: var(--coral); }
    .mini:disabled { opacity: .5; cursor: not-allowed; }
  `],
  template: `
    <ng-template #row let-a>
      <div class="appt" [class.off]="a.status === 'cancelled'">
        <div class="when">{{ when(a.starts_at) }}</div>
        <div class="who">
          @if (isDoctor()) { {{ a.patient_name }} } @else { {{ a.doctor_name }} · {{ a.specialty }} }
        </div>
        @if (!isDoctor() && a.address) { <div class="meta">⌖ {{ a.address }}</div> }
        @if (a.note) { <div class="meta">“{{ a.note }}”</div> }
        <div class="foot">
          <span class="badge" [attr.data-s]="a.status">{{ statusLabel(a) }}</span>
          @if (canCancel(a)) {
            <button class="mini danger" [disabled]="busy() === a.id" (click)="change(a, 'cancelled')">{{ t('Annuler', 'إلغاء') }}</button>
          }
          @if (canClose(a)) {
            <button class="mini" [disabled]="busy() === a.id" (click)="change(a, 'completed')">{{ t('Terminé', 'منتهي') }}</button>
            <button class="mini danger" [disabled]="busy() === a.id" (click)="change(a, 'no_show')">{{ t('Absent', 'تغيّب') }}</button>
          }
        </div>
      </div>
    </ng-template>

    <div class="account-card">
      <span class="account-brand">▦</span>
      <span class="section-kicker">{{ t('RENDEZ-VOUS', 'المواعيد') }}</span>
      <h1>{{ t('Mes rendez-vous', 'مواعيدي') }}</h1>

      @if (state() === 'loading') {
        <p>{{ t('Chargement…', 'جارٍ التحميل…') }}</p>
      } @else if (state() === 'error') {
        <p class="error" role="alert">{{ error() }}</p>
        <button class="primary-btn" (click)="load()">{{ t('Réessayer', 'إعادة المحاولة') }}</button>
      } @else {
        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        <h3 class="sub">{{ t('À venir', 'القادمة') }}</h3>
        @for (a of upcoming(); track a.id) {
          <ng-container *ngTemplateOutlet="row; context: { $implicit: a }" />
        } @empty {
          <p class="empty">{{ t('Aucun rendez-vous à venir.', 'لا توجد مواعيد قادمة.') }}</p>
        }

        @if (past().length) {
          <h3 class="sub">{{ t('Passés et annulés', 'السابقة والملغاة') }}</h3>
          @for (a of past(); track a.id) {
            <ng-container *ngTemplateOutlet="row; context: { $implicit: a }" />
          }
        }
      }
    </div>
  `,
})
export class MyAppointmentsComponent implements OnInit {
  private api = inject(AppointmentService);
  private auth = inject(AuthService);
  readonly lang = input<'fr' | 'ar'>('fr');

  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly items = signal<Appointment[]>([]);
  readonly error = signal('');
  readonly busy = signal<number | null>(null);

  readonly isDoctor = computed(() => this.auth.user()?.role === 'doctor');
  readonly upcoming = computed(() => this.items()
    .filter((a) => this.isFuture(a))
    .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at)));
  readonly past = computed(() => this.items().filter((a) => !this.isFuture(a)));

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  when(iso: string) { return formatWhen(iso, this.lang()); }
  private isFuture(a: Appointment) { return a.status === 'confirmed' && Date.parse(a.starts_at) > Date.now(); }

  canCancel(a: Appointment) { return this.isFuture(a); }
  canClose(a: Appointment) { return this.isDoctor() && a.status === 'confirmed' && !this.isFuture(a); }

  statusLabel(a: Appointment) {
    switch (a.status) {
      case 'cancelled': return this.t('Annulé', 'ملغى');
      case 'completed': return this.t('Terminé', 'منتهي');
      case 'no_show': return this.t('Absent', 'تغيّب');
      default:
        if (this.isFuture(a)) return this.t('Confirmé', 'مؤكد');
        return this.isDoctor() ? this.t('À clôturer', 'للإغلاق') : this.t('Passé', 'سابق');
    }
  }

  ngOnInit() { this.load(); }

  async load() {
    try {
      this.items.set(await this.api.mine());
      this.state.set('ready');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
      if (this.state() === 'loading') this.state.set('error');
    }
  }

  async change(a: Appointment, status: 'cancelled' | 'completed' | 'no_show') {
    if (this.busy() !== null) return;
    if (status === 'cancelled' && !window.confirm(this.t('Annuler ce rendez-vous ?', 'إلغاء هذا الموعد؟'))) return;
    this.error.set('');
    this.busy.set(a.id);
    try {
      await this.api.setStatus(a.id, status);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.busy.set(null);
    }
    await this.load();
  }
}