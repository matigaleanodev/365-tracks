import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
  type IsActiveMatchOptions,
} from '@angular/router';
import { environment } from '../environments/environment';
import { HistoryReturn } from './core/history-return';

const themeKey = '365-tracks-theme';
type EditionTheme = 'system' | 'light' | 'dark';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly colorScheme = inject(DOCUMENT).documentElement.style;
  protected readonly skipHref = computed(() => {
    const url = this.router.lastSuccessfulNavigation()?.finalUrl?.toString() ?? '/';
    return url.split('#')[0] + '#content';
  });
  protected readonly navMatch: IsActiveMatchOptions = {
    paths: 'exact',
    queryParams: 'ignored',
    fragment: 'ignored',
    matrixParams: 'ignored',
  };
  protected readonly historyReturn = inject(HistoryReturn);
  protected readonly fixtures = environment.fixtures;
  private readonly selectedTheme = signal(this.readTheme());
  protected readonly theme = this.selectedTheme.asReadonly();

  protected skipToContent(event: MouseEvent, content: HTMLElement): void {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    content.scrollIntoView({ block: 'start' });
    content.focus({ preventScroll: true });
  }

  protected changeTheme(value: string): void {
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    this.selectedTheme.set(value);
    this.colorScheme.colorScheme = value === 'system' ? '' : value;
    try {
      localStorage.setItem(themeKey, value);
    } catch {
      // The theme remains available for the current page when persistence is blocked.
    }
  }

  private readTheme(): EditionTheme {
    const value = this.colorScheme.colorScheme;
    return value === 'light' || value === 'dark' ? value : 'system';
  }
}
