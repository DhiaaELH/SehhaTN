import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from './auth.service';
import { currentPosition } from './doctor.service';
import { MapComponent, MapMarker } from './map.component';
import { LangService } from './lang.service';

type FType = 'pharmacy' | 'clinic' | 'hospital' | 'laboratory' | 'radiology' | 'health_center';
interface Place {
  id: number | string; source: 'sehhatn' | 'osm'; type: FType; name: string; name_ar?: string | null;
  governorate?: string; city?: string; address: string | null; phone: string | null; website?: string | null;
  latitude: number; longitude: number; open_24h: boolean; has_emergency: boolean; opening_hours: string | null;
  services?: string[]; accepts_cnam?: boolean | null; photo_url?: string | null; description?: string | null;
  is_public?: boolean; is_demo?: boolean; osm_url?: string; distance_km: number;
}
interface Nearby { center: { lat: number; lng: number }; radius_km: number; osm: string; items: Place[] }

const FILTERS: { key: string; icon: string; fr: string; ar: string; types: FType[]; open24?: boolean; emergency?: boolean }[] = [
  { key: 'all', icon: '✚', fr: 'Tout', ar: 'الكل', types: ['pharmacy', 'clinic', 'hospital', 'laboratory', 'radiology', 'health_center'] },
  { key: 'pharmacy', icon: '⚕', fr: 'Pharmacies', ar: 'الصيدليات', types: ['pharmacy'] },
  { key: 'night', icon: '☾', fr: 'Pharmacies de nuit', ar: 'صيدليات الليل', types: ['pharmacy'], open24: true },
  { key: 'hospital', icon: 'H', fr: 'Urgences & hôpitaux', ar: 'المستشفيات والاستعجالي', types: ['hospital', 'clinic'], emergency: true },
  { key: 'clinic', icon: '＋', fr: 'Cliniques', ar: 'المصحات', types: ['clinic'] },
  { key: 'laboratory', icon: '⚗', fr: 'Laboratoires', ar: 'المخابر', types: ['laboratory'] },
  { key: 'radiology', icon: '◎', fr: 'Radiologie', ar: 'الأشعة', types: ['radiology'] },
  { key: 'health_center', icon: '⌂', fr: 'Centres de santé', ar: 'المراكز الصحية', types: ['health_center'] },
];
const TYPE_LABEL: Record<FType, [string, string]> = {
  pharmacy: ['Pharmacie', 'صيدلية'], clinic: ['Clinique', 'مصحة'], hospital: ['Hôpital', 'مستشفى'],
  laboratory: ['Laboratoire', 'مخبر'], radiology: ['Centre de radiologie', 'مركز أشعة'], health_center: ['Centre de santé', 'مركز صحي'],
};
const FALLBACK_PHOTO: Record<FType, string> = {
  pharmacy: 'https://images.unsplash.com/photo-1765031092161-a9ebe556117e?auto=format&fit=crop&w=900&q=80',
  clinic: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=900&q=80',
  hospital: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=900&q=80',
  laboratory: 'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=900&q=80',
  radiology: 'https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=900&q=80',
  health_center: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=900&q=80',
};

