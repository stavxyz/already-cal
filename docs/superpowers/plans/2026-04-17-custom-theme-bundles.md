# Custom Theme Bundles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to register named theme bundles that package a layout renderer, palette defaults, orientation/imagePosition defaults, constraints, and CSS custom property overrides into a single reusable unit. Refactor the four built-in themes into bundles so everything flows through the same code path.

**Architecture:** A new `"theme"` registry type (built on the existing generic registry) stores bundle objects. `resolveTheme()` is rewritten to look up bundles, apply a priority chain (constraint > user > bundle default > THEME_DEFAULTS), and throw on constraint violations. The public API gains `registerTheme()` and a `THEMES` snapshot. Error handling differs by call site: `init()` renders error state and re-throws; `setConfig()` logs and preserves the current theme.

**Tech Stack:** Vanilla JS, Node.js built-in test runner, JSDOM, esbuild IIFE bundle, Biome linting

**Spec:** `docs/superpowers/specs/2026-04-17-custom-theme-bundles-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/themes/registry.js` | Theme registry type, validator, built-in bundles, validation sets, `getTheme()` |
| Modify | `src/theme.js` | Rewrite `resolveTheme()` for bundle lookup + priority chain; import validation sets from themes/registry |
| Modify | `src/already-cal.js` | Add `registerTheme()`, `THEMES` export, error handling in `init()`/`setConfig()` |
| Create | `test/themes/registry.test.cjs` | Theme registry validation, built-in bundles, `getTheme()` |
| Modify | `test/theme.test.cjs` | Update compact test to expect throw; add bundle resolution tests |
| Modify | `test/set-config.test.cjs` | Constraint violation non-destructive tests |
| Modify | `package.json` | Add `test/themes/*.test.cjs` to test glob |

---

### Task 1: Theme Bundle Registry — Type, Validator, and Built-ins

**Files:**
- Create: `src/themes/registry.js`
- Create: `test/themes/registry.test.cjs`
- Modify: `package.json` (test script)

- [ ] **Step 1: Add `test/themes/*.test.cjs` to test script**

In `package.json`, add `test/themes/*.test.cjs` to the test glob:

```json
"test": "node --test test/*.test.cjs test/views/*.test.cjs test/ui/*.test.cjs test/layouts/*.test.cjs test/themes/*.test.cjs",
```

- [ ] **Step 2: Write failing tests for theme registry validator**

