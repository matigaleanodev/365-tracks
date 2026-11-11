import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

@Component({
  selector: 'app-album-cover',
  template: `@if (!failed()) {
      <img
        [src]="src()"
        [alt]="'Portada de ' + album()"
        [loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : 'auto'"
        width="640"
        height="640"
        (error)="markFailed()"
      />
    } @else {
      <span class="fallback" role="img" [attr.aria-label]="'Portada no disponible: ' + album()"
        ><span aria-hidden="true">♪</span></span
      >
    }`,
  styles: `
    :host {
      display: block;
      aspect-ratio: 1;
      overflow: hidden;
      background: var(--surface);
      border-radius: inherit;
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fallback {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      color: var(--muted);
      font-size: 3rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlbumCover {
  readonly src = input.required<string>();
  readonly album = input.required<string>();
  readonly priority = input(false);
  private readonly failedUrl = signal<string | null>(null);
  protected readonly failed = computed(() => this.failedUrl() === this.src());
  protected markFailed(): void {
    this.failedUrl.set(this.src());
  }
}
