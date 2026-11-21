import type { Observable } from 'rxjs';
import { catchError, map, of, startWith } from 'rxjs';

export type LoadState<T> =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly data: T };

export function loadState<T>(request: Observable<T>): Observable<LoadState<T>> {
  return request.pipe(
    map((data): LoadState<T> => ({ status: 'ready', data })),
    startWith<LoadState<T>>({ status: 'loading' }),
    catchError(() => of<LoadState<T>>({ status: 'error' })),
  );
}
