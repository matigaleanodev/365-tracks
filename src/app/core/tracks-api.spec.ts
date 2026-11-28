import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { apiError, sampleTrack, sampleTrackWithEditorial } from '../testing/sample-track';
import { isPublicationDate, parseTrackListResponse, parseTrackResponse } from './track';
import { TracksApi } from './tracks-api';

describe('TracksApi', () => {
  const api = () => TestBed.inject(TracksApi);
  let http: HttpTestingController;
  const base = environment.apiBaseUrl + '/tracks';
  const timeZone = 'America/New_York';
  const timeZoneQuery = '?timezone=' + timeZone;

  beforeEach(() => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat('en', { timeZone }).resolvedOptions(),
      timeZone,
    });
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('loads today with the browser time zone and accepts omitted optional fields', () => {
    const next = vi.fn();
    api().today().subscribe(next);
    const request = http.expectOne(base + '/today' + timeZoneQuery);
    expect(request.request.cache).toBe('no-store');
    request.flush({ data: sampleTrack });
    expect(next).toHaveBeenCalledWith(sampleTrack);
  });

  it('loads a date with optional editorial fields', () => {
    const next = vi.fn();
    api().byDate(sampleTrack.date).subscribe(next);
    http
      .expectOne(base + '/' + sampleTrack.date + timeZoneQuery)
      .flush({ data: sampleTrackWithEditorial });
    expect(next).toHaveBeenCalledWith(sampleTrackWithEditorial);
  });

  it('maps a 404 TRACK_NOT_FOUND with an optional request ID to an unpublished date', () => {
    const next = vi.fn();
    api().today().subscribe(next);
    http
      .expectOne(base + '/today' + timeZoneQuery)
      .flush(
        { error: { code: 'TRACK_NOT_FOUND', message: 'No track' } },
        { status: 404, statusText: 'Not Found' },
      );
    expect(next).toHaveBeenCalledWith(null);
  });

  it.each([
    [400, 'INVALID_DATE'],
    [404, 'ROUTE_NOT_FOUND'],
    [500, 'INTERNAL_ERROR'],
  ] as const)('propagates HTTP %i %s with its error envelope', (status, code) => {
    const error = vi.fn();
    const body = apiError(code);
    api().byDate(sampleTrack.date).subscribe({ error });
    http
      .expectOne(base + '/' + sampleTrack.date + timeZoneQuery)
      .flush(body, { status, statusText: code });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status, error: body }));
  });

  it('rejects impossible dates without making an HTTP request', () => {
    const error = vi.fn();
    api().byDate('2027-02-30').subscribe({ error });
    http.expectNone(() => true);
    expect(error).toHaveBeenCalledWith(expect.any(RangeError));
  });

  it('sends the time zone, limit and opaque cursor and parses response metadata', () => {
    const next = vi.fn();
    api().history('a+b/=').subscribe(next);
    const request = http.expectOne(base + timeZoneQuery + '&limit=30&cursor=a%2Bb/=');
    const response = { data: [sampleTrack], pagination: { limit: 30, nextCursor: null } };
    request.flush(response);
    expect(next).toHaveBeenCalledWith(response);
  });

  it('propagates invalid cursor errors', () => {
    const error = vi.fn();
    api().history('invalid').subscribe({ error });
    http
      .expectOne(base + timeZoneQuery + '&limit=30&cursor=invalid')
      .flush(apiError('INVALID_QUERY_PARAMETER'), { status: 400, statusText: 'Bad Request' });
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it.each([null, sampleTrack, { data: { title: 'Incomplete' } }])(
    'rejects malformed success responses',
    (body) => {
      const error = vi.fn();
      api().today().subscribe({ error });
      http.expectOne(base + '/today' + timeZoneQuery).flush(body);
      expect(error).toHaveBeenCalledOnce();
    },
  );

  it('sends UTC when the browser cannot determine a valid time zone', () => {
    vi.mocked(Intl.DateTimeFormat.prototype.resolvedOptions).mockReturnValue({
      ...new Intl.DateTimeFormat().resolvedOptions(),
      timeZone: 'Invalid/Zone',
    });
    api().today().subscribe();
    http.expectOne(base + '/today?timezone=UTC').flush({ data: sampleTrack });
  });
});

describe('API boundary', () => {
  it('validates calendar dates', () => {
    expect(isPublicationDate('2028-02-29')).toBe(true);
    for (const date of ['2027-02-29', '2027-13-01', 'today', '2027-1-1'])
      expect(isPublicationDate(date)).toBe(false);
  });

  it('rejects unsafe or unrelated outgoing URLs', () => {
    for (const spotifyUrl of [
      'javascript:alert(1)',
      'https://open.spotify.com.evil.test/track/1234567890123456789012',
      'https://example.com',
      'https://open.spotify.com/album/1234567890123456789012',
    ]) {
      expect(() => parseTrackResponse({ data: { ...sampleTrack, spotifyUrl } })).toThrow();
    }
    expect(() =>
      parseTrackResponse({ data: { ...sampleTrack, coverUrl: 'http://example.com/cover' } }),
    ).toThrow();
  });

  it('only accepts relative fixture artwork in fixture mode', () => {
    const response = { data: { ...sampleTrack, coverUrl: '/fixtures/cover.svg' } };
    expect(() => parseTrackResponse(response)).toThrow();
    expect(parseTrackResponse(response, true)).toEqual(response);
  });

  it.each([
    { data: [], pagination: { limit: 0, nextCursor: null } },
    { data: [], pagination: { limit: 101, nextCursor: null } },
    { data: [], pagination: { limit: 30, nextCursor: 2 } },
    { data: [], pagination: { limit: 30 } },
    { data: [{}], pagination: { limit: 30, nextCursor: null } },
  ])('rejects malformed history responses', (body) => {
    expect(() => parseTrackListResponse(body)).toThrow();
  });
});
