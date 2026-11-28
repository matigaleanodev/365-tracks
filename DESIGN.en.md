# Daywave · Daily Edition

[Español](DESIGN.md)

Daily Edition design reference. The styling foundation shares semantic tokens between SCSS and Tailwind.

Daywave is a shared daily music selection, with one listening note and a Spotify link. Violet, the edition rule, date and serif track title establish its editorial identity. Running text spells the name Daywave. The visual wordmark is lowercase **daywave** in Source Sans 3 at weight 600 with −0.02 em tracking and the foreground color on one line, next to the mark: a classic vinyl record. The tagline **One day. One song. One world.** appears on the prelaunch screen and in product introductions. The interface uses Rioplatense Spanish.

### Mark and favicon

`public/daywave-mark.svg` (symbol `#record`) is the single source for the mark. Geometry on a 120 viewBox: body r 56, five 1-unit grooves at r 49, 44, 39, 34 and 29, label r 22 and a body-colored r 3.5 spindle hole. The geometry stays identical in both themes. Only the colors change, through brand tokens that leave the general palette untouched:

| Token                            | Light     | Dark      |
| -------------------------------- | --------- | --------- |
| `--brand-record` (body and hole) | `#242326` | `#39373F` |
| `--brand-groove` (grooves)       | `#49474C` | `#605D67` |
| `--brand-label` (label)          | `#8B79C6` | `#B5A6E8` |

The light label uses a mid violet because the `#413474` accent barely contrasts with the body. Without tokens, for example inside `<img>`, the SVG falls back to the light palette.

In the header the mark sits in a 0.9 em box with a 0.2 em gap before the wordmark. Below an 18 px font size, use the mark or favicon alone. The tagline is not part of the logo: it goes in a separate composition, such as the social card or the prelaunch screen. The logo has no animation or effects.

`public/favicon.svg` is the optical simplification for tabs. On a 32 viewBox it keeps the body (r 16, edge to edge), the label (r 6.5) and an r 2 hole, which still reads at 3:1 at 16 px. It shows two grooves at 32 px and none at 16 px. Under `prefers-color-scheme: dark` it switches to the dark palette and adds a pixel-aligned groove-colored rim (1 px at both 32 and 16 px), because the dark body almost disappears on dark browser tabs.

`scripts/brand-assets.sh` derives the favicon PNG, touch icon, manifest icons and social card from those two SVG files with the light palette. It holds no geometry of its own: change the brand in the SVG files and rerun the script.

## Editions and surfaces

Use the API's valid ISO civil date and display it in Spanish using UTC semantics. For dates in 2027, add one to the calendar-day offset from January 1 and pad the result to three digits. Gaps in publication stay gaps in the archive. Prelaunch has no folio and uses the existing prelaunch state. For an unpublished Today without an authoritative date, omit the numeric date and folio. An unpublished historical detail may show the requested date. Dates outside 2027 show their date without a folio until a new cycle is approved.

Today and detail use date, title, artist, listening action, album and year, artwork, then the optional note. Offer «Volver al historial» from a known archive origin and «Ir al historial» for a direct visit. The monthly archive uses descending sections with whole-row links and a reserved thumbnail. Load pages by opaque cursor, extend the same month and deduplicate dates. When a public playlist is configured, the annual section sits below the archive and has a jump link beside the heading. The configured destinations open in another tab.

Prelaunch features «Estreno el 1 de enero de 2027» and «Una canción compartida cada día.», the English tagline, and a small masthead. A valid unpublished date, invalid date, empty archive, and unknown page each have their own copy and a useful exit. Static loading placeholders reserve geometry and sit alongside an accessible heading and status. The colophon appears once initial loading resolves in Today, the detail or the archive. Errors offer retry, preserve any already loaded rows and keep the pending control perceptible.

## Tokens and typography

The target CSS token architecture includes primitives, semantic aliases, theme values and interaction states. Light roles use paper #F2EFE8, deep paper #E8E2D8, ink #232040 and violet #413474. Dark uses #171620, #24222F, #F2EFE8 and lavender #B5A6E8. Use the semantic text, surface, focus, border, action, status, selection and disabled roles. Text pairs target 4.5:1, necessary control boundaries and focus target 3:1. Active navigation also uses an underline. The theme selector begins at System, with persistent Light and Dark overrides and a System reset. Apply the preference before first paint and fall back to system when storage is unavailable.

Newsreader uses weights 520–550 for editorial titles and headings. Short titles range from 2.4 to 5.65 rem and long titles from 2 to 3.5 rem, with full wrapping and native direction. Source Sans 3 400–750 serves body, controls, dates and wordmark. Notes use 1.065 rem / 1.54 and 57ch maximum. Host upright WOFF2 with licenses, fixed optical size for Newsreader, Unicode subsets and swap. Proposed initial Latin font budget is 90 KiB. Fall back to Georgia or Times New Roman for headlines and system UI for functional text, with system glyph fallback for other scripts. [Newsreader](https://github.com/productiontype/Newsreader) · [Source Sans](https://github.com/adobe-fonts/source-sans)

## Layout and interaction

Use the 4/8/12/16/20/24/32/40/48/64 px rhythm, 76 rem shell, 60 rem archive, 2 px artwork corners, 4 px control corners and no default shadows. Below 36 rem use one column. From 36 rem the copy and art occupy parallel columns, with the note below the copy. The cover has the same geometry in loading and published states, with and without a note. At 69 rem the artwork column widens. Art is capped at 22 rem below 46 rem and 32 rem from that breakpoint, reserves a square, preserves the original image through contain and uses high priority only for the feature. A missing or failed feature cover uses an edition-and-album sleeve with a visible and accessible unavailable label. Small fallbacks use a neutral mark.

Use a consistent 24-unit stroke icon grid, 18 px icons, 44 px targets, 2 px focus outline and 3 px offset. Color feedback takes 150 ms ease-out with reduced-motion override. The skip link targets main. Place focus on the detail heading, restore the initiating archive row on return via the contextual link, header link or browser Back, focus the first appended row after load-more success, and explicitly focus the playlist heading on jump. Preserve focus on automatic Today changes and announce the update. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Angular and Tailwind

Keep the existing Angular routes, standalone OnPush components, signals and RxJS cancellation. Centralize CSS primitives and semantic custom properties globally. Map semantic properties via Tailwind 4 `@theme inline` and the shared archive breakpoint via `@theme`. Keep the edition's 36/46/69 rem composition in its layout utilities. Use complete literal class names and restrict source discovery to production templates and TypeScript. Use `@tailwindcss/postcss` in a CSS entry, starting with theme and utilities, with the existing reset and no Preflight during parity. Encapsulate special composition and artwork behavior where native layout utilities benefit less. [Angular Tailwind guide](https://angular.dev/guide/tailwind) · [Tailwind theme variables](https://tailwindcss.com/docs/theme#referencing-other-variables)
