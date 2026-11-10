import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import { catchError, map, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import type { Track, TrackPage } from './track';
import { isPublicationDate, parseTrack, parseTrackPage } from './track';

@Injectable({ providedIn: 'root' })
export class TracksApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  today(): Observable<Track | null> {
    return this.find('today');
  }

  byDate(date: string): Observable<Track | null> {
    return isPublicationDate(date) ? this.find(date) : of(null);
  }

  history(page: number, pageSize = 12): Observable<TrackPage> {
    return this.http
      .get<unknown>(`${this.baseUrl}/tracks`, { params: { page, pageSize } })
      .pipe(map(parseTrackPage));
  }

  private find(date: string): Observable<Track | null> {
    return this.http.get<unknown>(`${this.baseUrl}/tracks/${date}`).pipe(
      map((value) => (value === null ? null : parseTrack(value))),
      catchError((error: unknown) =>
        error instanceof HttpErrorResponse && error.status === 404
          ? of(null)
          : throwError(() => error),
      ),
    );
  }
}
