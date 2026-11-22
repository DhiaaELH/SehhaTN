import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

/** Libellés stockés en base (doctors.specialty). Le référentiel complet (arabe, icônes) vient de /api/meta/specialties. */
export const SPECIALTIES = [
  'Médecin généraliste', 'Pédiatre', 'Gynécologue', 'Cardiologue', 'Dermatologue', 'Ophtalmologue',
  'ORL', 'Dentiste', 'Orthopédiste', 'Rhumatologue', 'Neurologue', 'Psychiatre', 'Psychologue', 'Endocrinologue',
  'Gastro-entérologue', 'Pneumologue', 'Urologue', 'Néphrologue', 'Allergologue', 'Nutritionniste', 'Kinésithérapeute',
];

export const GOVERNORATES = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja', 'Jendouba',
  'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine',
  'Sidi Bouzid', 'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili',
];

export const LANGUAGES = ['Français', 'Arabe', 'Anglais'];

export interface Specialty {
  slug: string; name_fr: string; name_ar: string; icon: string | null;
  description_fr: string | null; description_ar: string | null; doctor_count: number;
}

/** Un médecin tel que le renvoie le backend. */
export interface ApiDoctor {
  id: number;
  name: string;
  specialty: string;
  governorate: string;
  city: string;
  address: string | null;
  phone: string | null;
  schedule: string | null;
  verified: boolean;
  bio: string | null;
  languages: string[];
  years_experience: number | null;
  consultation_fee: number | null;
  accepts_cnam: boolean | null;
  photo_url?: string | null;
  gender?: 'f' | 'm' | null;
  latitude?: number | null;
  longitude?: number | null;
  location_precise?: boolean;
  education?: string[];
  services?: string[];
  teleconsultation?: boolean;
  is_demo?: boolean;
  rating?: number;
  review_count?: number;
  distance_km?: number | null;
}

/** Un médecin tel que le site l'affiche. */
export type Doctor = {
  id: number;
  name: string;
  specialty: string;
  governorate: string;
  city: string;
  rating: number;
  reviews: number;
  initials: string;
  color: string;
  verified: boolean;
  address: string;
  phone: string;
  next: string;
  schedule: string;
  bio: string;
  languages: string[];
  yearsExperience: number | null;
  consultationFee: number | null;
  acceptsCnam: boolean | null;
  photo: string;
  lat: number | null;
  lng: number | null;
  locationPrecise: boolean;
  education: string[];
  services: string[];
  teleconsultation: boolean;
  isDemo: boolean;
  distanceKm: number | null;
};

const COLORS = ['#cde7e7', '#f4ded2', '#e5def5', '#dae8db', '#f5e3e9', '#e5e9cf', '#f0dfe0', '#dce7f0'];

export function initialsOf(name: string): string {
  const words = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function toDoctor(d: ApiDoctor): Doctor {
  return {
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    governorate: d.governorate,
    city: d.city,
    rating: d.rating ?? 0,
    reviews: d.review_count ?? 0,
    initials: initialsOf(d.name),
    color: COLORS[d.id % COLORS.length],
    verified: d.verified,
    address: d.address || d.city,
    phone: d.phone || '',
    next: '',
    schedule: d.schedule || '',
    bio: d.bio || '',
    languages: d.languages ?? [],
    yearsExperience: d.years_experience,
    consultationFee: d.consultation_fee,
    acceptsCnam: d.accepts_cnam,
    photo: d.photo_url || '',
    lat: d.latitude ?? null,
    lng: d.longitude ?? null,
    locationPrecise: !!d.location_precise,
    education: d.education ?? [],
    services: d.services ?? [],
    teleconsultation: !!d.teleconsultation,
    isDemo: !!d.is_demo,
    distanceKm: d.distance_km ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private auth = inject(AuthService);

  /** La liste des médecins venant de la base de données. */
  readonly doctors = signal<Doctor[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  /** Position utilisée pour le tri « près de moi » (null = tri alphabétique). */
  readonly near = signal<{ lat: number; lng: number } | null>(null);
  readonly specialties = signal<Specialty[]>([]);

  constructor() {
    this.load();
    this.auth.request<Specialty[]>('/meta/specialties').then((s) => this.specialties.set(s)).catch(() => {});
  }

  async load(near: { lat: number; lng: number } | null = this.near()) {
    this.loading.set(true);
    this.error.set('');
    this.near.set(near);
    try {
      const qs = near ? `?lat=${near.lat}&lng=${near.lng}&sort=distance` : '';
      const rows = await this.auth.request<ApiDoctor[]>('/doctors' + qs);
      this.doctors.set(rows.map(toDoctor));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.loading.set(false);
    }
  }

  async getById(id: number): Promise<Doctor> {
    // Toujours relire la fiche : la liste peut être ancienne (note, horaires…)
    try { return toDoctor(await this.auth.request<ApiDoctor>(`/doctors/${id}`)); }
    catch (e) { const cached = this.doctors().find((d) => d.id === id); if (cached) return cached; throw e; }
  }

  specialtyLabel(nameFr: string, lang: 'fr' | 'ar') {
    if (lang === 'fr') return nameFr;
    return this.specialties().find((s) => s.name_fr === nameFr)?.name_ar ?? nameFr;
  }
}

/** Position du navigateur (demandée uniquement sur action de l'utilisateur). */
export function currentPosition(timeoutMs = 12000): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!globalThis.navigator?.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 5 * 60 * 1000 },
    );
  });
}