@Component({
  selector: 'app-facilities',
  standalone: true,
  imports: [FormsModule, MapComponent],
  template: `
<section class="page-section facilities-page">
  <div class="page-intro"><div><span class="section-kicker">{{ tr('SERVICES DE SANTÉ EN TUNISIE','الخدمات الصحية في تونس') }}</span><h1>{{ tr('Les soins utiles, près de vous.','الرعاية الصحية بالقرب منك.') }}</h1><p>{{ tr('Pharmacies, pharmacies de nuit, urgences, cliniques, laboratoires et radiologie : trouvez le plus proche en un geste.','الصيدليات وصيدليات الليل والاستعجالي والمصحات والمخابر ومراكز الأشعة: اعثر على الأقرب بنقرة واحدة.') }}</p></div><div class="page-intro-icon">⌖</div></div>

  <div class="fx-search">
    <button class="primary-btn fx-locate" (click)="locate()" [disabled]="locating()">{{ locating() ? tr('Localisation…','تحديد الموقع…') : tr('⌖ Autour de moi','⌖ حولي') }}</button>
    <span class="fx-or">{{ tr('ou','أو') }}</span>
    <label><span aria-hidden="true">⌕</span><input [(ngModel)]="query" (keydown.enter)="searchCity()" [placeholder]="tr('Ville, quartier ou adresse (ex. Sfax, La Marsa)…','مدينة أو حي أو عنوان (مثال: صفاقس، المرسى)…')" [attr.aria-label]="tr('Rechercher un lieu','ابحث عن مكان')"></label>
    <button class="outline-btn" (click)="searchCity()" [disabled]="loading()">{{ tr('Rechercher','بحث') }}</button>
  </div>

  <div class="fx-filters" role="tablist">
    @for (f of filters; track f.key) { <button role="tab" [attr.aria-selected]="filter() === f.key" [class.selected]="filter() === f.key" (click)="setFilter(f.key)">{{ f.icon }} {{ tr(f.fr, f.ar) }}</button> }
    <select [ngModel]="radius()" (ngModelChange)="radius.set(+$event); search()" [attr.aria-label]="tr('Rayon de recherche','نطاق البحث')">
      @for (r of [2, 5, 10, 25]; track r) { <option [value]="r">{{ r }} km</option> }
    </select>
  </div>

  @if (center(); as c) { <p class="results-line">⌖ {{ c.label }} · {{ loading() ? tr('recherche…','جارٍ البحث…') : places().length + ' ' + tr('lieux dans un rayon de','مكاناً ضمن') + ' ' + radius() + ' km' }}</p> }
  @if (error()) { <div class="facility-status facility-error" role="alert">{{ error() }}</div> }
  @if (center() && !loading()) {
    <p class="fx-osm" [attr.data-s]="osm()">{{ osm() === 'loading' ? tr('Recherche complémentaire dans OpenStreetMap…','بحث إضافي في OpenStreetMap…') : osm() === 'ok' ? tr('Annuaire SehhaTN + données ouvertes OpenStreetMap','دليل SehhaTN + بيانات OpenStreetMap المفتوحة') : tr('OpenStreetMap ne répond pas pour le moment : seuls les lieux de l’annuaire SehhaTN sont affichés.','OpenStreetMap لا يستجيب حالياً: تُعرض فقط أماكن دليل SehhaTN.') }}</p>
  }
  @if (filter() === 'hospital') { <div class="fx-urgent">☎ {{ tr('Urgence vitale ? N’attendez pas : appelez le SAMU au','حالة طارئة؟ لا تنتظر: اتصل بالإسعاف على') }} <a href="tel:190">190</a></div> }

  <div class="fx-layout">
    <div class="fx-map"><app-map [markers]="markers()" [user]="userPoint()" [center]="mapCenter()" [activeId]="active()" height="min(70vh, 560px)" [label]="tr('Carte des lieux de soins','خريطة أماكن الرعاية')" (markerClick)="active.set($event)" /></div>
    <div class="fx-list">
      @for (p of places(); track p.id) {
        <article class="fx-card" [class.active]="active() === p.id" (click)="active.set(p.id)" tabindex="0" (keydown.enter)="active.set(p.id)">
          <img [src]="p.photo_url || fallback(p.type)" alt="" loading="lazy" (error)="$any($event.target).style.visibility='hidden'">
          <div class="fx-body">
            <div class="fx-head"><span class="fx-type" [attr.data-type]="p.type">{{ typeLabel(p.type) }}</span><b class="fx-dist">{{ formatDistance(p.distance_km) }}</b></div>
            <h2>{{ lang() === 'ar' && p.name_ar ? p.name_ar : p.name }}</h2>
            <div class="fx-badges">
              @if (p.open_24h) { <span class="ok">☾ 24h/24</span> }
              @if (p.has_emergency) { <span class="warn">{{ tr('Urgences','استعجالي') }}</span> }
              @if (p.accepts_cnam) { <span>CNAM</span> }
              @if (p.is_public) { <span>{{ tr('Public','عمومي') }}</span> }
              @if (p.source === 'osm') { <span class="src">OpenStreetMap</span> }
              @if (p.is_demo) { <span class="src" [title]="tr('Fiche de démonstration','بطاقة تجريبية')">{{ tr('Démo','تجريبي') }}</span> }
            </div>
            @if (p.address) { <p>⌖ {{ p.address }}</p> }
            @if (p.opening_hours) { <p>◷ {{ p.opening_hours }}</p> }
            <div class="fx-actions">
              <a class="primary-btn" [href]="directions(p)" target="_blank" rel="noopener" (click)="$event.stopPropagation()">{{ tr('Itinéraire','الاتجاهات') }} ↗</a>
              @if (p.phone) { <a class="outline-btn" [href]="tel(p.phone)" (click)="$event.stopPropagation()">☎ {{ tr('Appeler','اتصل') }}</a> }
              @if (p.osm_url) { <a class="fx-more" [href]="p.osm_url" target="_blank" rel="noopener" (click)="$event.stopPropagation()">{{ tr('Fiche OSM','بطاقة OSM') }} ↗</a> }
            </div>
          </div>
        </article>
      } @empty {
        @if (!loading()) {
          <div class="facility-empty"><span>⌖</span><h2>{{ center() ? tr('Aucun lieu trouvé dans ce rayon','لم يتم العثور على أي مكان في هذا النطاق') : tr('Où êtes-vous ?','أين أنت؟') }}</h2>
            <p>{{ center() ? tr('Élargissez le rayon ou choisissez un autre type de lieu.','وسّع النطاق أو اختر نوعاً آخر.') : tr('Utilisez « Autour de moi » ou saisissez une ville.','استخدم «حولي» أو أدخل مدينة.') }}</p></div>
        }
      }
    </div>
  </div>
  <div class="medical-note"><span>ⓘ</span><p><b>{{ tr('Vérifiez avant de vous déplacer','تحقق قبل التنقل') }}</b><br>{{ tr('Les fiches combinent l’annuaire SehhaTN et les données ouvertes © OpenStreetMap contributors. Horaires et gardes peuvent changer : appelez avant de vous déplacer. Votre position sert uniquement à calculer les distances et n’est pas enregistrée.','تجمع البطاقات بين دليل SehhaTN والبيانات المفتوحة © مساهمو OpenStreetMap. قد تتغير الأوقات والمناوبات: اتصل قبل التنقل. يُستخدم موقعك فقط لحساب المسافات ولا يتم حفظه.') }}</p></div>
</section>`,
  styles: [`
    .fx-search { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-bottom: 14px; }
    .fx-search label { flex: 1 1 260px; display: flex; align-items: center; gap: 8px; height: 46px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
    .fx-search input { border: 0; outline: 0; flex: 1; font-size: 15px; background: transparent; }
    .fx-search button { height: 46px; padding: 0 18px; border-radius: 12px; font-weight: 700; }
    .fx-locate { min-width: 160px; }
    .fx-or { color: var(--muted); font-size: 13px; }
    @media (max-width: 480px) { .fx-or { display: none; } }
    .fx-filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; align-items: center; }
    .fx-filters button { border: 1px solid var(--line); background: #fff; color: var(--navy); border-radius: 999px; padding: 7px 13px; font-weight: 600; font-size: 13px; }
    .fx-filters button.selected { background: var(--navy); border-color: var(--navy); color: #fff; }
    .fx-filters select { margin-inline-start: auto; height: 36px; border: 1px solid var(--line); border-radius: 10px; padding: 0 8px; background: #fff; }
    .fx-osm { margin: -6px 0 12px; font-size: 12px; color: var(--muted); }
    .fx-osm[data-s="loading"]::before { content: ''; display: inline-block; width: 8px; height: 8px; margin-inline-end: 6px; border-radius: 50%; background: var(--teal); animation: fxp 1s infinite; }
    .fx-osm[data-s="unavailable"] { color: #8a5a00; }
    @keyframes fxp { 50% { opacity: .3; } }
    .fx-urgent { margin: 0 0 12px; padding: 10px 14px; border-radius: 12px; background: #fdecec; color: #8b1515; font-weight: 600; }
    .fx-urgent a { color: #b91c1c; font-weight: 800; }
    .fx-layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; align-items: start; }
    .fx-map { position: sticky; top: 90px; }
    .fx-list { display: grid; gap: 12px; }
    .fx-card { display: grid; grid-template-columns: 112px minmax(0, 1fr); gap: 14px; padding: 12px; background: #fff; border: 1.5px solid var(--line); border-radius: 16px; cursor: pointer; }
    .fx-card.active { border-color: var(--teal); box-shadow: 0 8px 22px #00a6b822; }
    .fx-card img { width: 112px; height: 100%; min-height: 112px; object-fit: cover; border-radius: 12px; background: var(--pale); }
    .fx-head { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .fx-type { font-size: 10px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: #0a8f5a; }
    .fx-type[data-type="hospital"] { color: #c62828; } .fx-type[data-type="clinic"] { color: #0b5d9e; }
    .fx-type[data-type="laboratory"] { color: #7b4bb7; } .fx-type[data-type="radiology"] { color: #b8620a; } .fx-type[data-type="health_center"] { color: #00838f; }
    .fx-dist { font: 800 14px Montserrat, sans-serif; color: var(--deep); white-space: nowrap; }
    .fx-card h2 { margin: 4px 0 6px; font: 800 15px/1.3 Montserrat, sans-serif; color: var(--deep); }
    .fx-card p { margin: 3px 0; font-size: 13px; color: #4e6278; }
    .fx-badges { display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 4px; }
    .fx-badges span { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 999px; background: var(--pale); color: var(--navy); }
    .fx-badges .ok { background: #e8f6ef; color: #0a7a55; } .fx-badges .warn { background: #fdecec; color: #b91c1c; } .fx-badges .src { background: #f1f1f1; color: #666; }
    .fx-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; align-items: center; }
    .fx-actions a { padding: 7px 12px; border-radius: 9px; font-size: 12px; font-weight: 700; text-decoration: none; }
    .fx-more { color: #078b98; }
    @media (max-width: 900px) { .fx-layout { grid-template-columns: 1fr; } .fx-map { position: static; } }
    @media (max-width: 480px) { .fx-card { grid-template-columns: 84px minmax(0, 1fr); } .fx-card img { width: 84px; min-height: 84px; } .fx-locate { flex: 1; } }
  `],
})
export class FacilitiesComponent {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  readonly lang = inject(LangService).lang;
  readonly filters = FILTERS;

