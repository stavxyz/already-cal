# Pluggable Theme System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pluggable theme system with 4 card layout variants and 4 color palettes, composable independently.

**Architecture:** Two independent axes — layouts (JS template + co-located CSS) and palettes (CSS-only custom property sets). Grid and list views call a layout registry to render cards. The `.already` container gets data attributes (`data-layout`, `data-palette`, etc.) that CSS selectors target. All layouts and palettes ship in the single IIFE bundle.

**Tech Stack:** Vanilla JS, CSS custom properties, esbuild (existing build tooling)

**Spec:** `docs/superpowers/specs/2026-04-14-pluggable-themes-design.md`

---

## File Map

### New files

| File | Responsibility |
|------|----------------|
| `src/layouts/registry.js` | Maps layout names to render functions, exports `getLayout(name)` |
| `src/layouts/base.css` | Shared card primitives: `.already-card` base flex, overflow, image, body, orientation, image-position |
| `src/layouts/clean/clean.js` | Clean layout render function |
| `src/layouts/clean/clean.css` | Clean-specific styles (current grid card look) |
| `src/layouts/hero/hero.js` | Hero layout render function |
| `src/layouts/hero/hero.css` | Hero-specific styles (uppercase title, description, footer) |
| `src/layouts/badge/badge.js` | Badge layout render function |
| `src/layouts/badge/badge.css` | Badge-specific styles (date overlay, tag pills, actions) |
| `src/layouts/compact/compact.js` | Compact layout render function |
| `src/layouts/compact/compact.css` | Compact-specific styles (no image, inline badge, dense) |
| `src/palettes/light.css` | Light palette (current default colors) |
| `src/palettes/dark.css` | Dark palette |
| `src/palettes/warm.css` | Warm/earthy palette |
| `src/palettes/cool.css` | Cool/modern palette |
| `src/styles/index.css` | CSS entry point — `@import`s base, layouts, palettes in order |
| `src/theme.js` | Theme config parsing — resolves shorthand, merges defaults, extracts layout/palette/overrides |
| `test/theme.test.cjs` | Theme resolution tests |
| `test/layouts/clean.test.cjs` | Clean layout render tests |
| `test/layouts/hero.test.cjs` | Hero layout render tests |
| `test/layouts/badge.test.cjs` | Badge layout render tests |
| `test/layouts/compact.test.cjs` | Compact layout render tests |
| `test/layouts/registry.test.cjs` | Registry tests |

### Modified files

| File | Changes |
|------|---------|
| `src/already-cal.js` | Import `resolveTheme` from `theme.js`, use it to parse config, set data attributes, pass layout options to views |
| `src/views/grid.js` | Import layout registry, call layout render instead of hardcoded card HTML |
| `src/views/list.js` | Import layout registry, call layout render instead of hardcoded list item HTML |
| `src/views/helpers.js` | Add `applyCardModifiers` that uses classList (not className overwrite) for layout cards |
| `already-cal.css` | Becomes `src/styles/base.css` — remove grid card and list item styles (moved to layout CSS). Keep all other sections unchanged. |
| `build.cjs` | Change CSS entry point from `already-cal.css` to `src/styles/index.css` |
| `package.json` | Update test script glob to include `test/layouts/*.test.cjs` |

---

## Task 1: Theme Resolution Module

Parse theme config (string shorthand or full object), merge defaults, separate layout/palette/orientation keys from CSS custom property overrides.

**Files:**
- Create: `src/theme.js`
- Create: `test/theme.test.cjs`

- [ ] **Step 1: Write failing tests for theme resolution**

Create `test/theme.test.cjs`:

```js
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let resolveTheme;

before(async () => {
  const mod = await import("../src/theme.js");
  resolveTheme = mod.resolveTheme;
});

describe("resolveTheme", () => {
  it("returns defaults when theme is undefined", () => {
    const result = resolveTheme(undefined);
    assert.strictEqual(result.layout, "clean");
    assert.strictEqual(result.orientation, "vertical");
    assert.strictEqual(result.imagePosition, "left");
    assert.strictEqual(result.palette, "light");
    assert.deepStrictEqual(result.overrides, {});
  });

  it("returns defaults when theme is empty object", () => {
    const result = resolveTheme({});
    assert.strictEqual(result.layout, "clean");
    assert.strictEqual(result.palette, "light");
    assert.deepStrictEqual(result.overrides, {});
  });

  it("expands string shorthand to layout", () => {
    const result = resolveTheme("hero");
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.orientation, "vertical");
    assert.strictEqual(result.palette, "light");
  });

  it("parses full object", () => {
    const result = resolveTheme({
      layout: "badge",
      orientation: "horizontal",
      imagePosition: "alternating",
      palette: "dark",
    });
    assert.strictEqual(result.layout, "badge");
    assert.strictEqual(result.orientation, "horizontal");
    assert.strictEqual(result.imagePosition, "alternating");
    assert.strictEqual(result.palette, "dark");
  });

  it("separates CSS custom property overrides", () => {
    const result = resolveTheme({
      layout: "hero",
      primary: "#ff0000",
      radius: "0px",
      fontFamily: "Georgia, serif",
    });
    assert.strictEqual(result.layout, "hero");
    assert.deepStrictEqual(result.overrides, {
      primary: "#ff0000",
      radius: "0px",
      fontFamily: "Georgia, serif",
    });
  });

  it("falls back to defaults for unknown layout", () => {
    const result = resolveTheme({ layout: "nonexistent" });
    assert.strictEqual(result.layout, "clean");
  });

  it("falls back to defaults for unknown palette", () => {
    const result = resolveTheme({ palette: "neon" });
    assert.strictEqual(result.palette, "light");
  });

  it("ignores orientation for compact layout", () => {
    const result = resolveTheme({
      layout: "compact",
      orientation: "horizontal",
    });
    assert.strictEqual(result.orientation, "vertical");
  });

  it("ignores imagePosition when orientation is vertical", () => {
    const result = resolveTheme({
      orientation: "vertical",
      imagePosition: "right",
    });
    assert.strictEqual(result.imagePosition, "left");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/theme.test.cjs`
Expected: FAIL — `src/theme.js` does not exist

- [ ] **Step 3: Implement resolveTheme**

Create `src/theme.js`:

```js
const VALID_LAYOUTS = new Set(["clean", "hero", "badge", "compact"]);
const VALID_PALETTES = new Set(["light", "dark", "warm", "cool"]);
const VALID_ORIENTATIONS = new Set(["vertical", "horizontal"]);
const VALID_IMAGE_POSITIONS = new Set(["left", "right", "alternating"]);

const THEME_KEYS = new Set([
  "layout",
  "orientation",
  "imagePosition",
  "palette",
]);

const THEME_DEFAULTS = {
  layout: "clean",
  orientation: "vertical",
  imagePosition: "left",
  palette: "light",
};

/**
 * Resolve a theme config value (string shorthand or object) into
 * normalized layout/palette/orientation settings plus CSS overrides.
 */
export function resolveTheme(theme) {
  if (typeof theme === "string") {
    theme = { layout: theme };
  }
  const input = theme || {};

  const layout = VALID_LAYOUTS.has(input.layout)
    ? input.layout
    : THEME_DEFAULTS.layout;

  const palette = VALID_PALETTES.has(input.palette)
    ? input.palette
    : THEME_DEFAULTS.palette;

  // Compact has no image — force vertical
  const orientation =
    layout === "compact"
      ? "vertical"
      : VALID_ORIENTATIONS.has(input.orientation)
        ? input.orientation
        : THEME_DEFAULTS.orientation;

  // imagePosition only applies when horizontal
  const imagePosition =
    orientation === "horizontal" &&
    VALID_IMAGE_POSITIONS.has(input.imagePosition)
      ? input.imagePosition
      : THEME_DEFAULTS.imagePosition;

  // Everything not a known theme key is a CSS custom property override
  const overrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!THEME_KEYS.has(key)) {
      overrides[key] = value;
    }
  }

  return { layout, orientation, imagePosition, palette, overrides };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/theme.test.cjs`
Expected: all 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/theme.js test/theme.test.cjs
git commit -m "feat(theme): add resolveTheme config parser

Parses string shorthand and full object config. Validates layout,
palette, orientation, imagePosition. Separates CSS custom property
overrides from theme keys."
```

---

## Task 2: Layout Registry

Central registry that maps layout names to render functions. Starts with a placeholder `clean` that returns a simple string — real layouts come in later tasks.

**Files:**
- Create: `src/layouts/registry.js`
- Create: `test/layouts/registry.test.cjs`

- [ ] **Step 1: Create test directory**

Run: `mkdir -p test/layouts`

- [ ] **Step 2: Write failing tests for registry**

Create `test/layouts/registry.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let getLayout;

