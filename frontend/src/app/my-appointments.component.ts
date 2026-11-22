import { NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { Appointment, AppointmentService, formatWhen } from './appointment.service';
import { ApiError } from './auth.service';
import { HealthCardService, SharedHealthCard } from './health-card.service';

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
    .hc-back { position: fixed; inset: 0; z-index: 50; background: #001d3e99; display: grid; place-items: center; padding: 16px; }
    .hc { width: min(100%, 520px); max-height: 88vh; overflow: auto; background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 20px 50px #0004; }
    .hc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
    .hc-head h2 { margin: 0; font: 800 17px Montserrat, sans-serif; color: var(--deep); }
    .hc-head p { margin: 2px 0 0; font-size: 12px; color: #748395; }
    .hc-close { border: 0; background: var(--pale); border-radius: 8px; width: 32px; height: 32px; font-size: 18px; cursor: pointer; }
    .hc-blood { display: inline-block; padding: 4px 10px; border-radius: 8px; background: #fdeaea; color: var(--coral); font-weight: 800; }
    .hc h3 { margin: 14px 0 6px; font: 800 11px Montserrat, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #455a6e; }
    .hc ul { margin: 0; padding-inline-start: 18px; font-size: 13px; display: grid; gap: 4px; }
    .hc .sev { color: var(--coral); font-weight: 700; }
    .hc .none { font-size: 12px; color: #748395; margin: 0; }
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
          @if (isDoctor() && a.patient_id && a.status !== 'cancelled') {
            <button class="mini" (click)="openCard(a)">♡ {{ t('Carte santé', 'البطاقة الصحية') }}</button>
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

    @if (cardFor(); as who) {
      <div class="hc-back" (click)="cardFor.set(null)">
        <div class="hc" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="hc-head">
            <div><h2>{{ t('Carte santé', 'البطاقة الصحية') }} — {{ who }}</h2>
              <p>{{ t('Partagée par le patient · consultation enregistrée dans son historique', 'شاركها المريض · يتم تسجيل الاطلاع في سجله') }}</p></div>
            <button class="hc-close" (click)="cardFor.set(null)" [attr.aria-label]="t('Fermer', 'إغلاق')">×</button>
          </div>
          @if (cardState() === 'loading') { <p class="none">{{ t('Chargement…', 'جارٍ التحميل…') }}</p> }
          @else if (cardState() === 'missing') { <p class="none">{{ t('Ce patient n’a pas partagé sa carte santé.', 'لم يشارك هذا المريض بطاقته الصحية.') }}</p> }
          @else if (cardState() === 'error') { <p class="error">{{ cardError() }}</p> }
          @else if (card(); as c) {
            <p style="margin:0;font-size:13px">
              @if (c.age !== null) { {{ c.age }} {{ t('ans', 'سنة') }} · }
              @if (c.sex) { {{ c.sex === 'f' ? t('Femme', 'أنثى') : t('Homme', 'ذكر') }} · }
              {{ t('Groupe', 'الفصيلة') }} <span class="hc-blood">{{ c.blood_type || '?' }}</span>
              @if (c.height_cm) { · {{ c.height_cm }} cm } @if (c.weight_kg) { · {{ c.weight_kg }} kg }
              @if (c.smoker) { · {{ t('Fumeur', 'مدخن') }} }
            </p>
            <h3>{{ t('Allergies', 'الحساسية') }}</h3>
            @if (c.allergies.length) { <ul>@for (x of c.allergies; track $index) { <li [class.sev]="x.severity === 'severe'">{{ x.substance }}@if (x.reaction) { — {{ x.reaction }} }@if (x.severity === 'severe') { ({{ t('sévère', 'شديدة') }}) }</li> }</ul> }
            @else { <p class="none">{{ t('Aucune renseignée', 'لا شيء مسجل') }}</p> }
            <h3>{{ t('Maladies chroniques', 'الأمراض المزمنة') }}</h3>
            @if (c.conditions.length) { <ul>@for (x of c.conditions; track $index) { <li>{{ x.name }}@if (x.diagnosed_year) { ({{ x.diagnosed_year }}) }@if (x.notes) { — {{ x.notes }} }</li> }</ul> }
            @else { <p class="none">{{ t('Aucune renseignée', 'لا شيء مسجل') }}</p> }
            <h3>{{ t('Traitements', 'الأدوية') }}</h3>
            @if (c.medications.length) { <ul>@for (x of c.medications; track $index) { <li>{{ x.name }}@if (x.dosage) { · {{ x.dosage }} }@if (x.frequency) { · {{ x.frequency }} }</li> }</ul> }
            @else { <p class="none">{{ t('Aucun renseigné', 'لا شيء مسجل') }}</p> }
            @if (c.vaccinations.length) {
              <h3>{{ t('Vaccinations', 'التلاقيح') }}</h3>
              <ul>@for (x of c.vaccinations; track $index) { <li>{{ x.vaccine }}@if (x.dose_date) { · {{ x.dose_date }} }</li> }</ul>
            }
            @if (c.notes) { <h3>{{ t('Notes du patient', 'ملاحظات المريض') }}</h3><p style="margin:0;font-size:13px">{{ c.notes }}</p> }
          }
        </div>
      </div>
    }
  `,
})
export class MyAppointmentsComponent implements OnInit {
  private api = inject(AppointmentService);
  private auth = inject(AuthService);
  private healthCards = inject(HealthCardService);
  readonly lang = input<'fr' | 'ar'>('fr');

  readonly cardFor = signal<string | null>(null);
  readonly cardState = signal<'loading' | 'ready' | 'missing' | 'error'>('loading');
  readonly card = signal<SharedHealthCard | null>(null);
  readonly cardError = signal('');

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

  /** Le médecin ouvre la carte santé d'un patient (si celui-ci l'a partagée). */
  async openCard(a: Appointment) {
    if (!a.patient_id) return;
    this.cardFor.set(a.patient_name ?? '');
    this.card.set(null);
    this.cardState.set('loading');
    try {
      this.card.set(await this.healthCards.patient(a.patient_id));
      this.cardState.set('ready');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.cardState.set('missing');
      else { this.cardError.set(e instanceof Error ? e.message : 'Erreur inconnue'); this.cardState.set('error'); }
    }
  }

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