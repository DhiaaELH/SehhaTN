import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { AppointmentService, Slot, SlotDay, WEEKDAYS_AR, WEEKDAYS_FR, formatWhen } from './appointment.service';

@Component({
  selector: 'app-slot-picker',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
    .head h2 { margin: 0; }
    :host { display: block; min-width: 0; scroll-margin-top: 90px; }
    .sp-card { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 24px; box-shadow: 0 8px 28px #17395b0d; }
    h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; font: 800 17px Montserrat, sans-serif; color: var(--deep); }
    h2::before { content: ''; width: 5px; height: 18px; border-radius: 3px; background: linear-gradient(var(--teal), var(--mint)); }
    .muted { margin: 0; color: var(--muted); font-size: 13px; }
    .days { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 8px; }
    .day { flex: none; display: grid; justify-items: center; gap: 2px; min-width: 62px; padding: 8px 6px; border: 1px solid var(--line);
           border-radius: 12px; background: #fff; cursor: pointer; color: var(--navy); }
    .day small { font-size: 10px; text-transform: uppercase; color: var(--muted); }
    .day b { font: 800 18px Montserrat, sans-serif; }
    .day.on { background: var(--navy); border-color: var(--navy); color: #fff; }
    .day.on small { color: #cfe4f5; }
    .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; margin-top: 12px; }
    .slot { height: 38px; border: 1px solid var(--line); border-radius: 9px; background: #fff; color: #078b98; font-weight: 700; font-size: 13px; cursor: pointer; }
    .slot:hover:not(:disabled) { background: var(--pale); }
    .slot.on { background: var(--teal); border-color: var(--teal); color: #fff; }
    .slot.taken { background: #f1f4f8; color: #a4b0bd; text-decoration: line-through; cursor: not-allowed; }
    .legend { margin: 12px 0 0; color: var(--muted); font-size: 11px; }
    .confirm { margin-top: 16px; padding: 16px; border-radius: 12px; background: #f6f9fe; display: grid; gap: 10px; }
    .confirm p { margin: 0; font-size: 13px; color: #3b4d61; }
    textarea { width: 100%; height: 64px; box-sizing: border-box; border: 1px solid var(--line); border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 12px; resize: vertical; }
    .btn { height: 42px; border-radius: 10px; border: 1px solid transparent; font-weight: 700; font-size: 13px; cursor: pointer; padding: 0 16px; }
    .btn.main { background: linear-gradient(135deg, var(--navy), #0d5781); color: #fff; }
    .btn.main:disabled { opacity: .5; cursor: not-allowed; }
    .btn.soft { background: #fff; color: var(--navy); border-color: var(--line); }
    .ok { margin: 12px 0 0; color: #0a7a55; font-weight: 700; font-size: 13px; }
    .err { margin: 12px 0 0; color: var(--coral); font-size: 12px; }
    .link { border: 0; background: none; color: #078b98; font-weight: 700; cursor: pointer; padding: 0; text-decoration: underline; }
  `],
  template: `
    <article class="sp-card">
      <div class="head">
  <h2>{{ t('Prendre rendez-vous', 'حجز موعد') }}</h2>
  <button class="link" type="button" (click)="closed.emit()">✕ {{ t('Fermer', 'إغلاق') }}</button>
</div>

      @switch (status()) {
        @case ('loading') {
          <p class="muted">{{ t('Chargement des disponibilités… le premier chargement peut prendre jusqu’à une minute.', 'جارٍ تحميل المواعيد… قد يستغرق التحميل الأول حتى دقيقة.') }}</p>
        }
        @case ('error') {
          <p class="err">{{ t('Impossible de charger les créneaux.', 'تعذر تحميل المواعيد.') }}</p>
          <button class="btn soft" (click)="load()">{{ t('Réessayer', 'إعادة المحاولة') }}</button>
        }
        @case ('none') {
          <p class="muted">{{ t('Ce médecin n’a pas encore ouvert de créneaux en ligne.', 'لم يفتح هذا الطبيب مواعيد للحجز عبر الإنترنت بعد.') }}</p>
        }
        @default {
          <div class="days">
            @for (d of days(); track d.date) {
              <button class="day" [class.on]="d.date === selectedDate()" (click)="selectDay(d.date)">
                <small>{{ weekday(d) }}</small><b>{{ dayNum(d.date) }}</b><small>{{ month(d.date) }}</small>
              </button>
            }
          </div>
          <div class="slots">
            @for (s of daySlots(); track s.starts_at) {
              <button class="slot" [class.on]="s.starts_at === selectedSlot()?.starts_at" [class.taken]="s.taken"
                      [disabled]="s.taken" (click)="selectSlot(s)">{{ s.time }}</button>
            }
          </div>
          <p class="legend">{{ t('Les créneaux barrés sont déjà pris. Heures de Tunis.', 'المواعيد المشطوبة محجوزة. توقيت تونس.') }}</p>

          @if (error()) { <p class="err" role="alert">{{ error() }}</p> }
          @if (booked()) {
            <p class="ok">✓ {{ t('Rendez-vous confirmé :', 'تم تأكيد الموعد:') }} {{ when(booked()!) }}.
              <button class="link" (click)="goAccount()">{{ t('Voir mes rendez-vous', 'عرض مواعيدي') }}</button></p>
          }

          @if (selectedSlot(); as s) {
            @if (auth.user(); as u) {
              @if (u.role === 'patient') {
                <div class="confirm">
                  <p><b>{{ when(s.starts_at) }}</b> · {{ slotMinutes() }} min</p>
                  <textarea name="note" maxlength="500" [(ngModel)]="note"
                            [placeholder]="t('Motif de la consultation (facultatif)', 'سبب الاستشارة (اختياري)')"></textarea>
                  <button class="btn main" [disabled]="booking()" (click)="book()">
                    {{ booking() ? t('Réservation…', 'جارٍ الحجز…') : t('Confirmer le rendez-vous', 'تأكيد الموعد') }}
                  </button>
                </div>
              } @else {
                <div class="confirm"><p>{{ t('Seuls les comptes patients peuvent réserver un rendez-vous.', 'الحجز متاح لحسابات المرضى فقط.') }}</p></div>
              }
            } @else {
              <div class="confirm">
                <p>{{ t('Connectez-vous avec un compte patient pour réserver ce créneau.', 'سجل الدخول بحساب مريض لحجز هذا الموعد.') }}</p>
                <button class="btn main" (click)="goAccount()">{{ t('Se connecter', 'تسجيل الدخول') }}</button>
              </div>
            }
          }
        }
      }
    </article>
  `,
})
export class SlotPickerComponent {
  private api = inject(AppointmentService);
  private router = inject(Router);
  readonly auth = inject(AuthService);

  readonly doctorId = input.required<number>();
  readonly lang = input<'fr' | 'ar'>('fr');
  readonly closed = output<void>();

  /** 'none' = ce médecin n'a pas (encore) d'horaires structurés. */
  readonly status = signal<'loading' | 'ok' | 'none' | 'error'>('loading');
  readonly days = signal<SlotDay[]>([]);
  readonly slotMinutes = signal(30);
  readonly selectedDate = signal<string | null>(null);
  readonly selectedSlot = signal<Slot | null>(null);
  readonly booking = signal(false);
  readonly error = signal('');
  readonly booked = signal<string | null>(null);
  note = '';

  readonly daySlots = computed(() => this.days().find((d) => d.date === this.selectedDate())?.slots ?? []);

  constructor() {
    effect(() => { this.doctorId(); untracked(() => void this.load()); });
  }

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  when(iso: string) { return formatWhen(iso, this.lang()); }
  weekday(d: SlotDay) { return this.lang() === 'fr' ? WEEKDAYS_FR[d.weekday].slice(0, 3) : WEEKDAYS_AR[d.weekday]; }
  dayNum(date: string) { return Number(date.slice(8, 10)); }
  month(date: string) {
    return new Intl.DateTimeFormat(this.lang() === 'fr' ? 'fr-FR' : 'ar-TN', { month: 'short', timeZone: 'UTC' })
      .format(new Date(date + 'T12:00:00Z'));
  }

  async load() {
    try {
      const r = await this.api.slots(this.doctorId());
      const days = r.days.filter((d) => d.slots.length > 0);
      this.slotMinutes.set(r.slot_minutes);
      this.days.set(days);
      if (days.length === 0) { this.status.set('none'); return; }

      if (!days.some((d) => d.date === this.selectedDate())) {
        this.selectedDate.set((days.find((d) => d.slots.some((s) => !s.taken)) ?? days[0]).date);
      }
      const sel = this.selectedSlot();
      if (sel && days.flatMap((d) => d.slots).find((s) => s.starts_at === sel.starts_at)?.taken !== false) {
        this.selectedSlot.set(null);   // le créneau choisi vient d'être pris
      }
      this.status.set('ok');
    } catch {
      this.status.set('error');
    }
  }

  selectDay(date: string) { this.selectedDate.set(date); this.selectedSlot.set(null); this.error.set(''); }
  selectSlot(s: Slot) { if (s.taken) return; this.selectedSlot.set(s); this.error.set(''); this.booked.set(null); }
  goAccount() { this.router.navigateByUrl('/account'); }

  async book() {
    const slot = this.selectedSlot();
    if (!slot || this.booking()) return;
    this.error.set('');
    this.booking.set(true);
    try {
      await this.api.book(this.doctorId(), slot.starts_at, this.note.trim() || undefined);
      this.booked.set(slot.starts_at);
      this.selectedSlot.set(null);
      this.note = '';
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.booking.set(false);
    }
    await this.load();   // le créneau apparaît maintenant comme pris
  }
}