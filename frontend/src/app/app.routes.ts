import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', children: [] },
  { path: 'doctors', pathMatch: 'full', children: [] },
  { path: 'guide', children: [] },
  { path: 'orientation', children: [] },
  { path: 'about', children: [] },
  { path: 'account', children: [] },
  {
    path: 'doctors/:id',
    loadComponent: () => import('./doctor-route.component').then((m) => m.DoctorRouteComponent),
  },
  { path: '**', redirectTo: '' },
];