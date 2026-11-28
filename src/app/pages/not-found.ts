import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  viewChild,
} from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  template: `<section class="edition-rule max-w-[60rem]">
    <p class="edition-prose m-0 text-[.9375rem]/[1.3] font-bold tabular-nums text-accent">404</p>
    <h1 #heading class="edition-title" tabindex="-1">No encontramos esta página</h1>
    <p class="edition-prose m-0 max-w-[57ch] text-[.9375rem]/[1.5] text-muted">
      La dirección puede haber cambiado.
    </p>
    <a class="edition-action mt-4" routerLink="/">Volver a Hoy</a>
  </section>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFound {
  private readonly heading = viewChild.required<ElementRef<HTMLHeadingElement>>('heading');

  constructor() {
    // Las rutas inexistentes responden 200 con index.html: se excluyen del índice desde la vista y
    // CanonicalLink omite su URL canónica.
    const meta = inject(Meta);
    meta.updateTag({ name: 'robots', content: 'noindex' });
    inject(DestroyRef).onDestroy(() => meta.removeTag('name="robots"'));
    afterNextRender({ write: () => this.heading().nativeElement.focus({ preventScroll: true }) });
  }
}