Create `test/themes/registry.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let register, has, getTheme;

before(async () => {
  const reg = await import("../../src/registry.js");
  register = reg.register;
  has = reg.has;

  // Import theme registry (triggers defineType + registerBuiltIn for "theme")
  const themes = await import("../../src/themes/registry.js");
  getTheme = themes.getTheme;
});

describe("theme registry — validator rejects invalid bundles", () => {
  it("throws when bundle is not an object", () => {
    assert.throws(
      () => register("theme", "bad-str", "not-an-object"),
      /must be a plain object/,
    );
  });

  it("throws when bundle is null", () => {
    assert.throws(
      () => register("theme", "bad-null", null),
      /must be a plain object/,
    );
  });

  it("throws when bundle is an array", () => {
    assert.throws(
      () => register("theme", "bad-arr", []),
      /must be a plain object/,
    );
  });

  it("throws on unknown top-level key", () => {
    assert.throws(
      () => register("theme", "bad-key", { layout: "clean", bogus: true }),
      /unknown key "bogus"/,
    );
  });

  it("throws when layout is not a function or string", () => {
    assert.throws(
      () => register("theme", "bad-layout-type", { layout: 42 }),
      /layout must be a function or string/,
    );
  });

  it("throws when layout string references unregistered layout", () => {
    assert.throws(
      () => register("theme", "bad-layout-ref", { layout: "nonexistent" }),
      /not a registered layout/,
    );
  });

  it("throws on unknown defaults key", () => {
    assert.throws(
      () => register("theme", "bad-def-key", { defaults: { layout: "clean" } }),
      /unknown defaults key "layout"/,
    );
  });

  it("throws on invalid defaults value", () => {
    assert.throws(
      () =>
        register("theme", "bad-def-val", {
          defaults: { orientation: "diagonal" },
        }),
      /invalid defaults value "diagonal" for "orientation"/,
    );
  });

  it("throws on unknown constraints key", () => {
    assert.throws(
      () =>
        register("theme", "bad-con-key", {
          constraints: { bogus: "value" },
        }),
      /unknown constraints key "bogus"/,
    );
  });

  it("throws on invalid constraints value", () => {
    assert.throws(
      () =>
        register("theme", "bad-con-val", {
          constraints: { palette: "neon" },
        }),
      /invalid constraints value "neon" for "palette"/,
    );
  });

  it("throws when defaults is not an object", () => {
    assert.throws(
      () => register("theme", "bad-def-type", { defaults: "nope" }),
      /defaults must be a plain object/,
    );
  });

  it("throws when constraints is not an object", () => {
    assert.throws(
      () => register("theme", "bad-con-type", { constraints: 42 }),
      /constraints must be a plain object/,
    );
  });

  it("throws when overrides is not an object", () => {
    assert.throws(
      () => register("theme", "bad-ovr-type", { overrides: "nope" }),
      /overrides must be a plain object/,
    );
  });
});

describe("theme registry — validator accepts valid bundles", () => {
  it("accepts an empty bundle", () => {
    register("theme", "valid-empty", {});
    assert.strictEqual(has("theme", "valid-empty"), true);
  });

  it("accepts a bundle with layout string", () => {
    register("theme", "valid-layout-str", { layout: "clean" });
    assert.strictEqual(has("theme", "valid-layout-str"), true);
  });

  it("accepts a bundle with layout function", () => {
    register("theme", "valid-layout-fn", {
      layout: () => document.createElement("div"),
    });
    assert.strictEqual(has("theme", "valid-layout-fn"), true);
  });

  it("accepts a bundle with all valid sections", () => {
    register("theme", "valid-full", {
      layout: "hero",
      defaults: { orientation: "horizontal", imagePosition: "alternating", palette: "dark" },
      constraints: { orientation: "horizontal" },
      overrides: { primary: "#2563eb", fontSizeSm: "0.7rem" },
    });
    assert.strictEqual(has("theme", "valid-full"), true);
  });
});

describe("theme registry — built-in bundles", () => {
  it("registers clean as a built-in", () => {
    assert.strictEqual(has("theme", "clean"), true);
  });

  it("registers hero as a built-in", () => {
    assert.strictEqual(has("theme", "hero"), true);
  });

  it("registers badge as a built-in", () => {
    assert.strictEqual(has("theme", "badge"), true);
  });

  it("registers compact as a built-in", () => {
    assert.strictEqual(has("theme", "compact"), true);
  });

  it("compact bundle has orientation constraint", () => {
    const bundle = getTheme("compact");
    assert.deepStrictEqual(bundle.constraints, { orientation: "vertical" });
  });

  it("clean bundle has layout only", () => {
    const bundle = getTheme("clean");
    assert.strictEqual(bundle.layout, "clean");
    assert.strictEqual(bundle.defaults, undefined);
    assert.strictEqual(bundle.constraints, undefined);
  });

  it("throws when overriding a built-in theme name", () => {
    assert.throws(
      () => register("theme", "clean", { layout: "clean" }),
      /built-in/i,
    );
  });
});

describe("theme registry — getTheme", () => {
  it("returns bundle for registered theme", () => {
    const bundle = getTheme("compact");
    assert.ok(bundle);
    assert.strictEqual(bundle.layout, "compact");
  });

  it("returns undefined for unregistered name", () => {
    assert.strictEqual(getTheme("nonexistent"), undefined);
  });
});

describe("theme registry — custom theme re-registration", () => {
  it("replaces a previously registered custom theme", () => {
    register("theme", "replaceable", { layout: "clean" });
    assert.strictEqual(getTheme("replaceable").layout, "clean");

    register("theme", "replaceable", { layout: "hero" });
    assert.strictEqual(getTheme("replaceable").layout, "hero");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/themes/registry.test.cjs`
Expected: All tests fail — module `../../src/themes/registry.js` not found.

- [ ] **Step 4: Create `src/themes/registry.js` with type definition, validator, and built-ins**