before(async () => {
  const mod = await import("../../src/layouts/registry.js");
  getLayout = mod.getLayout;
});

describe("getLayout", () => {
  it("returns a function for clean", () => {
    assert.strictEqual(typeof getLayout("clean"), "function");
  });

  it("returns a function for hero", () => {
    assert.strictEqual(typeof getLayout("hero"), "function");
  });

  it("returns a function for badge", () => {
    assert.strictEqual(typeof getLayout("badge"), "function");
  });

  it("returns a function for compact", () => {
    assert.strictEqual(typeof getLayout("compact"), "function");
  });

  it("falls back to clean for unknown name", () => {
    assert.strictEqual(getLayout("unknown"), getLayout("clean"));
  });

  it("each layout render function returns a DOM element", () => {
    const event = {
      id: "test",
      title: "Test Event",
      start: "2026-04-15T10:00:00Z",
      end: "2026-04-15T11:00:00Z",
      allDay: false,
      image: null,
      location: "",
      description: "",
      tags: [],
      featured: false,
      htmlLink: "",
    };
    const options = {
      orientation: "vertical",
      imagePosition: "left",
      index: 0,
      timezone: "UTC",
      locale: "en-US",
      config: {},
    };
    for (const name of ["clean", "hero", "badge", "compact"]) {
      const el = getLayout(name)(event, options);
      assert.ok(el instanceof HTMLElement, `${name} should return HTMLElement`);
    }
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/layouts/registry.test.cjs`
Expected: FAIL — `src/layouts/registry.js` does not exist

- [ ] **Step 4: Implement registry with placeholder renders**

Create `src/layouts/registry.js`:

```js
import { createElement } from "../views/helpers.js";

// Placeholder render functions — replaced in Tasks 4-7
function placeholderRender(event, options) {
  const card = createElement("div", "already-card");
  card.textContent = event.title;
  return card;
}

const layouts = {
  clean: placeholderRender,
  hero: placeholderRender,
  badge: placeholderRender,
  compact: placeholderRender,
};

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}

/**
 * Register a layout render function. Used internally by layout modules
 * and available for custom layouts.
 */
export function registerLayout(name, renderFn) {
  layouts[name] = renderFn;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test test/layouts/registry.test.cjs`
Expected: all 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/layouts/registry.js test/layouts/registry.test.cjs
git commit -m "feat(theme): add layout registry with placeholder renders

Central registry maps layout names to render functions.
getLayout() falls back to clean for unknown names."
```

---

## Task 3: Shared Card Base CSS + CSS Entry Point + Build Update

Split the existing `already-cal.css` — move grid card and list item styles out, create the CSS entry point, create shared card base CSS, and update the build to use the new entry point.

**Files:**
- Create: `src/styles/index.css`
- Create: `src/styles/base.css`
- Create: `src/layouts/base.css`
- Create: `src/layouts/clean/clean.css` (empty placeholder — filled in Task 4)
- Create: `src/palettes/light.css` (empty placeholder — filled in Task 8)
- Modify: `already-cal.css` — remove grid card styles (lines 277-346) and list item styles (lines 208-268)
- Modify: `build.cjs` — change CSS entry point

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p src/styles src/layouts/clean src/layouts/hero src/layouts/badge src/layouts/compact src/palettes`

- [ ] **Step 2: Create `src/layouts/base.css` — shared card primitives**

This file defines the `.already-card` base class and orientation/image-position modifiers that all layouts share.

```css
/* ===== Shared Card Primitives ===== */

/* Base card — used by all layouts in grid and list views */
.already-card {
  background: var(--already-surface);
  border-radius: var(--already-radius);
  overflow: hidden;
  cursor: pointer;
  transition:
    box-shadow 0.15s,
    transform 0.1s;
}

.already-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.already-card:focus-visible {
  outline: 2px solid var(--already-primary);
  outline-offset: 2px;
}

.already-card--past {
  opacity: 0.5;
}

/* Featured — accent border + star */
.already-card--featured {
  border-left: 3px solid var(--already-primary);
}

.already-card--featured .already-card__title::before {
  content: "\2605";
  font-size: 0.75em;
  color: var(--already-primary);
  margin-right: 0.25em;
}

/* Vertical orientation (default) — image on top, body below */
.already-card--vertical {
  display: flex;
  flex-direction: column;
}

/* Horizontal orientation — image beside body */
.already-card--horizontal {
  display: flex;
  flex-direction: row;
}

.already-card--horizontal .already-card__image {
  width: 180px;
  flex-shrink: 0;
}

/* Image position: right (horizontal only) */
.already-card--horizontal.already-card--image-right {
  flex-direction: row-reverse;
}

/* Card image */
.already-card__image {
  overflow: hidden;
  background: var(--already-background);
}

.already-card--vertical .already-card__image {
  width: 100%;
  aspect-ratio: 16 / 9;
}

.already-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

/* Card body */
.already-card__body {
  padding: 0.75rem 1rem;
  flex: 1;
  min-width: 0;
}

/* Card title */
.already-card__title {
  font-weight: 600;
  font-size: 0.9375rem;
  line-height: 1.3;
}

/* Card meta (date/time) */
.already-card__meta {
  font-size: 0.8125rem;
  color: var(--already-primary);
  font-weight: 500;
  margin-top: 0.25rem;
}

/* Card location */
.already-card__location {
  font-size: 0.75rem;
  color: var(--already-text-secondary);
  margin-top: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Card description (hero, badge) */
.already-card__description {
  font-size: 0.75rem;
  color: var(--already-text-secondary);
  margin-top: 0.5rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Card footer (badge) */
.already-card__footer {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

/* Tag pills (badge, compact) */
.already-card__tags {
  display: flex;
  gap: 0.25rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}

.already-card__tag {
  font-size: 0.625rem;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 0.75rem;
  padding: 0.125rem 0.5rem;
  color: var(--already-text-secondary);
}

/* Date badge (badge overlay, compact inline) */
.already-card__badge {
  text-align: center;
  line-height: 1.1;
}

.already-card__badge-day {
  font-weight: 800;
  font-size: 1.125rem;
}

.already-card__badge-month {
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Action links (badge) */
.already-card__action {
  font-size: 0.6875rem;
  color: var(--already-primary);
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
```

- [ ] **Step 3: Extract grid card and list item CSS from `already-cal.css` into `src/layouts/clean/clean.css`**

Create `src/layouts/clean/clean.css` — placeholder for now, will be populated in Task 4. For now just a comment:

```css
/* Clean layout — structural overrides beyond base card primitives.
   Populated in Task 4 when clean.js is built. */
```

- [ ] **Step 4: Remove grid card and list item CSS from `already-cal.css`**

Remove the following sections from `already-cal.css`:
- **Grid card styles** (lines 277-346): `.already-grid-card` through `.already-grid-location`
- **List item styles** (lines 208-268): `.already-list-item` through `.already-list-location`
- **Featured event styles that reference grid/list** (lines 1415-1436): these move to `src/layouts/base.css`

Keep the grid container (`.already-grid`) and list container (`.already-list`) rules — those control the grid layout, not the cards.

After removal, `already-cal.css` keeps: custom properties, container, sticky, header, view selector, `.already-grid` container (the `display: grid` rule), `.already-list` container (the `display: flex` rule), month view, week view, day view, detail view, states, past toggle, pagination, responsive grid/list container overrides, print.

Also update the featured event selectors — replace `.already-grid-card--featured` / `.already-list-item--featured` references with `.already-card--featured` (now handled in `base.css`). Keep the `.already-day-event--featured`, `.already-month-chip--featured`, `.already-week-event--featured` selectors as-is since those views aren't changing.

- [ ] **Step 5: Create `src/styles/base.css`**

Copy the modified `already-cal.css` content to `src/styles/base.css`. This is a straight copy — the file content is the same, just relocated.

- [ ] **Step 6: Create empty palette placeholder**

Create `src/palettes/light.css`:

```css
/* Light palette — default. Populated in Task 8. */
```

- [ ] **Step 7: Create `src/styles/index.css`**

```css
/* already-cal styles — assembled from base, layouts, and palettes */

/* Base styles (container, header, views, states, responsive, print) */
@import "./base.css";

/* Shared card primitives */
@import "../layouts/base.css";

/* Layout-specific card styles */
@import "../layouts/clean/clean.css";
@import "../layouts/hero/hero.css";
@import "../layouts/badge/badge.css";
@import "../layouts/compact/compact.css";

/* Color palettes */
@import "../palettes/light.css";
@import "../palettes/dark.css";
@import "../palettes/warm.css";
@import "../palettes/cool.css";
```

Create empty placeholder CSS files for layouts/palettes not yet implemented so the `@import`s don't break the build:

Create `src/layouts/hero/hero.css`:
```css
/* Hero layout — populated in Task 5 */
```

Create `src/layouts/badge/badge.css`:
```css
/* Badge layout — populated in Task 6 */
```

Create `src/layouts/compact/compact.css`:
```css
/* Compact layout — populated in Task 7 */
```

Create `src/palettes/dark.css`:
```css
/* Dark palette — populated in Task 8 */
```

Create `src/palettes/warm.css`:
```css
/* Warm palette — populated in Task 8 */
```

Create `src/palettes/cool.css`:
```css
/* Cool palette — populated in Task 8 */
```

- [ ] **Step 8: Update `build.cjs` — change CSS entry point**

In `build.cjs`, change the CSS entry points from `already-cal.css` to `src/styles/index.css`:

```js
// Line 26: change entryPoints
const ctxCss = await esbuild.context({
  entryPoints: ["src/styles/index.css"],
  bundle: true,
  outfile: "dist/already-cal.css",
  minify: false,
});

// Line 33: change entryPoints
const ctxCssMin = await esbuild.context({
  entryPoints: ["src/styles/index.css"],
  bundle: true,
  outfile: "dist/already-cal.min.css",
  minify: true,
});
```

- [ ] **Step 9: Delete the old `already-cal.css` at the root**

The content is now at `src/styles/base.css`. Delete the root file:

Run: `rm already-cal.css`

- [ ] **Step 10: Run build to verify CSS compiles**

Run: `node build.cjs`
Expected: "Build complete." — `dist/already-cal.css` should contain all the base styles plus the layout/palette placeholder comments.

- [ ] **Step 11: Run existing tests to verify nothing breaks**

Run: `npm test`
Expected: all existing tests pass (CSS changes don't affect test assertions since tests use JSDOM without CSS)

- [ ] **Step 12: Commit**

```bash
git add src/styles/ src/layouts/base.css src/layouts/clean/clean.css \
  src/layouts/hero/hero.css src/layouts/badge/badge.css src/layouts/compact/compact.css \
  src/palettes/ build.cjs
git rm already-cal.css
git add src/styles/base.css
git commit -m "refactor: split CSS into base, layout, and palette files

Move grid card and list item styles out of the monolith CSS file.
Create src/styles/index.css entry point that @imports base, layouts,
and palettes. Update build.cjs to use new entry point."
```

---

## Task 4: Clean Layout (Current Default)

Extract the current grid card rendering into the clean layout module. This is largely moving existing code from `grid.js` into `clean.js` with the new card class names.

**Files:**
- Create: `src/layouts/clean/clean.js`
- Modify: `src/layouts/clean/clean.css`
- Create: `test/layouts/clean.test.cjs`
- Modify: `src/layouts/registry.js`

- [ ] **Step 1: Write failing tests for clean layout**

Create `test/layouts/clean.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/clean/clean.js");
  render = mod.render;
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("clean layout", () => {
  it("returns a .already-card element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card"));
    assert.ok(el.classList.contains("already-card--clean"));
  });

  it("includes title", () => {
    const el = render(createTestEvent({ title: "My Event" }), baseOptions);
    const title = el.querySelector(".already-card__title");
    assert.ok(title);
    assert.strictEqual(title.textContent, "My Event");
  });

  it("includes date/time meta", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__meta"));
  });

  it("includes location when present", () => {
    const el = render(
      createTestEvent({ location: "Central Park" }),
      baseOptions,
    );
    const loc = el.querySelector(".already-card__location");
    assert.ok(loc);
    assert.strictEqual(loc.textContent, "Central Park");
  });

  it("omits location when empty", () => {
    const el = render(createTestEvent({ location: "" }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__location"), null);
  });

  it("includes image when present", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    const img = el.querySelector(".already-card__image img");
    assert.ok(img);
    assert.strictEqual(img.getAttribute("loading"), "lazy");
  });

  it("omits image when absent", () => {
    const el = render(createTestEvent({ image: null }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__image"), null);
  });

  it("does not include description", () => {
    const el = render(
      createTestEvent({ description: "Some text" }),
      baseOptions,
    );
    assert.strictEqual(el.querySelector(".already-card__description"), null);
  });

  it("applies vertical orientation class", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card--vertical"));
  });

  it("applies horizontal orientation class", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(el.classList.contains("already-card--horizontal"));
  });

  it("applies image-right class when horizontal + right", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
      imagePosition: "right",
    });
    assert.ok(el.classList.contains("already-card--image-right"));
  });

  it("alternates image position based on index", () => {
    const opts = {
      ...baseOptions,
      orientation: "horizontal",
      imagePosition: "alternating",
    };
    const el0 = render(createTestEvent(), { ...opts, index: 0 });
    const el1 = render(createTestEvent(), { ...opts, index: 1 });
    assert.ok(!el0.classList.contains("already-card--image-right"));
    assert.ok(el1.classList.contains("already-card--image-right"));
  });

  it("escapes title via textContent (no XSS)", () => {
    const el = render(
      createTestEvent({ title: "<script>alert(1)</script>" }),
      baseOptions,
    );
    const title = el.querySelector(".already-card__title");
    assert.strictEqual(title.textContent, "<script>alert(1)</script>");
    assert.ok(!title.innerHTML.includes("<script>"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/layouts/clean.test.cjs`
Expected: FAIL — `src/layouts/clean/clean.js` does not exist

- [ ] **Step 3: Implement clean layout render function**

Create `src/layouts/clean/clean.js`:

```js
import { formatDateShort, formatTime } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

/**
 * Render a clean layout card.
 * Fields: image, title, date/time (short), location.
 */
export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  let cls = "already-card already-card--clean";
  cls += ` already-card--${orientation}`;
  if (
    orientation === "horizontal" &&
    (imagePosition === "right" ||
      (imagePosition === "alternating" && index % 2 === 1))
  ) {
    cls += " already-card--image-right";
  }
  card.className = cls;

  // Image
  if (event.image) {
    const wrapper = createElement("div", "already-card__image");
    const img = document.createElement("img");
    img.src = event.image;
    img.alt = event.title;
    img.setAttribute("loading", "lazy");
    img.onerror = () => {
      wrapper.style.display = "none";
    };
    wrapper.appendChild(img);
    card.appendChild(wrapper);
  }

  // Body
  const body = createElement("div", "already-card__body");

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  const dateStr = formatDateShort(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const meta = createElement("div", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}`;
  body.appendChild(meta);

  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = event.location;
    body.appendChild(loc);
  }

  card.appendChild(body);
  return card;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/layouts/clean.test.cjs`
Expected: all 14 tests PASS

- [ ] **Step 5: Register clean layout in registry**

Update `src/layouts/registry.js` — replace the placeholder for clean:

```js
import { render as clean } from "./clean/clean.js";
import { createElement } from "../views/helpers.js";

// Placeholder render function for layouts not yet implemented
function placeholderRender(event, options) {
  const card = createElement("div", "already-card");
  card.textContent = event.title;
  return card;
}

const layouts = {
  clean,
  hero: placeholderRender,
  badge: placeholderRender,
  compact: placeholderRender,
};

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}

export function registerLayout(name, renderFn) {
  layouts[name] = renderFn;
}
```

- [ ] **Step 6: Populate `src/layouts/clean/clean.css`**

This layout is the current default — minimal overrides beyond `base.css`:

```css
/* Clean layout — minimal styling, relies on base card primitives */

/* No additional structural overrides needed — clean uses base card styles as-is. */
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/layouts/clean/clean.js src/layouts/clean/clean.css \
  src/layouts/registry.js test/layouts/clean.test.cjs
git commit -m "feat(theme): implement clean card layout

Extracts current grid card rendering into a standalone layout module.
Fields: image, title, date/time (short), location. Supports vertical,
horizontal, and alternating image positions."
```

---

## Task 5: Hero Layout

Bold card with uppercase title, description preview, and footer with location/date icons.

**Files:**
- Create: `src/layouts/hero/hero.js`
- Modify: `src/layouts/hero/hero.css`
- Create: `test/layouts/hero.test.cjs`
- Modify: `src/layouts/registry.js`

- [ ] **Step 1: Write failing tests for hero layout**

Create `test/layouts/hero.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/hero/hero.js");
  render = mod.render;
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("hero layout", () => {
  it("returns a .already-card--hero element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card"));
    assert.ok(el.classList.contains("already-card--hero"));
  });

  it("includes title", () => {
    const el = render(createTestEvent({ title: "Concert" }), baseOptions);
    assert.strictEqual(
      el.querySelector(".already-card__title").textContent,
      "Concert",
    );
  });

  it("includes description preview when present", () => {
    const el = render(
      createTestEvent({ description: "A great show" }),
      baseOptions,
    );
    const desc = el.querySelector(".already-card__description");
    assert.ok(desc);
    assert.strictEqual(desc.textContent, "A great show");
  });

  it("omits description when empty", () => {
    const el = render(createTestEvent({ description: "" }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__description"), null);
  });

  it("includes footer with location and date", () => {
    const el = render(
      createTestEvent({ location: "The Venue" }),
      baseOptions,
    );
    const footer = el.querySelector(".already-card__footer");
    assert.ok(footer);
    assert.ok(footer.textContent.includes("The Venue"));
  });

  it("includes image when present", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    assert.ok(el.querySelector(".already-card__image img"));
  });

  it("omits image when absent", () => {
    const el = render(createTestEvent({ image: null }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__image"), null);
  });

  it("applies horizontal orientation class", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(el.classList.contains("already-card--horizontal"));
  });

  it("alternates image position based on index", () => {
    const opts = {
      ...baseOptions,
      orientation: "horizontal",
      imagePosition: "alternating",
    };
    const el0 = render(createTestEvent(), { ...opts, index: 0 });
    const el1 = render(createTestEvent(), { ...opts, index: 1 });
    assert.ok(!el0.classList.contains("already-card--image-right"));
    assert.ok(el1.classList.contains("already-card--image-right"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/layouts/hero.test.cjs`
Expected: FAIL — `src/layouts/hero/hero.js` does not exist

- [ ] **Step 3: Implement hero layout**

Create `src/layouts/hero/hero.js`:

```js
import {
  formatDateShort,
  formatTime,
} from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

/**
 * Render a hero layout card.
 * Fields: image (larger), title (uppercase/bold), description preview,
 * footer with location + date/time icons.
 */
export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  let cls = "already-card already-card--hero";
  cls += ` already-card--${orientation}`;
  if (
    orientation === "horizontal" &&
    (imagePosition === "right" ||
      (imagePosition === "alternating" && index % 2 === 1))
  ) {
    cls += " already-card--image-right";
  }
  card.className = cls;

  // Image
  if (event.image) {
    const wrapper = createElement("div", "already-card__image");
    const img = document.createElement("img");
    img.src = event.image;
    img.alt = event.title;
    img.setAttribute("loading", "lazy");
    img.onerror = () => {
      wrapper.style.display = "none";
    };
    wrapper.appendChild(img);
    card.appendChild(wrapper);
  }

  // Body
  const body = createElement("div", "already-card__body");

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  // Description preview
  if (event.description) {
    const desc = createElement("div", "already-card__description");
    desc.textContent = event.description;
    body.appendChild(desc);
  }

  // Footer with location + date
  const footer = createElement("div", "already-card__footer");

  if (event.location) {
    const loc = createElement("span", "already-card__location");
    loc.textContent = event.location;
    footer.appendChild(loc);
  }

  const dateStr = formatDateShort(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` ${formatTime(event.start, timezone, locale)}`;
  const endTimeStr =
    !event.allDay && event.end
      ? ` \u2013 ${formatTime(event.end, timezone, locale)}`
      : "";
  const meta = createElement("span", "already-card__meta");
  meta.textContent = `${dateStr} \u00b7 ${timeStr}${endTimeStr}`.trim();
  footer.appendChild(meta);

  body.appendChild(footer);
  card.appendChild(body);
  return card;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/layouts/hero.test.cjs`
Expected: all 9 tests PASS

- [ ] **Step 5: Write hero CSS**

Update `src/layouts/hero/hero.css`:

```css
/* Hero layout — bold uppercase title, description preview, footer */

.already-card--hero .already-card__title {
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.already-card--hero .already-card__image {
  aspect-ratio: 16 / 9;
}

.already-card--hero.already-card--horizontal .already-card__image {
  aspect-ratio: auto;
  min-height: 160px;
  width: 200px;
}

.already-card--hero .already-card__footer {
  font-size: 0.6875rem;
  color: var(--already-text-secondary);
}

.already-card--hero .already-card__footer .already-card__location {
  white-space: normal;
  overflow: visible;
  font-size: inherit;
}

.already-card--hero .already-card__footer .already-card__meta {
  font-size: inherit;
  font-weight: 400;
}
```

- [ ] **Step 6: Register hero in registry**

Update `src/layouts/registry.js` — import hero:

```js
import { render as clean } from "./clean/clean.js";
import { render as hero } from "./hero/hero.js";
import { createElement } from "../views/helpers.js";

function placeholderRender(event, options) {
  const card = createElement("div", "already-card");
  card.textContent = event.title;
  return card;
}

const layouts = {
  clean,
  hero,
  badge: placeholderRender,
  compact: placeholderRender,
};

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}

export function registerLayout(name, renderFn) {
  layouts[name] = renderFn;
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/layouts/hero/hero.js src/layouts/hero/hero.css \
  src/layouts/registry.js test/layouts/hero.test.cjs
git commit -m "feat(theme): implement hero card layout

Bold uppercase title, description preview, footer with location and
date range. Supports vertical and horizontal orientations."
```

---

## Task 6: Badge Layout

Date badge overlay on image, full metadata, tag pills, description preview, action footer.

**Files:**
- Create: `src/layouts/badge/badge.js`
- Modify: `src/layouts/badge/badge.css`
- Create: `test/layouts/badge.test.cjs`
- Modify: `src/layouts/registry.js`

- [ ] **Step 1: Write failing tests for badge layout**

Create `test/layouts/badge.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/badge/badge.js");
  render = mod.render;
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("badge layout", () => {
  it("returns a .already-card--badge element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card--badge"));
  });

  it("includes date badge overlay on image", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    const badge = el.querySelector(".already-card__badge");
    assert.ok(badge);
    assert.ok(el.querySelector(".already-card__badge-day"));
    assert.ok(el.querySelector(".already-card__badge-month"));
  });

  it("includes date badge even without image", () => {
    const el = render(createTestEvent({ image: null }), baseOptions);
    assert.ok(el.querySelector(".already-card__badge"));
  });

  it("includes full date and time", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__meta"));
  });

  it("includes location with icon prefix", () => {
    const el = render(
      createTestEvent({ location: "The Venue" }),
      baseOptions,
    );
    const loc = el.querySelector(".already-card__location");
    assert.ok(loc);
    assert.ok(loc.textContent.includes("The Venue"));
  });

  it("includes description preview", () => {
    const el = render(
      createTestEvent({ description: "A great event" }),
      baseOptions,
    );
    assert.ok(el.querySelector(".already-card__description"));
  });

  it("renders tag pills when tags are present", () => {
    const el = render(
      createTestEvent({ tags: ["Outdoor", "Family"] }),
      baseOptions,
    );
    const tags = el.querySelectorAll(".already-card__tag");
    assert.strictEqual(tags.length, 2);
    assert.strictEqual(tags[0].textContent, "Outdoor");
    assert.strictEqual(tags[1].textContent, "Family");
  });

  it("omits tag container when no tags", () => {
    const el = render(createTestEvent({ tags: [] }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__tags"), null);
  });

  it("renders action footer with RSVP link when htmlLink present", () => {
    const el = render(
      createTestEvent({ htmlLink: "https://calendar.google.com/event/abc" }),
      baseOptions,
    );
    const actions = el.querySelectorAll(".already-card__action");
    assert.ok(actions.length > 0);
  });

  it("omits action footer when no htmlLink", () => {
    const el = render(createTestEvent({ htmlLink: "" }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__actions"), null);
  });

  it("applies horizontal orientation class", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(el.classList.contains("already-card--horizontal"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/layouts/badge.test.cjs`
Expected: FAIL

- [ ] **Step 3: Implement badge layout**

Create `src/layouts/badge/badge.js`:

```js
import { formatDate, formatTime } from "../../util/dates.js";
import { getDatePartsInTz } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

/**
 * Render a badge layout card.
 * Fields: date badge overlay on image, title, full date/time,
 * location, description preview, tag pills, action footer.
 */
export function render(event, options) {
  const { orientation, imagePosition, index, timezone, locale } = options;

  const card = createElement("div");
  let cls = "already-card already-card--badge";
  cls += ` already-card--${orientation}`;
  if (
    orientation === "horizontal" &&
    (imagePosition === "right" ||
      (imagePosition === "alternating" && index % 2 === 1))
  ) {
    cls += " already-card--image-right";
  }
  card.className = cls;

  // Date parts for badge
  const dateParts = getDatePartsInTz(event.start, timezone, locale);
  const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  // Image wrapper with badge overlay
  if (event.image) {
    const imageWrap = createElement("div", "already-card__image already-card__image--badged");
    const img = document.createElement("img");
    img.src = event.image;
    img.alt = event.title;
    img.setAttribute("loading", "lazy");
    img.onerror = () => {
      imageWrap.style.display = "none";
    };
    imageWrap.appendChild(img);

    const badge = buildBadge(dateParts, monthNames);
    imageWrap.appendChild(badge);
    card.appendChild(imageWrap);
  } else {
    // Badge without image — render inline in body (handled below)
  }

  // Body
  const body = createElement("div", "already-card__body");

  // Badge inline if no image
  if (!event.image) {
    const badge = buildBadge(dateParts, monthNames);
    badge.classList.add("already-card__badge--inline");
    body.appendChild(badge);
  }

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  body.appendChild(title);

  // Full date + time
  const dateStr = formatDate(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const endTimeStr =
    !event.allDay && event.end
      ? ` \u2013 ${formatTime(event.end, timezone, locale)}`
      : "";
  const meta = createElement("div", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}${endTimeStr}`;
  body.appendChild(meta);

  // Location
  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = `\u{1F4CD} ${event.location}`;
    body.appendChild(loc);
  }

  // Tags
  if (event.tags && event.tags.length > 0) {
    const tagsEl = createElement("div", "already-card__tags");
    for (const tag of event.tags) {
      const pill = createElement("span", "already-card__tag");
      pill.textContent = tag;
      tagsEl.appendChild(pill);
    }
    body.appendChild(tagsEl);
  }

  // Description preview
  if (event.description) {
    const desc = createElement("div", "already-card__description");
    desc.textContent = event.description;
    body.appendChild(desc);
  }

  // Action footer
  if (event.htmlLink) {
    const actions = createElement("div", "already-card__footer");
    const rsvp = createElement("span", "already-card__action");
    rsvp.textContent = "RSVP";
    actions.appendChild(rsvp);
    body.appendChild(actions);
  }

  card.appendChild(body);
  return card;
}

function buildBadge(dateParts, monthNames) {
  const badge = createElement("div", "already-card__badge");
  const day = createElement("div", "already-card__badge-day");
  day.textContent = dateParts.day;
  badge.appendChild(day);
  const month = createElement("div", "already-card__badge-month");
  month.textContent = monthNames[dateParts.month] || "";
  badge.appendChild(month);
  return badge;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/layouts/badge.test.cjs`
Expected: all 11 tests PASS

- [ ] **Step 5: Write badge CSS**

Update `src/layouts/badge/badge.css`:

```css
/* Badge layout — date badge overlay, tag pills, action footer */

.already-card--badge .already-card__image--badged {
  position: relative;
}

.already-card--badge .already-card__badge {
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  background: var(--already-primary);
  color: var(--already-primary-text);
  border-radius: 6px;
  padding: 0.25rem 0.5rem;
}

.already-card--badge .already-card__badge--inline {
  position: static;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.already-card--badge .already-card__image {
  aspect-ratio: 16 / 9;
}

.already-card--badge.already-card--horizontal .already-card__image {
  aspect-ratio: auto;
  min-height: 160px;
  width: 180px;
}

.already-card--badge .already-card__meta {
  font-size: 0.6875rem;
  color: var(--already-text-secondary);
  font-weight: 400;
}

.already-card--badge .already-card__location {
  font-size: 0.6875rem;
  white-space: normal;
}
```

- [ ] **Step 6: Register badge in registry**

Update `src/layouts/registry.js`:

```js
import { render as clean } from "./clean/clean.js";
import { render as hero } from "./hero/hero.js";
import { render as badge } from "./badge/badge.js";
import { createElement } from "../views/helpers.js";

function placeholderRender(event, options) {
  const card = createElement("div", "already-card");
  card.textContent = event.title;
  return card;
}

const layouts = {
  clean,
  hero,
  badge,
  compact: placeholderRender,
};

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}

export function registerLayout(name, renderFn) {
  layouts[name] = renderFn;
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/layouts/badge/badge.js src/layouts/badge/badge.css \
  src/layouts/registry.js test/layouts/badge.test.cjs
git commit -m "feat(theme): implement badge card layout

Date badge overlay on image, full metadata, tag pills, description
preview, action footer with RSVP link. Supports vertical/horizontal."
```

---

## Task 7: Compact Layout

No image, inline date badge, tags, dense information display.

**Files:**
- Create: `src/layouts/compact/compact.js`
- Modify: `src/layouts/compact/compact.css`
- Create: `test/layouts/compact.test.cjs`
- Modify: `src/layouts/registry.js`

- [ ] **Step 1: Write failing tests for compact layout**

Create `test/layouts/compact.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/compact/compact.js");
  render = mod.render;
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("compact layout", () => {
  it("returns a .already-card--compact element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card--compact"));
  });

  it("never renders an image, even when present", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    assert.strictEqual(el.querySelector(".already-card__image"), null);
    assert.strictEqual(el.querySelector("img"), null);
  });

  it("includes inline date badge", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__badge"));
    assert.ok(el.querySelector(".already-card__badge-day"));
    assert.ok(el.querySelector(".already-card__badge-month"));
  });

  it("includes title", () => {
    const el = render(createTestEvent({ title: "My Event" }), baseOptions);
    assert.strictEqual(
      el.querySelector(".already-card__title").textContent,
      "My Event",
    );
  });

  it("includes date/time", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__meta"));
  });

  it("includes location", () => {
    const el = render(
      createTestEvent({ location: "Central Park" }),
      baseOptions,
    );
    const loc = el.querySelector(".already-card__location");
    assert.ok(loc);
    assert.ok(loc.textContent.includes("Central Park"));
  });

  it("renders tag pills when present", () => {
    const el = render(
      createTestEvent({ tags: ["Outdoor", "Family"] }),
      baseOptions,
    );
    const tags = el.querySelectorAll(".already-card__tag");
    assert.strictEqual(tags.length, 2);
  });

  it("omits tags when empty", () => {
    const el = render(createTestEvent({ tags: [] }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__tags"), null);
  });

  it("does not include description", () => {
    const el = render(
      createTestEvent({ description: "Some text" }),
      baseOptions,
    );
    assert.strictEqual(el.querySelector(".already-card__description"), null);
  });

  it("ignores orientation — always renders without orientation class modifiers", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    // Compact does not use horizontal — it's a single-row layout
    assert.ok(!el.classList.contains("already-card--horizontal"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/layouts/compact.test.cjs`
Expected: FAIL

- [ ] **Step 3: Implement compact layout**

Create `src/layouts/compact/compact.js`:

```js
import { formatDateShort, formatTime } from "../../util/dates.js";
import { getDatePartsInTz } from "../../util/dates.js";
import { createElement } from "../../views/helpers.js";

/**
 * Render a compact layout card.
 * No image. Inline date badge, title, date/time, location, tag pills.
 */
export function render(event, options) {
  const { timezone, locale } = options;

  const card = createElement("div");
  card.className = "already-card already-card--compact";

  const body = createElement("div", "already-card__body already-card__body--compact");

  // Top row: info left, badge right
  const row = createElement("div", "already-card__compact-row");

  // Info column
  const info = createElement("div", "already-card__compact-info");

  const title = createElement("div", "already-card__title");
  title.textContent = event.title;
  info.appendChild(title);

  const dateStr = formatDateShort(event.start, timezone, locale);
  const timeStr = event.allDay
    ? ""
    : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
  const meta = createElement("div", "already-card__meta");
  meta.textContent = `${dateStr}${timeStr}`;
  info.appendChild(meta);

  if (event.location) {
    const loc = createElement("div", "already-card__location");
    loc.textContent = `\u{1F4CD} ${event.location}`;
    info.appendChild(loc);
  }

  row.appendChild(info);

  // Date badge
  const dateParts = getDatePartsInTz(event.start, timezone, locale);
  const monthNames = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  const badge = createElement("div", "already-card__badge already-card__badge--inline");
  const day = createElement("div", "already-card__badge-day");
  day.textContent = dateParts.day;
  badge.appendChild(day);
  const month = createElement("div", "already-card__badge-month");
  month.textContent = monthNames[dateParts.month] || "";
  badge.appendChild(month);
  row.appendChild(badge);

  body.appendChild(row);

  // Tags
  if (event.tags && event.tags.length > 0) {
    const tagsEl = createElement("div", "already-card__tags");
    for (const tag of event.tags) {
      const pill = createElement("span", "already-card__tag");
      pill.textContent = tag;
      tagsEl.appendChild(pill);
    }
    body.appendChild(tagsEl);
  }

  card.appendChild(body);
  return card;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/layouts/compact.test.cjs`
Expected: all 10 tests PASS

- [ ] **Step 5: Write compact CSS**

Update `src/layouts/compact/compact.css`:

```css
/* Compact layout — no image, inline badge, dense info */

.already-card--compact {
  display: block;
}

.already-card__compact-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.already-card__compact-info {
  flex: 1;
  min-width: 0;
}

.already-card--compact .already-card__badge--inline {
  background: var(--already-background);
  color: var(--already-primary);
  border-radius: 6px;
  padding: 0.375rem 0.625rem;
  flex-shrink: 0;
}

.already-card--compact .already-card__meta {
  font-size: 0.75rem;
}

.already-card--compact .already-card__location {
  font-size: 0.75rem;
  white-space: normal;
}

.already-card--compact .already-card__tags {
  margin-top: 0.5rem;
}

.already-card--compact .already-card__tag {
  background: var(--already-background);
  border: none;
  border-radius: 4px;
  padding: 0.125rem 0.375rem;
}
```

- [ ] **Step 6: Register compact in registry — final registry state**

Update `src/layouts/registry.js`:

```js
import { render as clean } from "./clean/clean.js";
import { render as hero } from "./hero/hero.js";
import { render as badge } from "./badge/badge.js";
import { render as compact } from "./compact/compact.js";

const layouts = { clean, hero, badge, compact };

export function getLayout(name) {
  return layouts[name] || layouts.clean;
}

export function registerLayout(name, renderFn) {
  layouts[name] = renderFn;
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 8: Commit**

```bash
git add src/layouts/compact/compact.js src/layouts/compact/compact.css \
  src/layouts/registry.js test/layouts/compact.test.cjs
git commit -m "feat(theme): implement compact card layout

No image, inline date badge, title, date/time, location, tag pills.
Ignores orientation since there is no image to position."
```

---

## Task 8: Color Palettes

Implement the four palette CSS files: light, dark, warm, cool.

**Files:**
- Modify: `src/palettes/light.css`
- Modify: `src/palettes/dark.css`
- Modify: `src/palettes/warm.css`
- Modify: `src/palettes/cool.css`

- [ ] **Step 1: Implement light palette**

Update `src/palettes/light.css`:

```css
/* Light palette — clean default */
.already[data-palette="light"] {
  --already-primary: #8b4513;
  --already-primary-text: #ffffff;
  --already-background: #f5f0eb;
  --already-surface: #ffffff;
  --already-text: #1a1a1a;
  --already-text-secondary: #666;
  --already-border: rgba(0, 0, 0, 0.06);
  --already-font-family: system-ui, sans-serif;
  --already-font-weight-normal: 400;
  --already-font-weight-bold: 700;
  --already-font-size-sm: 0.75rem;
  --already-font-size-base: 0.875rem;
  --already-font-size-lg: 0.9375rem;
  --already-radius: 8px;
  --already-radius-sm: 6px;
  --already-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --already-spacing: 1rem;
}
```

- [ ] **Step 2: Implement dark palette**

Update `src/palettes/dark.css`:

```css
/* Dark palette — dark mode */
.already[data-palette="dark"] {
  --already-primary: #d4a574;
  --already-primary-text: #1a1a1a;
  --already-background: #1a1a1a;
  --already-surface: #2a2a2a;
  --already-text: #e8e8e8;
  --already-text-secondary: #999;
  --already-border: rgba(255, 255, 255, 0.08);
  --already-font-family: system-ui, sans-serif;
  --already-font-weight-normal: 400;
  --already-font-weight-bold: 600;
  --already-font-size-sm: 0.75rem;
  --already-font-size-base: 0.875rem;
  --already-font-size-lg: 0.9375rem;
  --already-radius: 8px;
  --already-radius-sm: 6px;
  --already-shadow: none;
  --already-spacing: 1rem;
}
```

- [ ] **Step 3: Implement warm palette**

Update `src/palettes/warm.css`:

```css
/* Warm palette — earthy, organic, inviting */
.already[data-palette="warm"] {
  --already-primary: #c9713c;
  --already-primary-text: #ffffff;
  --already-background: #faf6f0;
  --already-surface: #fff8f0;
  --already-text: #2c1810;
  --already-text-secondary: #8b6f5c;
  --already-border: rgba(139, 69, 19, 0.1);
  --already-font-family: Georgia, "Times New Roman", serif;
  --already-font-weight-normal: 400;
  --already-font-weight-bold: 700;
  --already-font-size-sm: 0.75rem;
  --already-font-size-base: 0.9rem;
  --already-font-size-lg: 1rem;
  --already-radius: 12px;
  --already-radius-sm: 8px;
  --already-shadow: 0 2px 8px rgba(139, 69, 19, 0.08);
  --already-spacing: 1.125rem;
}
```

- [ ] **Step 4: Implement cool palette**

Update `src/palettes/cool.css`:

```css
/* Cool palette — modern, minimal, professional */
.already[data-palette="cool"] {
  --already-primary: #4a6cf7;
  --already-primary-text: #ffffff;
  --already-background: #f8f9fb;
  --already-surface: #ffffff;
  --already-text: #1a1f36;
  --already-text-secondary: #6b7280;
  --already-border: rgba(0, 0, 0, 0.06);
  --already-font-family: Inter, system-ui, sans-serif;
  --already-font-weight-normal: 400;
  --already-font-weight-bold: 600;
  --already-font-size-sm: 0.6875rem;
  --already-font-size-base: 0.8125rem;
  --already-font-size-lg: 0.875rem;
  --already-radius: 4px;
  --already-radius-sm: 3px;
  --already-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  --already-spacing: 0.875rem;
}
```

- [ ] **Step 5: Run build to verify CSS compiles**

Run: `node build.cjs`
Expected: "Build complete."

- [ ] **Step 6: Commit**

```bash
git add src/palettes/
git commit -m "feat(theme): implement light, dark, warm, and cool palettes

Each palette sets the full custom property set: colors, typography,
shape, and depth. Light is the default. Dark for dark mode. Warm for
earthy/organic vibes. Cool for modern/minimal."
```

---

## Task 9: Integrate Theme into Main Entry Point

Wire up `resolveTheme` in `src/already-cal.js` — set data attributes on container, apply CSS overrides, pass layout config to view renderers.

**Files:**
- Modify: `src/already-cal.js`

- [ ] **Step 1: Import resolveTheme and update theme application**

In `src/already-cal.js`, make these changes:

1. Add import at top:
```js
import { resolveTheme } from "./theme.js";
```

2. Replace the current theme application block (lines 115-131):

Old code:
```js
  const theme = { ...THEME_DEFAULTS, ...config.theme };
  const el =
    typeof config.el === "string"
      ? document.querySelector(config.el)
      : config.el;

  if (!el) {
    console.error("already-cal: Element not found:", config.el);
    return;
  }

  // Apply theme as CSS custom properties
  for (const [key, value] of Object.entries(theme)) {
    const prop = `--already-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    el.style.setProperty(prop, value);
  }

  el.classList.add("already");
```

New code:
```js
  const themeConfig = resolveTheme(config.theme);
  const el =
    typeof config.el === "string"
      ? document.querySelector(config.el)
      : config.el;

  if (!el) {
    console.error("already-cal: Element not found:", config.el);
    return;
  }

  // Set theme data attributes
  el.dataset.layout = themeConfig.layout;
  el.dataset.orientation = themeConfig.orientation;
  el.dataset.imagePosition = themeConfig.imagePosition;
  el.dataset.palette = themeConfig.palette;

  // Apply CSS custom property overrides (from user config, not palette)
  for (const [key, value] of Object.entries(themeConfig.overrides)) {
    const prop = `--already-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    el.style.setProperty(prop, value);
  }

  el.classList.add("already");

  // Store resolved theme for view renderers
  config._theme = themeConfig;
```

3. Remove the `THEME_DEFAULTS` constant (lines 82-91) — it's now in `theme.js` as part of `resolveTheme`. Also remove the `:root` CSS custom properties from `src/styles/base.css` — palettes handle this now via `[data-palette]` selectors.

- [ ] **Step 2: Update `:root` CSS to remove hardcoded values**

In `src/styles/base.css`, change the `:root` block to only set fallback defaults (used when no `data-palette` is set — e.g., when the light palette CSS hasn't loaded). The `:root` values act as a safety net:

Old (at top of file):
```css
:root {
  --already-primary: #8b4513;
  --already-primary-text: #ffffff;
  --already-background: #f5f0eb;
  --already-surface: #ffffff;
  --already-text: #1a1a1a;
  --already-text-secondary: #666;
  --already-radius: 8px;
  --already-font-family: system-ui, sans-serif;
}
```

New — expand with new properties and add a comment:
```css
/* Fallback defaults — overridden by palette [data-palette] selectors */
:root {
  --already-primary: #8b4513;
  --already-primary-text: #ffffff;
  --already-background: #f5f0eb;
  --already-surface: #ffffff;
  --already-text: #1a1a1a;
  --already-text-secondary: #666;
  --already-border: rgba(0, 0, 0, 0.06);
  --already-font-family: system-ui, sans-serif;
  --already-font-weight-normal: 400;
  --already-font-weight-bold: 700;
  --already-font-size-sm: 0.75rem;
  --already-font-size-base: 0.875rem;
  --already-font-size-lg: 0.9375rem;
  --already-radius: 8px;
  --already-radius-sm: 6px;
  --already-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  --already-spacing: 1rem;
}
```

- [ ] **Step 3: Run existing tests to verify nothing breaks**

Run: `npm test`
Expected: all tests pass. The theme changes don't affect existing grid/list test assertions because those tests pass config objects that don't include theme — the resolver defaults to clean/vertical/light which matches current behavior.

- [ ] **Step 4: Commit**

```bash
git add src/already-cal.js src/styles/base.css
git commit -m "feat(theme): wire resolveTheme into main entry point

Set data-layout, data-orientation, data-image-position, data-palette
on container element. Apply CSS overrides from user config. Store
resolved theme in config._theme for view renderers."
```

---

## Task 10: Integrate Layouts into Grid View

Replace hardcoded card HTML in `src/views/grid.js` with layout registry calls.

**Files:**
- Modify: `src/views/grid.js`
- Modify: `test/views/grid.test.cjs`

- [ ] **Step 1: Update grid view to use layout registry**

Replace `src/views/grid.js`.

**Important:** Do NOT use `applyEventClasses` — it overwrites `el.className`, which would destroy the layout classes set by the render function. Instead, use `classList.add` for the `--past` and `--featured` modifiers.

```js
import { getLayout } from "../layouts/registry.js";
import {
  bindEventClick,
  createElement,
  filterHidden,
  sortFeaturedByDate,
} from "./helpers.js";
import { isPast } from "../util/dates.js";

/** Render the card grid view with thumbnails. */
export function renderGridView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const theme = config._theme || {
    layout: "clean",
    orientation: "vertical",
    imagePosition: "left",
  };

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const grid = createElement("div", "already-grid");
  const renderCard = getLayout(theme.layout);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const card = renderCard(event, {
      orientation: theme.orientation,
      imagePosition: theme.imagePosition,
      index: i,
      timezone,
      locale,
      config,
    });

    // Add modifier classes via classList (not applyEventClasses which
    // overwrites className and would destroy layout-specific classes)
    if (isPast(event.start)) card.classList.add("already-card--past");
    if (event.featured) card.classList.add("already-card--featured");
    card.dataset.eventId = event.id;
    bindEventClick(card, event, "grid", config);

    grid.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(grid);
}
```

- [ ] **Step 2: Update grid tests to use new class names**

Update `test/views/grid.test.cjs` — change `.already-grid-card` to `.already-card`, `.already-grid-title` to `.already-card__title`, `.already-grid-image` to `.already-card__image`, `.already-grid-location` to `.already-card__location`, `.already-grid-card--featured` to `.already-card--featured`:

```js
require("../setup-dom.cjs");
const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderGridView;

before(async () => {
  const mod = await import("../../src/views/grid.js");
  renderGridView = mod.renderGridView;
});

beforeEach(() => {
  window.location.hash = "";
});

describe("renderGridView", () => {
  it("renders a card for each event", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "1", title: "Event A" }),
      createTestEvent({ id: "2", title: "Event B" }),
    ];
    renderGridView(container, events, "UTC", {});
    const cards = container.querySelectorAll(".already-card");
    assert.strictEqual(cards.length, 2);
  });

  it("displays event title via textContent", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ title: "Concert <script>alert(1)</script>" }),
    ];
    renderGridView(container, events, "UTC", {});
    const title = container.querySelector(".already-card__title");
    assert.strictEqual(title.textContent, "Concert <script>alert(1)</script>");
    assert.ok(!title.innerHTML.includes("<script>"));
  });

  it("displays event location", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ location: "Central Park" })];
    renderGridView(container, events, "UTC", {});
    assert.ok(
      container.querySelector(".already-card__location").textContent.includes("Central Park"),
    );
  });

  it("omits location when empty", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ location: "" })];
    renderGridView(container, events, "UTC", {});
    assert.strictEqual(container.querySelector(".already-card__location"), null);
  });

  it("renders image when present", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ image: "https://example.com/img.jpg" })];
    renderGridView(container, events, "UTC", {});
    const img = container.querySelector(".already-card__image img");
    assert.ok(img);
    assert.strictEqual(img.getAttribute("loading"), "lazy");
  });

  it("omits image container when no image", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ image: null })];
    renderGridView(container, events, "UTC", {});
    assert.strictEqual(container.querySelector(".already-card__image"), null);
  });

  it("navigates to detail on click", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ id: "click-test" })];
    renderGridView(container, events, "UTC", {});
    container.querySelector(".already-card").click();
    assert.strictEqual(window.location.hash, "#event/click-test");
  });

  it("sets accessibility attributes", () => {
    const container = document.createElement("div");
    const events = [createTestEvent()];
    renderGridView(container, events, "UTC", {});
    const card = container.querySelector(".already-card");
    assert.strictEqual(card.getAttribute("tabindex"), "0");
    assert.strictEqual(card.getAttribute("role"), "button");
  });

  it("does not render hidden events", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "1", title: "Visible" }),
      createTestEvent({ id: "2", title: "Hidden", hidden: true }),
    ];
    renderGridView(container, events, "UTC", {});
    const cards = container.querySelectorAll(".already-card");
    assert.strictEqual(cards.length, 1);
    assert.strictEqual(
      cards[0].querySelector(".already-card__title").textContent,
      "Visible",
    );
  });

  it("adds --featured class to featured events", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ featured: true })];
    renderGridView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card--featured"));
  });

  it("sorts featured events first within same date", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        id: "1",
        title: "Regular",
        start: "2026-04-15T10:00:00Z",
      }),
      createTestEvent({
        id: "2",
        title: "Star",
        start: "2026-04-15T14:00:00Z",
        featured: true,
      }),
    ];
    renderGridView(container, events, "UTC", {});
    const titles = [...container.querySelectorAll(".already-card__title")].map(
      (t) => t.textContent,
    );
    assert.strictEqual(titles[0], "Star");
    assert.strictEqual(titles[1], "Regular");
  });

  it("sets data-event-id on each card", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "abc-123" }),
      createTestEvent({ id: "def-456" }),
    ];
    renderGridView(container, events, "UTC", {});
    const cards = container.querySelectorAll(".already-card");
    assert.strictEqual(cards[0].dataset.eventId, "abc-123");
    assert.strictEqual(cards[1].dataset.eventId, "def-456");
  });

  it("does not sort featured across different dates", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        id: "1",
        title: "Apr14",
        start: "2026-04-14T10:00:00Z",
      }),
      createTestEvent({
        id: "2",
        title: "Apr15-Star",
        start: "2026-04-15T10:00:00Z",
        featured: true,
      }),
    ];
    renderGridView(container, events, "UTC", {});
    const titles = [...container.querySelectorAll(".already-card__title")].map(
      (t) => t.textContent,
    );
    assert.strictEqual(titles[0], "Apr14");
    assert.strictEqual(titles[1], "Apr15-Star");
  });

  it("uses layout from config._theme", () => {
    const container = document.createElement("div");
    const events = [createTestEvent()];
    renderGridView(container, events, "UTC", {
      _theme: { layout: "compact", orientation: "vertical", imagePosition: "left" },
    });
    assert.ok(container.querySelector(".already-card--compact"));
  });
});
```

- [ ] **Step 3: Run grid tests**

Run: `node --test test/views/grid.test.cjs`
Expected: all tests PASS

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/views/grid.js test/views/grid.test.cjs
git commit -m "feat(theme): integrate layout registry into grid view

Grid view now calls getLayout() to render cards instead of hardcoding
HTML. Reads layout/orientation/imagePosition from config._theme.
Updated tests to use .already-card class names."
```

---

## Task 11: Integrate Layouts into List View

Replace hardcoded list item HTML in `src/views/list.js` with layout registry calls.

**Files:**
- Modify: `src/views/list.js`
- Modify: `test/views/list.test.cjs`

- [ ] **Step 1: Update list view to use layout registry**

Replace `src/views/list.js`.

**Important:** Same as grid — use `classList.add` for modifiers, not `applyEventClasses`.

```js
import { getLayout } from "../layouts/registry.js";
import {
  bindEventClick,
  createElement,
  filterHidden,
  sortFeaturedByDate,
} from "./helpers.js";
import { isPast } from "../util/dates.js";

/** Render the list view using layout cards (horizontal by default). */
export function renderListView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const theme = config._theme || {
    layout: "clean",
    orientation: "vertical",
    imagePosition: "left",
  };

  // List view defaults to horizontal orientation
  const orientation =
    theme.layout === "compact" ? "vertical" : "horizontal";

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const list = createElement("div", "already-list");
  const renderCard = getLayout(theme.layout);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const card = renderCard(event, {
      orientation,
      imagePosition: theme.imagePosition,
      index: i,
      timezone,
      locale,
      config,
    });

    if (isPast(event.start)) card.classList.add("already-card--past");
    if (event.featured) card.classList.add("already-card--featured");
    card.dataset.eventId = event.id;
    bindEventClick(card, event, "list", config);

    list.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(list);
}
```

- [ ] **Step 2: Update list tests to use new class names**

Update `test/views/list.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let renderListView;

before(async () => {
  const mod = await import("../../src/views/list.js");
  renderListView = mod.renderListView;
});

beforeEach(() => {
  window.location.hash = "";
});

describe("renderListView", () => {
  it("renders a card for each event", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ id: "1" }), createTestEvent({ id: "2" })];
    renderListView(container, events, "UTC", {});
    assert.strictEqual(
      container.querySelectorAll(".already-card").length,
      2,
    );
  });

  it("displays event title safely via textContent", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ title: "<img src=x onerror=alert(1)>" })];
    renderListView(container, events, "UTC", {});
    const title = container.querySelector(".already-card__title");
    assert.strictEqual(title.textContent, "<img src=x onerror=alert(1)>");
    assert.ok(!title.innerHTML.includes("<img"));
  });

  it("displays date/time meta", () => {
    const container = document.createElement("div");
    const events = [createTestEvent()];
    renderListView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card__meta"));
  });

  it("displays location when present", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ location: "The Venue" })];
    renderListView(container, events, "UTC", {});
    assert.ok(
      container.querySelector(".already-card__location").textContent.includes("The Venue"),
    );
  });

  it("navigates to detail on click", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ id: "nav-test" })];
    renderListView(container, events, "UTC", {});
    container.querySelector(".already-card").click();
    assert.strictEqual(window.location.hash, "#event/nav-test");
  });

  it("does not render hidden events", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "1", hidden: false }),
      createTestEvent({ id: "2", hidden: true }),
    ];
    renderListView(container, events, "UTC", {});
    assert.strictEqual(
      container.querySelectorAll(".already-card").length,
      1,
    );
  });

  it("adds --featured class", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ featured: true })];
    renderListView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card--featured"));
  });

  it("sets data-event-id on each card", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "list-1" }),
      createTestEvent({ id: "list-2" }),
    ];
    renderListView(container, events, "UTC", {});
    const cards = container.querySelectorAll(".already-card");
    assert.strictEqual(cards[0].dataset.eventId, "list-1");
    assert.strictEqual(cards[1].dataset.eventId, "list-2");
  });

  it("sorts featured first within same date", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({
        id: "1",
        title: "Normal",
        start: "2026-04-15T10:00:00Z",
      }),
      createTestEvent({
        id: "2",
        title: "Featured",
        start: "2026-04-15T14:00:00Z",
        featured: true,
      }),
    ];
    renderListView(container, events, "UTC", {});
    const titles = [...container.querySelectorAll(".already-card__title")].map(
      (t) => t.textContent,
    );
    assert.strictEqual(titles[0], "Featured");
  });

  it("renders cards with horizontal orientation by default", () => {
    const container = document.createElement("div");
    const events = [createTestEvent({ image: "https://example.com/img.jpg" })];
    renderListView(container, events, "UTC", {});
    assert.ok(container.querySelector(".already-card--horizontal"));
  });
});
```

- [ ] **Step 3: Run list tests**

Run: `node --test test/views/list.test.cjs`
Expected: all tests PASS

- [ ] **Step 4: Run all tests**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/views/list.js test/views/list.test.cjs
git commit -m "feat(theme): integrate layout registry into list view

List view now uses layout registry for card rendering. Defaults to
horizontal orientation. Updated tests to .already-card class names."
```

