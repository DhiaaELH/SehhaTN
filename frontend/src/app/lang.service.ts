import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LangService {
  readonly lang = signal<'fr' | 'ar'>('fr');
}