  query = '';
  readonly filter = signal('all');
  readonly radius = signal(10);
  readonly center = signal<{ lat: number; lng: number; label: string } | null>(null);
  readonly userPoint = signal<[number, number] | null>(null);
  readonly places = signal<Place[]>([]);
  readonly loading = signal(false);
  readonly locating = signal(false);
  readonly error = signal('');
  readonly active = signal<string | number | null>(null);
  readonly osm = signal<'loading' | 'ok' | 'unavailable'>('loading');
  private requestId = 0;

  readonly mapCenter = computed<[number, number]>(() => { const c = this.center(); return c ? [c.lat, c.lng] : [36.8065, 10.1815]; });
  readonly markers = computed<MapMarker[]>(() => this.places().map((p) => ({
    id: p.id, lat: p.latitude, lng: p.longitude, kind: p.type, title: p.name,
    subtitle: `${this.typeLabel(p.type)} · ${this.formatDistance(p.distance_km)}`,
    href: this.directions(p), hrefLabel: this.tr('Itinéraire', 'الاتجاهات'),
  })));

  constructor() {
    // Paramètres d'URL (ex. depuis un résultat d'orientation) : ?type=hospital&near=1
    const qp = this.route.snapshot.queryParamMap;
    const type = qp.get('type');
    if (type === 'hospital' || qp.get('emergency')) this.filter.set('hospital');
    else if (type && FILTERS.some((f) => f.key === type)) this.filter.set(type);
    if (qp.get('night')) this.filter.set('night');
    const near = qp.get('near');
    effect(() => {
      this.lang();
      untracked(() => {
        if (near) this.locate();
        else if (!this.center()) { this.center.set({ lat: 36.8065, lng: 10.1815, label: this.tr('Tunis (par défaut)', 'تونس (افتراضي)') }); this.search(); }
      });
    });
  }

