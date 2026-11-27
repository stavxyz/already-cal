# Comprehensive Documentation Update — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full-pass documentation update — fix gaps/inaccuracies in existing docs and add developer/contributor documentation.

**Architecture:** Surgical edits to 3 existing markdown files (README.md, docs/configuration.md, docs/event-schema.md) plus 3 new files (CONTRIBUTING.md, docs/development.md, docs/architecture.md). Each task is one file, committed independently.

**Tech Stack:** Markdown only — no code changes.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `README.md` | Modify | Fix lightbox/sticky/past-events gaps, add theming extensibility subsection, add docs navigation section |
| `docs/configuration.md` | Modify | Add `Already.DEFAULTS` note |
| `docs/event-schema.md` | Modify | Add `htmlLink` field to event object table |
| `CONTRIBUTING.md` | Create | Contributor quick-start and workflow guide |
| `docs/development.md` | Create | Developer guide: project structure, build, test, lint, CI |
| `docs/architecture.md` | Create | Technical deep-dive: data pipeline, rendering, themes, lifecycle |

---

### Task 1: Fix README.md gaps and add new sections

**Files:**
- Modify: `README.md`

**Context:** The README has 5 specific gaps identified in the design spec. All edits are to existing sections except for two new subsections (theming extensibility and docs navigation). The README is currently 509 lines. Read the full file before making edits to understand the structure.

- [ ] **Step 1: Update the Views section paragraph (line 88)**

Replace:

```markdown
Visitors can switch views via the selector bar, which includes inline SVG icons for each view. Their preference is saved in localStorage. Detail view shows a gallery with arrow navigation when an event has multiple images.
```

With:

```markdown
Visitors can switch views via the selector bar, which includes inline SVG icons for each view. Their preference is saved in localStorage. Detail view shows an image gallery when an event has multiple images — tapping any image opens a fullscreen lightbox overlay (see [Event Images](#event-images) below).
```

- [ ] **Step 2: Add a comment to the sticky config line (line 119)**

Replace:

```js
  sticky: true,                        // true | false | { header, viewSelector, tagFilter }
```

With:

```js
  sticky: true,                        // true | false | object (see configuration.md)
```

- [ ] **Step 3: Add theming extensibility subsection after CSS Custom Properties (after line 279)**

Insert after the CSS Custom Properties paragraph (after line 279, before `## Link Extraction`):

```markdown

### Customizing Beyond Built-in Palettes

The four built-in palettes cover common styles, but you can override any CSS custom property directly in the theme config. Any key beyond the fixed theme keys (`layout`, `palette`, `orientation`, `imagePosition`) is converted from camelCase to a CSS custom property (`--already-kebab-case`) and applied to the mount element:

```js
Already.init({
  el: '#cal',
  theme: {
    layout: 'clean',
    palette: 'light',
    // These become CSS custom properties, applied on top of the palette:
    primary: '#2563eb',           // --already-primary
    fontFamily: 'Georgia, serif', // --already-font-family
    radius: '0px',                // --already-radius
    shadow: 'none',               // --already-shadow
  },
});
```

This is equivalent to:

```css
.already {
  --already-primary: #2563eb;
  --already-font-family: Georgia, serif;
  --already-radius: 0px;
  --already-shadow: none;
}
```

The JS approach is useful for runtime changes via `setConfig()`. The CSS approach works for static overrides.

Layouts are a fixed set of 4 built-in options (`clean`, `hero`, `badge`, `compact`). Custom layout renderers are not currently supported — see [#32](https://github.com/stavxyz/already-cal/issues/32) for future plans.
```

- [ ] **Step 4: Expand the lightbox description in Event Images (line 317)**

Replace:

```markdown
The first image is the thumbnail (grid/list views). Multiple images show as a gallery in detail view with ← → navigation and keyboard support. Tapping any gallery image opens a fullscreen lightbox overlay for easy reading of text-heavy images like flyers — with prev/next navigation, keyboard controls, and multiple dismiss methods (close button, backdrop tap, image tap, Escape key).
```

With:

