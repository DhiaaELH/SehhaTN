import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from './auth.service';
import { LangService } from './lang.service';

type Topic = 'account' | 'appointment' | 'doctor' | 'data' | 'bug' | 'other';
interface Faq { q_fr: string; q_ar: string; a_fr: string; a_ar: string; }
interface FaqGroup { id: string; fr: string; ar: string; items: Faq[]; }

const TOPICS: { key: Topic; fr: string; ar: string }[] = [
  { key: 'account', fr: 'Mon compte', ar: 'حسابي' },
  { key: 'appointment', fr: 'Un rendez-vous', ar: 'موعد' },
  { key: 'doctor', fr: 'Je suis médecin', ar: 'أنا طبيب' },
  { key: 'data', fr: 'Mes données personnelles', ar: 'بياناتي الشخصية' },
  { key: 'bug', fr: 'Signaler un problème', ar: 'الإبلاغ عن مشكلة' },
  { key: 'other', fr: 'Autre', ar: 'أخرى' },
];

const FAQ: FaqGroup[] = [
  { id: 'patients', fr: 'Patients', ar: 'المرضى', items: [
    { q_fr: 'Comment trouver un médecin ?', q_ar: 'كيف أجد طبيباً؟',
      a_fr: 'Depuis la page Médecins, filtrez par spécialité, gouvernorat ou nom. Vous pouvez aussi cliquer sur une zone du corps depuis l’accueil, ou utiliser l’orientation guidée qui vous indique la spécialité adaptée.',
      a_ar: 'من صفحة الأطباء، صفِّ حسب التخصص أو الولاية أو الاسم. يمكنك أيضاً الضغط على منطقة من الجسم في الصفحة الرئيسية، أو استعمال التوجيه الموجَّه الذي يقترح التخصص المناسب.' },
    { q_fr: 'Comment prendre rendez-vous ?', q_ar: 'كيف أحجز موعداً؟',
      a_fr: 'Connectez-vous avec un compte patient, ouvrez la fiche du médecin, choisissez un jour puis un créneau libre. Les créneaux sont à l’heure de Tunis, réservables au moins 2 heures à l’avance et jusqu’à 30 jours.',
      a_ar: 'سجّل الدخول بحساب مريض، وافتح ملف الطبيب، واختر يوماً ثم موعداً شاغراً. المواعيد بتوقيت تونس، ويمكن حجزها قبل ساعتين على الأقل وحتى 30 يوماً مسبقاً.' },
    { q_fr: 'Comment annuler un rendez-vous ?', q_ar: 'كيف ألغي موعداً؟',
      a_fr: 'Dans Mon compte, rubrique « Mes rendez-vous », cliquez sur Annuler. L’annulation est possible jusqu’à l’heure de début du rendez-vous.',
      a_ar: 'في حسابي، قسم «مواعيدي»، اضغط على إلغاء. يمكن الإلغاء حتى ساعة بداية الموعد.' },
    { q_fr: 'Pourquoi ne puis-je pas réserver un deuxième rendez-vous avec le même médecin ?', q_ar: 'لماذا لا يمكنني حجز موعد ثانٍ مع نفس الطبيب؟',
      a_fr: 'Pour laisser des créneaux à tous, chaque patient ne peut avoir qu’un seul rendez-vous à venir par médecin. Une fois ce rendez-vous passé ou annulé, vous pouvez en réserver un nouveau.',
      a_ar: 'لترك المواعيد متاحة للجميع، لا يمكن لكل مريض أن يكون له سوى موعد قادم واحد لدى كل طبيب. بعد مرور هذا الموعد أو إلغائه، يمكنك حجز موعد جديد.' },
    { q_fr: 'Vais-je recevoir un rappel ?', q_ar: 'هل سأتلقى تذكيراً؟',
      a_fr: 'Pas encore : les rappels par e-mail ou SMS sont en préparation. Retrouvez en attendant tous vos rendez-vous dans Mon compte.',
      a_ar: 'ليس بعد: التذكير عبر البريد الإلكتروني أو الرسائل القصيرة قيد الإعداد. في الأثناء، تجد كل مواعيدك في حسابي.' },
    { q_fr: 'Qui peut laisser un avis ?', q_ar: 'من يمكنه ترك رأي؟',
      a_fr: 'Uniquement un patient ayant eu un rendez-vous passé avec ce médecin via SehhaTN, à raison d’un avis par médecin (modifiable). L’avis est publié avec votre prénom et l’initiale de votre nom ; le médecin peut y répondre.',
      a_ar: 'فقط المريض الذي كان له موعد سابق مع هذا الطبيب عبر SehhaTN، بمعدل رأي واحد لكل طبيب (قابل للتعديل). يُنشر الرأي باسمك الأول والحرف الأول من لقبك، ويمكن للطبيب الرد عليه.' },
    { q_fr: 'L’orientation est-elle fiable ?', q_ar: 'هل التوجيه موثوق؟',
      a_fr: 'Elle vérifie d’abord les signes d’alerte, puis tient compte de l’âge, de la grossesse, de la durée et de l’intensité pour vous indiquer le bon niveau de soins et la spécialité. Ce n’est pas un diagnostic : en cas de doute ou d’aggravation, consultez, et pour une urgence appelez le 190.',
      a_ar: 'يتحقق أولاً من علامات الخطر، ثم يأخذ بعين الاعتبار العمر والحمل والمدة والشدة ليقترح مستوى الرعاية والتخصص المناسبين. ليس تشخيصاً: عند الشك أو تفاقم الحالة استشر طبيباً، وفي الطوارئ اتصل بالرقم 190.' },
    { q_fr: 'À quoi sert la carte santé et son QR code d’urgence ?', q_ar: 'ما فائدة البطاقة الصحية ورمز QR للطوارئ؟',
      a_fr: 'La carte santé regroupe groupe sanguin, allergies, traitements, antécédents et contacts d’urgence. Vous choisissez de la partager avec vos médecins. Le QR code d’urgence, facultatif, affiche un résumé minimal ; vous pouvez le régénérer ou le désactiver à tout moment.',
      a_ar: 'تجمع البطاقة الصحية فصيلة الدم والحساسية والأدوية والسوابق وجهات الاتصال في الطوارئ. أنت من تختار مشاركتها مع أطبائك. رمز QR للطوارئ اختياري ويعرض ملخصاً أدنى، ويمكنك تجديده أو تعطيله في أي وقت.' },
    { q_fr: 'Mes symptômes sont-ils enregistrés ?', q_ar: 'هل تُحفظ أعراضي؟',
      a_fr: 'Non. Les symptômes saisis dans l’orientation ou l’assistant servent uniquement à calculer la réponse sur notre serveur ; ils ne sont ni stockés ni envoyés à une intelligence artificielle.',
      a_ar: 'لا. تُستعمل الأعراض المدخلة في التوجيه أو المساعد فقط لحساب الإجابة على خادمنا، ولا تُحفظ ولا تُرسل إلى أي ذكاء اصطناعي.' },
  ] },
  { id: 'medecins', fr: 'Médecins', ar: 'الأطباء', items: [
    { q_fr: 'Comment apparaître dans l’annuaire ?', q_ar: 'كيف أظهر في الدليل؟',
      a_fr: 'Créez un compte en choisissant « Médecin », puis complétez votre fiche professionnelle dans Mon compte (spécialité, adresse, tarifs, langues…). Elle devient visible immédiatement.',
      a_ar: 'أنشئ حساباً باختيار «طبيب»، ثم أكمل ملفك المهني في حسابي (التخصص، العنوان، الأسعار، اللغات…). يصبح ظاهراً فوراً.' },
    { q_fr: 'Comment définir mes horaires ?', q_ar: 'كيف أحدد أوقات عملي؟',
      a_fr: 'Dans Mon compte, ajoutez vos plages horaires pour chaque jour et choisissez la durée d’une consultation, de 15 à 60 minutes. Les créneaux proposés aux patients sont calculés automatiquement.',
      a_ar: 'في حسابي، أضف فتراتك لكل يوم واختر مدة الاستشارة من 15 إلى 60 دقيقة. تُحسب المواعيد المقترحة على المرضى تلقائياً.' },
    { q_fr: 'Comment gérer mes rendez-vous ?', q_ar: 'كيف أدير مواعيدي؟',
      a_fr: 'Vous voyez vos rendez-vous dans Mon compte. Vous pouvez annuler un rendez-vous à venir, puis, une fois l’heure passée, le marquer comme terminé ou indiquer que le patient était absent.',
      a_ar: 'تجد مواعيدك في حسابي. يمكنك إلغاء موعد قادم، وبعد مرور وقته يمكنك وسمه كمنتهٍ أو الإشارة إلى غياب المريض.' },
    { q_fr: 'Comment obtenir le badge « Profil vérifié » ?', q_ar: 'كيف أحصل على شارة «ملف موثق»؟',
      a_fr: 'Le badge est attribué par l’équipe SehhaTN après vérification de votre qualité de professionnel de santé. Contactez-nous via le formulaire avec le sujet « Je suis médecin ».',
      a_ar: 'يمنح فريق SehhaTN الشارة بعد التحقق من صفتك كمختص صحي. تواصل معنا عبر الاستمارة بموضوع «أنا طبيب».' },
    { q_fr: 'Comment ma position sur la carte est-elle déterminée ?', q_ar: 'كيف يُحدَّد موقعي على الخريطة؟',
      a_fr: 'L’adresse de votre cabinet est localisée automatiquement. Si elle ne peut pas être trouvée précisément, le repère est placé au centre de votre ville : précisez votre adresse pour l’améliorer.',
      a_ar: 'يُحدَّد موقع عنوان عيادتك تلقائياً. إذا تعذّر العثور عليه بدقة، يوضع المؤشر في وسط مدينتك: دقّق عنوانك لتحسينه.' },
    { q_fr: 'Puis-je répondre aux avis ?', q_ar: 'هل يمكنني الرد على الآراء؟',
      a_fr: 'Oui, vous pouvez publier une réponse à chaque avis laissé sur votre fiche. Restez courtois et ne divulguez jamais d’information médicale sur le patient.',
      a_ar: 'نعم، يمكنك نشر رد على كل رأي في ملفك. حافظ على اللباقة ولا تكشف أبداً أي معلومة طبية عن المريض.' },
  ] },
  { id: 'compte', fr: 'Compte et données', ar: 'الحساب والبيانات', items: [
    { q_fr: 'J’ai oublié mon mot de passe.', q_ar: 'نسيت كلمة المرور.',
      a_fr: 'La réinitialisation automatique n’est pas encore disponible. Écrivez-nous via le formulaire ci-dessous (sujet « Mon compte ») depuis l’adresse e-mail de votre compte.',
      a_ar: 'إعادة التعيين التلقائية غير متوفرة بعد. راسلنا عبر الاستمارة أدناه (موضوع «حسابي») من البريد الإلكتروني المرتبط بحسابك.' },
    { q_fr: 'Comment télécharger ou supprimer mes données ?', q_ar: 'كيف أنزّل بياناتي أو أحذفها؟',
      a_fr: 'Depuis Mon compte, vous pouvez télécharger vos données et supprimer votre compte. Vous pouvez aussi nous écrire avec le sujet « Mes données personnelles ».',
      a_ar: 'من حسابي، يمكنك تنزيل بياناتك وحذف حسابك. يمكنك أيضاً مراسلتنا بموضوع «بياناتي الشخصية».' },
    { q_fr: 'Comment changer la langue ?', q_ar: 'كيف أغيّر اللغة؟',
      a_fr: 'Utilisez le bouton FR / عربي en haut de la page. L’arabe s’affiche de droite à gauche.',
      a_ar: 'استعمل زر FR / عربي في أعلى الصفحة. تُعرض العربية من اليمين إلى اليسار.' },
  ] },
];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ًͯ-ٟ]/g, '').toLowerCase();

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styles: [`
    :host { display: block; }
    h1 { font: 800 clamp(28px, 4.5vw, 42px)/1.1 Montserrat, sans-serif; color: var(--deep); margin: 10px 0; }
    h2 { font: 800 20px Montserrat, sans-serif; color: var(--deep); margin: 0 0 14px; }
    .hp-lede { color: var(--muted); margin: 0 0 18px; line-height: 1.7; }
    .hp-search { display: flex; align-items: center; gap: 10px; max-width: 560px; background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 0 14px; }
    .hp-search input { flex: 1; border: 0; outline: 0; height: 48px; font-size: 15px; background: transparent; min-width: 0; }
    .hp-urgent { margin: 24px 0; padding: 18px 20px; border-radius: 16px; background: #fff1f0; border: 1px solid #f5c6c2; }
    .hp-urgent b { color: var(--coral); font-size: 14px; }
    .hp-nums { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0 10px; }
    .hp-nums a { display: flex; align-items: baseline; gap: 8px; padding: 9px 14px; border-radius: 12px; background: #fff; border: 1px solid #f5c6c2; text-decoration: none; color: var(--deep); font-size: 12.5px; font-weight: 700; }
    .hp-nums a strong { font: 800 20px Montserrat, sans-serif; color: var(--coral); }
    .hp-urgent p { margin: 0; font-size: 12.5px; color: #6b3a37; line-height: 1.6; }
    .hp-actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 34px; }
    .hp-actions a { display: block; padding: 18px; border-radius: 16px; background: #fff; border: 1px solid var(--line); text-decoration: none; color: inherit; transition: transform .15s, box-shadow .15s; }
    .hp-actions a:hover { transform: translateY(-2px); box-shadow: 0 10px 24px #0b325e14; }
    .hp-actions span { font-size: 22px; color: var(--teal); }
    .hp-actions b { display: block; margin: 8px 0 4px; color: var(--deep); font-size: 14px; }
    .hp-actions small { color: var(--muted); font-size: 12px; line-height: 1.5; }
    .hp-grid { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 24px; align-items: start; }
    .hp-group { margin-bottom: 22px; }
    .hp-group h3 { font: 800 12px Montserrat, sans-serif; letter-spacing: .06em; text-transform: uppercase; color: var(--teal); margin: 0 0 8px; }
    details { background: #fff; border: 1px solid var(--line); border-radius: 12px; margin-bottom: 8px; }
    summary { padding: 14px 16px; font-weight: 700; color: var(--deep); font-size: 14px; cursor: pointer; }
    details p { margin: 0; padding: 0 16px 16px; color: #3b4d61; font-size: 13.5px; line-height: 1.7; }
    .hp-empty { color: var(--muted); font-size: 13px; }
    .hp-form { background: #fff; border: 1px solid var(--line); border-radius: 18px; padding: 22px; position: sticky; top: 96px; }
    .hp-form label { display: block; font-size: 12px; font-weight: 700; color: #455a6e; margin-bottom: 12px; }
    .hp-form input, .hp-form select, .hp-form textarea { display: block; width: 100%; margin-top: 6px; border: 1px solid #dce4eb; border-radius: 10px; padding: 11px 12px; font-size: 14px; background: #fff; color: var(--ink); font-family: inherit; }
    .hp-form textarea { min-height: 130px; resize: vertical; }
    .hp-form .bad { border-color: var(--coral); }
    .hp-err { color: var(--coral); font-size: 11.5px; font-weight: 600; }
    .hp-count { float: inline-end; color: var(--muted); font-weight: 500; }
    .hp-trap { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .hp-note { font-size: 11.5px; color: var(--muted); line-height: 1.6; margin: 0 0 14px; }
    .hp-form button { width: 100%; }
    .hp-ok { text-align: center; padding: 10px 0; }
    .hp-ok span { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: 50%; background: #e6f6f1; color: #0a7a55; font-size: 24px; }
    .hp-ok code { display: inline-block; margin: 8px 0 14px; padding: 6px 12px; border-radius: 8px; background: var(--pale); font: 800 16px Montserrat, sans-serif; color: var(--navy); }
    @media (max-width: 900px) { .hp-grid { grid-template-columns: 1fr; } .hp-form { position: static; } }
  `],
  template: `
    <section class="page-section">
      <span class="section-kicker">{{ t('AIDE & CONTACT', 'المساعدة والتواصل') }}</span>
      <h1>{{ t('Comment pouvons-nous vous aider ?', 'كيف يمكننا مساعدتك؟') }}</h1>
      <p class="hp-lede">{{ t('Trouvez une réponse dans les questions fréquentes ou écrivez-nous.', 'ابحث عن إجابة في الأسئلة الشائعة أو راسلنا.') }}</p>
      <label class="hp-search">
        <span aria-hidden="true">⌕</span>
        <input [(ngModel)]="query" [placeholder]="t('Rechercher : rendez-vous, carte santé, mot de passe…', 'ابحث: موعد، بطاقة صحية، كلمة المرور…')" [attr.aria-label]="t('Rechercher dans l’aide', 'ابحث في المساعدة')">
      </label>

      <div class="hp-urgent" role="note">
        <b>{{ t('Urgence médicale ? N’utilisez pas ce formulaire.', 'حالة طبية طارئة؟ لا تستعمل هذه الاستمارة.') }}</b>
        <div class="hp-nums">
          <a href="tel:190"><strong>190</strong> {{ t('SAMU', 'الإسعاف') }}</a>
          <a href="tel:198"><strong>198</strong> {{ t('Protection civile', 'الحماية المدنية') }}</a>
          <a href="tel:197"><strong>197</strong> {{ t('Police', 'الشرطة') }}</a>
        </div>
        <p>{{ t('Si vous avez des pensées de vous faire du mal, appelez le 190 ou rendez-vous aux urgences les plus proches. Vous n’êtes pas seul(e).',
                'إذا راودتك أفكار لإيذاء نفسك، اتصل بالرقم 190 أو توجه إلى أقرب قسم استعجالي. لست وحدك.') }}</p>
      </div>

      <div class="hp-actions">
        <a routerLink="/orientation"><span>✚</span><b>{{ t('Orientation guidée', 'التوجيه الموجَّه') }}</b><small>{{ t('Savoir quel type de soins consulter.', 'اعرف نوع الرعاية المناسب.') }}</small></a>
        <a routerLink="/assistant"><span>✉</span><b>{{ t('Assistant santé', 'المساعد الصحي') }}</b><small>{{ t('Décrivez vos symptômes avec vos mots.', 'صف أعراضك بكلماتك.') }}</small></a>
        <a routerLink="/lieux-de-sante"><span>⌖</span><b>{{ t('Lieux de soins autour de moi', 'أماكن الرعاية من حولي') }}</b><small>{{ t('Pharmacies, hôpitaux, laboratoires.', 'صيدليات، مستشفيات، مخابر.') }}</small></a>
        <a routerLink="/account"><span>♡</span><b>{{ t('Ma carte santé', 'بطاقتي الصحية') }}</b><small>{{ t('Allergies, traitements, QR d’urgence.', 'الحساسية، الأدوية، رمز الطوارئ.') }}</small></a>
      </div>

      <div class="hp-grid">
        <div>
          <h2>{{ t('Questions fréquentes', 'الأسئلة الشائعة') }}</h2>
          @for (g of groups(); track g.id) {
            <div class="hp-group">
              <h3>{{ t(g.fr, g.ar) }}</h3>
              @for (f of g.items; track f.q_fr) {
                <details [open]="!!query.trim()">
                  <summary>{{ t(f.q_fr, f.q_ar) }}</summary>
                  <p>{{ t(f.a_fr, f.a_ar) }}</p>
                </details>
              }
            </div>
          } @empty {
            <p class="hp-empty">{{ t('Aucune question ne correspond. Écrivez-nous avec le formulaire.', 'لا يوجد سؤال مطابق. راسلنا عبر الاستمارة.') }}</p>
          }
        </div>

        <div class="hp-form">
          @if (reference()) {
            <div class="hp-ok" role="status">
              <span>✓</span>
              <h2>{{ t('Message envoyé', 'تم إرسال الرسالة') }}</h2>
              <p class="hp-note">{{ t('Merci ! Nous vous répondrons par e-mail. Votre référence :', 'شكراً! سنرد عليك عبر البريد الإلكتروني. مرجعك:') }}</p>
              <code>{{ reference() }}</code>
              <button class="outline-btn" (click)="reset()">{{ t('Envoyer un autre message', 'إرسال رسالة أخرى') }}</button>
            </div>
          } @else {
            <h2>{{ t('Nous écrire', 'راسلنا') }}</h2>
            <p class="hp-note">{{ t('Réponse par e-mail. Ce formulaire ne doit pas être utilisé pour une urgence médicale.', 'نرد عبر البريد الإلكتروني. لا تُستعمل هذه الاستمارة في الحالات الطبية الطارئة.') }}</p>
            <label>{{ t('Nom', 'الاسم') }}
              <input name="name" autocomplete="name" [(ngModel)]="name" [class.bad]="tried() && nameError()">
              @if (tried() && nameError()) { <span class="hp-err">{{ nameError() }}</span> }
            </label>
            <label>{{ t('Adresse e-mail', 'البريد الإلكتروني') }}
              <input name="email" type="email" autocomplete="email" [(ngModel)]="email" [class.bad]="tried() && emailError()">
              @if (tried() && emailError()) { <span class="hp-err">{{ emailError() }}</span> }
            </label>
            <label>{{ t('Sujet', 'الموضوع') }}
              <select name="topic" [(ngModel)]="topic">
                @for (o of topics; track o.key) { <option [value]="o.key">{{ t(o.fr, o.ar) }}</option> }
              </select>
            </label>
            <label>{{ t('Message', 'الرسالة') }} <span class="hp-count">{{ message.length }}/3000</span>
              <textarea name="message" maxlength="3000" [(ngModel)]="message" [class.bad]="tried() && messageError()"></textarea>
              @if (tried() && messageError()) { <span class="hp-err">{{ messageError() }}</span> }
            </label>
            <div class="hp-trap" aria-hidden="true">
              <label>Website <input name="website" tabindex="-1" autocomplete="off" [(ngModel)]="website"></label>
            </div>
            @if (error()) { <p class="hp-err" role="alert">{{ error() }}</p> }
            <button class="primary-btn" [disabled]="sending()" (click)="send()">
              {{ sending() ? t('Envoi…', 'جارٍ الإرسال…') : t('Envoyer', 'إرسال') }} →
            </button>
          }
        </div>
      </div>
    </section>
  `,
})
export class HelpComponent {
  private langService = inject(LangService);
  private auth = inject(AuthService);
  readonly topics = TOPICS;