```js
import { defineType, get, has, registerBuiltIn } from "../registry.js";
// Ensure layout registry is initialized before validating layout string references
import "../layouts/registry.js";

export const VALID_PALETTES = new Set(["light", "dark", "warm", "cool"]);
export const VALID_ORIENTATIONS = new Set(["vertical", "horizontal"]);
export const VALID_IMAGE_POSITIONS = new Set(["left", "right", "alternating"]);

const VALID_BUNDLE_KEYS = new Set([
  "layout",
  "defaults",
  "constraints",
  "overrides",
]);
const DIMENSION_KEYS = new Set(["orientation", "imagePosition", "palette"]);
const DIMENSION_VALIDATORS = {
  orientation: VALID_ORIENTATIONS,
  imagePosition: VALID_IMAGE_POSITIONS,
  palette: VALID_PALETTES,
};

const themeNames = [];

function validateBundle(name, bundle) {
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) {
    throw new Error(`Theme "${name}": bundle must be a plain object`);
  }

  for (const key of Object.keys(bundle)) {
    if (!VALID_BUNDLE_KEYS.has(key)) {
      throw new Error(`Theme "${name}": unknown key "${key}"`);
    }
  }

  if (bundle.layout !== undefined) {
    if (
      typeof bundle.layout !== "function" &&
      typeof bundle.layout !== "string"
    ) {
      throw new Error(
        `Theme "${name}": layout must be a function or string, got ${typeof bundle.layout}`,
      );
    }
    if (typeof bundle.layout === "string" && !has("layout", bundle.layout)) {
      throw new Error(
        `Theme "${name}": layout "${bundle.layout}" is not a registered layout`,
      );
    }
  }

  for (const section of ["defaults", "constraints"]) {
    if (bundle[section] !== undefined) {
      if (
        !bundle[section] ||
        typeof bundle[section] !== "object" ||
        Array.isArray(bundle[section])
      ) {
        throw new Error(
          `Theme "${name}": ${section} must be a plain object`,
        );
      }
      for (const [key, value] of Object.entries(bundle[section])) {
        if (!DIMENSION_KEYS.has(key)) {
          throw new Error(
            `Theme "${name}": unknown ${section} key "${key}"`,
          );
        }
        if (!DIMENSION_VALIDATORS[key].has(value)) {
          throw new Error(
            `Theme "${name}": invalid ${section} value "${value}" for "${key}"`,
          );
        }
      }
    }
  }

  if (bundle.overrides !== undefined) {
    if (
      !bundle.overrides ||
      typeof bundle.overrides !== "object" ||
      Array.isArray(bundle.overrides)
    ) {
      throw new Error(`Theme "${name}": overrides must be a plain object`);
    }
  }
}

defineType("theme", validateBundle);

registerBuiltIn("theme", "clean", { layout: "clean" });
themeNames.push("clean");

registerBuiltIn("theme", "hero", { layout: "hero" });
themeNames.push("hero");

registerBuiltIn("theme", "badge", { layout: "badge" });
themeNames.push("badge");

registerBuiltIn("theme", "compact", {
  layout: "compact",
  constraints: { orientation: "vertical" },
});
themeNames.push("compact");

export function getTheme(name) {
  return get("theme", name);
}

export function getThemeNames() {
  return [...themeNames];
}

export function addThemeName(name) {
  if (!themeNames.includes(name)) {
    themeNames.push(name);
  }
}
```

- [ ] **Step 5: Run theme registry tests to verify they pass**

Run: `node --test test/themes/registry.test.cjs`
Expected: All tests pass.

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/themes/registry.js test/themes/registry.test.cjs package.json
git commit -m "feat: add theme bundle registry with validator and built-ins (issue #36)"
```

---

### Task 2: Rewrite resolveTheme — Bundle Lookup and Priority Chain

**Files:**
- Modify: `src/theme.js`
- Modify: `test/theme.test.cjs`

- [ ] **Step 1: Update existing compact test to expect constraint throw**

In `test/theme.test.cjs`, replace the "ignores orientation for compact layout" test:

Replace:
```js
  it("ignores orientation for compact layout", () => {
    const result = resolveTheme({
      layout: "compact",
      orientation: "horizontal",
    });
    assert.strictEqual(result.orientation, "vertical");
  });
