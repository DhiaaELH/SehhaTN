import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export const SPECIALTIES = [
  'Médecin généraliste', 'Pédiatre', 'Gynécologue', 'Cardiologue', 'Dermatologue', 'Ophtalmologue',
  'ORL', 'Dentiste', 'Orthopédiste', 'Neurologue', 'Psychiatre', 'Endocrinologue',
  'Gastro-entérologue', 'Pneumologue',
];

export const GOVERNORATES = [
  'Tunis', 'Ariana', 'Ben Arous', 'Manouba', 'Nabeul', 'Zaghouan', 'Bizerte', 'Béja', 'Jendouba',
  'Le Kef', 'Siliana', 'Sousse', 'Monastir', 'Mahdia', 'Sfax', 'Kairouan', 'Kasserine',
  'Sidi Bouzid', 'Gabès', 'Médenine', 'Tataouine', 'Gafsa', 'Tozeur', 'Kébili',
];

export const LANGUAGES = ['Français', 'Arabe', 'Anglais'];

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
}

/** Un médecin tel que le site l'affiche. */
export type Doctor = {
  id: number;
  name: string;
  specialty: string;
  governorate: string;
  city: string;
  rating: number;     // viendra des avis plus tard (0 pour l'instant)
  reviews: number;    // idem
  initials: string;
  color: string;
  verified: boolean;
  address: string;
  phone: string;
  next: string;       // viendra des rendez-vous plus tard
  schedule: string;
  bio: string;
  languages: string[];
  yearsExperience: number | null;
  consultationFee: number | null;
  acceptsCnam: boolean | null;
};

const COLORS = ['#cde7e7', '#f4ded2', '#e5def5', '#dae8db', '#f5e3e9', '#e5e9cf', '#f0dfe0', '#dce7f0'];

function initialsOf(name: string): string {
  const words = name.replace(/^Dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || '?';
}

function toDoctor(d: ApiDoctor): Doctor {
  return {
    id: d.id,
    name: d.name,
    specialty: d.specialty,
    governorate: d.governorate,
    city: d.city,
    rating: 0,
    reviews: 0,
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
  };
}

@Injectable({ providedIn: 'root' })
export class DoctorService {
  private auth = inject(AuthService);

  /** La liste des médecins venant de la base de données. */
  readonly doctors = signal<Doctor[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const rows = await this.auth.request<ApiDoctor[]>('/doctors');
      this.doctors.set(rows.map(toDoctor));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      this.loading.set(false);
    }
  }
}
