# Wandering Pins — brand design assets

Pulled from the two Claude design exports in `C:\Claude Temp Tax Drive\Wandering Pins Design\`
(`CorkBoard-html.zip`, `OptionB-html.zip`). Not wired into the app yet.

## Files

| File | What it is |
| --- | --- |
| `logo.svg` | Stacked logo, transparent background (660×460) |
| `logo-on-navy.svg` | Logo on brand navy `#17323D` |
| `logo-on-cork.svg` | Logo pinned to the cork board (820×700), for merch/packaging/hero |
| `cork-texture.svg` | Cork board background alone (820×700), built from SVG noise filters |
| `reference/*.dc.html` | The original mockup markup, kept for exact values. Needs the export's `support.js`/React runtime to render, so use the SVGs above to view. |

## Palette

| Role | Hex |
| --- | --- |
| Brand navy (background) | `#17323D` |
| Orange (P, S, pin marker) | `#D06A2E` (hover/darker `#A9521F`) |
| Teal (N, "WANDERING" pill) | `#35948A` |
| Gold outline (every letter) | `#D9B441` |
| Dark gold (drop edge) | `#8E6E14` |
| Cream (I, label text, route line) | `#F5EDE0` |
| Muted blue-gray (captions on navy) | `#8CA3AB` |
| Cork base | `#C08A4E` |
| Cork frame / border | `#5E3A1C`, inner line `#311D0B` |
| Cork caption text | `#3E250F` |

## Fonts (Google Fonts)

- **Bricolage Grotesque**, weights 700–800: the logo lettering
- **Space Grotesk**, weights 400–700: small uppercase labels, 0.10em tracking

The logo SVGs reference these by name in `<text>`, so outside a page that loads the fonts they fall
back to a system sans-serif. Before using the logo in print or merch, convert the text to outlines
(Inkscape: Path → Object to Path) or load the fonts first.