  query = '';
  name = this.auth.user()?.name ?? '';
  email = this.auth.user()?.email ?? '';
  topic: Topic = 'other';
  message = '';
  website = '';

  readonly tried = signal(false);
  readonly sending = signal(false);
  readonly error = signal('');
  readonly reference = signal('');

  constructor() {
    const t = inject(ActivatedRoute).snapshot.queryParamMap.get('topic');
    if (t && TOPICS.some((x) => x.key === t)) this.topic = t as Topic;
  }

  t(fr: string, ar: string) { return this.langService.lang() === 'fr' ? fr : ar; }

  /** Groupes de FAQ filtrés par la recherche (français et arabe). */
  groups() {
    const q = fold(this.query.trim());
    if (!q) return FAQ;
    return FAQ.map((g) => ({
      ...g,
      items: g.items.filter((f) => fold(`${f.q_fr} ${f.a_fr} ${f.q_ar} ${f.a_ar}`).includes(q)),
    })).filter((g) => g.items.length);
  }

  nameError() { return this.name.trim().length < 2 ? this.t('Indiquez votre nom.', 'أدخل اسمك.') : ''; }
  emailError() {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim()) ? '' : this.t('Adresse e-mail invalide.', 'بريد إلكتروني غير صالح.');
  }
  messageError() {
    const n = this.message.trim().length;
    if (n < 10) return this.t('Message trop court (10 caractères minimum).', 'الرسالة قصيرة جداً (10 أحرف على الأقل).');
    if (n > 3000) return this.t('Message trop long (3000 caractères maximum).', 'الرسالة طويلة جداً (3000 حرف كحد أقصى).');
    return '';
  }

  async send() {
    if (this.sending()) return;
    this.tried.set(true);
    this.error.set('');
    if (this.nameError() || this.emailError() || this.messageError()) return;
    this.sending.set(true);
    try {
      const r = await this.auth.request<{ reference: string }>('/contact', {
        method: 'POST',
        body: JSON.stringify({ name: this.name.trim(), email: this.email.trim(), topic: this.topic, message: this.message.trim(), website: this.website }),
      });
      this.reference.set(r.reference);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.t('Envoi impossible, réessayez.', 'تعذّر الإرسال، حاول مجدداً.'));
    } finally {
      this.sending.set(false);
    }
  }

  reset() {
    this.message = '';
    this.tried.set(false);
    this.reference.set('');
    this.error.set('');
  }
}
