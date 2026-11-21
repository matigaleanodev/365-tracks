import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../environments/environment';
import { routes } from '../app.routes';
import type { Track } from '../core/track';
import { apiError, sampleTrack, sampleTrackWithEditorial } from '../testing/sample-track';

describe('Public pages', () => {
  const defaultEnvironment = { ...environment };
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let document: Document;
  const timezone = 'America/New_York';
  const text = () => harness.routeNativeElement?.textContent ?? '';
  const button = () => harness.routeNativeElement?.querySelector('button');
  const historyDates = () =>
    Array.from(harness.routeNativeElement?.querySelectorAll('.history-grid time') ?? [], (date) =>
      date.getAttribute('datetime'),
    );
  const historyRequest = (cursor: string | null = null) =>
    http.expectOne(
      (req) =>
        req.url.endsWith('/tracks') &&
        req.params.get('timezone') === timezone &&
        req.params.get('limit') === '30' &&
        req.params.get('cursor') === cursor,
    );
  const historyBody = (data: Track[], nextCursor: string | null = null) => ({
    data,
    pagination: { limit: 30, nextCursor },
  });

  beforeEach(async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockReturnValue({
      ...new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions(),
      timeZone: timezone,
    });
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => {
    Object.assign(environment, defaultEnvironment);
    vi.useRealTimers();
    vi.restoreAllMocks();
    http.verify();
  });

  it('uses the API unpublished state before launch even when the UTC date is January 1', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-01T04:59:00Z'));
    await harness.navigateByUrl('/');
    expect(text()).toContain('Buscando');
    const unpublished = () =>
      http
        .expectOne((req) => req.url.endsWith('/today') && req.params.get('timezone') === timezone)
        .flush(apiError('TRACK_NOT_FOUND'), {
          status: 404,
          statusText: 'Not Found',
        });
    unpublished();
    harness.detectChanges();
    expect(text()).toContain('El calendario musical todavía no empezó');
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe('2027-01-01');
    expect(harness.routeNativeElement?.querySelector('a[href="/history"]')).toBeTruthy();

    vi.setSystemTime(new Date('2027-01-01T05:00:00Z'));
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    unpublished();
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay una canción publicada para hoy');
    expect(text()).not.toContain('El calendario musical todavía no empezó');
  });

  it('refreshes only today when a hidden tab returns on a new local date', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-01-01T04:59:00Z'));
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    const visibilityChanged = () => document.dispatchEvent(new Event('visibilitychange'));
    const today = () => http.expectOne((req) => req.url.endsWith('/today'));

    await harness.navigateByUrl('/');
    const beforeMidnight = today();
    hidden.mockReturnValue(true);
    visibilityChanged();
    vi.setSystemTime(new Date('2027-01-01T05:01:00Z'));
    http.expectNone(() => true);
    hidden.mockReturnValue(false);
    visibilityChanged();
    expect(beforeMidnight.cancelled).toBe(true);
    today().flush({ data: sampleTrack });
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('time')?.dateTime).toBe(sampleTrack.date);

    visibilityChanged();
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    http.expectNone(() => true);

    vi.setSystemTime(new Date('2027-01-02T06:00:00Z'));
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    today().flush({ data: { ...sampleTrack, date: '2027-01-02' } });

    await harness.navigateByUrl('/tracks/2027-01-01');
    http.expectOne((req) => req.url.endsWith('/2027-01-01')).flush({ data: sampleTrack });
    harness.detectChanges();
    vi.setSystemTime(new Date('2027-01-03T06:00:00Z'));
    visibilityChanged();
    document.defaultView?.dispatchEvent(new Event('pageshow'));
    http.expectNone(() => true);
    expect(text()).toContain(sampleTrack.title);
  });

  it('retries daily failures and displays the complete selection', async () => {
    await harness.navigateByUrl('/');
    http
      .expectOne((req) => req.url.endsWith('/today'))
      .flush(apiError('INTERNAL_ERROR'), {
        status: 500,
        statusText: 'Error',
      });
    harness.detectChanges();
    expect(text()).toContain('No pudimos cargar la selección');
    button()?.click();
    TestBed.tick();
    http.expectOne((req) => req.url.endsWith('/today')).flush({ data: sampleTrackWithEditorial });
    harness.detectChanges();
    for (const copy of [
      sampleTrack.title,
      sampleTrack.artist,
      sampleTrack.album,
      String(sampleTrack.releaseYear),
      sampleTrackWithEditorial.description,
    ]) {
      expect(text()).toContain(copy);
    }
    expect(harness.routeNativeElement?.querySelector('img')?.getAttribute('src')).toBe(
      sampleTrackWithEditorial.coverUrl,
    );
    const spotify = harness.routeNativeElement?.querySelector('a[target="_blank"]');
    expect(spotify?.getAttribute('href')).toBe(sampleTrack.spotifyUrl);
    expect(spotify?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(spotify?.textContent).toContain('se abre en otra pestaña');
  });

  it('distinguishes an invalid route date from an unpublished selection', async () => {
    await harness.navigateByUrl('/tracks/2027-02-30');
    expect(text()).toContain('La fecha no es válida');
    http.expectNone(() => true);

    await harness.navigateByUrl('/tracks/2027-01-02');
    http
      .expectOne((req) => req.url.endsWith('/2027-01-02'))
      .flush(apiError('TRACK_NOT_FOUND'), {
        status: 404,
        statusText: 'Not Found',
      });
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay una canción para esta fecha');
    expect(harness.routeNativeElement?.querySelector('a[href="/history"]')).toBeTruthy();
  });

  it('updates a reused date route and cancels the previous request', async () => {
    await harness.navigateByUrl('/tracks/2027-01-01');
    const first = http.expectOne((req) => req.url.endsWith('/2027-01-01'));
    await harness.navigateByUrl('/tracks/2027-01-02');
    expect(first.cancelled).toBe(true);
    http
      .expectOne((req) => req.url.endsWith('/2027-01-02'))
      .flush({ data: { ...sampleTrack, date: '2027-01-02', title: 'Second track' } });
    harness.detectChanges();
    expect(text()).toContain('Second track');
    expect(text()).not.toContain('Por qué esta canción');
    expect(harness.routeNativeElement?.querySelector('app-album-cover img')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('app-album-cover [role="img"]')).toBeTruthy();
  });

  it('appends history in received order, ignores duplicate dates and retains rows on error', async () => {
    const newest = { ...sampleTrack, date: '2027-01-03', title: 'Newest' };
    const middle = { ...sampleTrack, date: '2027-01-02', title: 'Middle' };

    await harness.navigateByUrl('/history');
    expect(text()).toContain('Cargando el historial');
    historyRequest().flush(historyBody([newest, middle], 'opaque-cursor'));
    harness.detectChanges();
    expect(historyDates()).toEqual([newest.date, middle.date]);

    const loadMore = button();
    expect(loadMore?.textContent).toContain('Cargar más canciones');
    loadMore?.click();
    loadMore?.click();
    const pending = historyRequest('opaque-cursor');
    harness.detectChanges();
    expect(historyDates()).toEqual([newest.date, middle.date]);
    expect(text()).toContain('Cargando el historial');
    pending.flush(apiError('INTERNAL_ERROR'), { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(text()).toContain('No se pudo cargar el historial');
    expect(historyDates()).toEqual([newest.date, middle.date]);

    button()?.click();
    historyRequest('opaque-cursor').flush(historyBody([middle, sampleTrack, sampleTrack]));
    harness.detectChanges();
    expect(historyDates()).toEqual([newest.date, middle.date, sampleTrack.date]);
    expect(text()).toContain('Llegaste al final');
    expect(button()).toBeNull();

    const detailLink = harness.routeNativeElement?.querySelector('a[href="/tracks/2027-01-01"]');
    expect(detailLink).toBeTruthy();
    await harness.navigateByUrl(detailLink!.getAttribute('href')!);
    http.expectOne((req) => req.url.endsWith('/2027-01-01')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelector('a[href="/history"]')).toBeTruthy();
  });

  it('renders an empty history with no continuation', async () => {
    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([]));
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay canciones publicadas');
    expect(harness.routeNativeElement?.querySelector('.history-playlists')).toBeNull();
    expect(historyDates()).toEqual([]);
    expect(button()).toBeNull();
  });

  it('shows configured annual Spotify playlists only in history', async () => {
    const url = 'https://open.spotify.com/playlist/0123456789abcdefghijkl';
    const nextUrl = 'https://open.spotify.com/playlist/abcdefghijkl0123456789';
    Object.assign(environment, {
      spotifyPlaylists: {
        '2027': url + '?si=sharing-token',
        '2028': nextUrl,
        '2029': url.replace('/playlist/', '/track/'),
        '2030': url.replace('open.spotify.com', 'open.spotify.com.example.test'),
        '2031': url.replace('https:', 'http:'),
        '2032': 'https://open.spotify.com/playlist/REPLACE_ME',
        '2033': url.replace('open.spotify.com', 'name:password@open.spotify.com'),
        '2034': ' ',
      },
    });

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([sampleTrack]));
    harness.detectChanges();
    const links = Array.from(
      harness.routeNativeElement?.querySelectorAll('.history-playlists a') ?? [],
    );
    expect(links.map((link) => link.getAttribute('href'))).toEqual([nextUrl, url]);
    expect(links[0]?.textContent).toContain('Playlist 2028 en Spotify');
    expect(links[1]?.textContent).toContain('Playlist 2027 en Spotify');
    for (const link of links) {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.textContent).toContain('se abre en otra pestaña');
    }
    expect(text()).toContain('terminó en todas las zonas horarias');

    await harness.navigateByUrl('/');
    http.expectOne((req) => req.url.endsWith('/today')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelectorAll('a[target="_blank"]')).toHaveLength(1);
    expect(
      harness.routeNativeElement?.querySelector('a[target="_blank"]')?.getAttribute('href'),
    ).toBe(sampleTrack.spotifyUrl);
  });

  it('keeps external Spotify links out of fixture mode', async () => {
    Object.assign(environment, {
      fixtures: true,
      spotifyPlaylists: { '2027': 'https://open.spotify.com/playlist/0123456789abcdefghijkl' },
    });

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([sampleTrack]));
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('.history-playlists')).toBeNull();

    await harness.navigateByUrl('/');
    http.expectOne((req) => req.url.endsWith('/today')).flush({ data: sampleTrack });
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(harness.routeNativeElement?.querySelector('a[target="_blank"]')).toBeNull();
  });

  it('cancels a pending history page on navigation and starts over on return', async () => {
    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([sampleTrack], 'opaque-cursor'));
    harness.detectChanges();
    button()?.click();
    const pending = historyRequest('opaque-cursor');

    await harness.navigateByUrl('/unknown');
    expect(text()).toContain('404');
    expect(pending.cancelled).toBe(true);

    await harness.navigateByUrl('/history');
    historyRequest().flush(historyBody([]));
    harness.detectChanges();
    expect(historyDates()).toEqual([]);
  });
});