```

With:
```js
  it("throws when user contradicts compact orientation constraint", () => {
    assert.throws(
      () => resolveTheme({ layout: "compact", orientation: "horizontal" }),
      /constrains orientation to "vertical", but "horizontal" was passed/,
    );
  });

  it("resolves compact orientation to vertical via constraint", () => {
    const result = resolveTheme({ layout: "compact" });
    assert.strictEqual(result.orientation, "vertical");
  });

  it("allows compact with explicit vertical orientation (matches constraint)", () => {
    const result = resolveTheme({
      layout: "compact",
      orientation: "vertical",
    });
    assert.strictEqual(result.orientation, "vertical");
  });
```

- [ ] **Step 2: Add bundle resolution tests to `test/theme.test.cjs`**

Add a new describe block at the end of the resolveTheme suite in `test/theme.test.cjs`:

```js
describe("resolveTheme — bundle resolution", () => {
  let register;
  before(async () => {
    // Ensure theme registry is loaded (via theme.js import chain)
    const reg = await import("../src/registry.js");
    register = reg.register;
  });

  it("applies bundle defaults when user omits dimensions", () => {
    register("theme", "bundle-defaults", {
      layout: "hero",
      defaults: { orientation: "horizontal", palette: "dark" },
    });
    const result = resolveTheme("bundle-defaults");
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.orientation, "horizontal");
    assert.strictEqual(result.palette, "dark");
  });

  it("user value overrides bundle default", () => {
    register("theme", "bundle-override", {
      layout: "clean",
      defaults: { palette: "dark" },
    });
    const result = resolveTheme({ layout: "bundle-override", palette: "warm" });
    assert.strictEqual(result.palette, "warm");
  });

  it("constraint wins over user value — throws on conflict", () => {
    register("theme", "bundle-constraint", {
      layout: "badge",
      constraints: { palette: "light" },
    });
    assert.throws(
      () =>
        resolveTheme({ layout: "bundle-constraint", palette: "dark" }),
      /constrains palette to "light", but "dark" was passed/,
    );
  });

  it("constraint is applied when user omits dimension", () => {
    register("theme", "bundle-silent-constraint", {
      layout: "clean",
      constraints: { orientation: "horizontal" },
    });
    const result = resolveTheme("bundle-silent-constraint");
    assert.strictEqual(result.orientation, "horizontal");
  });

  it("merges bundle CSS overrides with user overrides", () => {
    register("theme", "bundle-css", {
      layout: "hero",
      overrides: { primary: "#2563eb", fontSizeSm: "0.7rem" },
    });
    const result = resolveTheme({
      layout: "bundle-css",
      primary: "#ff0000",
      radius: "4px",
    });
    assert.strictEqual(result.overrides.primary, "#ff0000");
    assert.strictEqual(result.overrides.fontSizeSm, "0.7rem");
    assert.strictEqual(result.overrides.radius, "4px");
  });

  it("string shorthand resolves bundle", () => {
    register("theme", "bundle-shorthand", {
      layout: "badge",
      defaults: { palette: "cool" },
    });
    const result = resolveTheme("bundle-shorthand");
    assert.strictEqual(result.layout, "badge");
    assert.strictEqual(result.palette, "cool");
  });

  it("non-bundle string falls back to layout lookup", () => {
    const result = resolveTheme("hero");
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.palette, "light");
  });

  it("non-bundle layout in object falls back to layout lookup", () => {
    const result = resolveTheme({ layout: "hero", palette: "dark" });
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.palette, "dark");
  });

  it("full priority chain: constraint > user > bundle default > THEME_DEFAULTS", () => {
    register("theme", "bundle-priority", {
      layout: "clean",
      defaults: { palette: "dark", imagePosition: "right" },
      constraints: { orientation: "horizontal" },
    });
    const result = resolveTheme({
      layout: "bundle-priority",
      palette: "warm",
    });
    assert.strictEqual(result.orientation, "horizontal");
    assert.strictEqual(result.palette, "warm");
    assert.strictEqual(result.imagePosition, "right");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/theme.test.cjs`
Expected: Compact test fails (currently returns vertical silently, now expects throw). Bundle tests fail (no bundle support in resolveTheme yet).

- [ ] **Step 4: Rewrite `src/theme.js` — import from themes/registry, add bundle lookup and priority chain**

Replace the entire contents of `src/theme.js`:

```js
import { has } from "./registry.js";
// Side-effect import: initializes the "theme" registry type and registers
// built-in bundles. Also transitively initializes the "layout" registry.
import {
  VALID_IMAGE_POSITIONS,
  VALID_ORIENTATIONS,
  VALID_PALETTES,
  getTheme,
} from "./themes/registry.js";

const THEME_KEYS = new Set([
  "layout",
  "orientation",
  "imagePosition",
  "palette",
]);

export const THEME_DEFAULTS = {
  layout: "clean",
  orientation: "vertical",
  imagePosition: "left",
  palette: "light",
};

/**
 * Resolve a single dimension (orientation, imagePosition, palette) through
 * the priority chain: constraint > user > bundle default > THEME_DEFAULTS.
 * Throws when a user value conflicts with a bundle constraint.
 */
function resolveDimension(dimension, userValue, bundle, validSet, themeName) {
  const constraint = bundle?.constraints?.[dimension];
  const bundleDefault = bundle?.defaults?.[dimension];

  if (constraint !== undefined) {
    if (userValue !== undefined && userValue !== constraint) {
      throw new Error(
        `already-cal: Theme "${themeName}" constrains ${dimension} to "${constraint}", but "${userValue}" was passed`,
      );
    }
    return constraint;
  }

  if (userValue !== undefined && validSet.has(userValue)) {
    return userValue;
  }

  if (bundleDefault !== undefined) {
    return bundleDefault;
  }

  return THEME_DEFAULTS[dimension];
}

/**
 * Resolve a theme config value (string shorthand or object) into
 * normalized layout/palette/orientation settings plus CSS overrides.
 *
 * Checks the theme bundle registry first. If the layout names a registered
 * bundle, applies its defaults, constraints, and CSS overrides with the
 * priority chain: constraint > user > bundle default > THEME_DEFAULTS.
 *
 * Throws on constraint violations (user value conflicts with bundle constraint).
 */
export function resolveTheme(theme) {
  if (typeof theme === "string") {
    theme = { layout: theme };
  }
  const input = theme || {};

  // Check if the layout names a theme bundle
  const bundle = input.layout ? getTheme(input.layout) : undefined;

  // Resolve layout
  let layout;
  if (bundle) {
    layout = bundle.layout || input.layout;
  } else if (has("layout", input.layout)) {
    layout = input.layout;
  } else {
    if (input.layout != null && input.layout !== THEME_DEFAULTS.layout) {
      console.warn(
        `already-cal: Unknown layout "${input.layout}", falling back to "${THEME_DEFAULTS.layout}"`,
      );
    }
    layout = THEME_DEFAULTS.layout;
  }

  const themeName = input.layout;

  const orientation = resolveDimension(
    "orientation",
    input.orientation,
    bundle,
    VALID_ORIENTATIONS,
    themeName,
  );

  const rawImagePosition = resolveDimension(
    "imagePosition",
    input.imagePosition,
    bundle,
    VALID_IMAGE_POSITIONS,
    themeName,
  );

  const palette = resolveDimension(
    "palette",
    input.palette,
    bundle,
    VALID_PALETTES,
    themeName,
  );

  // imagePosition only applies when horizontal
  const imagePosition =
    orientation === "horizontal"
      ? rawImagePosition
      : THEME_DEFAULTS.imagePosition;

  // CSS overrides: user overrides > bundle overrides (merged)
  const userOverrides = {};
  for (const [key, value] of Object.entries(input)) {
    if (!THEME_KEYS.has(key)) {
      userOverrides[key] = value;
    }
  }
  const overrides = { ...(bundle?.overrides || {}), ...userOverrides };

  return { layout, orientation, imagePosition, palette, overrides };
}

/**
 * Apply a theme config to a DOM element. Resolves the theme, sets data
 * attributes, clears previous CSS overrides, and applies new ones.
 *
 * @param {HTMLElement} el - The container element
 * @param {string|object} themeInput - Raw theme config (string shorthand or object)
 * @param {string[]} previousOverrideKeys - CSS property names set by a prior applyTheme call
 * @returns {{ layout, palette, orientation, imagePosition, overrides, overrideKeys }}
 */
export function applyTheme(el, themeInput, previousOverrideKeys) {
  const theme = resolveTheme(themeInput);

  el.dataset.layout = theme.layout;
  el.dataset.orientation = theme.orientation;
  el.dataset.imagePosition = theme.imagePosition;
  el.dataset.palette = theme.palette;

  // Clear previous CSS overrides
  for (const prop of previousOverrideKeys) {
    el.style.removeProperty(prop);
  }

  // Apply new CSS overrides
  const overrideKeys = [];
  for (const [key, value] of Object.entries(theme.overrides)) {
    const prop = `--already-${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;
    el.style.setProperty(prop, value);
    overrideKeys.push(prop);
  }

  return { ...theme, overrideKeys };
}
```

- [ ] **Step 5: Run theme tests to verify they pass**

Run: `node --test test/theme.test.cjs`
Expected: All tests pass (including updated compact tests and new bundle tests).

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/theme.js test/theme.test.cjs
git commit -m "feat: rewrite resolveTheme with bundle lookup and constraint system (issue #36)"
```

---

### Task 3: Public API — registerTheme and THEMES

**Files:**
- Modify: `src/already-cal.js`
- Modify: `test/themes/registry.test.cjs`

- [ ] **Step 1: Add failing tests for registerTheme and THEMES**

Append to `test/themes/registry.test.cjs`:

```js
describe("registerTheme — public API", () => {
  let registerTheme;
  before(async () => {
    const mod = await import("../../src/already-cal.js");
    registerTheme = mod.registerTheme;
  });

  it("registers a theme bundle with layout string", () => {
    registerTheme("pub-api-str", {
      layout: "hero",
      defaults: { palette: "dark" },
    });
    assert.strictEqual(has("theme", "pub-api-str"), true);
    assert.strictEqual(getTheme("pub-api-str").layout, "hero");
  });

  it("auto-registers layout function under theme name", () => {
    const renderFn = () => document.createElement("div");
    registerTheme("pub-api-fn", { layout: renderFn });
    // Layout registry should have the function registered under the theme name
    assert.strictEqual(has("layout", "pub-api-fn"), true);
    // Bundle should store the layout name as a string
    assert.strictEqual(getTheme("pub-api-fn").layout, "pub-api-fn");
  });

  it("throws when overriding a built-in theme name", () => {
    assert.throws(
      () => registerTheme("compact", { layout: "compact" }),
      /built-in/i,
    );
  });

  it("allows re-registering a custom theme name", () => {
    registerTheme("pub-api-replace", { layout: "clean" });
    registerTheme("pub-api-replace", { layout: "badge" });
    assert.strictEqual(getTheme("pub-api-replace").layout, "badge");
  });
});

describe("THEMES — frozen snapshot", () => {
  let THEMES_ref;
  before(async () => {
    const mod = await import("../../src/already-cal.js");
    THEMES_ref = () => mod.THEMES;
  });

  it("includes all four built-in themes", () => {
    const themes = THEMES_ref();
    assert.ok(themes.clean);
    assert.ok(themes.hero);
    assert.ok(themes.badge);
    assert.ok(themes.compact);
  });

  it("includes custom themes registered via registerTheme", () => {
    const themes = THEMES_ref();
    assert.ok(themes["pub-api-str"], "should include custom theme registered earlier");
  });

  it("compact bundle shows constraint", () => {
    const themes = THEMES_ref();
    assert.deepStrictEqual(themes.compact.constraints, {
      orientation: "vertical",
    });
  });

  it("snapshot is frozen", () => {
    const themes = THEMES_ref();
    assert.ok(Object.isFrozen(themes));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/themes/registry.test.cjs`
Expected: Tests fail — `registerTheme` and `THEMES` not exported from already-cal.js.

- [ ] **Step 3: Add registerTheme() and THEMES to `src/already-cal.js`**

At the top of `src/already-cal.js`, add the import:

```js
import { addThemeName, getTheme, getThemeNames } from "./themes/registry.js";
```

After the existing `registerLayout` function, add:

```js
/**
 * Register a custom theme bundle. Packages a layout, palette/orientation
 * defaults, constraints, and CSS custom property overrides into a reusable unit.
 *
 * If `bundle.layout` is a render function, it is auto-registered in the
 * layout registry under the theme name. Built-in names cannot be overridden.
 */
export function registerTheme(name, bundle) {
  const processed = { ...bundle };
  if (typeof bundle.layout === "function") {
    register("layout", name, bundle.layout);
    processed.layout = name;
  }
  register("theme", name, processed);
  addThemeName(name);
  THEMES = buildThemesSnapshot();
}
```

Add the THEMES snapshot builder and export:

```js
function buildThemesSnapshot() {
  const result = {};
  for (const name of getThemeNames()) {
    const bundle = getTheme(name);
    if (bundle) {
      const copy = { layout: bundle.layout };
      if (bundle.defaults) copy.defaults = { ...bundle.defaults };
      if (bundle.constraints) copy.constraints = { ...bundle.constraints };
      if (bundle.overrides) copy.overrides = { ...bundle.overrides };
      result[name] = Object.freeze(copy);
    }
  }
  return Object.freeze(result);
}

/**
 * Frozen snapshot of all registered theme bundles (built-in and custom).
 * Updated when registerTheme() is called. In the IIFE bundle, esbuild's
 * getter ensures each access to Already.THEMES returns the latest snapshot.
 */
export let THEMES = buildThemesSnapshot();
```

- [ ] **Step 4: Run theme registry tests to verify they pass**

Run: `node --test test/themes/registry.test.cjs`
Expected: All tests pass.

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/already-cal.js test/themes/registry.test.cjs
git commit -m "feat: add registerTheme() public API and THEMES snapshot (issue #36)"
```

---

### Task 4: Error Handling — init() and setConfig()

**Files:**
- Modify: `src/already-cal.js`
- Modify: `test/set-config.test.cjs`

- [ ] **Step 1: Add failing tests for constraint violation in setConfig**

Append to `test/set-config.test.cjs`:

```js
describe("setConfig — constraint violation handling", () => {
  it("preserves current theme when constraint is violated", () => {
    const { instance, container } = createInitedInstance({
      theme: "hero",
    });
    assert.strictEqual(container.dataset.layout, "hero");

    // compact constrains orientation to vertical — passing horizontal should fail
    instance.setConfig({
      theme: { layout: "compact", orientation: "horizontal" },
    });

    // Theme should be unchanged — still hero
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("logs error on constraint violation", (t) => {
    const errors = [];
    const origError = console.error;
    console.error = (...args) => errors.push(args.join(" "));

    const { instance } = createInitedInstance({ theme: "hero" });
    instance.setConfig({
      theme: { layout: "compact", orientation: "horizontal" },
    });

    console.error = origError;
    assert.ok(
      errors.some((msg) => msg.includes("constrains orientation")),
      "should log constraint violation error",
    );
  });

  it("accepts valid theme after a constraint violation", () => {
    const { instance, container } = createInitedInstance({
      theme: "hero",
    });
    // First: invalid — should fail silently
    instance.setConfig({
      theme: { layout: "compact", orientation: "horizontal" },
    });
    assert.strictEqual(container.dataset.layout, "hero");

    // Second: valid — should succeed
    instance.setConfig({ theme: "badge" });
    assert.strictEqual(container.dataset.layout, "badge");
  });
});
```

- [ ] **Step 2: Add failing test for constraint violation in init**

Also append to `test/set-config.test.cjs` (which already has init imported):

```js
describe("init — constraint violation handling", () => {
  it("renders error state on constraint violation", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let threw = false;
    try {
      init({
        el: container,
        data: { events: [], calendar: { name: "Test", description: "", timezone: "UTC" } },
        theme: { layout: "compact", orientation: "horizontal" },
      });
    } catch {
      threw = true;
    }
    assert.ok(threw, "init should throw on constraint violation");
    assert.ok(
      container.querySelector(".already-error") ||
        container.innerHTML.includes("constrains"),
      "container should show error state",
    );
    container.remove();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test test/set-config.test.cjs`
Expected: Constraint violation tests fail — current code doesn't catch/handle the throw from resolveTheme.

- [ ] **Step 4: Add error handling in init()**

In `src/already-cal.js`, inside the `init()` function, wrap the theme application in a try/catch. Replace:

```js
  let themeResult = applyTheme(el, config.theme, []);
  config._theme = themeResult;

  el.classList.add("already");
```

With:

```js
  let themeResult;
  try {
    themeResult = applyTheme(el, config.theme, []);
  } catch (err) {
    el.classList.add("already");
    el.innerHTML = `<div class="already-error"><p>${err.message}</p></div>`;
    throw err;
  }
  config._theme = themeResult;

  el.classList.add("already");
```

- [ ] **Step 5: Add error handling in setConfig()**

In `src/already-cal.js`, inside the `setConfig()` closure, replace the theme update block:

```js
    if (newConfig.theme !== undefined) {
      const prev = config._theme;
      themeResult = applyTheme(el, newConfig.theme, themeResult.overrideKeys);
      if (
        themeResult.layout !== prev.layout ||
        themeResult.orientation !== prev.orientation ||
        themeResult.imagePosition !== prev.imagePosition
      ) {
        needsRerender = true;
      }
      config._theme = themeResult;
    }
```

With:

```js
    if (newConfig.theme !== undefined) {
      try {
        const prev = config._theme;
        const newThemeResult = applyTheme(
          el,
          newConfig.theme,
          themeResult.overrideKeys,
        );
        if (
          newThemeResult.layout !== prev.layout ||
          newThemeResult.orientation !== prev.orientation ||
          newThemeResult.imagePosition !== prev.imagePosition
        ) {
          needsRerender = true;
        }
        themeResult = newThemeResult;
        config._theme = newThemeResult;
      } catch (err) {
        console.error("already-cal:", err.message);
      }
    }
```

- [ ] **Step 6: Run set-config tests to verify they pass**

Run: `node --test test/set-config.test.cjs`
Expected: All tests pass (including new constraint violation tests).

- [ ] **Step 7: Run full test suite to verify no regressions**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/already-cal.js test/set-config.test.cjs
git commit -m "feat: add constraint violation error handling in init() and setConfig() (issue #36)"
```

---

### Task 5: Documentation

**Files:**
- Modify: `docs/configuration.md`
- Modify: `README.md`

- [ ] **Step 1: Read current docs**

Read `docs/configuration.md` and `README.md` to understand the existing theme documentation structure.

- [ ] **Step 2: Add Custom Themes section to `docs/configuration.md`**

Add a "Custom Themes" section after the existing Themes section. Document:

- `Already.registerTheme(name, bundle)` API with parameter descriptions
- Bundle shape: `layout`, `defaults`, `constraints`, `overrides`
- Validation rules (what keys are accepted, what values are valid)
- String shorthand resolution (bundle lookup → layout fallback)
- Priority chain: constraint > user > bundle default > theme defaults
- CSS overrides merging (user wins over bundle)
- Constraint violations (throws in `init()`, logs in `setConfig()`)
- `Already.THEMES` snapshot
- Auto-registration of layout functions
- Re-registration behavior
- Built-in protection
- Full example with a custom "timeline" theme

- [ ] **Step 3: Update README.md Themes section**

Add a brief custom theme bundle example to the README's Themes section, with a link to the full documentation in `docs/configuration.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/configuration.md README.md
git commit -m "docs: add custom theme bundles documentation (issue #36)"
```

---

### Task 6: Build and Final Verification

**Files:**
- Modify: `dist/already-cal.js`, `dist/already-cal.min.js` (rebuilt)

- [ ] **Step 1: Run linter**

Run: `npx biome ci .`
Expected: No errors.

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: All tests pass.

- [ ] **Step 3: Rebuild dist**

Run: `npm run build`
Expected: Build succeeds. `dist/already-cal.js` includes the new `registerTheme`, `THEMES` exports.

- [ ] **Step 4: Verify IIFE exports in built bundle**

Run: `grep -E 'registerTheme|THEMES' dist/already-cal.js | head -5`
Expected: Both `registerTheme` and `THEMES` appear in the IIFE export object.

- [ ] **Step 5: Commit**

```bash
git add dist/
git commit -m "build: rebuild dist with theme bundle support"
```
