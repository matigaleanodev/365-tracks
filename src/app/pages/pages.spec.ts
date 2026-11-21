import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { sampleTrack } from '../testing/sample-track';
import { parsePage } from './history-page';

describe('Public pages', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const text = () => harness.routeNativeElement?.textContent ?? '';
  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });
  afterEach(() => http.verify());

  it('shows loading, empty and populated daily selections', async () => {
    await harness.navigateByUrl('/');
    expect(text()).toContain('Buscando');
    http.expectOne((req) => req.url.endsWith('/today')).flush(null);
    harness.detectChanges();
    expect(text()).toContain('Algo bueno está por sonar');
    await harness.navigateByUrl('/tracks/2027-01-01');
    http.expectOne((req) => req.url.endsWith('/2027-01-01')).flush(sampleTrack);
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    expect(
      harness.routeNativeElement?.querySelector('a[target="_blank"]')?.getAttribute('href'),
    ).toBe(sampleTrack.spotifyUrl);
  });
  it('retries failed requests and distinguishes missing dates', async () => {
    await harness.navigateByUrl('/');
    http
      .expectOne((req) => req.url.endsWith('/today'))
      .flush(null, { status: 500, statusText: 'Error' });
    harness.detectChanges();
    expect(text()).toContain('No pudimos conectar');
    harness.routeNativeElement?.querySelector('button')?.click();
    TestBed.tick();
    http.expectOne((req) => req.url.endsWith('/today')).flush(sampleTrack);
    harness.detectChanges();
    expect(text()).toContain(sampleTrack.title);
    await harness.navigateByUrl('/tracks/invalid');
    expect(text()).toContain('Todavía no hay una canción');
  });
  it('updates a reused date route and cancels the previous request', async () => {
    await harness.navigateByUrl('/tracks/2027-01-01');
    const first = http.expectOne((req) => req.url.endsWith('/2027-01-01'));
    await harness.navigateByUrl('/tracks/2027-01-02');
    expect(first.cancelled).toBe(true);
    http
      .expectOne((req) => req.url.endsWith('/2027-01-02'))
      .flush({ ...sampleTrack, date: '2027-01-02', title: 'Second track' });
    harness.detectChanges();
    expect(text()).toContain('Second track');
  });
  it('paginates through URL query parameters', async () => {
    await harness.navigateByUrl('/history?page=2');
    http
      .expectOne((req) => req.params.get('page') === '2')
      .flush({ items: [sampleTrack], page: 2, pageSize: 12, total: 13 });
    harness.detectChanges();
    expect(text()).toContain('Página 2 de 2');
    expect(harness.routeNativeElement?.querySelector('a[href="/history?page=1"]')).toBeTruthy();
    await harness.navigateByUrl('/history?page=1');
    http
      .expectOne((req) => req.params.get('page') === '1')
      .flush({ items: [], page: 1, pageSize: 12, total: 0 });
    harness.detectChanges();
    expect(text()).toContain('El archivo empieza');
  });
  it('shows a retryable history error', async () => {
    await harness.navigateByUrl('/history');
    http
      .expectOne((req) => req.url.endsWith('/tracks'))
      .flush(null, { status: 503, statusText: 'Error' });
    harness.detectChanges();
    expect(text()).toContain('No se pudo cargar el historial');
  });
  it('renders an unknown-route page', async () => {
    await harness.navigateByUrl('/unknown');
    expect(text()).toContain('404');
  });
});

describe('History query parameters', () => {
  it('accepts only safe positive integers', () => {
    expect(parsePage('3')).toBe(3);
    for (const value of [null, '', '-1', '0', '1.5', 'Infinity', '1e2', '99999999999999999999']) {
      expect(parsePage(value)).toBe(1);
    }
  });
});
