import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type Severity = 'mild' | 'moderate' | 'severe';
export type CnamTrack = 'public' | 'private' | 'reimbursement';
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;

export interface Allergy { substance: string; reaction: string | null; severity: Severity | null; }
export interface ChronicCondition { name: string; diagnosed_year: number | null; notes: string | null; }
export interface Medication { name: string; dosage: string | null; frequency: string | null; }
export interface Vaccination { vaccine: string; dose_date: string | null; notes: string | null; }
export interface EmergencyContact { name: string; relation: string | null; phone: string; }

export interface HealthCard {
  date_of_birth: string | null;
  sex: 'f' | 'm' | null;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  cnam_number: string | null;
  cnam_track: CnamTrack | null;
  insurer: string | null;
  organ_donor: boolean | null;
  smoker: boolean | null;
  notes: string | null;
  share_with_doctors: boolean;
  emergency_access_enabled?: boolean;
  emergency_token?: string | null;
  updated_at?: string | null;
  allergies: Allergy[];
  conditions: ChronicCondition[];
  medications: Medication[];
  vaccinations: Vaccination[];
  emergency_contacts: EmergencyContact[];
}

/** Carte vue par un médecin (partage autorisé par le patient). */
export type SharedHealthCard = HealthCard & { age: number | null };

/** Fiche d'urgence publique : données minimales. */
export interface EmergencyCard {
  first_name: string;
  age: number | null;
  blood_type: string | null;
  organ_donor: boolean | null;
  allergies: Allergy[];
  conditions: { name: string }[];
  medications: Medication[];
  emergency_contacts: EmergencyContact[];
  updated_at: string | null;
}

export interface AccessLogEntry { access_type: 'doctor_view' | 'emergency_view'; created_at: string; doctor_name: string | null; }

export function emptyCard(): HealthCard {
  return {
    date_of_birth: null, sex: null, blood_type: null, height_cm: null, weight_kg: null, cnam_number: null,
    cnam_track: null, insurer: null, organ_donor: null, smoker: null, notes: null, share_with_doctors: false,
    allergies: [], conditions: [], medications: [], vaccinations: [], emergency_contacts: [],
  };
}

/** Âge en années à partir d'une date AAAA-MM-JJ. */
export function ageFrom(dob: string | null): number | null {
  if (!dob) return null;
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

@Injectable({ providedIn: 'root' })
export class HealthCardService {
  private auth = inject(AuthService);

  mine() { return this.auth.request<HealthCard>('/health-card/me'); }

  /** Enregistre toute la carte (champs + listes). Seuls les champs attendus par l'API sont envoyés. */
  save(card: HealthCard) {
    const { emergency_access_enabled, emergency_token, updated_at, ...body } = card;
    return this.auth.request<HealthCard>('/health-card/me', { method: 'PUT', body: JSON.stringify(body) });
  }

  enableEmergency() {
    return this.auth.request<{ emergency_access_enabled: boolean; emergency_token: string }>('/health-card/me/emergency', { method: 'POST' });
  }
  disableEmergency() {
    return this.auth.request<{ emergency_access_enabled: boolean }>('/health-card/me/emergency', { method: 'DELETE' });
  }
  accessLog() { return this.auth.request<AccessLogEntry[]>('/health-card/me/access-log'); }
  emergency(token: string) { return this.auth.request<EmergencyCard>(`/health-card/emergency/${encodeURIComponent(token)}`); }
  patient(patientId: number) { return this.auth.request<SharedHealthCard>(`/health-card/patients/${patientId}`); }

  /** Téléchargement de toutes mes données (fichier JSON). */
  async exportData() {
    const data = await this.auth.request<unknown>('/auth/me/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sehhatn-mes-donnees.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Suppression définitive du compte (204 : pas de corps de réponse). */
  deleteAccount(password: string) {
    return this.auth.request<unknown>('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) });
  }
}