  tr(fr: string, ar: string) { return this.lang() === 'fr' ? fr : ar; }
  typeLabel(t: FType) { const l = TYPE_LABEL[t] ?? TYPE_LABEL.health_center; return this.tr(l[0], l[1]); }
  fallback(t: FType) { return FALLBACK_PHOTO[t] ?? FALLBACK_PHOTO.health_center; }
  formatDistance(k: number) { return k < 1 ? `${Math.round(k * 1000)} ${this.tr('m', 'م')}` : `${k.toFixed(1)} ${this.tr('km', 'كم')}`; }
  directions(p: Place) { return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`; }
  tel(phone: string) { return 'tel:' + phone.replace(/[^\d+]/g, ''); }
  setFilter(key: string) { this.filter.set(key); this.search(); }

  async locate() {
    this.locating.set(true);
    this.error.set('');
    try {
      const pos = await currentPosition();
      this.userPoint.set([pos.lat, pos.lng]);
      this.center.set({ ...pos, label: this.tr('Votre position', 'موقعك') });
      await this.search();
    } catch (e) {
      const denied = e instanceof Error && e.message === 'denied';
      this.error.set(denied
        ? this.tr('Accès à la position refusé. Autorisez-le dans votre navigateur, ou saisissez une ville.', 'تم رفض الوصول إلى الموقع. اسمح به في المتصفح أو أدخل مدينة.')
        : this.tr('Position indisponible. Saisissez une ville.', 'الموقع غير متاح. أدخل مدينة.'));
      if (!this.center()) { this.center.set({ lat: 36.8065, lng: 10.1815, label: 'Tunis' }); this.search(); }
    } finally {
      this.locating.set(false);
    }
  }

  async searchCity() {
    const q = this.query.trim();
    if (q.length < 2) { this.error.set(this.tr('Entrez une ville ou une adresse.', 'أدخل مدينة أو عنواناً.')); return; }
    this.loading.set(true);
    this.error.set('');
    try {
      const p = await this.auth.request<{ label: string; lat: number; lng: number }>(`/geo/search?q=${encodeURIComponent(q)}&lang=${this.lang()}`);
      this.userPoint.set(null);
      this.center.set({ lat: p.lat, lng: p.lng, label: p.label });
      await this.search();
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : this.tr('Lieu introuvable.', 'المكان غير موجود.'));
      this.loading.set(false);
    }
  }

  async search() {
    const c = this.center();
    if (!c) return;
    const f = FILTERS.find((x) => x.key === this.filter()) ?? FILTERS[0];
    const token = ++this.requestId;
    this.loading.set(true);
    this.error.set('');
    this.active.set(null);
    this.osm.set('loading');
    const qs = new URLSearchParams({ lat: String(c.lat), lng: String(c.lng), types: f.types.join(','), radius_km: String(this.radius()), limit: '40' });
    if (f.open24) qs.set('open_24h', 'true');
    if (f.emergency) qs.set('emergency', 'true');
    // 1. Annuaire SehhaTN : immédiat. 2. Données OpenStreetMap : ajoutées dès qu'elles arrivent (service parfois lent).
    try {
      const r = await this.auth.request<Nearby>(`/facilities/nearby?${qs}&osm=false`);
      if (token === this.requestId) this.places.set(r.items);
    } catch (e) {
      if (token === this.requestId) {
        this.places.set([]);
        this.error.set(e instanceof Error ? e.message : this.tr('Impossible de charger les lieux.', 'تعذر تحميل الأماكن.'));
      }
    } finally {
      if (token === this.requestId) this.loading.set(false);
    }
    try {
      const r = await this.auth.request<Nearby>(`/facilities/nearby?${qs}&osm=true`);
      if (token !== this.requestId) return;
      this.osm.set(r.osm === 'ok' ? 'ok' : 'unavailable');
      if (r.osm === 'ok') this.places.set(r.items);
    } catch {
      if (token === this.requestId) this.osm.set('unavailable');
    }
  }
}
