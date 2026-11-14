import { Component, computed, input, output, signal } from '@angular/core';
import type { Doctor } from './doctor.service';
import { SlotPickerComponent } from './slot-picker.component';

/** Page de profil d'un médecin. */
@Component({
  selector: 'app-doctor-page',
  standalone: true,
  imports: [SlotPickerComponent],
  styles: [`
    :host { display: block; }
    .dp-back { border: 0; background: none; color: var(--navy); font-weight: 700; font-size: 12px; cursor: pointer; padding: 6px 0; margin-bottom: 14px; }
    .dp-back span { display: inline-block; transition: transform .2s; }
    .dp-back:hover span { transform: translateX(-4px); }
    :host-context([dir=rtl]) .dp-back span { transform: scaleX(-1); }

    /* ---------- bandeau ---------- */
    .dp-hero { position: relative; overflow: hidden; border-radius: 22px; padding: 34px 36px 76px; color: #fff;
      background: radial-gradient(800px 280px at 100% 0%, #00a6b855, transparent 62%),
                  linear-gradient(135deg, var(--deep), var(--navy) 55%, #0b5d7a); }
    .dp-ecg { position: absolute; left: 0; right: 0; bottom: 58px; width: 100%; height: 76px; opacity: .55; pointer-events: none; }
    .dp-ecg path { fill: none; stroke: var(--mint); stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round;
      stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 2.6s .3s ease forwards; }
    @keyframes draw { to { stroke-dashoffset: 0; } }
    .dp-hero-main { position: relative; display: flex; align-items: center; gap: 28px; }
    .dp-avatar { width: 116px; height: 116px; border-radius: 50%; padding: 5px; flex: none;
      background: conic-gradient(from 200deg, var(--mint), var(--teal), #fff, var(--mint));
      box-shadow: 0 12px 34px #00000040; }
    .dp-avatar span { display: grid; place-items: center; width: 100%; height: 100%; border-radius: 50%;
      background: var(--tint, #cde7e7); color: var(--deep); font: 800 36px Montserrat, sans-serif; }
    .dp-chip { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase;
      padding: 5px 11px; border-radius: 999px; background: #ffffff1f; border: 1px solid #ffffff33; }
    .dp-chip-ok { background: #45d0bd33; border-color: #45d0bd88; color: #c9fff6; }
    h1 { font: 800 clamp(26px, 4vw, 38px)/1.1 Montserrat, sans-serif; margin: 12px 0 6px; color: #fff; letter-spacing: 0; }
    .dp-spec { margin: 0; color: var(--mint); font-weight: 700; font-size: 16px; }
    .dp-place { margin: 8px 0 0; color: #dbe8f5; font-size: 13px; }

    /* ---------- chiffres clés ---------- */
    .dp-tiles { position: relative; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: -46px 24px 0; }
    .dp-tile { display: flex; align-items: center; gap: 12px; background: #fff; border: 1px solid var(--line); border-radius: 14px;
      padding: 14px 16px; box-shadow: 0 10px 28px #0b325e1a; }
    .dp-tile svg { width: 38px; height: 38px; flex: none; padding: 9px; border-radius: 11px; background: #e7f5f4; color: #078b98;
      fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .dp-tile small { display: block; color: var(--muted); font-size: 10px; letter-spacing: .05em; text-transform: uppercase; }
    .dp-tile b { font: 800 15px Montserrat, sans-serif; color: var(--deep); }

    /* ---------- contenu ---------- */
    .dp-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 20px; margin-top: 22px; align-items: start; }
    .dp-main-col { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); }
    .dp-card { background: #fff; border: 1px solid var(--line); border-radius: 16px; padding: 24px; box-shadow: 0 8px 28px #17395b0d; }
    h2 { display: flex; align-items: center; gap: 10px; margin: 0 0 14px; font: 800 17px Montserrat, sans-serif; color: var(--deep); }
    h2::before { content: ''; width: 5px; height: 18px; border-radius: 3px; background: linear-gradient(var(--teal), var(--mint)); }
    .dp-bio { margin: 0; color: #3b4d61; line-height: 1.75; font-size: 14px; }
    .dp-muted { color: var(--muted); font-size: 13px; margin: 0; }
    .dp-langs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .dp-lang { padding: 6px 13px; border-radius: 999px; background: var(--pale); color: var(--navy); font-weight: 700; font-size: 12px; }

    .dp-hours { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
    .dp-hours li { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 12px 14px; border-radius: 12px; background: #f6f9fe; }
    .dp-days { min-width: 120px; font-weight: 800; color: var(--deep); font-size: 13px; }
    .dp-slot { padding: 5px 11px; border-radius: 8px; background: #fff; border: 1px solid var(--line); font-weight: 700; font-size: 12px; color: #078b98; }

    .dp-stars { color: #c5d3e2; font-size: 26px; letter-spacing: 4px; }
    .dp-empty { display: flex; align-items: center; gap: 18px; padding: 8px 0; }
    .dp-empty p { margin: 4px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; max-width: 46ch; }
    .dp-empty strong { color: var(--deep); font-size: 14px; }

    /* ---------- carte de contact ---------- */
    .dp-side { position: sticky; top: 96px; }
    .dp-book { display: grid; gap: 10px; }
    .dp-price { display: flex; align-items: baseline; justify-content: space-between; padding-bottom: 14px; border-bottom: 1px dashed var(--line); }
    .dp-price span { color: var(--muted); font-size: 12px; }
    .dp-price b { font: 800 26px Montserrat, sans-serif; color: var(--deep); }
    .dp-price b small { font-size: 13px; color: var(--muted); font-weight: 700; }
    .dp-btn { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 44px; border-radius: 10px;
      font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; border: 1px solid transparent; transition: transform .15s, box-shadow .15s, background .2s; }
    .dp-btn:hover { transform: translateY(-1px); }
    .dp-btn-main { background: linear-gradient(135deg, var(--navy), #0d5781); color: #fff; box-shadow: 0 8px 20px #0b325e33; }
    .dp-btn-soft { background: #fff; color: var(--navy); border-color: var(--line); }
    .dp-btn-soft:hover { background: var(--pale); }
    .dp-notice { margin: 0; padding: 10px 12px; border-radius: 10px; background: #fff7e6; color: #8a5a00; font-size: 12px; line-height: 1.5; }
    .dp-address { margin: 6px 0 0; padding-top: 14px; border-top: 1px dashed var(--line); color: #3b4d61; font-size: 12px; line-height: 1.6; }
    .dp-address a { display: inline-block; margin-top: 6px; color: #078b98; font-weight: 700; text-decoration: none; }
    .dp-address a:hover { text-decoration: underline; }
    .dp-address b { display: block; color: var(--deep); font-size: 11px; letter-spacing: .05em; text-transform: uppercase; margin-bottom: 4px; }

    /* ---------- apparition douce ---------- */
    .dp-rise { animation: rise .6s ease both; }
    .dp-d1 { animation-delay: .05s; } .dp-d2 { animation-delay: .15s; } .dp-d3 { animation-delay: .25s; } .dp-d4 { animation-delay: .35s; }
    @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .dp-rise, .dp-ecg path { animation: none; stroke-dashoffset: 0; } }

    @media (max-width: 860px) {
      .dp-ecg { display: none; }
      .dp-layout { grid-template-columns: 1fr; }
      .dp-side { position: static; order: -1; }
      .dp-hero { padding: 26px 22px 72px; }
      .dp-hero-main { flex-direction: column; align-items: flex-start; gap: 18px; }
      .dp-tiles { margin: -46px 12px 0; }
      .dp-days { min-width: 100%; }
    }
  `],
  template: `
    <div class="page-section">
      <button class="dp-back" (click)="back.emit()"><span aria-hidden="true">←</span> {{ t('Retour à l’annuaire', 'العودة إلى الدليل') }}</button>

      <div class="dp-hero dp-rise">
        <svg class="dp-ecg" viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength="1" d="M0 74 H250 L282 74 L302 24 L330 110 L354 46 L372 74 H800" />
        </svg>
        <div class="dp-hero-main">
          <div class="dp-avatar" [style.--tint]="doctor().color"><span>{{ doctor().initials }}</span></div>
          <div>
            @if (doctor().verified) {
              <span class="dp-chip dp-chip-ok">✓ {{ t('Profil vérifié', 'ملف موثق') }}</span>
            } @else {
              <span class="dp-chip">{{ t('Profil en attente de vérification', 'ملف قيد التحقق') }}</span>
            }
            <h1>{{ doctor().name }}</h1>
            <p class="dp-spec">{{ doctor().specialty }}</p>
            <p class="dp-place">⌖ {{ doctor().city }}, {{ doctor().governorate }} · {{ t('Tunisie', 'تونس') }}</p>
          </div>
        </div>
      </div>

      <section class="dp-tiles dp-rise dp-d1">
        @if (doctor().yearsExperience !== null) {
          <div class="dp-tile">
            <svg viewBox="0 0 24 24"><path d="M4 8h16v11H4z"/><path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M4 13h16"/></svg>
            <div><small>{{ t('Expérience', 'الخبرة') }}</small><b>{{ doctor().yearsExperience }} {{ t('ans', 'سنة') }}</b></div>
          </div>
        }
        @if (doctor().consultationFee !== null) {
          <div class="dp-tile">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 11h6"/></svg>
            <div><small>{{ t('Consultation', 'الاستشارة') }}</small><b>{{ doctor().consultationFee }} DT</b></div>
          </div>
        }
        @if (doctor().acceptsCnam !== null) {
          <div class="dp-tile">
            <svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>
            <div><small>CNAM</small><b>{{ doctor().acceptsCnam ? t('Conventionné', 'متعاقد') : t('Non conventionné', 'غير متعاقد') }}</b></div>
          </div>
        }
        @if (doctor().languages.length) {
          <div class="dp-tile">
            <svg viewBox="0 0 24 24"><path d="M4 5h16v10H9l-5 4z"/></svg>
            <div><small>{{ t('Langues', 'اللغات') }}</small><b>{{ langCodes() }}</b></div>
          </div>
        }
      </section>

      <div class="dp-layout">
        <div class="dp-main-col">
          <article class="dp-card dp-rise dp-d2">
            <h2>{{ t('À propos', 'نبذة') }}</h2>
            @if (doctor().bio) { <p class="dp-bio">{{ doctor().bio }}</p> }
            @else { <p class="dp-muted">{{ t('Ce médecin n’a pas encore ajouté de présentation.', 'لم يضف هذا الطبيب تقديماً بعد.') }}</p> }
            @if (doctor().languages.length) {
              <div class="dp-langs">
                @for (l of doctor().languages; track l) { <span class="dp-lang">{{ l }}</span> }
              </div>
            }
          </article>
    
                  <app-slot-picker #picker id="rdv" class="dp-rise dp-d3" [style.display]="booking() ? null : 'none'"
                 [doctorId]="doctor().id" [lang]="lang()" (closed)="booking.set(false)" />

        @if (picker.status() === 'none') {
          <article class="dp-card dp-rise dp-d3">
            <h2>{{ t('Horaires de consultation', 'أوقات الاستشارة') }}</h2>
            @if (rows().length) {
              <ul class="dp-hours">
                @for (r of rows(); track r.days) {
                  <li>
                    <span class="dp-days">{{ r.days }}</span>
                    @for (h of r.hours; track h) { <span class="dp-slot">{{ h }}</span> }
                  </li>
                }
              </ul>
            } @else { <p class="dp-muted">{{ t('Horaires non communiqués.', 'لم يتم تحديد الأوقات.') }}</p> }
          </article>
        }


          <article class="dp-card dp-rise dp-d4">
            <h2>{{ t('Avis des patients', 'آراء المرضى') }}</h2>
            <div class="dp-empty">
              <span class="dp-stars" aria-hidden="true">★★★★★</span>
              <div>
                <strong>{{ t('Pas encore d’avis', 'لا توجد آراء بعد') }}</strong>
                <p>{{ t('Les patients connectés pourront bientôt partager leur expérience, un avis par médecin.', 'سيتمكن المرضى المسجلون قريباً من مشاركة تجربتهم، رأي واحد لكل طبيب.') }}</p>
              </div>
            </div>
          </article>
        </div>

        <aside class="dp-side dp-rise dp-d2">
          <div class="dp-card dp-book">
            <div class="dp-price">
              <span>{{ t('Consultation', 'الاستشارة') }}</span>
              @if (doctor().consultationFee !== null) { <b>{{ doctor().consultationFee }} <small>DT</small></b> }
              @else { <span>{{ t('Tarif non communiqué', 'السعر غير محدد') }}</span> }
            </div>
            <button class="dp-btn dp-btn-main" (click)="openBooking()">
              {{ t('Prendre rendez-vous', 'حجز موعد') }}
            </button>
            <button class="dp-btn dp-btn-soft" (click)="soon(t('La messagerie arrive bientôt.', 'المراسلة قريباً.'))">
              {{ t('Envoyer un message', 'إرسال رسالة') }}
            </button>
            @if (phoneHref()) {
              <a class="dp-btn dp-btn-soft" [href]="phoneHref()">☎ {{ doctor().phone }}</a>
            }
            @if (notice()) { <p class="dp-notice" role="status">{{ notice() }}</p> }
            <p class="dp-address">
              <b>{{ t('Cabinet', 'العيادة') }}</b>
              {{ doctor().address }}
              <a [href]="mapsUrl()" target="_blank" rel="noopener noreferrer">{{ t('Voir l’itinéraire ↗', 'عرض الطريق ↗') }}</a>
            </p>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class DoctorPageComponent {
  readonly booking = signal(false);
openBooking() {
  this.booking.set(true);
  setTimeout(() => document.getElementById('rdv')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
}
  readonly doctor = input.required<Doctor>();
  readonly lang = input<'fr' | 'ar'>('fr');
  readonly back = output<void>();
  readonly notice = signal('');

  t(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }

  readonly langCodes = computed(() =>
    this.doctor().languages.map((l) => ({ 'Français': 'FR', 'Arabe': 'AR', 'Anglais': 'EN' } as Record<string, string>)[l] ?? l).join(' · '));

  soon(message: string) { this.notice.set(message); }

  readonly phoneHref = computed(() => {
    const digits = this.doctor().phone.replace(/[^\d+]/g, '');
    return digits ? 'tel:' + digits : '';
  });

  readonly mapsUrl = computed(() => {
    const d = this.doctor();
    const query = [d.address, d.city, 'Tunisie'].filter(Boolean).join(', ');
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
  });

  /** "Lun–Ven 09:00–17:00 · Sam 09:00–12:00"  ->  une ligne par groupe de jours. */
  readonly rows = computed(() => {
    const out: { days: string; hours: string[] }[] = [];
    for (const part of this.doctor().schedule.split('·').map((p) => p.trim()).filter(Boolean)) {
      const m = part.match(/^(\D+?)\s+(\d.*)$/);
      if (m) out.push({ days: m[1], hours: [m[2]] });
      else if (/^\d/.test(part) && out.length) out[out.length - 1].hours.push(part);
      else out.push({ days: part, hours: [] });
    }
    return out;
  });
}
