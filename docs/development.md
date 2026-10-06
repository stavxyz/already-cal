# Development Guide

## Prerequisites

- Node.js 20 or later
- npm

## Setup

```bash
git clone https://github.com/stavxyz/already-cal.git
cd already-cal
npm install
```

## Project Structure

```
src/
├── already-cal.js          # Main entry point — init(), setConfig(), registerLayout(), registerTheme(), DEFAULTS, THEMES
├── composite.js            # Composite events: grouping, id lookup, combined image and tag accessors
├── core.js                 # DOM-free server-side entry: enrichGoogleEvent, plainTextDescription, CONTENT_DEFAULTS
├── content-defaults.js     # CONTENT_DEFAULTS shared by the widget and the core entry
├── data.js                 # Data loading, format detection, event enrichment
├── registry.js             # Generic, type-agnostic registry (layouts, theme bundles)
├── router.js               # Hash-based routing, localStorage view persistence
├── theme.js                # Theme resolution, CSS custom property application
├── themes/
│   └── registry.js         # Theme bundle type, validator, built-in bundles
├── layouts/
│   ├── registry.js         # Layout registry — getLayout(name) with clean fallback
│   ├── helpers.js          # Shared layout rendering utilities
│   ├── base.css            # Shared card CSS primitives
│   ├── badge/              # Badge layout: date overlay, tags, Details link footer
│   ├── clean/              # Clean layout: minimal image + title + date + location
│   ├── compact/            # Compact layout: no image, inline date badge, dense
│   └── hero/               # Hero layout: large image, bold title, description preview
├── views/
│   ├── month.js            # Month calendar grid
│   ├── week.js             # 7-column week view
│   ├── day.js              # Single day view
│   ├── grid.js             # Card grid (uses theme layout)
│   ├── list.js             # Chronological list (uses theme layout)
│   ├── detail.js           # Two-column event detail with gallery
│   ├── lightbox.js         # Fullscreen image overlay
│   ├── card-decoration.js  # The one step that decorates a card after its layout renders it
│   ├── detail-entry.js     # One entry's body in the detail view (description, links, RSVP)
│   ├── detail-parts.js     # A composite's parts list in the detail view
│   ├── placement.js        # Day placement for month, week, and day
│   └── helpers.js          # Shared view rendering utilities
├── ui/
│   ├── header.js           # Calendar name, description, subscribe button
│   ├── card-parts.js       # The parts block on a composite's card
│   ├── event-link.js       # linkTitle, eventAnchor, and fillEventAnchor: the event's link in a card, a row, a chip, or a block
│   ├── event-popover.js    # The card shown on hover or tap from the month and week views
│   ├── rsvp-form.js        # The RSVP button, form, and done line a card or the detail view mounts
│   ├── rsvp-state.js       # The class a card carries while its RSVP form is open
│   ├── share-button.js     # Share button (Web Share API, with copy as the fallback)
│   ├── subscribe-menu.js   # Subscribe menu: Apple Calendar, Google Calendar, Outlook, Copy iCal link
│   ├── view-selector.js    # View tabs with SVG icons
│   ├── tag-filter.js       # Clickable tag pills with OR filtering
│   ├── past-toggle.js      # Show/hide past events button
│   ├── pagination.js       # Load more / Show earlier buttons with scroll anchoring
│   ├── sticky.js           # Sticky header positioning
│   └── states.js           # Loading, empty, and error state renderers
├── util/
│   ├── comments.js         # AFL comment stripping (// line syntax)
│   ├── tokens.js           # TokenSet — deduplication container with canonical IDs
│   ├── directives.js       # #already: directive extraction
│   ├── images.js           # Image URL extraction (Drive, Dropbox normalization)
│   ├── links.js            # Platform URL extraction and label generation
│   ├── attachments.js      # File attachment extraction
│   ├── description.js      # Description format detection and rendering
│   ├── sanitize.js         # HTML sanitization
│   └── dates.js            # Date formatting and comparison utilities
├── palettes/               # light.css, dark.css, warm.css, cool.css
└── styles/
    ├── index.css           # CSS entry point (imports all stylesheets)
    └── base.css            # Core layout, grid, responsive breakpoints

test/
├── setup-dom.cjs           # JSDOM initialization — exposes document, window, etc.
├── helpers.cjs             # createTestEvent() factory, captureConsoleError() helper
├── set-config.test.cjs     # setConfig() and destroy() lifecycle tests
├── postmessage.test.cjs    # postMessage listener tests
├── a11y/cards.test.cjs     # axe-core over every layout and view (see Accessibility check)
└── ...                     # Mirrors src/ structure (directives, links, images, etc.)
```

## Build System

