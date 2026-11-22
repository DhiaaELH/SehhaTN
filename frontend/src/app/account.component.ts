import { DoctorAvailabilityComponent } from './doctor-availability.component';
import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';
import { DoctorProfileComponent } from './doctor-profile.component';
import { MyAppointmentsComponent } from './my-appointments.component';
import { HealthCardComponent } from './health-card.component';
import { HealthCardService } from './health-card.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule, DoctorProfileComponent, DoctorAvailabilityComponent, MyAppointmentsComponent, HealthCardComponent],
  styles: [`
    :host { display: flex; flex-direction: column; gap: 20px; width: min(100%, 760px); }
    /* Les cartes de l'espace connecté (et celles des composants enfants) occupent toute la colonne. */
    :host ::ng-deep .account-card { width: 100%; }
    .narrow { width: min(100%, 420px); align-self: center; }
    .data-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .data-actions button { flex: 1 1 160px; }
    .danger-btn { border: 1px solid var(--coral); background: #fff; color: var(--coral); border-radius: 8px; padding: 10px 12px; font-weight: 700; font-size: 12px; }
    .ok { color: #0a7a55; font-size: 12px; font-weight: 700; margin: 0 0 12px; }
    .dlg-back { position: fixed; inset: 0; z-index: 50; background: #001d3e99; display: grid; place-items: center; padding: 16px; }
    .dlg { width: min(100%, 420px); background: #fff; border-radius: 16px; padding: 22px; box-shadow: 0 20px 50px #0004; }
    .dlg h2 { margin: 0 0 8px; font: 800 18px Montserrat, sans-serif; color: var(--coral); }
    .dlg p { font-size: 13px; color: var(--ink); line-height: 1.6; margin: 0 0 12px; }
    .dlg input { display: block; width: 100%; height: 40px; margin: 6px 0 12px; border: 1px solid #dce4eb; border-radius: 8px; padding: 0 10px; }
    .dlg-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .dlg-actions button { flex: 1 1 140px; }
    .error { color: var(--coral); font-size: 11px; margin: 0 0 14px; }
    select { display: block; width: 100%; height: 42px; margin-top: 7px; border: 1px solid #dce4eb;
             border-radius: 6px; padding: 0 12px; font-size: 11px; background: #fff; }
    .hint { color: #748395; font-size: 10px; margin: 10px 0 0; text-align: center; }
  `],
  template: `
    @if (auth.user(); as u) {
      <div class="account-card">
        <span class="account-brand">✚</span>
        <span class="section-kicker">{{ t('VOTRE ESPACE SEHHATN', 'مساحتك في SehhaTN') }}</span>
        <h1>{{ t('Bonjour', 'مرحباً') }} {{ u.name }}</h1>
        <p>{{ u.email }} · {{ roleLabel(u.role) }}</p>
        <button class="primary-btn" (click)="auth.logout()">{{ t('Se déconnecter', 'تسجيل الخروج') }}</button>
        @if (dataError()) { <p class="error" role="alert" style="margin-top:12px">{{ dataError() }}</p> }
        <div class="data-actions">
          <button class="outline-btn" [disabled]="exporting()" (click)="exportData()">{{ exporting() ? t('Préparation…', 'جارٍ التحضير…') : t('Télécharger mes données', 'تنزيل بياناتي') }}</button>
          <button class="danger-btn" (click)="openDelete()">{{ t('Supprimer mon compte', 'حذف حسابي') }}</button>
        </div>
      </div>
      @if (u.role !== 'admin') { <app-my-appointments [lang]="lang()" /> }
      @if (u.role === 'patient' || u.role === 'doctor') { <app-health-card [lang]="lang()" /> }
@if (u.role === 'doctor') {
  <app-doctor-availability [lang]="lang()" />
  <app-doctor-profile [lang]="lang()" />
}
    } @else {
      @if (deletedMessage()) { <p class="ok narrow" role="status">{{ deletedMessage() }}</p> }
      <div class="account-card narrow">
        <span class="account-brand">✚</span>
        <span class="section-kicker">{{ t('VOTRE ESPACE SEHHATN', 'مساحتك في SehhaTN') }}</span>
        <h1>{{ mode() === 'login' ? t('Ravi de vous revoir.', 'سعداء بعودتك.') : t('Créer votre compte', 'إنشاء حسابك') }}</h1>
        <p>{{ mode() === 'login'
              ? t('Connectez-vous pour retrouver vos médecins favoris et partager votre expérience.', 'سجل الدخول للاحتفاظ بأطبائك المفضلين ومشاركة تجربتك.')
              : t('Inscrivez-vous gratuitement en quelques secondes.', 'سجل مجاناً في ثوانٍ.') }}</p>

        @if (mode() === 'register') {
          <label>{{ t('Nom complet', 'الاسم الكامل') }}
            <input type="text" name="name" autocomplete="name" [(ngModel)]="name">
          </label>
        }
        <label>{{ t('Adresse e-mail', 'البريد الإلكتروني') }}
          <input type="email" name="email" autocomplete="email" placeholder="vous@exemple.com" [(ngModel)]="email">
        </label>
        <label>{{ t('Mot de passe', 'كلمة المرور') }}
          <input type="password" name="password" placeholder="••••••••"
                 [attr.autocomplete]="mode() === 'login' ? 'current-password' : 'new-password'"
                 [(ngModel)]="password" (keyup.enter)="submit()">
        </label>
        @if (mode() === 'register') {
          <label>{{ t('Je suis', 'أنا') }}
            <select name="role" [(ngModel)]="role">
              <option value="patient">{{ t('Patient', 'مريض') }}</option>
              <option value="doctor">{{ t('Médecin', 'طبيب') }}</option>
            </select>
          </label>
        }

        @if (error()) { <p class="error" role="alert">{{ error() }}</p> }

        <button class="primary-btn" [disabled]="loading()" (click)="submit()">
          {{ loading() ? t('Veuillez patienter…', 'يرجى الانتظار…')
                       : (mode() === 'login' ? t('Se connecter', 'تسجيل الدخول') : t('Créer mon compte', 'إنشاء الحساب')) }} →
        </button>
        @if (loading()) {
          <p class="hint">{{ t('Le premier chargement peut prendre jusqu’à une minute.', 'قد يستغرق التحميل الأول حتى دقيقة.') }}</p>
        }

        <div class="account-or">
          @if (mode() === 'login') {
            {{ t('Pas encore de compte ?', 'ليس لديك حساب؟') }}
            <button (click)="switchMode('register')">{{ t('Créer un compte', 'إنشاء حساب') }}</button>
          } @else {
            {{ t('Déjà un compte ?', 'لديك حساب بالفعل؟') }}
            <button (click)="switchMode('login')">{{ t('Se connecter', 'تسجيل الدخول') }}</button>
          }
        </div>
      </div>
    }

    @if (deleteOpen()) {
      <div class="dlg-back" (click)="closeDelete()">
        <div class="dlg" role="dialog" aria-modal="true" [attr.aria-label]="t('Supprimer mon compte', 'حذف حسابي')" (click)="$event.stopPropagation()">
          <h2>{{ t('Supprimer mon compte', 'حذف حسابي') }}</h2>
          <p>{{ t('Cette action est définitive : votre compte, vos rendez-vous, vos avis, votre carte santé et, pour un médecin, votre fiche de l’annuaire seront effacés. Pensez à télécharger vos données avant.',
            'هذا الإجراء نهائي: سيتم حذف حسابك ومواعيدك وآرائك وبطاقتك الصحية، وملفك في الدليل إذا كنت طبيباً. ننصحك بتنزيل بياناتك قبل ذلك.') }}</p>
          <label>{{ t('Mot de passe', 'كلمة المرور') }}
            <input type="password" name="delpwd" autocomplete="current-password" [(ngModel)]="deletePassword">
          </label>
          <label>{{ t('Tapez SUPPRIMER pour confirmer', 'اكتب SUPPRIMER للتأكيد') }}
            <input type="text" name="delconfirm" autocomplete="off" [(ngModel)]="deleteConfirm">
          </label>
          @if (deleteError()) { <p class="error" role="alert">{{ deleteError() }}</p> }
          <div class="dlg-actions">
            <button class="danger-btn" [disabled]="deleting() || deleteConfirm.trim().toUpperCase() !== 'SUPPRIMER' || !deletePassword" (click)="confirmDelete()">
              {{ deleting() ? t('Suppression…', 'جارٍ الحذف…') : t('Supprimer définitivement', 'حذف نهائي') }}</button>
            <button class="outline-btn" (click)="closeDelete()">{{ t('Annuler', 'إلغاء') }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  private healthCards = inject(HealthCardService);
  readonly lang = input<'fr' | 'ar'>('fr');

  readonly exporting = signal(false);
  readonly dataError = signal('');
  readonly deleteOpen = signal(false);
  readonly deleting = signal(false);
  readonly deleteError = signal('');
  readonly deletedMessage = signal('');
  deletePassword = '';
  deleteConfirm = '';

  readonly mode = signal<'login' | 'register'>('login');
  readonly error = signal('');
  readonly loading = signal(false);

  name = '';
  email = '';
  password = '';
  role: 'patient' | 'doctor' = 'patient';

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }

  roleLabel(role: string) {
    if (role === 'doctor') return this.t('Médecin', 'طبيب');
    if (role === 'admin') return this.t('Administrateur', 'مدير');
    return this.t('Patient', 'مريض');
  }

  async exportData() {
    this.dataError.set('');
    this.exporting.set(true);
    try { await this.healthCards.exportData(); } catch (e) {
      this.dataError.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally { this.exporting.set(false); }
  }

  openDelete() {
    this.deletePassword = '';
    this.deleteConfirm = '';
    this.deleteError.set('');
    this.deleteOpen.set(true);
  }
  closeDelete() { if (!this.deleting()) this.deleteOpen.set(false); }

  async confirmDelete() {
    if (this.deleting()) return;
    this.deleteError.set('');
    this.deleting.set(true);
    try {
      await this.healthCards.deleteAccount(this.deletePassword);
      this.deletePassword = '';
      this.deleteOpen.set(false);
      this.auth.logout();
      this.deletedMessage.set(this.t('Votre compte et vos données ont été supprimés.', 'تم حذف حسابك وبياناتك.'));
    } catch (e) {
      this.deleteError.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.deleting.set(false);
    }
  }

  switchMode(mode: 'login' | 'register') {
    this.mode.set(mode);
    this.error.set('');
  }

  async submit() {
    if (this.loading()) return;
    this.error.set('');
    if (!this.email.trim() || !this.password) {
      this.error.set(this.t('Remplis ton e-mail et ton mot de passe.', 'أدخل بريدك وكلمة المرور.'));
      return;
    }
    this.loading.set(true);
    try {
      if (this.mode() === 'register') {
        await this.auth.register(this.name.trim(), this.email.trim(), this.password, this.role);
      } else {
        await this.auth.login(this.email.trim(), this.password);
      }
      this.password = '';
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.loading.set(false);
    }
  }
}