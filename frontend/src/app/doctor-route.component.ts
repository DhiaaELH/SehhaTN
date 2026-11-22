import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError } from './auth.service';
import { DoctorPageComponent } from './doctor-page.component';
import { DoctorService, type Doctor } from './doctor.service';
import { LangService } from './lang.service';

@Component({
  selector: 'app-doctor-route',
  standalone: true,
  imports: [DoctorPageComponent],
  template: `
    @if (doctor(); as d) {
      <app-doctor-page [doctor]="d" [lang]="langService.lang()" (back)="back()" />
    } @else {
      <section class="page-section">
        @if (notFound()) {
          <p>{{ langService.lang() === 'fr' ? 'Médecin introuvable.' : 'الطبيب غير موجود.' }}</p>
          <button class="outline-btn" (click)="back()">
            {{ langService.lang() === 'fr' ? 'Retour à l’annuaire' : 'العودة إلى الدليل' }}
          </button>
        } @else {
          <p>{{ langService.lang() === 'fr' ? 'Chargement…' : 'جارٍ التحميل…' }}</p>
        }
      </section>
    }
  `,
})
export class DoctorRouteComponent {
  private doctors = inject(DoctorService);
  private router = inject(Router);
  readonly langService = inject(LangService);

  readonly id = input.required<string>();      // filled from the :id URL segment
  readonly doctor = signal<Doctor | null>(null);
  readonly notFound = signal(false);

  constructor() {
    effect(() => {
      const id = Number(this.id());
      untracked(() => this.load(id));
    });
  }

  private async load(id: number) {
    this.doctor.set(null);
    this.notFound.set(false);
    if (!Number.isInteger(id)) return this.notFound.set(true);
    try {
      const d = await this.doctors.getById(id);
      if (Number(this.id()) === id) this.doctor.set(d);      // ignore stale answers
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) this.notFound.set(true);
      else if (Number(this.id()) === id) this.notFound.set(true);
    }
  }

  back() { this.router.navigateByUrl('/doctors'); }
}