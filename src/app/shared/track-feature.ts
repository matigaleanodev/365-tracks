import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { environment } from '../../environments/environment';
import type { Track } from '../core/track';
import { AlbumCover } from './album-cover';

const editionStart = Date.UTC(2027, 0, 1);
const millisecondsPerDay = 86_400_000;

@Component({
  selector: 'app-track-feature',
  imports: [DatePipe, AlbumCover],
  templateUrl: './track-feature.html',
  styleUrl: './track-feature.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackFeature {
  readonly track = input.required<Track>();
  protected readonly fixtures = environment.fixtures;
  protected readonly folio = computed(() => {
    const date = this.track().date;
    if (!date.startsWith('2027-')) return null;
    return String((Date.parse(date) - editionStart) / millisecondsPerDay + 1).padStart(3, '0');
  });
  protected readonly paragraphs = computed(() => {
    const note = this.track().description?.trim();
    return note
      ? note
          .split(/\r?\n[^\S\r\n]*\r?\n+/)
          .map((part) => part.trim())
          .filter(Boolean)
      : [];
  });
}
