import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError, AuthService } from './auth.service';
import { ApiDoctor, DoctorService, GOVERNORATES, LANGUAGES, SPECIALTIES } from './doctor.service';

/** Formulaire du médecin connecté : il crée (puis modifie) sa fiche dans l'annuaire. */
@Component({
  selector: 'app-doctor-profile',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display: block; }
    .error { color: var(--coral); font-size: 11px; margin: 0 0 14px; }
    .ok { color: #0a7a55; font-size: 11px; margin: 0 0 14px; font-weight: 700; }
    select, textarea { display: block; width: 100%; margin-top: 7px; border: 1px solid #dce4eb; border-radius: 6px;
                       padding: 0 12px; font-size: 11px; background: #fff; }
    select { height: 42px; }
    textarea { height: 90px; padding: 10px 12px; resize: vertical; }
    .langs { display: flex; gap: 16px; margin-top: 8px; }
    .langs label { display: flex; align-items: center; gap: 6px; margin: 0; font-weight: 600; }
        .field { display: block; font-size: 10px; font-weight: 700; color: #455a6e; margin-bottom: 14px; }
    .langs input[type=checkbox] { appearance: none; -webkit-appearance: none; display: inline-block; flex: none;
      width: 16px; height: 16px; margin: 0; padding: 0; border: 1.5px solid #9fb3c4; border-radius: 4px;
      background: #fff; cursor: pointer; position: relative; }
    .langs input[type=checkbox]:checked { background: #00a6b8; border-color: #00a6b8; }
    .langs input[type=checkbox]:checked::after { content: ''; position: absolute; left: 4px; top: 1px;
      width: 4px; height: 8px; border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg); }
    .langs input[type=checkbox]:focus-visible { outline: 2px solid #00a6b8; outline-offset: 2px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  `],
  template: `
    <div class="account-card">
      <span class="account-brand">⚕</span>
      <span class="section-kicker">{{ t('PROFIL PROFESSIONNEL', 'الملف المهني') }}</span>
      <h1>{{ state() === 'edit' ? t('Ma fiche médecin', 'ملفي كطبيب') : t('Complétez votre profil', 'أكمل ملفك') }}</h1>
      <p>{{ state() === 'edit'
            ? t('Ces informations sont visibles dans l’annuaire des médecins.', 'هذه المعلومات ظاهرة في دليل الأطباء.')
            : t('Renseignez votre fiche pour apparaître dans l’annuaire des médecins.', 'أدخل بياناتك لتظهر في دليل الأطباء.') }}</p>

      @if (state() === 'loading') {
        <p>{{ t('Chargement…', 'جارٍ التحميل…') }}</p>
      } @else if (state() === 'error') {
        <p class="error" role="alert">{{ error() }}</p>
        <button class="primary-btn" (click)="load()">{{ t('Réessayer', 'إعادة المحاولة') }}</button>
      } @else {
        <label>{{ t('Spécialité *', 'التخصص *') }}
          <select name="specialty" [(ngModel)]="specialty">
            <option value="">—</option>
            @for (s of specialties; track s) { <option [value]="s">{{ s }}</option> }
          </select>
        </label>
        <label>{{ t('Gouvernorat *', 'الولاية *') }}
          <select name="governorate" [(ngModel)]="governorate">
            <option value="">—</option>
            @for (g of governorates; track g) { <option [value]="g">{{ g }}</option> }
          </select>
        </label>
        <label>{{ t('Ville *', 'المدينة *') }}
          <input type="text" name="city" [(ngModel)]="city">
        </label>
        <label>{{ t('Adresse du cabinet', 'عنوان العيادة') }}
          <input type="text" name="address" [(ngModel)]="address">
        </label>
        <label>{{ t('Téléphone', 'الهاتف') }}
          <input type="tel" name="phone" [(ngModel)]="phone">
        </label>
        <label>{{ t('Horaires', 'أوقات العمل') }}
          <input type="text" name="schedule" placeholder="Lun–Ven 09:00–17:00" [(ngModel)]="schedule">
        </label>
        <label>{{ t('Présentation', 'تقديم') }}
          <textarea name="bio" maxlength="500" [(ngModel)]="bio"></textarea>
        </label>
        <div class="field">{{ t('Langues parlées', 'اللغات') }}
          <div class="langs">
            @for (l of languages; track l) {
              <label><input type="checkbox" [name]="'lang-' + l" [(ngModel)]="langs[l]"> {{ l }}</label>
            }
          </div>
        </div>
        <div class="row">
          <label>{{ t('Années d’expérience', 'سنوات الخبرة') }}
            <input type="number" name="years" min="0" max="60" step="1" [(ngModel)]="years">
          </label>
          <label>{{ t('Tarif (DT)', 'السعر (د.ت)') }}
            <input type="number" name="fee" min="0" max="1000" step="1" [(ngModel)]="fee">
          </label>
        </div>
        <label>{{ t('Conventionné CNAM', 'متعاقد مع الكنام') }}
          <select name="cnam" [(ngModel)]="cnam">
            <option value="unknown">—</option>
            <option value="yes">{{ t('Oui', 'نعم') }}</option>
            <option value="no">{{ t('Non', 'لا') }}</option>
          </select>
        </label>

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
        @if (saved()) { <p class="ok">{{ t('Profil enregistré ✓ Il apparaît dans l’annuaire.', 'تم حفظ الملف ✓ يظهر الآن في الدليل.') }}</p> }

        <button class="primary-btn" [disabled]="saving()" (click)="save()">
          {{ saving() ? t('Enregistrement…', 'جارٍ الحفظ…')
                      : (state() === 'edit' ? t('Enregistrer les modifications', 'حفظ التعديلات') : t('Publier mon profil', 'نشر ملفي')) }}
        </button>
      }
    </div>
  `,
})
export class DoctorProfileComponent implements OnInit {
  private auth = inject(AuthService);
  private doctorService = inject(DoctorService);
  readonly lang = input<'fr' | 'ar'>('fr');

  readonly specialties = SPECIALTIES;
  readonly governorates = GOVERNORATES;
  readonly languages = LANGUAGES;

  readonly state = signal<'loading' | 'create' | 'edit' | 'error'>('loading');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);

  specialty = '';
  governorate = '';
  city = '';
  address = '';
  phone = '';
  schedule = '';
  bio = '';
  langs: Record<string, boolean> = { 'Français': true, 'Arabe': true, 'Anglais': false };
  years: number | null = null;
  fee: number | null = null;
  cnam: 'unknown' | 'yes' | 'no' = 'unknown';

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }

  ngOnInit() { this.load(); }

  /** Cherche la fiche existante : trouvée -> modification, absente -> création. */
  async load() {
    this.state.set('loading');
    this.error.set('');
    try {
      const d = await this.auth.request<ApiDoctor>('/doctors/me');
      this.specialty = d.specialty;
      this.governorate = d.governorate;
      this.city = d.city;
      this.address = d.address ?? '';
      this.phone = d.phone ?? '';
      this.schedule = d.schedule ?? '';
      this.bio = d.bio ?? '';
      if (d.languages?.length) {
        this.langs = Object.fromEntries(LANGUAGES.map((l) => [l, d.languages.includes(l)]));
      }
      this.years = d.years_experience;
      this.fee = d.consultation_fee;
      this.cnam = d.accepts_cnam === null ? 'unknown' : d.accepts_cnam ? 'yes' : 'no';
      this.state.set('edit');
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.state.set('create');
      else {
        this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
        this.state.set('error');
      }
    }
  }

  async save() {
    if (this.saving()) return;
    this.error.set('');
    this.saved.set(false);
    if (!this.specialty || !this.governorate || !this.city.trim()) {
      this.error.set(this.t('Spécialité, gouvernorat et ville sont obligatoires.', 'التخصص والولاية والمدينة إلزامية.'));
      return;
    }

    const editing = this.state() === 'edit';
    const body: Record<string, unknown> = {
      specialty: this.specialty,
      governorate: this.governorate,
      city: this.city.trim(),
    };
    const texts: Record<string, string> = {
      address: this.address, phone: this.phone, schedule: this.schedule, bio: this.bio,
    };
    for (const [key, value] of Object.entries(texts)) {
      if (editing || value.trim()) body[key] = value.trim();
    }
    const chosen = LANGUAGES.filter((l) => this.langs[l]);
    if (chosen.length) body['languages'] = chosen;
    if (this.years !== null && this.years !== undefined) body['years_experience'] = Math.round(Number(this.years));
    if (this.fee !== null && this.fee !== undefined) body['consultation_fee'] = Math.round(Number(this.fee));
    if (this.cnam !== 'unknown') body['accepts_cnam'] = this.cnam === 'yes';

    this.saving.set(true);
    try {
      await this.auth.request<ApiDoctor>('/doctors/me', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
      this.state.set('edit');
      this.saved.set(true);
      this.doctorService.load(); // l'annuaire se met à jour
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.saving.set(false);
    }
  }
}
