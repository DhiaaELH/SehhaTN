import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

export type AgeGroup = 'infant' | 'child' | 'adult' | 'senior';
export type Duration = 'hours' | 'days' | 'week' | 'weeks';
export type Severity = 'mild' | 'moderate' | 'severe';

export interface SuggestedDoctor {
  id: number; name: string; specialty: string; city: string; governorate: string; photo_url: string | null;
  consultation_fee: number | null; verified: boolean; teleconsultation: boolean; rating: number; review_count: number;
}
export interface Outcome {
  level: number;
  level_key: 'self_care' | 'pharmacist' | 'consult' | 'consult_today' | 'urgent' | 'emergency';
  color: string;
  title: string;
  action: string;
  reasons: string[];
  specialty: { slug: string; name: string; name_fr: string; icon: string | null } | null;
  red_flags: string[];
  advice: string[];
  watch_for: { key: string; text: string; level: number }[];
  related_conditions: { slug: string; name: string; summary: string; urgency: string }[];
  facility_type: 'hospital' | 'pharmacy' | null;
  disclaimer: string;
  doctors: SuggestedDoctor[];
}
export interface Catalog {
  levels: { level: number; key: string; color: string; title: string }[];
  global_red_flags: { key: string; question: string; level: number }[];
  categories: { key: string; icon: string; label: string; symptoms: { key: string; label: string; red_flags: string[] }[] }[];
  red_flags: Record<string, { question: string; level: number; context: string | null }>;
}
export interface QuickReply { label: string; answer: { field: string; value: unknown } }
export interface ChatTurn {
  messages: { text: string; kind?: 'urgent' | 'care' | 'normal' }[];
  quick_replies: QuickReply[];
  state: Record<string, unknown>;
  outcome?: Outcome;
}
export interface EvaluateInput {
  symptoms: string[]; red_flags: string[]; age_group: AgeGroup | null; pregnant: boolean | null;
  duration: Duration | null; severity: Severity | null; lang: 'fr' | 'ar'; governorate?: string;
}

@Injectable({ providedIn: 'root' })
export class TriageService {
  private auth = inject(AuthService);
  catalog(lang: 'fr' | 'ar') { return this.auth.request<Catalog>(`/triage/catalog?lang=${lang}`); }
  evaluate(input: EvaluateInput) {
    return this.auth.request<Outcome>('/triage/evaluate', { method: 'POST', body: JSON.stringify(input) });
  }
  chat(body: { message?: string; answer?: QuickReply['answer']; state?: Record<string, unknown>; lang: 'fr' | 'ar'; governorate?: string }) {
    return this.auth.request<ChatTurn>('/triage/chat', { method: 'POST', body: JSON.stringify(body) });
  }
}
