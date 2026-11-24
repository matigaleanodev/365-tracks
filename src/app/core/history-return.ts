import { ViewportScroller } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { PRIMARY_OUTLET, Router, type UrlTree } from '@angular/router';
import type { Track } from './track';

export interface HistoryState {
  readonly status: 'loading' | 'error' | 'ready';
  readonly tracks: readonly Track[];
  readonly nextCursor: string | null;
  readonly addedCount: number | null;
}

interface HistoryOrigin {
  readonly state: HistoryState;
  readonly position: [number, number];
  readonly detailUrl: string;
  readonly historyUrl: UrlTree;
  readonly navigationId: number;
}

@Injectable({ providedIn: 'root' })
export class HistoryReturn {
  private readonly router = inject(Router);
  private readonly scroller = inject(ViewportScroller);
  private origin?: HistoryOrigin;
  private restoredHistoryNavigationId?: number;
  private departureState?: HistoryState;
  private departurePosition: [number, number] = [0, 0];

  detailOriginUrl(): UrlTree | undefined {
    const navigationId = this.router.lastSuccessfulNavigation()?.id;
    return this.origin?.navigationId === navigationId ? this.origin?.historyUrl : undefined;
  }

  capture(state: HistoryState): void {
    this.departureState = state;
    this.departurePosition = this.scroller.getScrollPosition();
  }

  record(date: string): UrlTree | undefined {
    const navigation = this.router.currentNavigation();
    const returningForward =
      navigation?.trigger === 'popstate' &&
      navigation.previousNavigation?.id === this.restoredHistoryNavigationId &&
      navigation.finalUrl?.toString() === this.origin?.detailUrl;
    const state = returningForward
      ? this.departureState
      : (navigation?.extras.info as HistoryState | undefined);
    const historyUrl = navigation?.previousNavigation?.finalUrl;
    const previous = historyUrl?.root.children[PRIMARY_OUTLET];
    if (
      navigation &&
      historyUrl &&
      previous?.segments.length === 1 &&
      previous.segments[0]?.path === 'history' &&
      state?.tracks?.some((track) => track.date === date)
    ) {
      this.origin = {
        state: state.status === 'loading' ? { ...state, status: 'ready' } : state,
        position: this.departurePosition,
        detailUrl: '/tracks/' + date,
        historyUrl,
        navigationId: navigation.id,
      };
      return historyUrl;
    }
    return undefined;
  }

  restore(): HistoryOrigin | undefined {
    const navigation = this.router.currentNavigation();
    const previous = navigation?.previousNavigation;
    const origin = this.origin;
    if (
      origin &&
      previous?.id === origin.navigationId &&
      previous.finalUrl?.toString() === origin.detailUrl &&
      (navigation?.extras.info === this || navigation?.trigger === 'popstate')
    ) {
      this.restoredHistoryNavigationId = navigation.id;
      return origin;
    }
    return undefined;
  }
}
