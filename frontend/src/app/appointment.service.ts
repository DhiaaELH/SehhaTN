import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export interface Slot { starts_at: string; time: string; taken: boolean; }
export interface SlotDay { date: string; weekday: number; slots: Slot[]; }
export interface SlotsResponse { doctor_id: number; slot_minutes: number; timezone: string; days: SlotDay[]; }

export interface AvailabilityRange { weekday: number; start: string; end: string; }
export interface Availability { slot_minutes: number; ranges: AvailabilityRange[]; }

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export interface Appointment {
  id: number; starts_at: string; ends_at: string; status: AppointmentStatus;
  note: string | null; created_at: string;
  // vue patient
  doctor_id?: number; doctor_name?: string; specialty?: string; address?: string | null; city?: string; phone?: string | null;
  // vue médecin
  patient_name?: string;
}

export const WEEKDAYS_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
export const WEEKDAYS_AR = ['الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد'];

/** "lundi 16 novembre à 09:30", toujours à l'heure de Tunis. */
export function formatWhen(iso: string, lang: 'fr' | 'ar'): string {
  return new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'ar-TN', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Tunis',
  }).format(new Date(iso));
}

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private auth = inject(AuthService);

  /** Créneaux des 30 prochains jours (le serveur limite lui-même la fenêtre). */
  slots(doctorId: number) {
    const far = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);
    return this.auth.request<SlotsResponse>(`/doctors/${doctorId}/slots?to=${far}`);
  }

  availability() { return this.auth.request<Availability>('/doctors/me/availability'); }
  saveAvailability(body: Availability) {
    return this.auth.request<Availability>('/doctors/me/availability', { method: 'PUT', body: JSON.stringify(body) });
  }

  book(doctorId: number, startsAt: string, note?: string) {
    return this.auth.request<Appointment>('/appointments', {
      method: 'POST',
      body: JSON.stringify({ doctor_id: doctorId, starts_at: startsAt, ...(note ? { note } : {}) }),
    });
  }

  mine() { return this.auth.request<Appointment[]>('/appointments/me'); }
  setStatus(id: number, status: 'cancelled' | 'completed' | 'no_show') {
    return this.auth.request<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }
}