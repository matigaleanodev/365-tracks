import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { TracksApi } from './tracks-api';
import { parseTrack, parseTrackPage, isPublicationDate } from './track';

import { sampleTrack } from '../testing/sample-track';

describe('TracksApi', () => {
  let api: TracksApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(TracksApi);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads today from the API without choosing a local date', () => {
    let track: unknown;
    api.today().subscribe((value) => (track = value));
    http.expectOne(`${environment.apiBaseUrl}/tracks/today`).flush(sampleTrack);
    expect(track).toEqual(sampleTrack);
  });
  it('maps 404 and null responses to an unpublished date', () => {
    const values: unknown[] = [];
    api.byDate('2027-01-02').subscribe((value) => values.push(value));
    http
      .expectOne(`${environment.apiBaseUrl}/tracks/2027-01-02`)
      .flush(null, { status: 404, statusText: 'Not Found' });
    api.today().subscribe((value) => values.push(value));
    http.expectOne(`${environment.apiBaseUrl}/tracks/today`).flush(null);
    expect(values).toEqual([null, null]);
  });
  it('keeps server failures distinct from missing songs', () => {
    const error = vi.fn();
    api.today().subscribe({ error });
    http
      .expectOne(`${environment.apiBaseUrl}/tracks/today`)
      .flush(null, { status: 503, statusText: 'Unavailable' });
    expect(error).toHaveBeenCalledOnce();
  });
  it('does not request impossible dates', () => {
    let value: unknown;
    api.byDate('2027-02-30').subscribe((track) => (value = track));
    expect(value).toBeNull();
    http.expectNone(() => true);
  });
  it('sends pagination parameters and parses the page', () => {
    let response: unknown;
    api.history(2).subscribe((value) => (response = value));
    const request = http.expectOne((req) => req.url === `${environment.apiBaseUrl}/tracks`);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('12');
    request.flush({ items: [sampleTrack], page: 2, pageSize: 12, total: 13 });
    expect(response).toEqual({ items: [sampleTrack], page: 2, pageSize: 12, total: 13 });
  });
  it('rejects malformed responses', () => {
    const error = vi.fn();
    api.today().subscribe({ error });
    http.expectOne(`${environment.apiBaseUrl}/tracks/today`).flush({ title: 'Incomplete' });
    expect(error).toHaveBeenCalledOnce();
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
      expect(() => parseTrack({ ...sampleTrack, spotifyUrl })).toThrow();
    }
    expect(() => parseTrack({ ...sampleTrack, coverUrl: 'http://example.com/cover' })).toThrow();
  });
  it('rejects invalid pagination metadata', () => {
    expect(() => parseTrackPage({ items: [], page: 1, pageSize: 0, total: 1 })).toThrow();
    expect(() => parseTrackPage({ items: [{}], page: 1, pageSize: 12, total: 1 })).toThrow();
  });
});
