import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `<section class="state-panel">
    <p class="section-label">404</p>
    <h1>Esta página no está en el disco.</h1>
    <p>Volvé a la selección del día para seguir explorando.</p>
    <a class="button primary" routerLink="/">Volver al inicio</a>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {}
