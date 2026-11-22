import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError } from './auth.service';
import { AppointmentService, WEEKDAYS_AR, WEEKDAYS_FR } from './appointment.service';

interface Row { start: string; end: string; }
interface Day { weekday: number; rows: Row[]; }

@Component({
  selector: 'app-doctor-availability',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display: block; }
    .error { color: var(--coral); font-size: 11px; margin: 0 0 14px; }
    .ok { color: #0a7a55; font-size: 11px; margin: 0 0 14px; font-weight: 700; }
    select { display: block; width: 100%; height: 42px; margin-top: 7px; border: 1px solid #dce4eb;
             border-radius: 6px; padding: 0 12px; font-size: 11px; background: #fff; }
    .day { padding: 10px 0; border-top: 1px dashed #dce4eb; }
    .day-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 800; color: #17395b; }
    .range { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
    .range input[type=time] { flex: 1; min-width: 0; height: 36px; margin-top: 0; }
    .closed { color: #748395; font-size: 11px; margin: 6px 0 0; }
    .mini { border: 0; background: none; color: #078b98; font-weight: 700; font-size: 11px; cursor: pointer; padding: 4px 0; }
    .mini.danger { color: var(--coral); }
    .tools { display: flex; justify-content: space-between; margin: 4px 0 8px; }
  `],
  template: `
    <div class="account-card">
      <span class="account-brand">◷</span>
      <span class="section-kicker">{{ t('PLANNING', 'الجدول') }}</span>
      <h1>{{ t('Mes horaires de consultation', 'أوقات استشاراتي') }}</h1>
      <p>{{ t('Les patients réservent des créneaux dans ces plages. Les rendez-vous déjà pris ne sont pas modifiés.',
               'يحجز المرضى مواعيدهم ضمن هذه الفترات. المواعيد المحجوزة لا تتغير.') }}</p>

      @if (state() === 'loading') {
        <p>{{ t('Chargement…', 'جارٍ التحميل…') }}</p>
      } @else if (state() === 'noprofile') {
        <p>{{ t('Complète d’abord ta fiche médecin (formulaire ci-dessous), puis actualise.', 'أكمل ملفك أولاً (النموذج أدناه) ثم حدّث الصفحة.') }}</p>
        <button class="primary-btn" (click)="load()">{{ t('Actualiser', 'تحديث') }}</button>
      } @else if (state() === 'error') {
        <p class="error" role="alert">{{ error() }}</p>
        <button class="primary-btn" (click)="load()">{{ t('Réessayer', 'إعادة المحاولة') }}</button>
      } @else {
        <label>{{ t('Durée d’un créneau', 'مدة الموعد') }}
          <select name="slot" [(ngModel)]="slotMinutes">
            @for (m of slotChoices; track m) { <option [ngValue]="m">{{ m }} min</option> }
          </select>
        </label>
        <div class="tools">
          <button class="mini" type="button" (click)="fillTypical()">{{ t('Remplir Lun–Ven 09–12 / 14–17', 'ملء الاثنين–الجمعة 09–12 / 14–17') }}</button>
        </div>

        @for (day of week(); track day.weekday) {
          <div class="day">
            <div class="day-head">
              <span>{{ t(fr[day.weekday], ar[day.weekday]) }}</span>
              <button class="mini" type="button" (click)="addRow(day.weekday)">+ {{ t('Ajouter une plage', 'إضافة فترة') }}</button>
            </div>
            @if (day.rows.length === 0) { <p class="closed">{{ t('Fermé', 'مغلق') }}</p> }
            @for (r of day.rows; track $index) {
              <div class="range">
                <input type="time" [name]="'s' + day.weekday + '-' + $index" [(ngModel)]="r.start">
                <span>→</span>
                <input type="time" [name]="'e' + day.weekday + '-' + $index" [(ngModel)]="r.end">
                <button class="mini danger" type="button" (click)="removeRow(day.weekday, $index)" [attr.aria-label]="t('Supprimer', 'حذف')">✕</button>
              </div>
            }
          </div>
        }

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (saved()) { <p class="ok">{{ t('Horaires enregistrés ✓', 'تم حفظ الأوقات ✓') }}</p> }
        <button class="primary-btn" [disabled]="saving()" (click)="save()">
          {{ saving() ? t('Enregistrement…', 'جارٍ الحفظ…') : t('Enregistrer mes horaires', 'حفظ أوقاتي') }}
        </button>
      }
    </div>
  `,
})
export class DoctorAvailabilityComponent implements OnInit {
  private api = inject(AppointmentService);
  readonly lang = input<'fr' | 'ar'>('fr');

  readonly slotChoices = [15, 20, 30, 45, 60];
  readonly fr = WEEKDAYS_FR;
  readonly ar = WEEKDAYS_AR;

  readonly state = signal<'loading' | 'ready' | 'noprofile' | 'error'>('loading');
  readonly week = signal<Day[]>(this.emptyWeek());
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  slotMinutes = 30;

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  private emptyWeek(): Day[] { return Array.from({ length: 7 }, (_, weekday) => ({ weekday, rows: [] })); }

  ngOnInit() { this.load(); }

  async load() {
    this.state.set('loading');
    this.error.set('');
    try {
      const a = await this.api.availability();
      this.slotMinutes = a.slot_minutes;
      this.week.set(this.fromRanges(a.ranges));
      this.state.set('ready');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.state.set('noprofile');
      else { this.error.set(e instanceof Error ? e.message : 'Erreur inconnue'); this.state.set('error'); }
    }
  }

  private fromRanges(ranges: { weekday: number; start: string; end: string }[]): Day[] {
    const week = this.emptyWeek();
    for (const r of ranges) week[r.weekday].rows.push({ start: r.start, end: r.end });
    return week;
  }

  addRow(weekday: number) {
    this.week.update((w) => w.map((d) => d.weekday !== weekday ? d : {
      ...d, rows: [...d.rows, d.rows.length ? { start: '14:00', end: '17:00' } : { start: '09:00', end: '12:00' }],
    }));
  }

  removeRow(weekday: number, index: number) {
    this.week.update((w) => w.map((d) => d.weekday !== weekday ? d : { ...d, rows: d.rows.filter((_, i) => i !== index) }));
  }

  fillTypical() {
    this.week.set(this.emptyWeek().map((d) => d.weekday < 5
      ? { ...d, rows: [{ start: '09:00', end: '12:00' }, { start: '14:00', end: '17:00' }] } : d));
  }

  async save() {
    if (this.saving()) return;
    this.error.set('');
    this.saved.set(false);
    const ranges = this.week().flatMap((d) =>
      d.rows.filter((r) => r.start && r.end).map((r) => ({ weekday: d.weekday, start: r.start, end: r.end })));
    this.saving.set(true);
    try {
      const a = await this.api.saveAvailability({ slot_minutes: this.slotMinutes, ranges });
      this.week.set(this.fromRanges(a.ranges));
      this.saved.set(true);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.saving.set(false);
    }
  }
}