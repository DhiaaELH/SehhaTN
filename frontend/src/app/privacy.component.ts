import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LangService } from './lang.service';

interface PolicySection { id: string; title_fr: string; title_ar: string; fr: string[]; ar: string[]; }

const SECTIONS: PolicySection[] = [
  {
    id: 'qui', title_fr: '1. Qui sommes-nous ?', title_ar: '1. من نحن؟',
    fr: [
      'SehhaTN est une plateforme tunisienne d’information et d’orientation en santé : annuaire de médecins, prise de rendez-vous en ligne, orientation vers le bon type de soins, lieux de soins à proximité et carte santé personnelle.',
      'Cette politique explique quelles données nous traitons, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et comment exercer vos droits. Pour toute question, utilisez le formulaire de la page Aide & contact.',
    ],
    ar: [
      'SehhaTN منصة تونسية للمعلومات والتوجيه الصحي: دليل للأطباء، وحجز المواعيد عبر الإنترنت، وتوجيه نحو نوع الرعاية المناسب، وأماكن الرعاية القريبة، وبطاقة صحية شخصية.',
      'توضح هذه السياسة البيانات التي نعالجها، ولماذا، ومع من نشاركها، ومدة الاحتفاظ بها، وكيفية ممارسة حقوقك. لأي سؤال، استعمل استمارة صفحة المساعدة والتواصل.',
    ],
  },
  {
    id: 'donnees', title_fr: '2. Les données que nous collectons', title_ar: '2. البيانات التي نجمعها',
    fr: [
      'Compte : nom, adresse e-mail, mot de passe (jamais stocké en clair : seule une empreinte chiffrée avec bcrypt est conservée) et rôle (patient ou médecin).',
      'Fiche médecin : les informations saisies par le médecin (spécialité, adresse du cabinet, téléphone, horaires, tarifs, langues, présentation, photo) sont publiques et visibles dans l’annuaire.',
      'Rendez-vous : médecin, date, heure, statut et note facultative. Le médecin voit uniquement le nom du patient et la note ; les autres patients ne voient jamais qui a réservé un créneau.',
      'Avis : note et commentaire, publiés avec un nom abrégé (par exemple « Amira B. »). Un avis n’est possible qu’après un rendez-vous passé avec ce médecin.',
      'Carte santé : uniquement si vous la remplissez vous-même (voir la section dédiée).',
      'Messages envoyés via le formulaire de contact : nom, e-mail, sujet et contenu du message.',
      'Données techniques : journaux du serveur (adresse IP, date, page demandée) utilisés pour la sécurité et la limitation des abus.',
    ],
    ar: [
      'الحساب: الاسم والبريد الإلكتروني وكلمة المرور (لا تُخزَّن أبداً بشكل مقروء: نحتفظ فقط ببصمة مشفرة بواسطة bcrypt) والدور (مريض أو طبيب).',
      'ملف الطبيب: المعلومات التي يدخلها الطبيب (التخصص، عنوان العيادة، الهاتف، الأوقات، الأسعار، اللغات، التقديم، الصورة) عمومية وتظهر في الدليل.',
      'المواعيد: الطبيب والتاريخ والساعة والحالة وملاحظة اختيارية. يرى الطبيب اسم المريض والملاحظة فقط، ولا يرى المرضى الآخرون أبداً من حجز موعداً.',
      'الآراء: تقييم وتعليق يُنشران باسم مختصر (مثلاً «أميرة ب.»). لا يمكن ترك رأي إلا بعد موعد سابق مع هذا الطبيب.',
      'البطاقة الصحية: فقط إذا ملأتها بنفسك (انظر القسم الخاص بها).',
      'الرسائل المرسلة عبر استمارة التواصل: الاسم والبريد الإلكتروني والموضوع ومحتوى الرسالة.',
      'بيانات تقنية: سجلات الخادم (عنوان IP، التاريخ، الصفحة المطلوبة) لأغراض الأمان والحد من التجاوزات.',
    ],
  },
  {
    id: 'finalites', title_fr: '3. Pourquoi nous les utilisons', title_ar: '3. لماذا نستعملها',
    fr: [
      'Fournir le service : créer votre compte, afficher l’annuaire, gérer les rendez-vous, publier les avis, conserver votre carte santé et répondre à vos messages.',
      'Sécuriser la plateforme : prévenir les abus, les tentatives de connexion répétées et les usages frauduleux.',
      'Nous n’utilisons pas vos données à des fins publicitaires, nous ne les vendons pas et nous ne faisons pas de profilage commercial.',
    ],
    ar: [
      'تقديم الخدمة: إنشاء حسابك، وعرض الدليل، وإدارة المواعيد، ونشر الآراء، وحفظ بطاقتك الصحية، والرد على رسائلك.',
      'تأمين المنصة: منع التجاوزات ومحاولات الدخول المتكررة والاستعمال الاحتيالي.',
      'لا نستعمل بياناتك لأغراض إشهارية، ولا نبيعها، ولا نقوم بأي تصنيف تجاري.',
    ],
  },
  {
    id: 'carte-sante', title_fr: '4. Données de santé et carte santé', title_ar: '4. البيانات الصحية والبطاقة الصحية',
    fr: [
      'Les données de santé sont des données sensibles. La carte santé (groupe sanguin, allergies, antécédents, traitements, vaccinations, contacts d’urgence, numéro et filière CNAM, assurance complémentaire, notes) n’est enregistrée que lorsque vous la remplissez et la sauvegardez vous-même.',
      'Partage avec vos médecins : désactivé par défaut. Si vous activez « Partager avec mes médecins », seul un médecin chez qui vous avez un rendez-vous peut consulter votre carte. Vous pouvez retirer ce partage à tout moment.',
      'Fiche d’urgence : facultative. Si vous l’activez, un lien secret (et son QR code) permet d’afficher un résumé minimal : prénom, âge, groupe sanguin, allergies, antécédents, traitements et contacts d’urgence. Vous pouvez régénérer le lien (l’ancien cesse de fonctionner) ou le désactiver.',
      'Traçabilité : chaque consultation de votre carte par un médecin ou via la fiche d’urgence est enregistrée dans un journal que vous pouvez consulter depuis votre compte.',
    ],
    ar: [
      'البيانات الصحية بيانات حساسة. لا تُحفظ البطاقة الصحية (فصيلة الدم، الحساسية، السوابق، الأدوية، التلاقيح، جهات الاتصال في الطوارئ، رقم ومسلك الكنام، التأمين التكميلي، الملاحظات) إلا عندما تملؤها وتحفظها بنفسك.',
      'المشاركة مع أطبائك: معطلة افتراضياً. إذا فعّلت «المشاركة مع أطبائي»، يمكن فقط للطبيب الذي لديك موعد معه الاطلاع على بطاقتك. يمكنك إلغاء المشاركة في أي وقت.',
      'بطاقة الطوارئ: اختيارية. إذا فعّلتها، يتيح رابط سري (ورمز QR الخاص به) عرض ملخص أدنى: الاسم الأول، العمر، فصيلة الدم، الحساسية، السوابق، الأدوية وجهات الاتصال في الطوارئ. يمكنك تجديد الرابط (فيتوقف القديم) أو تعطيله.',
      'التتبع: يُسجَّل كل اطلاع على بطاقتك من طرف طبيب أو عبر بطاقة الطوارئ في سجل يمكنك الاطلاع عليه من حسابك.',
    ],
  },
  {
    id: 'orientation', title_fr: '5. Orientation et assistant santé', title_ar: '5. التوجيه والمساعد الصحي',
    fr: [
      'Les symptômes que vous décrivez dans l’orientation guidée ou dans l’assistant sont traités par le serveur de SehhaTN uniquement pour calculer la réponse. SehhaTN ne les enregistre pas dans sa base de données. Dans l’assistant, lorsque vous écrivez librement, votre message peut être transmis à un service d’intelligence artificielle tiers, uniquement pour formuler la réponse ; les signes d’urgence, le niveau de soins et la spécialité conseillée sont calculés par nos propres règles. Évitez d’indiquer des informations qui vous identifient.',
      'L’état de la conversation reste dans votre navigateur ; il disparaît lorsque vous recommencez ou fermez la page.',
    ],
    ar: [
      'تُعالَج الأعراض التي تصفها في التوجيه الموجَّه أو في المساعد من طرف خادم SehhaTN فقط لحساب الإجابة. لا تحفظها SehhaTN في قاعدة بياناتها. وفي المساعد، عندما تكتب بحرية، قد تُرسل رسالتك إلى خدمة ذكاء اصطناعي خارجية لصياغة الرد فقط؛ أما علامات الطوارئ ومستوى الرعاية والتخصص المقترح فتُحسب بقواعدنا الخاصة. تجنب ذكر معلومات تعرّف بك.',
      'تبقى حالة المحادثة في متصفحك وتختفي عند إعادة البدء أو إغلاق الصفحة.',
    ],
  },
  {
    id: 'geolocalisation', title_fr: '6. Géolocalisation et cartes', title_ar: '6. تحديد الموقع والخرائط',
    fr: [
      'Votre position n’est demandée par le navigateur que lorsque vous cliquez sur « Autour de moi ». Vous pouvez refuser ; la recherche par ville reste disponible.',
      'Les coordonnées sont envoyées au serveur de SehhaTN pour calculer les lieux et médecins les plus proches, puis oubliées : elles ne sont pas enregistrées.',
      'Les recherches de villes ou d’adresses et de lieux de soins sont transmises par notre serveur aux services ouverts d’OpenStreetMap (Nominatim et Overpass), sans aucune information sur votre compte.',
      'Les fonds de carte sont chargés directement depuis les serveurs de tuiles OpenStreetMap, qui voient donc votre adresse IP, comme pour tout site affichant une carte.',
    ],
    ar: [
      'لا يطلب المتصفح موقعك إلا عندما تضغط على «من حولي». يمكنك الرفض، ويبقى البحث حسب المدينة متاحاً.',
      'تُرسل الإحداثيات إلى خادم SehhaTN لحساب أقرب الأماكن والأطباء ثم تُنسى: لا تُحفظ.',
      'تُحال عمليات البحث عن المدن أو العناوين وأماكن الرعاية من خادمنا إلى خدمات OpenStreetMap المفتوحة (Nominatim وOverpass)، دون أي معلومة عن حسابك.',
      'تُحمَّل خلفيات الخرائط مباشرة من خوادم OpenStreetMap التي ترى بالتالي عنوان IP الخاص بك، كما هو الحال في أي موقع يعرض خريطة.',
    ],
  },
  {
    id: 'destinataires', title_fr: '7. Destinataires et hébergement', title_ar: '7. المتلقون والاستضافة',
    fr: [
      'Vos données sont accessibles uniquement aux personnes qui en ont besoin : vous-même, le médecin concerné par un rendez-vous (et, si vous l’avez autorisé, par votre carte santé), et l’équipe SehhaTN pour l’assistance et la sécurité.',
      'Prestataires techniques : le site est hébergé sur GitHub Pages, l’API sur Render et la base de données sur Neon (PostgreSQL). Ces services peuvent héberger les données en dehors de la Tunisie ; ils agissent comme sous-traitants techniques et n’utilisent pas vos données pour leur propre compte.',
      'Actualités santé : la page d’accueil affiche des articles issus du flux RSS public de l’Organisation mondiale de la santé ; aucune donnée personnelle ne lui est transmise.',
    ],
    ar: [
      'لا يطّلع على بياناتك إلا من يحتاج إليها: أنت، والطبيب المعني بالموعد (وببطاقتك الصحية إذا سمحت بذلك)، وفريق SehhaTN للمساعدة والأمان.',
      'مزودو الخدمات التقنية: يُستضاف الموقع على GitHub Pages، والواجهة البرمجية على Render، وقاعدة البيانات على Neon (PostgreSQL). قد تستضيف هذه الخدمات البيانات خارج تونس، وهي تعمل كمعالجين تقنيين ولا تستعمل بياناتك لحسابها الخاص.',
      'الأخبار الصحية: تعرض الصفحة الرئيسية مقالات من التدفق العام لمنظمة الصحة العالمية، دون إرسال أي بيانات شخصية إليها.',
    ],
  },
  {
    id: 'stockage', title_fr: '8. Stockage local et cookies', title_ar: '8. التخزين المحلي وملفات تعريف الارتباط',
    fr: [
      'SehhaTN n’utilise ni cookie publicitaire ni outil de suivi. Le navigateur conserve seulement votre jeton de session (pour rester connecté) et vos préférences d’affichage.',
      'Vous pouvez les effacer à tout moment en vous déconnectant ou en vidant les données du site dans votre navigateur.',
    ],
    ar: [
      'لا تستعمل SehhaTN أي ملفات تعريف ارتباط إشهارية ولا أي أداة تتبع. يحتفظ المتصفح فقط برمز الجلسة (لتبقى متصلاً) وبتفضيلات العرض.',
      'يمكنك حذفها في أي وقت بتسجيل الخروج أو بمسح بيانات الموقع من متصفحك.',
    ],
  },
  {
    id: 'securite', title_fr: '9. Sécurité', title_ar: '9. الأمان',
    fr: [
      'Échanges chiffrés (HTTPS/TLS), mots de passe hachés avec bcrypt, jetons de session signés qui expirent après 7 jours.',
      'Accès limités selon le rôle (patient, médecin, administrateur), limitation du nombre de requêtes contre les abus et journal d’accès pour les cartes santé.',
      'Aucun système n’est infaillible : en cas d’incident affectant vos données, nous vous en informerons et prendrons les mesures nécessaires.',
    ],
    ar: [
      'اتصالات مشفرة (HTTPS/TLS)، وكلمات مرور مشفرة بواسطة bcrypt، ورموز جلسة موقّعة تنتهي صلاحيتها بعد 7 أيام.',
      'صلاحيات محدودة حسب الدور (مريض، طبيب، مدير)، وتحديد عدد الطلبات ضد التجاوزات، وسجل اطلاع خاص بالبطاقات الصحية.',
      'لا يوجد نظام معصوم من الخطأ: في حال وقوع حادث يمس بياناتك، سنُعلمك ونتخذ الإجراءات اللازمة.',
    ],
  },
  {
    id: 'conservation', title_fr: '10. Durées de conservation', title_ar: '10. مدة الاحتفاظ',
    fr: [
      'Compte, fiche médecin et carte santé : tant que votre compte existe.',
      'Rendez-vous : 3 ans après la date du rendez-vous.',
      'Messages de contact : 12 mois.',
      'Journal d’accès aux cartes santé : 12 mois.',
      'Lorsque vous supprimez votre compte, vos données personnelles sont effacées, sauf obligation légale de conservation.',
    ],
    ar: [
      'الحساب وملف الطبيب والبطاقة الصحية: طالما حسابك موجود.',
      'المواعيد: 3 سنوات بعد تاريخ الموعد.',
      'رسائل التواصل: 12 شهراً.',
      'سجل الاطلاع على البطاقات الصحية: 12 شهراً.',
      'عند حذف حسابك، تُمحى بياناتك الشخصية، إلا ما يفرض القانون الاحتفاظ به.',
    ],
  },
  {
    id: 'droits', title_fr: '11. Vos droits', title_ar: '11. حقوقك',
    fr: [
      'Conformément à la loi organique n° 2004-63 du 27 juillet 2004 portant sur la protection des données à caractère personnel, vous disposez d’un droit d’accès, de rectification, d’opposition et de suppression de vos données.',
      'Depuis votre compte, vous pouvez modifier vos informations, télécharger vos données et supprimer votre compte. Vous pouvez aussi nous écrire via le formulaire de la page Aide & contact en choisissant le sujet « Mes données personnelles ».',
      'Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir l’Instance nationale de protection des données personnelles (INPDP).',
    ],
    ar: [
      'وفقاً للقانون الأساسي عدد 63 لسنة 2004 المؤرخ في 27 جويلية 2004 المتعلق بحماية المعطيات الشخصية، لك حق النفاذ إلى بياناتك وتصحيحها والاعتراض على معالجتها وحذفها.',
      'من حسابك، يمكنك تعديل معلوماتك وتنزيل بياناتك وحذف حسابك. يمكنك أيضاً مراسلتنا عبر استمارة صفحة المساعدة والتواصل باختيار موضوع «بياناتي الشخصية».',
      'إذا رأيت أن حقوقك لم تُحترم، يمكنك تقديم شكوى إلى الهيئة الوطنية لحماية المعطيات الشخصية.',
    ],
  },
  {
    id: 'mineurs', title_fr: '12. Mineurs', title_ar: '12. القُصَّر',
    fr: [
      'Les personnes de moins de 18 ans ne doivent pas créer de compte seules : le compte est créé et géré par un parent ou un tuteur légal.',
      'Les informations de santé d’un enfant (par exemple dans une note de rendez-vous) sont saisies par ce parent ou tuteur.',
    ],
    ar: [
      'لا ينبغي للأشخاص دون 18 سنة إنشاء حساب بمفردهم: يُنشأ الحساب ويُدار من طرف أحد الوالدين أو الولي القانوني.',
      'تُدخل المعلومات الصحية للطفل (مثلاً في ملاحظة الموعد) من طرف هذا الولي.',
    ],
  },
  {
    id: 'avertissement', title_fr: '13. Avertissement médical', title_ar: '13. تنبيه طبي',
    fr: [
      'SehhaTN est un outil d’information et d’orientation. Il ne pose pas de diagnostic et ne remplace pas une consultation avec un professionnel de santé.',
      'En cas d’urgence, appelez immédiatement le SAMU au 190.',
    ],
    ar: [
      'SehhaTN أداة للمعلومات والتوجيه. لا تقدم تشخيصاً ولا تعوّض استشارة مختص صحي.',
      'في حالة الطوارئ، اتصل فوراً بالإسعاف على الرقم 190.',
    ],
  },
  {
    id: 'modifications', title_fr: '14. Modifications de cette politique', title_ar: '14. تعديل هذه السياسة',
    fr: [
      'Cette politique peut évoluer avec le service. La date de dernière mise à jour figure en haut de la page ; en cas de changement important, nous vous en informerons sur le site.',
    ],
    ar: [
      'قد تتطور هذه السياسة مع تطور الخدمة. يظهر تاريخ آخر تحديث في أعلى الصفحة، وفي حال حدوث تغيير مهم سنُعلمك بذلك على الموقع.',
    ],
  },
];

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [RouterLink],
  styles: [`
    :host { display: block; }
    .pv-head { margin-bottom: 26px; }
    .pv-head h1 { font: 800 clamp(28px, 4.5vw, 42px)/1.1 Montserrat, sans-serif; color: var(--deep); margin: 10px 0 10px; }
    .pv-head p { color: var(--muted); margin: 0; max-width: 70ch; line-height: 1.7; }
    .pv-date { display: inline-block; margin-top: 14px; padding: 5px 12px; border-radius: 999px; background: var(--pale); color: var(--navy); font-size: 12px; font-weight: 700; }
    .pv-layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 28px; align-items: start; }
    .pv-toc { position: sticky; top: 96px; background:var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 16px; }
    .pv-toc summary { font: 800 13px Montserrat, sans-serif; color: var(--deep); cursor: pointer; list-style: none; }
    .pv-toc summary::-webkit-details-marker { display: none; }
    .pv-toc ol { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 2px; }
    .pv-toc a { display: block; padding: 6px 8px; border-radius: 8px; color: var(--text2); font-size: 12.5px; text-decoration: none; }
    .pv-toc a:hover { background: var(--pale); color: var(--navy); }
    .pv-body { display: grid; gap: 16px; }
    .pv-sec { background:var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 22px 24px; scroll-margin-top: 96px; }
    .pv-sec h2 { font: 800 18px Montserrat, sans-serif; color: var(--deep); margin: 0 0 12px; }
    .pv-sec p { margin: 0 0 10px; color: var(--text2); line-height: 1.75; font-size: 14px; }
    .pv-sec p:last-child { margin-bottom: 0; }
    .pv-cta { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 22px 24px; border-radius: 16px;
      background:linear-gradient(135deg, var(--deep-bg), var(--navy-bg)); color: #fff; }
    .pv-cta b { font: 800 16px Montserrat, sans-serif; display: block; margin-bottom: 4px; }
    .pv-cta span { color: #cfe1f2; font-size: 13px; }
    .pv-cta a { background: var(--mint); color: var(--deep); font-weight: 800; font-size: 13px; padding: 11px 18px; border-radius: 10px; text-decoration: none; }
    @media (max-width: 860px) {
      .pv-layout { grid-template-columns: 1fr; }
      .pv-toc { position: static; }
      .pv-sec { padding: 18px; }
    }
  `],
  template: `
    <section class="page-section">
      <header class="pv-head">
        <span class="section-kicker">{{ t('VIE PRIVÉE', 'الخصوصية') }}</span>
        <h1>{{ t('Politique de confidentialité', 'سياسة الخصوصية') }}</h1>
        <p>{{ t('Vos données de santé vous appartiennent. Voici, en langage clair, ce que SehhaTN en fait — et ce qu’il n’en fait jamais.',
                'بياناتك الصحية ملك لك. إليك بلغة واضحة ما تفعله SehhaTN بها، وما لا تفعله أبداً.') }}</p>
        <span class="pv-date">{{ t('Dernière mise à jour : 22 novembre 2026', 'آخر تحديث: 22 نوفمبر 2026') }}</span>
      </header>

      <div class="pv-layout">
        <nav [attr.aria-label]="t('Sommaire', 'المحتويات')">
          <details class="pv-toc" [open]="tocOpen">
            <summary>{{ t('Sommaire', 'المحتويات') }}</summary>
            <ol>
              @for (s of sections; track s.id) {
                <li><a [href]="'#' + s.id" (click)="jump($event, s.id)">{{ t(s.title_fr, s.title_ar) }}</a></li>
              }
            </ol>
          </details>
        </nav>

        <div class="pv-body">
          @for (s of sections; track s.id) {
            <section class="pv-sec" [id]="s.id">
              <h2>{{ t(s.title_fr, s.title_ar) }}</h2>
              @for (p of (lang() === 'ar' ? s.ar : s.fr); track $index) { <p>{{ p }}</p> }
            </section>
          }
          <div class="pv-cta">
            <div>
              <b>{{ t('Une question sur vos données ?', 'سؤال حول بياناتك؟') }}</b>
              <span>{{ t('Écrivez-nous depuis la page Aide & contact, sujet « Mes données personnelles ».', 'راسلنا من صفحة المساعدة والتواصل، موضوع «بياناتي الشخصية».') }}</span>
            </div>
            <a routerLink="/aide" [queryParams]="{ topic: 'data' }">{{ t('Nous contacter', 'تواصل معنا') }} →</a>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class PrivacyComponent {
  private langService = inject(LangService);
  readonly sections = SECTIONS;
  readonly lang = this.langService.lang;
  /** Sommaire ouvert sur grand écran, replié sur mobile. */
  readonly tocOpen = typeof window === 'undefined' || window.innerWidth > 860;

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }

  jump(event: Event, id: string) {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
