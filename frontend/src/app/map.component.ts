import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, output, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';

export interface MapMarker {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  kind?: string;              // pharmacy, hospital, doctor… (couleur et pictogramme)
  href?: string;              // lien « Itinéraire » dans la bulle
  hrefLabel?: string;
}

const COLORS: Record<string, string> = {
  pharmacy: '#0a8f5a', hospital: '#c62828', clinic: '#0b5d9e', laboratory: '#7b4bb7', radiology: '#b8620a',
  health_center: '#00838f', doctor: '#0b325e', user: '#00a6b8',
};
const ICONS: Record<string, string> = {
  pharmacy: '✚', hospital: 'H', clinic: '＋', laboratory: '⚗', radiology: '◎', health_center: '⌂', doctor: '⚕',
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Carte OpenStreetMap (Leaflet, chargé à la demande dans le navigateur uniquement). */
@Component({
  selector: 'app-map',
  standalone: true,
  template: `<div #host class="map-host" [style.height]="height()" role="region" [attr.aria-label]="label()"></div>`,
  styles: [`
    :host { display: block; position: relative; z-index: 0; }
    .map-host { width: 100%; border-radius: 16px; overflow: hidden; background:var(--surface2); border: 1px solid var(--line); }
    :host ::ng-deep .sm-pin { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg); color: #fff; font: 800 13px Montserrat, sans-serif; border: 2px solid #fff; box-shadow: 0 4px 12px #0003; }
    :host ::ng-deep .sm-pin span { transform: rotate(45deg); }
    :host ::ng-deep .sm-pin.active { width: 38px; height: 38px; font-size: 16px; box-shadow: 0 0 0 5px #00a6b855, 0 6px 16px #0004; }
    :host ::ng-deep .sm-user { width: 18px; height: 18px; border-radius: 50%; background: #00a6b8; border: 3px solid #fff; box-shadow: 0 0 0 6px #00a6b840; }
    :host ::ng-deep .leaflet-popup-content { margin: 12px 14px; font: 13px/1.45 'Roboto Flex', sans-serif; }
    :host ::ng-deep .leaflet-popup-content b { color: var(--deep); display: block; font-size: 14px; }
    :host ::ng-deep .leaflet-popup-content small { color: var(--muted); display: block; margin-top: 2px; }
    :host ::ng-deep .leaflet-popup-content a { display: inline-block; margin-top: 6px; color: var(--text2); font-weight: 700; text-decoration: none; }
  `],
})
export class MapComponent implements OnDestroy {
  readonly markers = input<MapMarker[]>([]);
  readonly center = input<[number, number] | null>(null);
  readonly user = input<[number, number] | null>(null);
  readonly zoom = input(13);
  readonly height = input('360px');
  readonly label = input('Carte');
  readonly activeId = input<string | number | null>(null);
  readonly markerClick = output<string | number>();

  private host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private layer?: Leaflet.LayerGroup;
  private byId = new Map<string | number, Leaflet.Marker>();

  constructor() {
    afterNextRender(async () => {
      const mod: any = await import('leaflet');
      this.L = (mod.default ?? mod) as typeof Leaflet;
      const c = this.center() ?? [36.8065, 10.1815];
      this.map = this.L.map(this.host().nativeElement, { scrollWheelZoom: false, zoomControl: true }).setView(c, this.zoom());
      this.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);
      this.layer = this.L.layerGroup().addTo(this.map);
      this.render();
      // La carte peut naître dans un conteneur encore invisible : on recalcule sa taille.
      setTimeout(() => this.map?.invalidateSize(), 200);
    });
    effect(() => { this.markers(); this.user(); this.center(); this.render(); });
    effect(() => { const id = this.activeId(); if (id !== null) this.focus(id); });
  }

  private pin(kind = 'doctor', active = false) {
    return this.L!.divIcon({
      className: '', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28],
      html: `<div class="sm-pin${active ? ' active' : ''}" style="background:${COLORS[kind] ?? COLORS['doctor']}"><span>${ICONS[kind] ?? '•'}</span></div>`,
    });
  }

  private render() {
    if (!this.map || !this.L || !this.layer) return;
    const L = this.L;
    this.layer.clearLayers();
    this.byId.clear();
    const points: [number, number][] = [];
    for (const m of this.markers()) {
      const popup = `<b>${esc(m.title)}</b>${m.subtitle ? `<small>${esc(m.subtitle)}</small>` : ''}`
        + (m.href ? `<a href="${esc(m.href)}" target="_blank" rel="noopener">${esc(m.hrefLabel ?? 'Itinéraire')} ↗</a>` : '');
      const marker = L.marker([m.lat, m.lng], { icon: this.pin(m.kind), title: m.title, keyboard: true })
        .bindPopup(popup)
        .on('click', () => this.markerClick.emit(m.id))
        .addTo(this.layer);
      this.byId.set(m.id, marker);
      points.push([m.lat, m.lng]);
    }
    const u = this.user();
    if (u) {
      L.marker(u, { icon: L.divIcon({ className: '', html: '<div class="sm-user"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }), zIndexOffset: 1000 })
        .bindPopup('<b>Vous êtes ici</b>').addTo(this.layer);
      points.push(u);
    }
    if (points.length > 1) this.map.fitBounds(L.latLngBounds(points).pad(0.12), { maxZoom: 15 });
    else if (points.length === 1) this.map.setView(points[0], Math.max(this.zoom(), 14));
    else if (this.center()) this.map.setView(this.center()!, this.zoom());
  }

  private focus(id: string | number) {
    const m = this.byId.get(id);
    if (!m || !this.map) return;
    this.map.setView(m.getLatLng(), Math.max(this.map.getZoom(), 15), { animate: true });
    m.openPopup();
  }

  ngOnDestroy() { this.map?.remove(); }
}
