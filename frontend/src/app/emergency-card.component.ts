import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { ApiError } from './auth.service';
import { EmergencyCard, HealthCardService } from './health-card.service';
import { LangService } from './lang.service';

/** Fiche d'urgence publique (lien secret / QR code) : lisible en quelques secondes par les secours. */
@Component({
  selector: 'app-emergency-card',
  standalone: true,
  styles: [`
    :host { display: block; padding: 20px 16px 48px; }
    .ec { max-width: 560px; margin: 0 auto; background:var(--surface); border: 2px solid #c62828; border-radius: 18px; overflow: hidden;
      box-shadow: 0 12px 34px #0002; color: #111; }
    .ec-head { background: #c62828; color: #fff; padding: 16px 18px; }
    .ec-head b { display: block; font: 800 24px Montserrat, sans-serif; letter-spacing: .04em; }
    .ec-head small { font-size: 12px; opacity: .9; }
    .ec-id { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px; border-bottom: 1px solid #eee; }
    .ec-id h1 { margin: 0; font: 800 26px Montserrat, sans-serif; color: #111; }
    .ec-id p { margin: 4px 0 0; font-size: 15px; color: #333; }
    .blood { flex: none; min-width: 84px; text-align: center; padding: 10px 8px; border-radius: 14px; background: #fdecea; color: #b71c1c; }
    .blood small { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; }
    .blood b { font: 800 30px Montserrat, sans-serif; }
    section { padding: 14px 18px; border-bottom: 1px solid #eee; }
    h2 { margin: 0 0 8px; font: 800 13px Montserrat, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: #555; }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 16px; }
    .sev { color: #b71c1c; font-weight: 800; }
    .none { color: #666; font-size: 15px; margin: 0; }
    .tel { display: inline-block; margin-inline-start: 6px; font-weight: 800; color: var(--ink); }
    .call { display: flex; align-items: center; justify-content: center; gap: 10px; margin: 16px 18px; padding: 14px; border-radius: 12px;
      background: #c62828; color: #fff; font: 800 18px Montserrat, sans-serif; text-decoration: none; }
    .foot { padding: 0 18px 16px; color: #666; font-size: 12px; }
    .state { max-width: 560px; margin: 40px auto; text-align: center; color: #333; }
  `],
  template: `
    @if (card(); as c) {
      <article class="ec">
        <div class="ec-head"><b>{{ t('FICHE D’URGENCE', 'بطاقة الطوارئ') }}</b><small>{{ t('Informations médicales essentielles partagées par le patient', 'معلومات طبية أساسية شاركها المريض') }}</small></div>
        <div class="ec-id">
          <div>
            <h1>{{ c.first_name }}</h1>
            <p>@if (c.age !== null) { {{ c.age }} {{ t('ans', 'سنة') }} }
              @if (c.organ_donor) { · {{ t('Donneur d’organes', 'متبرع بالأعضاء') }} }</p>
          </div>
          <div class="blood"><small>{{ t('Groupe sanguin', 'فصيلة الدم') }}</small><b>{{ c.blood_type || '?' }}</b></div>
        </div>
        <section>
          <h2>{{ t('Allergies', 'الحساسية') }}</h2>
          @if (c.allergies.length) {
            <ul>@for (a of c.allergies; track $index) {
              <li [class.sev]="a.severity === 'severe'">@if (a.severity === 'severe') { ⚠ }{{ a.substance }}@if (a.reaction) { — {{ a.reaction }} }</li> }</ul>
          } @else { <p class="none">{{ t('Aucune allergie renseignée', 'لا توجد حساسية مسجلة') }}</p> }
        </section>
        <section>
          <h2>{{ t('Maladies et antécédents', 'الأمراض والسوابق') }}</h2>
          @if (c.conditions.length) { <ul>@for (x of c.conditions; track $index) { <li>{{ x.name }}</li> }</ul> }
          @else { <p class="none">{{ t('Non renseigné', 'غير مسجل') }}</p> }
        </section>
        <section>
          <h2>{{ t('Traitements en cours', 'الأدوية الحالية') }}</h2>
          @if (c.medications.length) {
            <ul>@for (m of c.medications; track $index) { <li>{{ m.name }}@if (m.dosage) { · {{ m.dosage }} }@if (m.frequency) { · {{ m.frequency }} }</li> }</ul>
          } @else { <p class="none">{{ t('Non renseigné', 'غير مسجل') }}</p> }
        </section>
        <section>
          <h2>{{ t('Personnes à prévenir', 'أشخاص يجب إعلامهم') }}</h2>
          @if (c.emergency_contacts.length) {
            <ul>@for (p of c.emergency_contacts; track $index) {
              <li>{{ p.name }}@if (p.relation) { ({{ p.relation }}) }<a class="tel" dir="ltr" [href]="'tel:' + p.phone">☎ {{ p.phone }}</a></li> }</ul>
          } @else { <p class="none">{{ t('Aucun contact renseigné', 'لا توجد جهة اتصال') }}</p> }
        </section>
        <a class="call" href="tel:190">☎ {{ t('En cas d’urgence vitale : 190', 'في حالة طوارئ حيوية: 190') }}</a>
        @if (c.updated_at) { <p class="foot">{{ t('Informations déclarées par le patient, mises à jour le', 'معلومات صرح بها المريض، آخر تحديث') }} {{ fmt(c.updated_at) }}.</p> }
      </article>
    } @else if (status() === 'missing') {
      <div class="state">
        <h1>{{ t('Fiche introuvable ou désactivée', 'البطاقة غير موجودة أو معطلة') }}</h1>
        <p>{{ t('Ce lien n’est plus valide. En cas d’urgence vitale, appelez le 190.', 'هذا الرابط لم يعد صالحاً. في حالة طوارئ حيوية، اتصل بالرقم 190.') }}</p>
        <a class="call" href="tel:190">☎ 190</a>
      </div>
    } @else if (status() === 'error') {
      <div class="state">
        <p>{{ t('Impossible de charger la fiche pour le moment.', 'تعذر تحميل البطاقة حالياً.') }}</p>
        <button class="primary-btn" (click)="load(token())">{{ t('Réessayer', 'إعادة المحاولة') }}</button>
        <a class="call" href="tel:190">☎ 190</a>
      </div>
    } @else {
      <p class="state">{{ t('Chargement…', 'جارٍ التحميل…') }}</p>
    }
  `,
})
export class EmergencyCardComponent {
  private api = inject(HealthCardService);
  private langService = inject(LangService);
  readonly token = input.required<string>();
  readonly card = signal<EmergencyCard | null>(null);
  readonly status = signal<'loading' | 'missing' | 'error'>('loading');

  constructor() {
    effect(() => { const tk = this.token(); untracked(() => this.load(tk)); });
  }

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }

  async load(token: string) {
    this.card.set(null);
    this.status.set('loading');
    try {
      const c = await this.api.emergency(token);
      if (this.token() === token) this.card.set(c);
    } catch (e) {
      this.status.set(e instanceof ApiError && (e.status === 404 || e.status === 400) ? 'missing' : 'error');
    }
  }

  fmt(iso: string) {
    return new Date(iso).toLocaleDateString(this.langService.lang() === 'ar' ? 'ar-TN' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