```markdown
The first image is the thumbnail (grid/list views). Multiple images show as a gallery in detail view. Tapping any gallery image opens a fullscreen lightbox overlay:

- **Navigation:** Left/Right arrow keys, or on-screen prev/next buttons
- **Dismiss:** Close button, backdrop click, image click, or Escape key
- **Accessibility:** `role="dialog"` with `aria-modal="true"`, focus trapped within the overlay and restored to the gallery image on close
- **Display:** Image counter shows position (e.g. "2 / 5")
```

- [ ] **Step 5: Expand the Past Events section (lines 393-395)**

Replace:

```markdown
## Past Events

A toggle button appears when past events exist. Visitors can show/hide past events, and the labels are configurable via `i18n.showPastEvents` and `i18n.hidePastEvents`. The initial state is controlled by `showPastEvents` config.
```

With:

```markdown
## Past Events

A toggle button appears when past events exist. Visitors can show/hide past events, and the labels are configurable via `i18n.showPastEvents` and `i18n.hidePastEvents`. The initial state is controlled by `showPastEvents` config.

Toggle state is in-memory only — it resets on page reload. When past events are visible in grid/list views, they are paginated in reverse-chronological order (most recent first) with a separate "Show earlier" button.
```

- [ ] **Step 6: Add Documentation section after Development (after line 478, before `## CI/CD`)**

Insert:

```markdown

## Documentation

| Document | Description |
|----------|-------------|
| [Configuration Reference](docs/configuration.md) | Every config option with types, defaults, and descriptions |
| [Event Schema](docs/event-schema.md) | Event object fields and data pipeline |
| [Directives Reference](docs/directives.md) | `#already:` directive syntax for all platforms, images, and tags |
| [Architecture](docs/architecture.md) | Technical deep-dive: data pipeline, rendering flow, theme system, lifecycle |
| [Development Guide](docs/development.md) | Project structure, build system, testing, linting, CI |
| [Contributing](CONTRIBUTING.md) | How to contribute: workflow, code style, commit conventions |
```

- [ ] **Step 7: Verify the README renders correctly**

Run: `head -5 README.md && wc -l README.md`
Expected: File starts with `# already-cal` and is roughly 540-560 lines.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: fix README gaps and add theming extensibility, docs navigation sections"
```

---

### Task 2: Update docs/configuration.md and docs/event-schema.md

**Files:**
- Modify: `docs/configuration.md`
- Modify: `docs/event-schema.md`

**Context:** Two small targeted additions to existing reference docs.

- [ ] **Step 1: Add Already.DEFAULTS note to configuration.md**

After the `## Link Extraction` section's "Extend the defaults" code example (after line 181, before `## Sanitization`), insert:

```markdown

### `Already.DEFAULTS`

The full default config object is exported as `Already.DEFAULTS`. Use it to extend arrays like `knownPlatforms` without replacing the built-in entries:

```js
knownPlatforms: [
  ...Already.DEFAULTS.knownPlatforms,
  { pattern: /your-site\.com/i, label: 'Visit Our Site' },
],
```

`Already.DEFAULTS` is read-only at runtime — mutating it does not affect existing instances.
```

- [ ] **Step 2: Add htmlLink field to event-schema.md event object table**

In the Event Object table (line 25), after the `hidden` row, add:

```markdown
| `htmlLink` | `string` | Google Calendar web link for the event (empty string if not from Google Calendar) |
```

The table should now have 16 rows total (id through htmlLink).

- [ ] **Step 3: Commit**

```bash
git add docs/configuration.md docs/event-schema.md
git commit -m "docs: add Already.DEFAULTS note and htmlLink field to reference docs"
```

---

### Task 3: Create CONTRIBUTING.md

**Files:**
- Create: `CONTRIBUTING.md`

**Context:** Standard root-level contributor guide. Keep it welcoming and concise — link out to docs/development.md for project internals.

- [ ] **Step 1: Write CONTRIBUTING.md**

