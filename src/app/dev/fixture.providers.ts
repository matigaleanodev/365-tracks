import { DOCUMENT } from '@angular/common';
import {
  HttpErrorResponse,
  HttpResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { delay, mergeMap, of, throwError, timer } from 'rxjs';
import { isPublicationDate } from '../core/track';
import type { ErrorResponse, Track, TrackListResponse, TrackResponse } from '../core/track';

const fixtureTracks: readonly Track[] = Array.from({ length: 35 }, (_, index) => {
  const date = new Date(Date.UTC(2027, 1, 4 - index)).toISOString().slice(0, 10);
  const spotifyTrackId = 'fixture-track-' + (index + 1);
  return {
    date,
    title: index === 0 ? 'Una ventana abierta' : 'Estudio sonoro ' + (index + 1),
    artist: 'Artista de ejemplo',
    album: 'Sesiones de desarrollo',
    releaseYear: 1999,
    spotifyTrackId,
    spotifyUrl: 'https://open.spotify.com/track/' + spotifyTrackId,
    selectionCriterion: 'development-fixture',
    createdAt: date + 'T00:00:00.000Z',
    ...(index % 2 === 0
      ? {
          coverUrl: '/fixtures/cover.svg',
          description: 'Esta es una muestra ficticia para explorar la interfaz.',
        }
      : {}),
  };
});

function fixtureError(status: number, code: ErrorResponse['error']['code'], message: string) {
  const error: ErrorResponse = { error: { code, message, requestId: 'local-fixtures' } };
  return timer(350).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status, statusText: code, error }))),
  );
}

function fixtureResponse(body: TrackResponse | TrackListResponse) {
  return of(new HttpResponse({ body })).pipe(delay(350));
}

function encodeCursor(date: string): string {
  return btoa(date).replace(/=+$/, '');
}

function decodeCursor(cursor: string): string | null {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) return null;
  try {
    const date = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
    return isPublicationDate(date) && encodeCursor(date) === cursor ? date : null;
  } catch {
    return null;
  }
}

const fixtureInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.method !== 'GET' || !/^\/api\/tracks(?:\/[^/]+)?$/.test(request.url)) {
    return next(request);
  }

  const scenario = new URLSearchParams(inject(DOCUMENT).location.search).get('fixture');
  if (scenario === 'error') return fixtureError(500, 'INTERNAL_ERROR', 'Fixture server error');

  const tracks = scenario === 'empty' ? [] : fixtureTracks;
  const date = request.url.slice('/api/tracks'.length + 1);
  if (!date) {
    const rawLimit = request.params.get('limit') ?? '30';
    const limit = Number(rawLimit);
    const cursor = request.params.get('cursor');
    const before = cursor === null ? null : decodeCursor(cursor);
    if (
      !/^\d+$/.test(rawLimit) ||
      limit < 1 ||
      limit > 100 ||
      (cursor !== null && before === null)
    ) {
      return fixtureError(400, 'INVALID_QUERY_PARAMETER', 'Invalid history query');
    }
    const available = before === null ? tracks : tracks.filter((track) => track.date < before);
    const data = available.slice(0, limit);
    const last = data.at(-1);
    return fixtureResponse({
      data,
      pagination: {
        limit,
        nextCursor: available.length > limit && last ? encodeCursor(last.date) : null,
      },
    });
  }

  if (date !== 'today' && !isPublicationDate(date)) {
    return fixtureError(400, 'INVALID_DATE', 'Invalid publication date');
  }

  const track = date === 'today' ? tracks[0] : tracks.find((item) => item.date === date);
  return track
    ? fixtureResponse({ data: track })
    : fixtureError(404, 'TRACK_NOT_FOUND', 'No track published for this date');
};

export const fixtureProviders: EnvironmentProviders[] = [
  provideHttpClient(withInterceptors([fixtureInterceptor])),
];
