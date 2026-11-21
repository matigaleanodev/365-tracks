import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { fixtureProviders as defaultProviders } from '../core/fixture.providers';
import { parseTrackListResponse, parseTrackResponse } from '../core/track';
import { fixtureProviders } from './fixture.providers';

describe('Fixture HTTP responses', () => {
  let http: HttpClient;
  let location: { search: string };
  const timezone = 'Pacific/Auckland';

  beforeEach(() => {
    location = { search: '' };
    TestBed.configureTestingModule({
      providers: [
        ...fixtureProviders,
        provideHttpClientTesting(),
        { provide: DOCUMENT, useValue: { location } },
      ],
    });
    http = TestBed.inject(HttpClient);
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('keeps the default provider list empty', () => {
    expect(defaultProviders).toEqual([]);
  });

  it('returns matching fixture envelopes when the requests carry a time zone', async () => {
    const params = { timezone };
    const today = parseTrackResponse(
      await firstValueFrom(http.get('/api/tracks/today', { params })),
      true,
    );
    const detail = await firstValueFrom(http.get('/api/tracks/' + today.data.date, { params }));
    expect(detail).toEqual(today);

    const first = parseTrackListResponse(
      await firstValueFrom(http.get('/api/tracks', { params })),
      true,
    );
    const cursor = first.pagination.nextCursor;
    expect(first.data).toHaveLength(30);
    expect(first.data[0]?.date).toBe(today.data.date);
    expect(first.data[1]?.coverUrl).toBeUndefined();
    expect(first.data[1]?.description).toBeUndefined();
    expect(cursor).toBeTruthy();

    const last = parseTrackListResponse(
      await firstValueFrom(http.get('/api/tracks', { params: { ...params, cursor: cursor! } })),
      true,
    );
    expect(last.data).toHaveLength(5);
    expect(last.data[0]!.date < first.data.at(-1)!.date).toBe(true);
    expect(last.pagination).toEqual({ limit: 30, nextCursor: null });
  });

  it('simulates an empty history and an unpublished song', async () => {
    location.search = '?fixture=empty';
    await expect(firstValueFrom(http.get('/api/tracks'))).resolves.toEqual({
      data: [],
      pagination: { limit: 30, nextCursor: null },
    });
    await expect(firstValueFrom(http.get('/api/tracks/today'))).rejects.toMatchObject({
      status: 404,
      error: { error: { code: 'TRACK_NOT_FOUND', requestId: 'local-fixtures' } },
    });
  });

  it('simulates invalid queries and server errors with error envelopes', async () => {
    await expect(
      firstValueFrom(http.get('/api/tracks', { params: { cursor: 'invalid' } })),
    ).rejects.toMatchObject({
      status: 400,
      error: { error: { code: 'INVALID_QUERY_PARAMETER' } },
    });
    location.search = '?fixture=error';
    await expect(firstValueFrom(http.get('/api/tracks/today'))).rejects.toMatchObject({
      status: 500,
      error: { error: { code: 'INTERNAL_ERROR' } },
    });
  });
});
