import { TestBed } from '@angular/core/testing';
import { AlbumCover } from './album-cover';

describe('AlbumCover', () => {
  it('keeps an accessible fallback and loads a new image after an error', () => {
    const fixture = TestBed.createComponent(AlbumCover);
    fixture.componentRef.setInput('src', 'https://example.com/first.webp');
    fixture.componentRef.setInput('album', 'Sample album');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const image = element.querySelector('img')!;
    expect(image.alt).toContain('Sample album');
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('[role="img"]')?.getAttribute('aria-label')).toContain(
      'Portada no disponible',
    );
    fixture.componentRef.setInput('src', 'https://example.com/second.webp');
    fixture.detectChanges();
    expect(element.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.com/second.webp',
    );
  });
});
