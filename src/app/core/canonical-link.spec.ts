import { Component, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NotFound } from '../pages/not-found';
import { CanonicalLink } from './canonical-link';

@Component({ template: '' })
class Blank {}

describe('CanonicalLink', () => {
  let document: Document;
  const canonical = () =>
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null;
  const robots = () =>
    document.head.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: Blank },
          { path: 'history', component: Blank },
          { path: 'tracks/:date', component: Blank },
        ]),
      ],
    });
    document = TestBed.inject(DOCUMENT);
    TestBed.inject(CanonicalLink);
  });

  afterEach(() => document.head.querySelector('link[rel="canonical"]')?.remove());

  it('declares the served origin and route without query or fragment after navigation', async () => {
    const router = TestBed.inject(Router);
    const origin = document.location.origin;

    await router.navigateByUrl('/tracks/2027-01-05?timezone=UTC#nota');
    expect(canonical()).toBe(`${origin}/tracks/2027-01-05`);

    await router.navigateByUrl('/history?cursor=abc');
    expect(canonical()).toBe(`${origin}/history`);

    await router.navigateByUrl('/');
    expect(canonical()).toBe(`${origin}/`);
    expect(document.head.querySelectorAll('link[rel="canonical"]').length).toBe(1);
  });

  it('marks the 404 view as noindex without a canonical URL, and restores both on leaving', () => {
    const links = TestBed.inject(CanonicalLink);
    links.update('/history');

    const fixture = TestBed.createComponent(NotFound);
    links.update('/no-existe');
    expect(robots()).toBe('noindex');
    expect(canonical()).toBeNull();

    fixture.destroy();
    links.update('/');
    expect(robots()).toBeNull();
    expect(canonical()).toBe(`${document.location.origin}/`);
  });
});
