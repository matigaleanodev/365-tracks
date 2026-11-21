import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BrowserTimeZone } from './browser-time-zone';
import type { Track, TrackListResponse } from './track';
import {
  hasApiErrorCode,
  isPublicationDate,
  parseTrackListResponse,
  parseTrackResponse,
} from './track';

@Injectable({ providedIn: 'root' })
export class TracksApi {
  private readonly http = inject(HttpClient);
  private readonly timeZone = inject(BrowserTimeZone);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  today(): Observable<Track | null> {
    return this.find('today');
  }

  byDate(date: string): Observable<Track | null> {
    return isPublicationDate(date)
      ? this.find(date)
      : throwError(() => new RangeError('Invalid publication date'));
  }

  history(cursor: string | null = null, limit = 30): Observable<TrackListResponse> {
    let params = new HttpParams().set('timezone', this.timeZone.timeZone).set('limit', limit);
    if (cursor !== null) params = params.set('cursor', cursor);
    return this.http
      .get<unknown>(this.baseUrl + '/tracks', { params, cache: 'no-store' })
      .pipe(map((value) => parseTrackListResponse(value, environment.fixtures)));
  }

  private find(date: string): Observable<Track | null> {
    const params = new HttpParams().set('timezone', this.timeZone.timeZone);
    return this.http
      .get<unknown>(this.baseUrl + '/tracks/' + date, { params, cache: 'no-store' })
      .pipe(
        map((value) => parseTrackResponse(value, environment.fixtures).data),
        catchError((error: unknown) =>
          error instanceof HttpErrorResponse &&
          error.status === 404 &&
          hasApiErrorCode(error.error, 'TRACK_NOT_FOUND')
            ? of(null)
            : throwError(() => error),
        ),
      );
  }
}