---

## Task 12: Update applyEventClasses + Scroll Anchor Selector + Build + Final Tests

Fix remaining references to old class names in `already-cal.js` (scroll anchor selector) and `helpers.js` (`applyEventClasses`). Run build and full test suite.

**Files:**
- Modify: `src/already-cal.js` — update scroll anchor selector
- Modify: `src/styles/base.css` — update responsive grid/list overrides
- Modify: `package.json` — add `test/layouts/*.test.cjs` to test glob

- [ ] **Step 1: Update scroll anchor selector in `already-cal.js`**

In `src/already-cal.js`, find the scroll anchoring code (around line 252):

Old:
```js
const anchorEl = viewContainer.querySelector(
  ".already-grid-card:last-child, .already-list-item:last-child",
);
```

New:
```js
const anchorEl = viewContainer.querySelector(
  ".already-card:last-child",
);
```

- [ ] **Step 2: Update featured event selectors in `src/styles/base.css`**

If there are still references to `.already-grid-card--featured` or `.already-list-item--featured` in `src/styles/base.css`, remove them — they're now handled by `.already-card--featured` in `src/layouts/base.css`.

Keep the non-card featured selectors: `.already-day-event--featured`, `.already-month-chip--featured`, `.already-week-event--featured`.

- [ ] **Step 3: Update responsive grid container overrides in `src/styles/base.css`**

