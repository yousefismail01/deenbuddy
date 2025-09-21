import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
  { path: 'info', canActivate: [authGuard], loadComponent: () => import('./pages/info/info.component').then(m => m.InfoComponent) },
  { path: '**', redirectTo: '' }
];
