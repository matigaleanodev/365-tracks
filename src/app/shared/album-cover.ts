import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-album-cover',
  host: {
    '[class.edition-cover]': 'editionLabel() !== undefined',
    '[class.thumbnail]': 'thumbnail()',
    '[attr.aria-hidden]': 'thumbnail() ? "true" : null',
  },
  template: `@if (!showFallback()) {
      <img
        [src]="src()"
        [alt]="thumbnail() ? '' : 'Portada de ' + album()"
        [loading]="priority() ? 'eager' : 'lazy'"
        [attr.fetchpriority]="priority() ? 'high' : 'auto'"
        width="640"
        height="640"
        (error)="markFailed()"
      />
    } @else if (thumbnail()) {
      <span class="thumbnail-placeholder"><span></span></span>
    } @else if (editionLabel(); as label) {
      <div class="edition-sleeve" role="img" aria-label="Portada no disponible">
        <span>daywave</span>
        <strong class="cover-number">{{ label }}</strong>
        <strong class="cover-album" dir="auto">{{ album() }}</strong>
        <span>Portada no disponible</span>
      </div>
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
    }
    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    :host(.edition-cover:has(img)) {
      outline: 1px solid var(--rule);
      outline-offset: -1px;
    }
    :host(.edition-cover) img {
      object-fit: contain;
    }
    :host(.thumbnail) img {
      object-fit: contain;
    }
    .thumbnail-placeholder {
      display: grid;
      place-items: center;
      height: 100%;
      background: var(--hover-surface);
      color: var(--accent);
    }
    .thumbnail-placeholder span {
      width: 0.48rem;
      aspect-ratio: 1;
      border: 1px solid currentColor;
      border-radius: 50%;
    }
    .fallback {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
      color: var(--muted);
      font-size: 3rem;
    }
    .edition-sleeve {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.5rem;
      height: 100%;
      border: 1px solid var(--rule);
      padding: clamp(0.8rem, 3vw, 1.85rem);
      background: var(--hover-surface);
      color: var(--muted);
      font-size: 0.875rem;
    }
    .cover-number {
      padding-block: 0.5rem;
      border-block: 1px solid var(--control-border);
      color: var(--accent);
      font: 520 clamp(2.35rem, 7vw, 5.5rem) / 0.95 var(--font-display);
      letter-spacing: -0.04em;
    }
    .cover-album {
      color: var(--foreground);
      font: 600 clamp(0.95rem, 2vw, 1.32rem) / 1.12 var(--font-body);
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    @media (width >= 46rem) {
      .edition-sleeve {
        padding: 1.5rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlbumCover {
  readonly src = input.required<string | undefined>();
  readonly album = input.required<string>();
  readonly priority = input(false);
  readonly thumbnail = input(false);
  readonly editionLabel = input<string>();
  private readonly failed = linkedSignal({
    source: this.src,
    computation: () => false as boolean,
  });
  protected readonly showFallback = computed(() => !this.src() || this.failed());
  protected markFailed(): void {
    this.failed.set(true);
  }
}