The responsive section may have references to `.already-grid-card` or `.already-list-item`. Check and update class names if needed. The container rules (`.already-grid` changing `grid-template-columns`) stay as-is.

- [ ] **Step 4: Update `package.json` test script**

Add `test/layouts/*.test.cjs` to the test glob:

```json
"test": "node --test test/*.test.cjs test/views/*.test.cjs test/ui/*.test.cjs test/layouts/*.test.cjs",
"test:coverage": "c8 node --test test/*.test.cjs test/views/*.test.cjs test/ui/*.test.cjs test/layouts/*.test.cjs"
```

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 6: Run build**

Run: `node build.cjs`
Expected: "Build complete."

- [ ] **Step 7: Verify dist output**

Run: `ls -la dist/`
Expected: `already-cal.js`, `already-cal.min.js`, `already-cal.css`, `already-cal.min.css`, `already-cal.js.map` all present and reasonable sizes.

- [ ] **Step 8: Commit**

```bash
git add src/already-cal.js src/styles/base.css package.json
git commit -m "fix: update scroll anchor selector and test glob for theme system

Update .already-grid-card references to .already-card.
Add test/layouts/ glob to test scripts."
```

---

## Task 13: Documentation

Update README with theme configuration and available layouts/palettes.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add theme documentation to README**

Add a new "Themes" section to `README.md` after the existing Configuration section. Include:

- Theme shorthand: `theme: "hero"`
- Full theme object with all options
- Available layouts: clean, hero, badge, compact (brief description of each)
- Available palettes: light, dark, warm, cool
- Orientation and image position options
- CSS custom property override examples

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add theme configuration guide to README

Document layout variants, color palettes, orientation options,
image position, and CSS custom property overrides."
```
