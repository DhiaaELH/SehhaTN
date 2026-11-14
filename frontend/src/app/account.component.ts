import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display: block; width: min(100%, 420px); }
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
      </div>
    } @else {
      <div class="account-card">
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
  `,
})
export class AccountComponent {
  readonly auth = inject(AuthService);
  readonly lang = input<'fr' | 'ar'>('fr');

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