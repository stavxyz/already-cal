# Comprehensive Documentation Update — Design Spec

## Goal

Full-pass documentation update: fix inaccuracies and gaps in existing docs, add developer/contributor documentation, and improve cross-file navigation. Covers both end-user/integrator and contributor audiences.

## Approach

Surgical updates to existing files + targeted new files. Keep the current structure (README as main entry point, `docs/` for detailed references). No reorganization needed.

## Scope

### Existing file updates

#### README.md

1. **Lightbox details** — Expand line ~317 to include keyboard shortcuts (Left/Right arrow keys), multiple dismiss methods (close button, backdrop click, image click, Escape key), focus trap, and image counter display. Update the Views section (~line 88) to reference the lightbox specifically rather than "gallery with arrow navigation."

2. **Sticky header object form** — Line ~119 shows `true | false | { header, viewSelector, tagFilter }` but doesn't explain the keys. Add a brief note that omitted keys default to `true` and elements stack vertically with auto-calculated offsets, or link to configuration.md's detailed coverage.

3. **Custom theming beyond built-ins** — Add a subsection under Themes explaining that any key in the `theme` object beyond the fixed keys (`layout`, `palette`, `orientation`, `imagePosition`) becomes a CSS custom property override via camelCase-to-`--already-kebab-case` conversion. This lets users fully customize visuals without a named palette. Explicitly state that layouts are a closed set of 4 built-in options (link to stavxyz/already-cal#32 for future extensibility).

4. **Past Events section** — Expand to note that state is in-memory only (resets on page reload) and that in grid/list views, past events paginate in reverse-chronological order with a separate "Show earlier" button.

5. **Documentation navigation section** — Add a "Documentation" section after "Development" (near the bottom, before "CI/CD") listing all doc files with one-line descriptions so readers can find what they need.

#### docs/configuration.md

6. **`Already.DEFAULTS`** — Add a note about the `Already.DEFAULTS` export and how to extend defaults (e.g. `Already.DEFAULTS.knownPlatforms`).

#### docs/event-schema.md

7. **`htmlLink` field** — Add the `htmlLink` field to the event object table. It exists in the code and test helpers but is not documented. Type: `string`, description: Google Calendar web link for the event.

#### docs/directives.md

No changes needed — accurate and complete.

### New files

#### CONTRIBUTING.md (root)

Lightweight contributor-facing document:

1. **Getting started** — Clone, install, run tests, open `dev.html`
2. **Development workflow** — Branch from main, make changes, run lint + tests before pushing, open a PR
3. **Code style** — Biome handles formatting/linting, no framework dependencies, follow existing patterns
4. **Testing expectations** — Tests required for new features, coverage thresholds enforced in CI
5. **Commit conventions** — Atomic commits, descriptive messages using conventional prefixes (`feat:`, `fix:`, `docs:`, `build:`, `test:`, `refactor:`)
6. **Links out** — Points to `docs/development.md` for project structure/build/architecture details

#### docs/development.md

Developer guide with practical setup and project internals:

1. **Prerequisites** — Node.js 20+, npm
2. **Project structure** — Module map of `src/` with one-line descriptions: `src/layouts/` (card renderers), `src/ui/` (interactive UI components), `src/util/` (extraction pipeline), `src/views/` (view renderers), `src/styles/` (CSS), `src/data.js` (data loading/enrichment), `src/router.js` (hash routing), `src/theme.js` (theme application), `src/already-cal.js` (main entry point/orchestrator)
3. **Build system** — esbuild config: IIFE bundle with `Already` global, CSS bundling from `src/styles/index.css` entry point, outputs to `dist/`. Explain `build.cjs` and the dev/watch workflow.
4. **Testing** — Node built-in test runner, JSDOM for DOM simulation via `test/setup-dom.cjs`, test file organization mirrors `src/`. Coverage via c8 with thresholds (86% statements, 80% branches, 72% functions, 86% lines). Commands: `npm test`, `npm run test:coverage`.
5. **Linting** — Biome for formatting + linting. Config in `biome.json`. `npm run lint` to check, `npm run format` to fix.
6. **`dev.html`** — Local preview page with mock data, how to use it.
7. **CI workflows** — Expand on README's CI section: path filtering logic, what triggers which workflow, Node version matrix, coverage reporting on Node 22 only.
8. **Key conventions** — No framework dependencies, CSS custom properties for all visual values, `Intl.DateTimeFormat` for locale-aware dates, `TokenSet` for deduplication across extraction stages.
9. **Links out** — Points to `docs/architecture.md` for technical deep-dive, `CONTRIBUTING.md` for workflow.

#### docs/architecture.md

Technical deep-dive for contributors:

1. **Data pipeline** — Full flow: raw data (Google Calendar API / fetchUrl / pre-loaded) → format auto-detection → `enrichEvent()` → `eventTransform()` → `eventFilter()` → stored events → per-render filtering (past toggle, hidden, tags, pagination) → view renderer. Expands on event-schema.md's pipeline diagram with code-path detail.

2. **Rendering flow** — `init()` bootstraps: mount element setup → `applyTheme()` → data loading → `start()` → `renderView()`. View switching via hash-based routing (`src/router.js`). `renderView()` composes: sticky headers, tag filter, past toggle, pagination, view-specific renderer.

3. **Theme system** — `applyTheme()` in `src/theme.js`: validation of fixed keys (`layout`, `palette`, `orientation`, `imagePosition`), open-ended CSS custom property injection for everything else, `data-*` attributes on mount element, override key tracking for cleanup on theme change. Palette CSS files define `[data-palette="name"]` selectors.

4. **Layout registry** — `src/layouts/registry.js`: closed set of 4 layouts (`clean`, `hero`, `badge`, `compact`), `getLayout(name)` with `clean` fallback. Each layout module exports a render function with signature `(event, config) => HTMLElement`. Link to stavxyz/already-cal#32 for future extensibility.

5. **Extraction pipeline** — `TokenSet` deduplication pattern, extraction order (directives → images → links → attachments), canonical ID system for dedup across stages, `&amp;` decoding. Links to `docs/directives.md` for directive specifics.

6. **Lifecycle** — `init()` → `start()` → `renderView()` cycle. `setConfig()` for runtime updates (CSS-only vs. re-render paths). `destroy()` cleanup: event listeners (resize, message, hashchange), DOM (innerHTML, CSS class, data attributes, CSS custom property overrides), module state (`_instance` nulling). The `destroyed` flag pattern and async guard in `start()` after `await loadData()`.

7. **Module dependency overview** — Which top-level modules import what, as a text list. Kept simple — not a generated dependency graph, just the key relationships (e.g. `already-cal.js` imports from `data.js`, `router.js`, `theme.js`, all `views/`, all `ui/`).

### Cross-references

- **README.md** → new "Documentation" section linking to all doc files
- **docs/development.md** → links to architecture.md, CONTRIBUTING.md, README
- **docs/architecture.md** → links to event-schema.md, configuration.md, development.md
- **CONTRIBUTING.md** → links to development.md, architecture.md

## Out of scope

- Docs site / static site generation — markdown files served by GitHub are sufficient for now
- API reference generation — the codebase is small enough that hand-written docs are more useful
- Changelog — git log serves this purpose
- Browser support matrix — not tested systematically, would be speculative
