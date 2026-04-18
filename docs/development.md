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
├── already-cal.js          # Main entry point — init(), setConfig(), destroy(), DEFAULTS
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
│   ├── badge/              # Badge layout: date overlay, tags, RSVP footer
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
│   └── helpers.js          # Shared view rendering utilities
├── ui/
│   ├── header.js           # Calendar name, description, subscribe button
│   ├── view-selector.js    # View tabs with SVG icons
│   ├── tag-filter.js       # Clickable tag pills with OR filtering
│   ├── past-toggle.js      # Show/hide past events button
│   ├── pagination.js       # Load more / Show earlier buttons with scroll anchoring
│   ├── sticky.js           # Sticky header positioning
│   └── states.js           # Loading, empty, and error state renderers
├── util/
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
