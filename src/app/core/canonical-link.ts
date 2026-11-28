import { DestroyRef, DOCUMENT, inject, Injectable } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Mantiene una URL canónica por ruta: el origen servido y la ruta, sin query ni fragmento. El HTML
 * estático no declara una, porque todas las rutas reciben el mismo index.html. Una vista marcada
 * como noindex (404) queda sin URL canónica.
 */
@Injectable({ providedIn: 'root' })
export class CanonicalLink {
  private readonly document = inject(DOCUMENT);

  constructor() {
    const subscription = inject(Router)
      .events.pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => this.update(event.urlAfterRedirects));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  update(url: string): void {
    const head = this.document.head;
    if (head.querySelector('meta[name="robots"][content~="noindex"]')) {
      head.querySelector('link[rel="canonical"]')?.remove();
      return;
    }
    let link = head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      head.append(link);
    }
    const path = new URL(url, 'https://route.invalid').pathname;
    link.href = this.document.location.origin + path;
  }
}
