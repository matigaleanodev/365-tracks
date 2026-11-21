import type { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    title: 'La canción del día · 365 Tracks',
    loadComponent: () => import('./pages/track-page').then((m) => m.TrackPage),
  },
  {
    path: 'history',
    title: 'Historial · 365 Tracks',
    loadComponent: () => import('./pages/history-page').then((m) => m.HistoryPage),
  },
  {
    path: 'tracks/:date',
    title: 'Selección del día · 365 Tracks',
    loadComponent: () => import('./pages/track-page').then((m) => m.TrackPage),
  },
  {
    path: '**',
    title: 'Página no encontrada · 365 Tracks',
    loadComponent: () => import('./pages/not-found').then((m) => m.NotFound),
  },
];
