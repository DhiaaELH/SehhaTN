import { Routes } from '@angular/router';

/** Les pages « shell » (accueil, annuaire, à propos, compte) sont dessinées par AppComponent ;
 *  les autres sont chargées à la demande pour garder un premier chargement léger. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', children: [] },
  { path: 'doctors', pathMatch: 'full', children: [] },
  { path: 'about', children: [] },
  { path: 'account', children: [] },
  { path: 'doctors/:id', loadComponent: () => import('./doctor-route.component').then((m) => m.DoctorRouteComponent) },
  { path: 'orientation', title: 'Orientation santé — SehhaTN', loadComponent: () => import('./orientation.component').then((m) => m.OrientationComponent) },
  { path: 'assistant', title: 'Assistant santé — SehhaTN', loadComponent: () => import('./assistant.component').then((m) => m.AssistantComponent) },
  { path: 'lieux-de-sante', title: 'Pharmacies, urgences et lieux de soins — SehhaTN', loadComponent: () => import('./facilities.component').then((m) => m.FacilitiesComponent) },
  { path: 'guide', pathMatch: 'full', title: 'Guide santé — SehhaTN', loadComponent: () => import('./guide.component').then((m) => m.GuideComponent) },
  { path: 'guide/:slug', loadComponent: () => import('./condition-page.component').then((m) => m.ConditionPageComponent) },
  { path: 'confidentialite', title: 'Politique de confidentialité — SehhaTN', loadComponent: () => import('./privacy.component').then((m) => m.PrivacyComponent) },
  { path: 'aide', title: 'Aide et contact — SehhaTN', loadComponent: () => import('./help.component').then((m) => m.HelpComponent) },
  { path: 'urgence/:token', title: 'Fiche d’urgence — SehhaTN', loadComponent: () => import('./emergency-card.component').then((m) => m.EmergencyCardComponent) },
  { path: '**', redirectTo: '' },
];
