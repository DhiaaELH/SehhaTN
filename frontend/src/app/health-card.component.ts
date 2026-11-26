import { Component, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AuthService } from './auth.service';
import {
  AccessLogEntry, BLOOD_TYPES, HealthCard, HealthCardService, ageFrom, emptyCard,
} from './health-card.service';

const LIMITS = { allergies: 30, conditions: 30, medications: 30, vaccinations: 50, emergency_contacts: 5 } as const;
type ListKey = keyof typeof LIMITS;

/** Carte santé du patient : résumé type « carte d'identité médicale », édition, partage et fiche d'urgence. */
@Component({
  selector: 'app-health-card',
  standalone: true,
  imports: [FormsModule],
  styles: [`
    :host { display: block; }
    .error { color: var(--coral); font-size: 12px; margin: 0 0 12px; }
    .ok { color: #0a7a55; font-size: 12px; font-weight: 700; margin: 0 0 12px; }
    .muted { color: var(--muted); font-size: 12px; line-height: 1.6; margin: 0; }
    .id { position: relative; overflow: hidden; border-radius: 18px; padding: 20px; color: #fff; margin: 14px 0 18px;
      background:radial-gradient(420px 180px at 100% 0, #00a6b855, transparent 70%), linear-gradient(135deg, var(--deep-bg), var(--navy-bg)); }
    .id-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
    .id small { display: block; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: #9ee9e0; }
    .id h2 { margin: 4px 0 2px; font: 800 20px Montserrat, sans-serif; color: #fff; }
    .id p { margin: 0; color: #d6e4f2; font-size: 12px; }
    .blood { flex: none; display: grid; place-items: center; width: 64px; height: 64px; border-radius: 16px; background:var(--surface);
      color: var(--coral); font: 800 22px Montserrat, sans-serif; box-shadow: 0 8px 20px #0003; }
    .blood.none { color: var(--muted); font-size: 12px; }
    .id-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 16px; }
    .id-grid div { background: #ffffff14; border-radius: 10px; padding: 8px 10px; font-size: 12px; }
    .sec { margin: 0 0 16px; }
    .sec h3 { margin: 0 0 8px; font: 800 12px Montserrat, sans-serif; letter-spacing: .05em; text-transform: uppercase; color: var(--text2); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { padding: 5px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--pale); color: var(--navy); }
    .chip[data-s='severe'] { background: #fdeaea; color: var(--coral); }
    .chip[data-s='moderate'] { background: #fff3dc; color: #8a5a00; }
    .chip[data-s='mild'] { background:var(--surface2); color: var(--text2); }
    ul.plain { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; font-size: 13px; color: var(--ink); }
    ul.plain small { color: var(--muted); }
    .row-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 8px; }
    .row-actions > * { flex: 1 1 160px; }
    fieldset { border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin: 0 0 14px; min-width: 0; }
    legend { padding: 0 6px; font-weight: 800; font-size: 12px; color: var(--deep); }
    .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    label.f { display: block; font-size: 11px; font-weight: 700; color: var(--text2); }
    .f input, .f select, .f textarea, .item input, .item select { display: block; width: 100%; margin-top: 5px; height: 38px;
      border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; font-size: 13px; background:var(--surface); color: var(--ink); }
    .f textarea { height: 72px; padding: 8px 10px; resize: vertical; }
    .item { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)) 36px; gap: 6px; align-items: end; margin-bottom: 8px; }
    .item input, .item select { margin-top: 0; }
    .x { height: 38px; border: 1px solid var(--line); border-radius: 8px; background:var(--surface); color: var(--coral); font-weight: 800; }
    .add { border: 1px dashed var(--teal); background: none; color: var(--text2); border-radius: 8px; padding: 7px 12px; font-weight: 700; font-size: 12px; }
    .add:disabled { opacity: .5; }
    .switch { display: flex; gap: 10px; align-items: flex-start; font-size: 13px; color: var(--ink); cursor: pointer; }
    .switch input { width: 18px; height: 18px; margin-top: 2px; accent-color: var(--teal); flex: none; }
    .panel { border-top: 1px dashed var(--line); padding-top: 16px; margin-top: 18px; }
    .link { display: flex; gap: 8px; margin: 10px 0; }
    .link input { flex: 1; min-width: 0; height: 38px; border: 1px solid var(--line); border-radius: 8px; padding: 0 10px; font-size: 12px; direction: ltr; }
    .qr { width: 168px; padding: 8px; background:var(--surface); border: 1px solid var(--line); border-radius: 12px; }
    .qr :is(svg) { display: block; width: 100%; height: auto; }
    .print-only { display: none; }
    .log { list-style: none; padding: 0; margin: 8px 0 0; font-size: 12px; color: var(--ink); display: grid; gap: 6px; }
    .log time { color: var(--muted); margin-inline-start: 6px; }
    .empty { text-align: center; padding: 10px 0; }
    .empty .big { font-size: 36px; color: var(--teal); }
    @media print {
      ::ng-deep body.hc-printing * { visibility: hidden !important; }
      ::ng-deep body.hc-printing .hc-print, ::ng-deep body.hc-printing .hc-print * { visibility: visible !important; }
      ::ng-deep body.hc-printing .hc-print { position: fixed; inset: 0 auto auto 0; padding: 24px; }
      .print-only { display: block; }
    }
  `],
  template: `
    <div class="account-card">
      <span class="account-brand">♡</span>
      <span class="section-kicker">{{ t('CARTE SANTÉ', 'البطاقة الصحية') }}</span>
      <h1>{{ t('Ma carte santé', 'بطاقتي الصحية') }}</h1>

      @if (loading()) {
        <p class="muted">{{ t('Chargement…', 'جارٍ التحميل…') }}</p>
      } @else if (loadError()) {
        <p class="error" role="alert">{{ loadError() }}</p>
        <button class="primary-btn" (click)="load()">{{ t('Réessayer', 'إعادة المحاولة') }}</button>
      } @else if (mode() === 'edit') {
        <form (submit)="$event.preventDefault(); save()">
          <fieldset>
            <legend>{{ t('Informations générales', 'معلومات عامة') }}</legend>
            <div class="grid2">
              <label class="f">{{ t('Date de naissance', 'تاريخ الميلاد') }}<input type="date" name="dob" [(ngModel)]="draft.date_of_birth" [max]="today"></label>
              <label class="f">{{ t('Sexe', 'الجنس') }}
                <select name="sex" [(ngModel)]="draft.sex"><option [ngValue]="null">—</option><option value="f">{{ t('Femme', 'أنثى') }}</option><option value="m">{{ t('Homme', 'ذكر') }}</option></select></label>
              <label class="f">{{ t('Groupe sanguin', 'فصيلة الدم') }}
                <select name="blood" [(ngModel)]="draft.blood_type"><option [ngValue]="null">{{ t('Inconnu', 'غير معروف') }}</option>
                  @for (b of bloodTypes; track b) { <option [value]="b">{{ b }}</option> }</select></label>
              <label class="f">{{ t('Taille (cm)', 'الطول (سم)') }}<input type="number" name="h" min="30" max="250" [(ngModel)]="draft.height_cm"></label>
              <label class="f">{{ t('Poids (kg)', 'الوزن (كغ)') }}<input type="number" name="w" min="1" max="400" step="0.1" [(ngModel)]="draft.weight_kg"></label>
              <label class="f">{{ t('Donneur d’organes', 'متبرع بالأعضاء') }}
                <select name="donor" [(ngModel)]="draft.organ_donor"><option [ngValue]="null">—</option><option [ngValue]="true">{{ t('Oui', 'نعم') }}</option><option [ngValue]="false">{{ t('Non', 'لا') }}</option></select></label>
              <label class="f">{{ t('Fumeur', 'مدخن') }}
                <select name="smoker" [(ngModel)]="draft.smoker"><option [ngValue]="null">—</option><option [ngValue]="true">{{ t('Oui', 'نعم') }}</option><option [ngValue]="false">{{ t('Non', 'لا') }}</option></select></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>{{ t('Couverture sociale', 'التغطية الاجتماعية') }}</legend>
            <div class="grid2">
              <label class="f">{{ t('Filière CNAM', 'منظومة الكنام') }}
                <select name="track" [(ngModel)]="draft.cnam_track"><option [ngValue]="null">—</option>
                  <option value="public">{{ trackLabel('public') }}</option><option value="private">{{ trackLabel('private') }}</option>
                  <option value="reimbursement">{{ trackLabel('reimbursement') }}</option></select></label>
              <label class="f">{{ t('N° d’assuré CNAM', 'رقم المنخرط') }}<input name="cnam" maxlength="30" autocomplete="off" [(ngModel)]="draft.cnam_number"></label>
              <label class="f">{{ t('Mutuelle / assurance', 'التأمين التكميلي') }}<input name="ins" maxlength="100" [(ngModel)]="draft.insurer"></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>{{ t('Allergies', 'الحساسية') }}</legend>
            @for (a of draft.allergies; track $index) {
              <div class="item">
                <input [name]="'as' + $index" maxlength="100" [placeholder]="t('Substance (ex. pénicilline)', 'المادة (مثال: البنسلين)')" [(ngModel)]="a.substance">
                <input [name]="'ar' + $index" maxlength="200" [placeholder]="t('Réaction', 'رد الفعل')" [(ngModel)]="a.reaction">
                <select [name]="'av' + $index" [(ngModel)]="a.severity"><option [ngValue]="null">{{ t('Gravité', 'الخطورة') }}</option>
                  <option value="mild">{{ sevLabel('mild') }}</option><option value="moderate">{{ sevLabel('moderate') }}</option><option value="severe">{{ sevLabel('severe') }}</option></select>
                <button type="button" class="x" (click)="remove('allergies', $index)" [attr.aria-label]="t('Supprimer', 'حذف')">×</button>
              </div>
            }
            <button type="button" class="add" [disabled]="full('allergies')" (click)="add('allergies')">+ {{ t('Ajouter une allergie', 'إضافة حساسية') }}</button>
          </fieldset>

          <fieldset>
            <legend>{{ t('Maladies chroniques et antécédents', 'الأمراض المزمنة والسوابق') }}</legend>
            @for (c of draft.conditions; track $index) {
              <div class="item">
                <input [name]="'cn' + $index" maxlength="120" [placeholder]="t('Ex. diabète de type 2', 'مثال: السكري من النوع 2')" [(ngModel)]="c.name">
                <input [name]="'cy' + $index" type="number" min="1900" [max]="year" [placeholder]="t('Année', 'السنة')" [(ngModel)]="c.diagnosed_year">
                <input [name]="'cx' + $index" maxlength="300" [placeholder]="t('Remarque', 'ملاحظة')" [(ngModel)]="c.notes">
                <button type="button" class="x" (click)="remove('conditions', $index)" [attr.aria-label]="t('Supprimer', 'حذف')">×</button>
              </div>
            }
            <button type="button" class="add" [disabled]="full('conditions')" (click)="add('conditions')">+ {{ t('Ajouter', 'إضافة') }}</button>
          </fieldset>

          <fieldset>
            <legend>{{ t('Traitements en cours', 'الأدوية الحالية') }}</legend>
            @for (m of draft.medications; track $index) {
              <div class="item">
                <input [name]="'mn' + $index" maxlength="120" [placeholder]="t('Médicament', 'الدواء')" [(ngModel)]="m.name">
                <input [name]="'md' + $index" maxlength="60" [placeholder]="t('Dosage', 'الجرعة')" [(ngModel)]="m.dosage">
                <input [name]="'mf' + $index" maxlength="60" [placeholder]="t('Fréquence', 'التكرار')" [(ngModel)]="m.frequency">
                <button type="button" class="x" (click)="remove('medications', $index)" [attr.aria-label]="t('Supprimer', 'حذف')">×</button>
              </div>
            }
            <button type="button" class="add" [disabled]="full('medications')" (click)="add('medications')">+ {{ t('Ajouter un traitement', 'إضافة دواء') }}</button>
          </fieldset>

          <fieldset>
            <legend>{{ t('Vaccinations', 'التلاقيح') }}</legend>
            @for (v of draft.vaccinations; track $index) {
              <div class="item">
                <input [name]="'vn' + $index" maxlength="120" [placeholder]="t('Vaccin', 'اللقاح')" [(ngModel)]="v.vaccine">
                <input [name]="'vd' + $index" type="date" [max]="today" [(ngModel)]="v.dose_date">
                <input [name]="'vx' + $index" maxlength="200" [placeholder]="t('Remarque', 'ملاحظة')" [(ngModel)]="v.notes">
                <button type="button" class="x" (click)="remove('vaccinations', $index)" [attr.aria-label]="t('Supprimer', 'حذف')">×</button>
              </div>
            }
            <button type="button" class="add" [disabled]="full('vaccinations')" (click)="add('vaccinations')">+ {{ t('Ajouter un vaccin', 'إضافة لقاح') }}</button>
          </fieldset>

          <fieldset>
            <legend>{{ t('Contacts d’urgence', 'جهات الاتصال للطوارئ') }}</legend>
            @for (p of draft.emergency_contacts; track $index) {
              <div class="item">
                <input [name]="'pn' + $index" maxlength="100" [placeholder]="t('Nom', 'الاسم')" [(ngModel)]="p.name">
                <input [name]="'pr' + $index" maxlength="50" [placeholder]="t('Lien (ex. sœur)', 'الصلة (مثال: أخت)')" [(ngModel)]="p.relation">
                <input [name]="'pp' + $index" type="tel" maxlength="30" dir="ltr" placeholder="+216 …" [(ngModel)]="p.phone">
                <button type="button" class="x" (click)="remove('emergency_contacts', $index)" [attr.aria-label]="t('Supprimer', 'حذف')">×</button>
              </div>
            }
            <button type="button" class="add" [disabled]="full('emergency_contacts')" (click)="add('emergency_contacts')">+ {{ t('Ajouter un contact', 'إضافة جهة اتصال') }}</button>
          </fieldset>

          <label class="f">{{ t('Notes utiles aux soignants', 'ملاحظات مفيدة للأطباء') }}<textarea name="notes" maxlength="1000" [(ngModel)]="draft.notes"></textarea></label>
          <label class="switch" style="margin-top:14px">
            <input type="checkbox" name="share" [(ngModel)]="draft.share_with_doctors">
            <span>{{ t('Partager ma carte avec les médecins chez qui j’ai un rendez-vous', 'مشاركة بطاقتي مع الأطباء الذين لدي موعد معهم') }}</span>
          </label>

          @if (error()) { <p class="error" role="alert" style="margin-top:12px">{{ error() }}</p> }
          <div class="row-actions">
            <button class="primary-btn" type="submit" [disabled]="saving()">{{ saving() ? t('Enregistrement…', 'جارٍ الحفظ…') : t('Enregistrer', 'حفظ') }}</button>
            <button class="outline-btn" type="button" (click)="cancel()">{{ t('Annuler', 'إلغاء') }}</button>
          </div>
        </form>
      } @else if (isEmpty()) {
        <div class="empty">
          <div class="big" aria-hidden="true">✚</div>
          <p class="muted">{{ t('Votre carte santé réunit les informations essentielles en cas de besoin : groupe sanguin, allergies, traitements, maladies chroniques et personnes à prévenir. Vous décidez avec qui la partager.',
            'تجمع بطاقتك الصحية المعلومات الأساسية عند الحاجة: فصيلة الدم والحساسية والأدوية والأمراض المزمنة والأشخاص الذين يجب إعلامهم. أنت من يقرر مع من تشاركها.') }}</p>
          <button class="primary-btn" style="margin-top:14px" (click)="edit()">{{ t('Remplir ma carte', 'املأ بطاقتي') }}</button>
        </div>
      } @else {
        @if (saved()) { <p class="ok" role="status">{{ t('Carte enregistrée.', 'تم حفظ البطاقة.') }}</p> }
        @let c = card();
        <div class="id">
          <div class="id-top">
            <div>
              <small>{{ t('Carte santé SehhaTN', 'البطاقة الصحية SehhaTN') }}</small>
              <h2>{{ auth.user()?.name }}</h2>
              <p>
                @if (age() !== null) { {{ age() }} {{ t('ans', 'سنة') }} }
                @if (c.sex) { · {{ c.sex === 'f' ? t('Femme', 'أنثى') : t('Homme', 'ذكر') }} }
                @if (c.height_cm) { · {{ c.height_cm }} cm }
                @if (c.weight_kg) { · {{ c.weight_kg }} kg }
              </p>
            </div>
            <div class="blood" [class.none]="!c.blood_type" [attr.aria-label]="t('Groupe sanguin', 'فصيلة الدم')">{{ c.blood_type || t('Groupe ?', 'الفصيلة؟') }}</div>
          </div>
          <div class="id-grid">
            <div><small>CNAM</small>{{ c.cnam_track ? trackLabel(c.cnam_track) : '—' }}@if (c.cnam_number) { <br><span dir="ltr">{{ masked(c.cnam_number) }}</span> }</div>
            <div><small>{{ t('Donneur d’organes', 'متبرع بالأعضاء') }}</small>{{ yesNo(c.organ_donor) }}</div>
            @if (c.insurer) { <div><small>{{ t('Mutuelle', 'التأمين') }}</small>{{ c.insurer }}</div> }
          </div>
        </div>

        <div class="sec"><h3>{{ t('Allergies', 'الحساسية') }}</h3>
          @if (c.allergies.length) {
            <div class="chips">@for (a of c.allergies; track $index) {
              <span class="chip" [attr.data-s]="a.severity">{{ a.substance }}@if (a.severity) { · {{ sevLabel(a.severity) }} }</span> }</div>
          } @else { <p class="muted">{{ t('Aucune allergie connue renseignée.', 'لا توجد حساسية مسجلة.') }}</p> }
        </div>
        @if (c.conditions.length) {
          <div class="sec"><h3>{{ t('Maladies chroniques', 'الأمراض المزمنة') }}</h3>
            <ul class="plain">@for (x of c.conditions; track $index) { <li>{{ x.name }}@if (x.diagnosed_year) { <small> · {{ x.diagnosed_year }}</small> }</li> }</ul></div>
        }
        @if (c.medications.length) {
          <div class="sec"><h3>{{ t('Traitements', 'الأدوية') }}</h3>
            <ul class="plain">@for (m of c.medications; track $index) { <li>{{ m.name }} <small>{{ [m.dosage, m.frequency].filter(ok).join(' · ') }}</small></li> }</ul></div>
        }
        @if (c.vaccinations.length) {
          <div class="sec"><h3>{{ t('Vaccinations', 'التلاقيح') }}</h3>
            <ul class="plain">@for (v of c.vaccinations; track $index) { <li>{{ v.vaccine }}@if (v.dose_date) { <small> · {{ fmtDate(v.dose_date) }}</small> }</li> }</ul></div>
        }
        @if (c.emergency_contacts.length) {
          <div class="sec"><h3>{{ t('Personnes à prévenir', 'أشخاص يجب إعلامهم') }}</h3>
            <ul class="plain">@for (p of c.emergency_contacts; track $index) { <li>{{ p.name }}@if (p.relation) { <small> ({{ p.relation }})</small> } · <a [href]="'tel:' + p.phone" dir="ltr">{{ p.phone }}</a></li> }</ul></div>
        }
        @if (c.updated_at) { <p class="muted">{{ t('Mise à jour le', 'آخر تحديث') }} {{ fmtDate(c.updated_at) }}</p> }
        <div class="row-actions"><button class="primary-btn" (click)="edit()">{{ t('Modifier', 'تعديل') }}</button></div>

        <div class="panel">
          <h3 class="sec" style="margin-bottom:6px">{{ t('Partage avec les médecins', 'المشاركة مع الأطباء') }}</h3>
          <label class="switch">
            <input type="checkbox" [checked]="c.share_with_doctors" [disabled]="saving()" (change)="toggleShare($any($event.target).checked)">
            <span>{{ t('Les médecins chez qui j’ai un rendez-vous peuvent consulter ma carte.', 'يمكن للأطباء الذين لدي موعد معهم الاطلاع على بطاقتي.') }}</span>
          </label>
          @if (error()) { <p class="error" role="alert" style="margin-top:8px">{{ error() }}</p> }
        </div>
      }

      @if (!loading() && !loadError() && mode() === 'view') {
        <div class="panel">
          <h3 class="sec" style="margin-bottom:6px">{{ t('Fiche d’urgence', 'بطاقة الطوارئ') }}</h3>
          <p class="muted">{{ t('Un lien secret (et son QR code) donne accès à une fiche réduite pour les secours : prénom, âge, groupe sanguin, allergies, maladies, traitements et contacts d’urgence. Rien d’autre. Vous pouvez la désactiver ou changer de lien à tout moment.',
            'رابط سري (ورمز QR) يتيح للمسعفين الاطلاع على بطاقة مختصرة: الاسم الأول والعمر وفصيلة الدم والحساسية والأمراض والأدوية وجهات الاتصال. لا شيء غير ذلك. يمكنك تعطيلها أو تغيير الرابط في أي وقت.') }}</p>
          @if (emergencyUrl(); as url) {
            <div class="link">
              <input [value]="url" readonly [attr.aria-label]="t('Lien de la fiche d’urgence', 'رابط بطاقة الطوارئ')" (focus)="$any($event.target).select()">
              <button class="outline-btn" type="button" (click)="copy(url)">{{ copied() ? t('Copié ✓', 'تم النسخ ✓') : t('Copier', 'نسخ') }}</button>
            </div>
            <div class="hc-print">
              <p class="print-only"><b>{{ t('FICHE D’URGENCE', 'بطاقة الطوارئ') }} — {{ auth.user()?.name }}</b><br>{{ t('Scannez pour voir les informations médicales essentielles. Urgence vitale : 190', 'امسح الرمز للاطلاع على المعلومات الطبية الأساسية. حالة طارئة: 190') }}</p>
              @if (qrSvg()) { <div class="qr" [innerHTML]="qrSvg()"></div> }
            </div>
            <div class="row-actions">
              <button class="outline-btn" type="button" (click)="print()">{{ t('Imprimer', 'طباعة') }}</button>
              <button class="outline-btn" type="button" [disabled]="busy()" (click)="enableEmergency(true)">{{ t('Générer un nouveau lien', 'إنشاء رابط جديد') }}</button>
              <button class="outline-btn" type="button" [disabled]="busy()" (click)="disableEmergency()">{{ t('Désactiver', 'تعطيل') }}</button>
            </div>
          } @else {
            <div class="row-actions"><button class="primary-btn" type="button" [disabled]="busy()" (click)="enableEmergency(false)">{{ t('Activer la fiche d’urgence', 'تفعيل بطاقة الطوارئ') }}</button></div>
          }
          @if (emergencyError()) { <p class="error" role="alert" style="margin-top:8px">{{ emergencyError() }}</p> }
        </div>

        <div class="panel">
          <h3 class="sec" style="margin-bottom:6px">{{ t('Historique des accès', 'سجل الاطلاع') }}</h3>
          @if (log().length) {
            <ul class="log">@for (l of log(); track $index) {
              <li>{{ logLabel(l) }}<time>{{ fmtDateTime(l.created_at) }}</time></li> }</ul>
          } @else { <p class="muted">{{ t('Personne n’a encore consulté votre carte.', 'لم يطلع أحد على بطاقتك بعد.') }}</p> }
        </div>
      }
    </div>
  `,
})
export class HealthCardComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private api = inject(HealthCardService);
  private sanitizer = inject(DomSanitizer);
  readonly lang = input<'fr' | 'ar'>('fr');

  readonly bloodTypes = BLOOD_TYPES;
  readonly today = new Date().toISOString().slice(0, 10);
  readonly year = new Date().getFullYear();

  readonly card = signal<HealthCard>(emptyCard());
  readonly log = signal<AccessLogEntry[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly mode = signal<'view' | 'edit'>('view');
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly emergencyError = signal('');
  readonly copied = signal(false);
  readonly qrSvg = signal<SafeHtml | null>(null);
  draft: HealthCard = emptyCard();
  private qrFor = '';

  readonly age = computed(() => ageFrom(this.card().date_of_birth));
  readonly isEmpty = computed(() => {
    const c = this.card();
    return !c.updated_at && !c.blood_type && !c.date_of_birth && !c.allergies.length && !c.conditions.length
      && !c.medications.length && !c.emergency_contacts.length;
  });
  readonly emergencyUrl = computed(() => {
    const c = this.card();
    if (!c.emergency_access_enabled || !c.emergency_token) return '';
    return new URL('urgence/' + c.emergency_token, document.baseURI).href;
  });

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  ok = (x: unknown) => !!x;

  ngOnInit() { this.load(); }
  ngOnDestroy() { document.body.classList.remove('hc-printing'); }

  async load() {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const [card, log] = await Promise.all([this.api.mine(), this.api.accessLog().catch(() => [])]);
      this.card.set(card);
      this.log.set(log);
      await this.refreshQr();
    } catch (e) {
      this.loadError.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.loading.set(false);
    }
  }

  edit() {
    this.draft = structuredClone(this.card());
    this.error.set('');
    this.saved.set(false);
    this.mode.set('edit');
  }
  cancel() { this.mode.set('view'); this.error.set(''); }

  add(key: ListKey) {
    if (this.full(key)) return;
    const blank = {
      allergies: { substance: '', reaction: null, severity: null },
      conditions: { name: '', diagnosed_year: null, notes: null },
      medications: { name: '', dosage: null, frequency: null },
      vaccinations: { vaccine: '', dose_date: null, notes: null },
      emergency_contacts: { name: '', relation: null, phone: '' },
    }[key];
    (this.draft[key] as unknown[]).push(blank);
  }
  remove(key: ListKey, i: number) { (this.draft[key] as unknown[]).splice(i, 1); }
  full(key: ListKey) { return this.draft[key].length >= LIMITS[key]; }

  /** Nettoie le brouillon : champs vides → null, lignes vides retirées, nombres arrondis. */
  private clean(d: HealthCard): HealthCard {
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() || null : v ?? null) as string | null;
    const n = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
    const h = n(d.height_cm);
    const y = (v: unknown) => { const x = n(v); return x === null ? null : Math.round(x); };
    return {
      ...d,
      date_of_birth: s(d.date_of_birth), cnam_number: s(d.cnam_number), insurer: s(d.insurer), notes: s(d.notes),
      height_cm: h === null ? null : Math.round(h), weight_kg: n(d.weight_kg),
      allergies: d.allergies.filter((a) => s(a.substance)).map((a) => ({ substance: s(a.substance)!, reaction: s(a.reaction), severity: a.severity ?? null })),
      conditions: d.conditions.filter((c) => s(c.name)).map((c) => ({ name: s(c.name)!, diagnosed_year: y(c.diagnosed_year), notes: s(c.notes) })),
      medications: d.medications.filter((m) => s(m.name)).map((m) => ({ name: s(m.name)!, dosage: s(m.dosage), frequency: s(m.frequency) })),
      vaccinations: d.vaccinations.filter((v) => s(v.vaccine)).map((v) => ({ vaccine: s(v.vaccine)!, dose_date: s(v.dose_date), notes: s(v.notes) })),
      emergency_contacts: d.emergency_contacts.filter((p) => s(p.name) || s(p.phone))
        .map((p) => ({ name: s(p.name) ?? '', relation: s(p.relation), phone: s(p.phone) ?? '' })),
    };
  }

  async save() {
    if (this.saving()) return;
    this.error.set('');
    this.saving.set(true);
    try {
      this.card.set(await this.api.save(this.clean(this.draft)));
      this.mode.set('view');
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleShare(on: boolean) {
    this.error.set('');
    this.saving.set(true);
    try {
      this.card.set(await this.api.save({ ...this.card(), share_with_doctors: on }));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
      this.card.update((c) => ({ ...c }));            // recoche l'état réel
    } finally {
      this.saving.set(false);
    }
  }

  async enableEmergency(regenerate: boolean) {
    if (regenerate && !window.confirm(this.t('L’ancien lien et l’ancien QR code cesseront de fonctionner. Continuer ?', 'سيتوقف الرابط ورمز QR القديمان عن العمل. هل تريد المتابعة؟'))) return;
    await this.emergencyAction(async () => {
      const r = await this.api.enableEmergency();
      this.card.update((c) => ({ ...c, emergency_access_enabled: true, emergency_token: r.emergency_token }));
    });
  }
  async disableEmergency() {
    await this.emergencyAction(async () => {
      await this.api.disableEmergency();
      this.card.update((c) => ({ ...c, emergency_access_enabled: false, emergency_token: null }));
    });
  }
  private async emergencyAction(fn: () => Promise<void>) {
    this.busy.set(true);
    this.emergencyError.set('');
    try { await fn(); await this.refreshQr(); } catch (e) {
      this.emergencyError.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally { this.busy.set(false); }
  }

  /** QR code généré localement (le lien secret n'est jamais envoyé à un service tiers). */
  private async refreshQr() {
    const url = this.emergencyUrl();
    if (url === this.qrFor) return;
    this.qrFor = url;
    if (!url) { this.qrSvg.set(null); return; }
    try {
      const mod: any = await import('qrcode-generator');
      const qrcode = mod.default ?? mod;
      const qr = qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      this.qrSvg.set(this.sanitizer.bypassSecurityTrustHtml(qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })));
    } catch {
      this.qrSvg.set(null);
    }
  }

  async copy(url: string) {
    try { await navigator.clipboard.writeText(url); this.copied.set(true); setTimeout(() => this.copied.set(false), 2000); } catch { /* non supporté */ }
  }
  print() {
    document.body.classList.add('hc-printing');
    const done = () => { document.body.classList.remove('hc-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(done, 1000);
  }

  trackLabel(t: string) {
    return t === 'public' ? this.t('Filière publique', 'المنظومة العمومية')
      : t === 'private' ? this.t('Filière privée (médecin de famille)', 'المنظومة الخاصة (طبيب العائلة)')
      : this.t('Système de remboursement', 'منظومة استرجاع المصاريف');
  }
  sevLabel(s: string) {
    return s === 'severe' ? this.t('sévère', 'شديدة') : s === 'moderate' ? this.t('modérée', 'متوسطة') : this.t('légère', 'خفيفة');
  }
  masked(n: string) { const x = n.replace(/\s+/g, ''); return x.length <= 4 ? x : '•••• ' + x.slice(-4); }
  yesNo(v: boolean | null) { return v === null ? '—' : v ? this.t('Oui', 'نعم') : this.t('Non', 'لا'); }
  logLabel(l: AccessLogEntry) {
    return l.access_type === 'doctor_view'
      ? this.t('Consultée par ', 'اطلع عليها ') + (l.doctor_name ?? this.t('un médecin', 'طبيب'))
      : this.t('Fiche d’urgence consultée', 'تم الاطلاع على بطاقة الطوارئ');
  }
  private locale() { return this.lang() === 'ar' ? 'ar-TN' : 'fr-FR'; }
  fmtDate(iso: string) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + 'T12:00:00') : new Date(iso);
    return d.toLocaleDateString(this.locale(), { day: 'numeric', month: 'long', year: 'numeric' });
  }
  fmtDateTime(iso: string) {
    return new Date(iso).toLocaleString(this.locale(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
