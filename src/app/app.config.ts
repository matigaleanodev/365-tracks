import type { ApplicationConfig } from '@angular/core';
import {
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es-AR';
import { routes } from './app.routes';
import { CanonicalLink } from './core/canonical-link';
import { fixtureProviders } from './core/fixture.providers';

registerLocaleData(localeEs);
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(),
    { provide: LOCALE_ID, useValue: 'es-AR' },
    provideAppInitializer(() => void inject(CanonicalLink)),
    ...fixtureProviders,
  ],
};
