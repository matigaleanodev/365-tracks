import { HttpResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import type { EnvironmentProviders } from '@angular/core';
import { delay, of } from 'rxjs';
import type { Track } from '../core/track';

export const fixtureTracks: readonly Track[] = Array.from({ length: 15 }, (_, index) => ({
  date: `2027-01-${String(15 - index).padStart(2, '0')}`,
  title: index === 0 ? 'Una ventana abierta' : `Estudio sonoro ${15 - index}`,
  artist: 'Artista de ejemplo',
  album: 'Sesiones de desarrollo',
  coverUrl: '/fixtures/cover.svg',
  spotifyUrl: null,
  description:
    'Esta es una muestra ficticia para explorar la interfaz. La selección diaria real comenzará el 1 de enero de 2027. Estos datos no representan una publicación musical.',
}));

export const fixtureProviders: EnvironmentProviders[] = [
  provideHttpClient(
    withInterceptors([
      (request, next) => {
        if (!request.url.startsWith('/api/tracks')) return next(request);
        const date = request.url.split('/').at(-1);
        const page = Number(request.params.get('page') ?? 1);
        const pageSize = Number(request.params.get('pageSize') ?? 12);
        const history = fixtureTracks.slice(1);
        const body =
          date === 'tracks'
            ? {
                items: history.slice((page - 1) * pageSize, page * pageSize),
                page,
                pageSize,
                total: history.length,
              }
            : date === 'today'
              ? fixtureTracks[0]
              : (fixtureTracks.find((track) => track.date === date) ?? null);
        return of(new HttpResponse({ body })).pipe(delay(350));
      },
    ]),
  ),
];
