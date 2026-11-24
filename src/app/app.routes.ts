import type { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    title: 'La canción del día · Daywave',
    loadComponent: () => import('./pages/track-page').then((m) => m.TrackPage),
  },
  {
    path: 'history',
    title: 'Historial · Daywave',
    loadComponent: () => import('./pages/history-page').then((m) => m.HistoryPage),
  },
  {
    path: 'tracks/:date',
    title: 'Selección del día · Daywave',
    loadComponent: () => import('./pages/track-page').then((m) => m.TrackPage),
  },
  {
    path: '**',
    title: 'Página no encontrada · Daywave',
    loadComponent: () => import('./pages/not-found').then((m) => m.NotFound),
  },
];
