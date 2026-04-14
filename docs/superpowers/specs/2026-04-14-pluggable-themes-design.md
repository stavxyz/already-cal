# Pluggable Theme System — Design Spec

## Goal

Add a pluggable theme system to already-cal with two independent axes: **layout variants** (card structure and information density) and **color palettes** (colors, typography, shape, depth). Users compose themes by mixing any layout with any palette.

## Principles

- **Two independent axes.** Layout controls what's in the card. Palette controls how everything looks. They don't overlap.
- **Co-located files.** Each layout is a JS template + CSS file in one directory. Each palette is a single CSS file.
- **CSS custom properties.** Palettes set properties; layouts and base styles consume them. No runtime style injection beyond user overrides.
- **Ship everything.** All 4 layouts and 4 palettes are in the bundle. No lazy loading, no code splitting.
- **No new dependencies.** Pure CSS + vanilla JS.

---

## Section 1: Architecture

```
Theme = Layout × Palette
```

File structure:

```
src/layouts/
  registry.js           # maps layout names → template functions
  base.css              # shared card primitives (flex, overflow, box model)
  clean/
    clean.js            # card template function
    clean.css           # clean-specific structural styles
  hero/
    hero.js
    hero.css
  badge/
    badge.js
    badge.css
  compact/
    compact.js
    compact.css

src/palettes/
  light.css             # default
  dark.css
  warm.css              # earthy/organic
  cool.css              # modern/minimal

src/styles/
  index.css             # single entry point, @imports everything in order
  base.css              # shared styles (container, header, views, states, responsive, print)
```

Build: esbuild bundles all `@import`s into a single `dist/already-cal.css` and all JS into a single IIFE bundle. No runtime CSS loading.

---

## Section 2: API Surface

### Shorthand

```js
AlreadyCal.init({
  theme: "hero"  // expands to { layout: "hero" } with all defaults
});
```

### Full control

```js
AlreadyCal.init({
  theme: {
    layout: "hero",            // clean | hero | badge | compact (default: clean)
    orientation: "horizontal", // vertical | horizontal (default: vertical, ignored for compact)
    imagePosition: "left",     // left | right | alternating (default: left, only when horizontal)
    palette: "dark",           // light | dark | warm | cool (default: light)

    // CSS custom property overrides — applied last, override palette values
    primary: "#8B4513",
    radius: "0px",
  }
});
```

### Resolution order

1. Palette CSS sets custom properties (e.g., `dark.css` sets `--already-background: #1a1a1a`)
2. Inline overrides from config trump palette values (applied as inline styles on `.already`)
3. Layout template renders the card structure
4. Layout CSS + palette CSS both apply (no conflicts — they control different things)

### Container data attributes

```html
<div class="already"
     data-layout="hero"
     data-orientation="horizontal"
     data-image-position="left"
     data-palette="dark">
```

All CSS selectors target these data attributes.

### Defaults

| Property | Default |
|----------|---------|
| `layout` | `"clean"` |
| `orientation` | `"vertical"` |
| `imagePosition` | `"left"` |
| `palette` | `"light"` |

---

## Section 3: Layout Templates

Each layout exports a render function:

```js
export function render(event, options) → string
```

`options` includes `{ orientation, imagePosition, index }` where `index` is the event's position in the list (used for alternating image position).

### Field mapping

| Element | Clean | Hero | Badge | Compact |
|---------|-------|------|-------|---------|
| Image | yes | yes (larger) | yes | no |
| Title | yes | yes (uppercase, bold) | yes | yes |
| Date/time | short | full range | full + day name | short + day |
| Location | yes | yes (icon) | yes (icon) | yes (icon) |
| Description | no | yes (2-line clamp) | yes (2-line clamp) | no |
| Date badge | no | no | yes (overlay on image) | yes (inline) |
| Tags | no | no | yes (pills) | yes (pills) |
| Actions | no | no | yes (RSVP, share) | no |

**Tags:** Rendered from `event.tags` if present. Tag extraction/sourcing (from categories, description parsing, or extended properties) is out of scope — this spec only builds the rendering. Templates gracefully omit tags when the array is empty or absent.

