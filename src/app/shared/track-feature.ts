import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { environment } from '../../environments/environment';
import type { Track } from '../core/track';
import { AlbumCover } from './album-cover';

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
}