```markdown
# Contributing to already-cal

Thanks for your interest in contributing! This guide covers the basics to get you started.

## Getting Started

```bash
git clone https://github.com/stavxyz/already-cal.git
cd already-cal
npm install
npm test              # run the test suite
open dev.html         # local preview with mock data
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run `npm run lint` and `npm test` before pushing
4. Open a pull request against `main`

For project structure, build system, testing details, and CI configuration, see the **[Development Guide](docs/development.md)**.

For architecture and module internals, see the **[Architecture Guide](docs/architecture.md)**.

## Code Style

- [Biome](https://biomejs.dev/) handles formatting and linting — run `npm run format` to auto-fix
- No framework dependencies — vanilla JavaScript only
- Follow existing patterns in the codebase

## Testing

- Tests are required for new features and bug fixes
- Use the Node.js built-in test runner (`node:test`)
- Test files mirror the `src/` directory structure under `test/`
- Coverage thresholds are enforced in CI (86% statements, 80% branches, 72% functions, 86% lines)
- Run `npm run test:coverage` to check coverage locally

## Commit Conventions

Use descriptive commit messages with conventional prefixes:

| Prefix | Use for |
|--------|---------|
| `feat:` | New features |
| `fix:` | Bug fixes |
| `docs:` | Documentation changes |
| `test:` | Test additions or fixes |
| `build:` | Build system or dependency changes |
| `refactor:` | Code changes that don't add features or fix bugs |

Keep commits atomic — each commit should represent one logical change.

## Questions?

Open an issue on [GitHub](https://github.com/stavxyz/already-cal/issues) for bugs, feature requests, or questions.
```

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add CONTRIBUTING.md"
```

---

### Task 4: Create docs/development.md

**Files:**
- Create: `docs/development.md`

**Context:** Developer guide covering practical setup, project structure, build, testing, linting, CI, and conventions. This is the "how things work" guide for contributors. Read `build.cjs`, `package.json`, `biome.json`, `test/setup-dom.cjs`, `.github/workflows/`, and `dev.html` to verify all details before writing.

- [ ] **Step 1: Write docs/development.md**

```markdown
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
├── router.js               # Hash-based routing, localStorage view persistence
├── theme.js                # Theme resolution, CSS custom property application
├── layouts/
│   ├── registry.js         # Layout registry — getLayout(name) with clean fallback
│   ├── helpers.js           # Shared layout rendering utilities
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
└── styles/
    ├── index.css           # CSS entry point (imports all stylesheets)
    ├── base.css            # Core layout, grid, responsive breakpoints
    └── palettes/           # light.css, dark.css, warm.css, cool.css

test/
├── setup-dom.cjs           # JSDOM initialization — exposes document, window, etc.
├── helpers.cjs             # createTestEvent() factory
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

The IIFE format exposes `Already` as a global — `Already.init()`, `Already.setConfig()`, `Already.DEFAULTS`.

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
- **Node 22 only:** Runs coverage report and verifies build output matches committed dist files
- **Node 20:** Runs tests only (no coverage, no build check)

### Release (`release.yml`)

- **Triggers:** Tags matching `v[0-9]*`
- **Action:** Runs tests, builds, verifies clean git state, creates GitHub Release with dist assets

## Key Conventions

- **No frameworks** — vanilla JavaScript, CSS custom properties, `Intl.DateTimeFormat`
- **IIFE bundle** — single `Already` global, no module consumers to worry about
- **TokenSet deduplication** — all extraction stages (directives, images, links, attachments) share a `TokenSet` keyed by canonical IDs to prevent duplicates
- **CSS custom properties for theming** — all visual values flow through `--already-*` properties
- **Data attribute auto-init** — `[data-already-cal]` elements are auto-discovered on DOMContentLoaded
```

- [ ] **Step 2: Verify structure renders correctly**

Run: `head -3 docs/development.md && wc -l docs/development.md`
Expected: File starts with `# Development Guide` and is roughly 140-160 lines.

- [ ] **Step 3: Commit**

```bash
git add docs/development.md
git commit -m "docs: add development guide"
```

---

### Task 5: Create docs/architecture.md

**Files:**
- Create: `docs/architecture.md`

**Context:** Technical deep-dive for contributors who want to understand how the codebase works. Read these source files before writing to verify all details: `src/already-cal.js` (init, start, renderView, setConfig, destroy), `src/data.js` (loadData, enrichEvent, format detection), `src/router.js` (parseHash, getInitialView, onHashChange), `src/theme.js` (THEME_DEFAULTS, resolveTheme, applyTheme), `src/layouts/registry.js` (getLayout), `src/util/tokens.js` (TokenSet).

- [ ] **Step 1: Write docs/architecture.md**

```markdown
# Architecture

Technical overview of how already-cal works internally. For practical setup and commands, see the [Development Guide](development.md). For config options, see the [Configuration Reference](configuration.md).

## Data Pipeline

Events flow through a pipeline from raw input to rendered view:

```
Raw data (config.data / config.fetchUrl / config.google)
  │
  ▼
Format detection
  Accepts already-cal schema OR raw Google Calendar API JSON.
  Auto-detects by checking for an `items` array (Google API format)
  vs. an `events` array (already-cal format). Google API responses
  are transformed: items → events, summary → calendar.name, etc.
  │
  ▼
enrichEvent() — per event
  Processes the description in this order:
  1. Directives — #already: tokens extracted and removed
  2. Images — image URLs, Drive links, Dropbox links extracted and removed
  3. Links — platform URLs extracted and removed
  4. Attachments — file URLs (.pdf, .doc, etc.) extracted and removed
  All stages share a TokenSet for deduplication by canonical ID.
  Pre-set values (non-empty images/links arrays) skip extraction.
  │
  ▼
eventTransform() — user hook (optional)
  Mutate or replace each enriched event.
  │
  ▼
eventFilter() — user hook (optional)
  Return true to keep, false to exclude.
  │
  ▼
Stored as data.events
  │
  ▼
Per render (on view switch, filter change, pagination, etc.):
  1. isPast filter — past events toggle
  2. hidden filter — removes event.hidden === true
  3. tag filter — tag pill selection (union/OR)
  4. sort + paginate (grid/list only)
  │
  ▼
View renderer
```

Data loading is in `src/data.js`. Enrichment helpers are in `src/util/` (directives.js, images.js, links.js, attachments.js). The `TokenSet` deduplication container is in `src/util/tokens.js`.

## Rendering Flow

### Initialization

`init(userConfig)` in `src/already-cal.js`:

1. Merges `userConfig` with `DEFAULTS` and `I18N_DEFAULTS`
2. Resolves `el` — accepts a CSS selector string or DOM element
3. Calls `applyTheme(el, config.theme)` — sets data attributes and CSS custom properties on the mount element
4. Calls `start()` which:
   - Loads data via `loadData(config)` (async)
   - Guards against `destroyed` flag after await (in case `destroy()` was called during load)
   - Determines initial view via `getInitialView()` (priority: `initialEvent` > URL hash/path > localStorage > `defaultView`)
   - Calls `renderView()` with the initial view state
5. Registers event listeners: `resize` (responsive breakpoint), `message` (postMessage API), `hashchange` (routing)
6. Returns the instance object with `setConfig()` and `destroy()` methods

### View Rendering

`renderView(viewState)` composes the UI from independent components:

1. Clears the mount element
2. Renders sticky header (calendar name, description, subscribe button) via `src/ui/header.js`
3. Renders view selector tabs via `src/ui/view-selector.js`
4. Renders tag filter bar via `src/ui/tag-filter.js` (only when tags exist)
5. Renders past events toggle via `src/ui/past-toggle.js` (only when past events exist)
6. Filters events (past, hidden, tags)
7. Delegates to the view-specific renderer (`src/views/month.js`, `week.js`, `day.js`, `grid.js`, `list.js`, or `detail.js`)
8. For grid/list: applies pagination via `src/ui/pagination.js` with scroll anchoring

Grid and list views use `getLayout(theme.layout)` from `src/layouts/registry.js` to get the card renderer. Month, week, and day views have their own rendering logic.

### Hash Routing

`src/router.js` manages view state via URL hash:

- `parseHash()` — reads `#event/{id}`, `#day/{date}`, or view names from the hash. Also checks the URL path for `/event/{id}` (server-side routing support).
- `getInitialView()` — determines the first view to show. Priority: `config.initialEvent` > hash/path > localStorage > `config.defaultView`.
- `setView(view)` — updates the hash and saves to localStorage with key `{storageKeyPrefix}-view`.
- `onHashChange(callback)` — registers a hashchange listener. Returns an unsubscribe function for cleanup.

## Theme System

`src/theme.js` manages all visual configuration.

### Theme Resolution

`resolveTheme(themeInput)` accepts either a string (layout shorthand) or an object:

- **Fixed keys** (validated against allowed values):
  - `layout` — `"clean"` | `"hero"` | `"badge"` | `"compact"` (default: `"clean"`)
  - `palette` — `"light"` | `"dark"` | `"warm"` | `"cool"` (default: `"light"`)
  - `orientation` — `"vertical"` | `"horizontal"` (default: `"vertical"`, forced to `"vertical"` for compact layout)
  - `imagePosition` — `"left"` | `"right"` | `"alternating"` (default: `"left"`, only applies in horizontal orientation)

- **Open-ended keys** — anything else is collected as CSS custom property overrides (e.g. `primary: '#ff0000'` → `--already-primary: #ff0000`)

### Theme Application

`applyTheme(el, themeInput, previousOverrideKeys)`:

1. Calls `resolveTheme()` to get the normalized theme config
2. Sets data attributes on the mount element: `data-layout`, `data-orientation`, `data-image-position`, `data-palette`
3. Clears previous CSS custom property overrides (tracked via `previousOverrideKeys` array)
4. Applies new overrides: converts camelCase keys to `--already-kebab-case` and sets them as inline styles
5. Returns the resolved theme object plus the new `overrideKeys` array for future cleanup

Palette CSS files (`src/styles/palettes/*.css`) define styles via `[data-palette="name"]` attribute selectors. Setting `data-palette` on the mount element activates the corresponding palette — no JavaScript re-render needed.

## Layout Registry

`src/layouts/registry.js` exports `getLayout(name)`:

- Maps layout names to render functions from `src/layouts/{name}/{name}.js`
- Returns `layouts.clean` as fallback for unknown names
- Each layout module exports a render function: `(event, config) => HTMLElement`
- The set is fixed: `clean`, `hero`, `badge`, `compact`. See [#32](https://github.com/stavxyz/already-cal/issues/32) for future custom layout support.

## Extraction Pipeline

All extraction happens in `enrichEvent()` (`src/data.js`) using utilities from `src/util/`:

### TokenSet

`src/util/tokens.js` — deduplication container keyed by canonical ID:

- `add(token)` — adds a token, returns `true` if new (canonical ID not yet seen)
- `has(canonicalId)` — checks for existence
- `ofType(type)` — filters tokens by type (e.g. `"image"`, `"link"`, `"attachment"`)
- `normalizeUrl(url)` — strips `www.`, forces HTTPS, removes tracking params (`utm_*`, `fbclid`, `si`)

### Canonical IDs

Each extracted token gets a canonical ID for deduplication:

| Token type | ID format | Example |
|-----------|-----------|---------|
| Platform link | `<platform>:<handle>` | `instagram:example-org` |
| Image (URL) | `image:<host><path>` | `image:example.com/pic.png` |
| Image (Drive) | `image:drive:<fileId>` | `image:drive:ABC123` |
| Scalar tag | `tag:<value>` | `tag:fundraiser` |
| Key-value tag | `tag:<key>:<value>` | `tag:cost:$25` |

This means `#already:instagram:foo` (directive) and `https://instagram.com/foo` (URL in description) produce a single link entry.

### Extraction Order

1. **Directives** (`src/util/directives.js`) — `#already:` tokens
2. **Images** (`src/util/images.js`) — image URLs, Drive links, Dropbox links
3. **Links** (`src/util/links.js`) — platform URLs with label generation
4. **Attachments** (`src/util/attachments.js`) — file URLs (`.pdf`, `.doc`, etc.)

All extractors decode `&amp;` → `&` before matching (Google Calendar HTML-encodes ampersands).

## Lifecycle

### Runtime Updates

`instance.setConfig(newConfig)`:

- Guards against `destroyed` flag — silently returns if destroyed
- Validates input — must be a non-null plain object
- **CSS-only updates** (no DOM rebuild): `palette` changes (sets `data-palette`), CSS custom property overrides
- **Re-render triggers**: `layout`, `orientation`, `imagePosition` changes, `views`, `showPastEvents`, `pageSize`, `defaultView`
- Pagination state resets on re-render
- Invalid values are logged via `console.warn` and ignored

`Already.setConfig(config)` — global convenience that delegates to `_instance` (last-created instance). Warns if no instance exists.

### PostMessage API

`window.addEventListener("message", handler)` listens for `{ type: "already:config", config: {...} }` messages. Delegates to `instance.setConfig()`. Messages without the `"already:config"` type, or with non-object config, are silently ignored.

### Destroy

`instance.destroy()`:

1. Sets `destroyed = true` (guards against double-destroy and setConfig-after-destroy)
2. Removes event listeners: `resize`, `message`, `hashchange` (via cleanup function returned by `onHashChange()`)
3. Clears `el.innerHTML`
4. Removes CSS class (`already`) and data attributes (`layout`, `orientation`, `imagePosition`, `palette`)
5. Removes CSS custom property overrides (tracked via `themeResult.overrideKeys`)
6. Nulls `_instance` if this is the current global instance

The `destroyed` flag also guards the async gap in `start()` — if `destroy()` is called while `loadData()` is in flight, `start()` bails after the await.

## Module Dependencies

Key import relationships (simplified):

- **`already-cal.js`** imports: `data.js`, `router.js`, `theme.js`, all `views/*`, all `ui/*`
- **`data.js`** imports: `util/directives.js`, `util/images.js`, `util/links.js`, `util/attachments.js`, `util/description.js`, `util/tokens.js`
- **`theme.js`** imports: `layouts/registry.js`
- **`views/grid.js`** and **`views/list.js`** import: `layouts/registry.js`
- **`views/detail.js`** imports: `views/lightbox.js`
- **`util/directives.js`** imports: `util/links.js` (for platform URL construction and canonical IDs)
- **`ui/*` modules** are leaf nodes — they don't import from each other
```

- [ ] **Step 2: Verify structure renders correctly**

Run: `head -3 docs/architecture.md && wc -l docs/architecture.md`
Expected: File starts with `# Architecture` and is roughly 180-210 lines.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: add architecture guide"
```

---

### Task 6: Final cross-reference check and push

**Files:**
- All files from Tasks 1-5

- [ ] **Step 1: Verify all cross-references resolve**

Check that all internal markdown links point to files that exist:

```bash
# From project root, verify all linked files exist:
ls README.md docs/configuration.md docs/event-schema.md docs/directives.md docs/architecture.md docs/development.md CONTRIBUTING.md
```

Expected: All 7 files listed without errors.

- [ ] **Step 2: Run Biome to check for any formatting issues in markdown**

```bash
npm run lint
```

Expected: No errors (Biome may not lint markdown, but verify no collateral issues).

- [ ] **Step 3: Verify the full commit history is clean**

```bash
git log --oneline origin/main..HEAD
```

Expected: 5 commits:
1. `docs: fix README gaps and add theming extensibility, docs navigation sections`
2. `docs: add Already.DEFAULTS note and htmlLink field to reference docs`
3. `docs: add CONTRIBUTING.md`
4. `docs: add development guide`
5. `docs: add architecture guide`

- [ ] **Step 4: Push and open PR**

```bash
git push -u origin docs/comprehensive-update
```

Then create a PR targeting `main` with title: `docs: comprehensive documentation update` and a body summarizing all changes.