**Actions:** Rendered from `event.htmlLink` (Google Calendar's event URL). RSVP links to the event page. Share triggers native share or copies URL. Templates omit the action footer when no link is available.

### Orientation behavior

- `vertical`: image on top, body below (current grid card behavior)
- `horizontal`: image beside body, `flex-direction: row`
- `compact` ignores orientation (no image to position)

### Image position (horizontal only)

- `left`: image is first flex item, body is second (default)
- `right`: CSS `flex-direction: row-reverse`
- `alternating`: template checks `index % 2` to flip direction

---

## Section 4: Palette System

Each palette is a CSS file that sets custom properties on `.already[data-palette="<name>"]`.

### Expanded custom property set

**Color properties:**
- `--already-primary` — accent color
- `--already-primary-text` — text on accent backgrounds
- `--already-background` — page/container background
- `--already-surface` — card background
- `--already-text` — primary text color
- `--already-text-secondary` — muted/secondary text
- `--already-border` — card borders, dividers

**Typography properties:**
- `--already-font-family` — base font stack
- `--already-font-weight-normal` — normal weight
- `--already-font-weight-bold` — bold weight
- `--already-font-size-sm` — small text (meta, captions)
- `--already-font-size-base` — body text
- `--already-font-size-lg` — titles, headings

**Shape & depth properties:**
- `--already-radius` — card border radius
- `--already-radius-sm` — inner element radius (badges, pills)
- `--already-shadow` — card box-shadow
- `--already-spacing` — base spacing unit (padding, gaps scale from this)

### Built-in palettes

| Property | Light | Dark | Warm | Cool |
|----------|-------|------|------|------|
| Vibe | Clean default | Dark mode | Earthy/organic | Modern/minimal |
| Background | `#ffffff` | `#1a1a1a` | `#faf6f0` | `#f8f9fb` |
| Surface | `#ffffff` | `#2a2a2a` | `#fff8f0` | `#ffffff` |
| Primary | user accent | user accent | `#c9713c` | `#4a6cf7` |
| Font | system-ui | system-ui | Georgia, serif | Inter, system-ui |
| Radius | `8px` | `8px` | `12px` | `4px` |
| Shadow | subtle | none | warm diffuse | crisp minimal |
| Weight (bold) | 700 | 600 | 700 | 600 |

- **Warm:** handmade and inviting — community events, farmers markets
- **Cool:** sharp and professional — tech meetups, conferences

---

## Section 5: CSS Build Strategy

### Entry point

`src/styles/index.css` imports everything in order:

```css
/* Base styles (refactored from existing already-cal.css) */
@import "./base.css";

/* Layout styles */
@import "../layouts/base.css";
@import "../layouts/clean/clean.css";
@import "../layouts/hero/hero.css";
@import "../layouts/badge/badge.css";
@import "../layouts/compact/compact.css";

/* Palette styles */
@import "../palettes/light.css";
@import "../palettes/dark.css";
@import "../palettes/warm.css";
@import "../palettes/cool.css";
```

esbuild bundles all `@import`s into `dist/already-cal.css`.

### Refactoring `already-cal.css`

The existing 1,486-line file gets split:

- **`src/styles/base.css`** — shared styles: container, sticky header, header bar, view selector, month/week/day views, detail view, states, past toggle, pagination, responsive, print
- **`src/layouts/base.css`** — shared card primitives: base `.already-card` flex, overflow, box model
- **`src/layouts/clean/clean.css`** — current grid card styles (clean is the current look)

---

## Section 6: View Integration

### Grid view (`src/views/grid.js`)

- Currently builds card HTML inline
- Changes to: import layout registry, call `getLayout(layout).render(event, options)` for each event
- Vertical orientation is the default for grid

### List view (`src/views/list.js`)

- Currently renders events as rows
- Changes to: same registry lookup, defaults to horizontal orientation
- Compact layout renders compact cards (no orientation change)

### Layout registry (`src/layouts/registry.js`)

```js
import { render as clean } from "./clean/clean.js";
import { render as hero } from "./hero/hero.js";
import { render as badge } from "./badge/badge.js";
import { render as compact } from "./compact/compact.js";

const layouts = { clean, hero, badge, compact };

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}
```

Falls back to clean for unknown layout names.

### Theme resolution (`src/already-cal.js`)

1. Parse `theme` config — if string, expand to `{ layout: string }`
2. Merge defaults for missing keys (`layout: "clean"`, `orientation: "vertical"`, `imagePosition: "left"`, `palette: "light"`)
3. Set data attributes on `.already` container (`data-layout`, `data-orientation`, `data-image-position`, `data-palette`)
4. Apply CSS custom property overrides as inline styles
5. Pass `layout`, `orientation`, `imagePosition` to view renderers

---

## Section 7: Affected Views

- **Grid view** — uses layout templates for card rendering (vertical default)
- **List view** — uses layout templates for card rendering (horizontal default)
- **Month/week/day views** — unchanged (own spatial constraints)
- **Detail view** — unchanged

---

## Section 8: Testing Strategy

### Unit tests — layout templates

- Each layout's `render()` tested with a mock event object
- Verify correct HTML structure: right classes, expected elements present/absent per the field mapping table
- Test orientation variants produce different markup
- Test imagePosition (left/right/alternating) applies correct classes
- Test compact ignores orientation

### Unit tests — theme resolution

- String shorthand `"hero"` expands correctly
- Full object merges with defaults
- Unknown layout/palette falls back to clean/light
- CSS custom property overrides pass through

### Unit tests — palette completeness

- Each palette CSS file sets all required custom properties (no gaps)
- Parse test to verify the full property set is defined

### Integration tests — view rendering

- Grid view with each layout produces valid card markup
- List view with horizontal orientation produces horizontal cards
- Data attributes appear correctly on `.already` container

No visual/screenshot testing — manual via dev server.