The build script (`build.cjs`) uses [esbuild](https://esbuild.github.io/) to produce four output files:

| Output | Entry | Format | Notes |
|--------|-------|--------|-------|
| `dist/already-cal.js` | `src/already-cal.js` | IIFE (`Already` global) | With sourcemap |
| `dist/already-cal.min.js` | `src/already-cal.js` | IIFE (`Already` global) | Minified, no sourcemap |
| `dist/already-cal.css` | `src/styles/index.css` | CSS bundle | All styles + palettes |
| `dist/already-cal.min.css` | `src/styles/index.css` | CSS bundle | Minified |
| `dist/already-cal-core.mjs` | `src/core.js` | ESM, `platform: "neutral"` | DOM-free server-side entry; see [Core (server-side entry)](core.md) |

Commands:

```bash
npm run build    # one-shot build
npm run dev      # watch mode (rebuilds JS + CSS on change; minified versions not watched)
```

The IIFE format exposes `Already` as a global — `Already.init()`, `Already.setConfig()`, `Already.DEFAULTS`, `Already.registerLayout()`, `Already.registerTheme()`, `Already.THEMES`.

## Testing

Tests use the **Node.js built-in test runner** (`node:test`) with [JSDOM](https://github.com/jsdom/jsdom) for DOM simulation.

### Running tests

```bash
npm test                 # run all tests
npm run test:coverage    # run with c8 coverage report
```

### How tests work

- `test/setup-dom.cjs` bootstraps a JSDOM environment and exposes browser globals (`document`, `window`, `HTMLElement`, `localStorage`, `navigator`, etc.)
- Test files `require("./setup-dom.cjs")` as their first line, then dynamically `import()` the ES module source files
- Tests use `node:test` (`describe`, `it`, `before`, `afterEach`) and `node:assert` — no third-party test framework

### Accessibility check

`test/a11y/cards.test.cjs` renders every built-in layout in the grid view with the RSVP form closed and then open, every built-in layout in the list view, the month, week, and day views, a composite's detail view, and the hover popover, and runs [axe-core](https://github.com/dequelabs/axe-core) over each with the rules `nested-interactive`, `button-name`, `link-name`, `aria-allowed-attr`, `aria-roles`, `aria-valid-attr-value`, and `duplicate-id-active`. A plain assertion in the same file checks that two RSVP buttons on one page are named after their own events, which axe cannot see. Colour-contrast rules are off because jsdom has no rendering engine, and `region` because it is a page-level landmark check that does not apply to a widget fragment. `focus-order-semantics` is left out although it runs under jsdom: axe tags it experimental, so a later axe release could change what it reports. It runs as part of `npm test`; to run it alone: `node --test test/a11y/cards.test.cjs`.

### Coverage thresholds

Enforced by [c8](https://github.com/bcoe/c8) in CI (Node 22 only):

| Metric | Threshold |
|--------|-----------|
| Statements | 86% |
| Branches | 80% |
| Functions | 72% |
| Lines | 86% |

Run `npm run test:coverage` locally to check. The coverage report prints to stdout.

## Linting and Formatting

[Biome](https://biomejs.dev/) handles both linting and formatting. Config is in `biome.json`.

```bash
npm run lint     # check for issues (non-destructive)
npm run format   # auto-fix formatting and lint issues
```

Biome excludes `dist/` and minified files. Formatting uses 2-space indentation.

## Local Preview

`dev.html` is a self-contained preview page that loads the built dist files with mock event data. Use it to visually test changes:

```bash
npm run build    # build first
open dev.html    # open in browser
```

The page includes two demo instances — one initialized via JavaScript and one via `data-*` attributes — with sample events demonstrating HTML, markdown, and plain text descriptions.

## CI Workflows

Three GitHub Actions workflows in `.github/workflows/`:

### Quality (`quality.yml`)

- **Triggers:** Push to main, PRs targeting main
- **Path filter:** Only runs when `*.js`, `*.cjs`, `*.css`, or `*.json` files change
- **Action:** Biome lint + format check

### Tests (`tests.yml`)

- **Triggers:** Push to main, PRs targeting main
- **Path filter:** Only runs when `src/`, `test/`, `build.cjs`, or `package*.json` files change
- **Matrix:** Node 20 and Node 22
- **Node 22 only:** Runs coverage report and verifies build succeeds
- **Node 20:** Runs tests only (no coverage, no build step)

### Release (`release.yml`)

- **Triggers:** Tags matching `v[0-9]*`
- **Action:** Runs tests, builds, verifies clean git state, creates GitHub Release with dist assets

## Key Conventions

- **No frameworks** — vanilla JavaScript, CSS custom properties, `Intl.DateTimeFormat`
- **IIFE bundle** — single `Already` global, no module consumers to worry about
- **TokenSet deduplication** — all extraction stages (directives, images, links, attachments) share a `TokenSet` keyed by canonical IDs to prevent duplicates
- **CSS custom properties for theming** — all visual values flow through `--already-*` properties
- **Data attribute auto-init** — `[data-already-cal]` elements are auto-discovered on DOMContentLoaded
