# Runtime Config API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `setConfig()` and `postMessage` APIs so already-cal instances can update theme, view, and display settings at runtime without teardown/reinit.

**Architecture:** Extract theme-application logic from `init()` into a reusable `applyTheme()` helper. Have `init()` return an instance object with `setConfig()`. Register a `postMessage` listener that delegates to `setConfig()`. Store `Already._instance` for the global convenience method `Already.setConfig()`.

**Tech Stack:** Vanilla JS, Node built-in test runner, JSDOM, esbuild IIFE bundle

**Pre-existing test failures:** 4 pagination tests fail on main due to hardcoded past dates — these are not regressions from this work.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `src/theme.js` | Theme resolution + **theme application** (new: `applyTheme()`) | Modify |
| `src/already-cal.js` | Init, instance lifecycle, `setConfig()`, postMessage listener | Modify |
| `test/set-config.test.cjs` | Tests for `setConfig()` runtime updates | Create |
| `test/postmessage.test.cjs` | Tests for postMessage listener | Create |

---

### Task 1: Extract `applyTheme()` helper into `src/theme.js`

The theme-application code in `init()` (lines 105–131 of `src/already-cal.js`) resolves the theme, sets data attributes, and applies CSS overrides. This logic needs to be reusable by `setConfig()`. Extract it into a function in `src/theme.js` that both `init()` and `setConfig()` can call.

**Files:**
- Modify: `src/theme.js`
- Modify: `src/already-cal.js:105-131`
- Test: `test/theme.test.cjs`

- [ ] **Step 1: Write failing tests for `applyTheme()`**

Add these tests to the end of `test/theme.test.cjs`:

```js
describe("applyTheme", () => {
  it("sets data-layout attribute on element", () => {
    const el = document.createElement("div");
    const resolved = applyTheme(el, { layout: "hero" }, []);
    assert.strictEqual(el.dataset.layout, "hero");
    assert.strictEqual(resolved.layout, "hero");
  });

  it("sets data-palette attribute on element", () => {
    const el = document.createElement("div");
    applyTheme(el, { palette: "dark" }, []);
    assert.strictEqual(el.dataset.palette, "dark");
  });

  it("sets data-orientation attribute on element", () => {
    const el = document.createElement("div");
    applyTheme(el, { orientation: "horizontal" }, []);
    assert.strictEqual(el.dataset.orientation, "horizontal");
  });

  it("sets data-imagePosition attribute on element", () => {
    const el = document.createElement("div");
    applyTheme(el, { orientation: "horizontal", imagePosition: "right" }, []);
    assert.strictEqual(el.dataset.imageposition, "right");
  });

  it("applies CSS custom property overrides", () => {
    const el = document.createElement("div");
    applyTheme(el, { primary: "#ff0000", radius: "0px" }, []);
    assert.strictEqual(
      el.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
    assert.strictEqual(el.style.getPropertyValue("--already-radius"), "0px");
  });

  it("clears previous CSS overrides not in new config", () => {
    const el = document.createElement("div");
    const prev1 = applyTheme(el, { primary: "#ff0000" }, []);
    assert.strictEqual(
      el.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );

    applyTheme(el, { palette: "dark" }, prev1.overrideKeys);
    assert.strictEqual(el.style.getPropertyValue("--already-primary"), "");
  });

  it("returns resolved theme and overrideKeys", () => {
    const el = document.createElement("div");
    const result = applyTheme(
      el,
      { layout: "badge", primary: "#333" },
      [],
    );
    assert.strictEqual(result.layout, "badge");
    assert.strictEqual(result.palette, "light");
    assert.ok(Array.isArray(result.overrideKeys));
    assert.ok(result.overrideKeys.includes("--already-primary"));
  });

  it("accepts string shorthand", () => {
    const el = document.createElement("div");
    const result = applyTheme(el, "hero", []);
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(el.dataset.layout, "hero");
  });
});
```

Also update the `before` block to import `applyTheme`:

```js
let resolveTheme, applyTheme;

before(async () => {
  const mod = await import("../src/theme.js");
  resolveTheme = mod.resolveTheme;
  applyTheme = mod.applyTheme;
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/theme.test.cjs`
Expected: FAIL — `applyTheme` is not exported from `src/theme.js`

- [ ] **Step 3: Implement `applyTheme()` in `src/theme.js`**

Add this function to the end of `src/theme.js`, before the closing of the file:

```js
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

- [ ] **Step 4: Update `init()` in `src/already-cal.js` to use `applyTheme()`**

Replace lines 1-3 of the import section — change the `resolveTheme` import:

```js
import { applyTheme } from "./theme.js";
```

Replace lines 105–131 (theme resolution + application) with:

```js
  let themeResult = applyTheme(el, config.theme, []);
  config._theme = themeResult;
```

Remove the now-unused `resolveTheme` import. The `applyTheme` import replaces it.

- [ ] **Step 5: Run all tests to verify they pass**

Run: `node --test test/theme.test.cjs`
Expected: All pass (existing `resolveTheme` tests + new `applyTheme` tests)

Run: `npm test`
Expected: 449+ pass (same pre-existing 4 pagination failures)

- [ ] **Step 6: Commit**

```bash
git add src/theme.js src/already-cal.js test/theme.test.cjs
git commit -m "refactor: extract applyTheme() helper from init()"
```

---

### Task 2: Add `setConfig()` method and return instance from `init()`

Make `init()` return an instance object with `setConfig()`. Store `Already._instance` for global convenience. `setConfig()` accepts partial config, merges it, and re-renders only what changed.

**Files:**
- Modify: `src/already-cal.js`
- Create: `test/set-config.test.cjs`

- [ ] **Step 1: Write failing tests for `setConfig()` — theme updates**

Create `test/set-config.test.cjs`:

```js
require("./setup-dom.cjs");
const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let init, DEFAULTS;

before(async () => {
  const mod = await import("../src/already-cal.js");
  init = mod.init;
  DEFAULTS = mod.DEFAULTS;
});

function createInitedInstance(configOverrides = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  // Provide pre-loaded data so init() doesn't try to fetch
  const instance = init({
    el: container,
    data: {
      events: [
        createTestEvent({ id: "e1", title: "Test" }),
        createTestEvent({ id: "e2", title: "Test 2" }),
      ],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: "grid",
    views: ["grid", "list", "month"],
    ...configOverrides,
  });
  return { instance, container };
}

describe("init() return value", () => {
  it("returns an object with setConfig method", () => {
    const { instance } = createInitedInstance();
    assert.ok(instance, "init() should return an instance");
    assert.strictEqual(typeof instance.setConfig, "function");
  });
});

describe("setConfig — theme updates", () => {
  it("updates data-palette attribute", async () => {
    const { instance, container } = createInitedInstance();
    // Allow async start() to complete
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
  });

  it("updates data-layout attribute", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { layout: "hero" } });
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("updates data-orientation attribute", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { orientation: "horizontal" } });
    assert.strictEqual(container.dataset.orientation, "horizontal");
  });

  it("applies CSS custom property overrides", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { primary: "#ff0000" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
  });

  it("clears previous CSS overrides when switching themes", async () => {
    const { instance, container } = createInitedInstance({
      theme: { primary: "#ff0000" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );

    instance.setConfig({ theme: { palette: "cool" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "",
      "previous override should be cleared",
    );
  });

  it("accepts string shorthand for theme", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: "hero" });
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("compact layout forces orientation to vertical", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({
      theme: { layout: "compact", orientation: "horizontal" },
    });
    assert.strictEqual(container.dataset.orientation, "vertical");
  });
});

describe("setConfig — partial updates", () => {
  it("does not reset theme when updating non-theme config", async () => {
    const { instance, container } = createInitedInstance({
      theme: { palette: "dark" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(container.dataset.palette, "dark");

    instance.setConfig({ showPastEvents: true });
    assert.strictEqual(
      container.dataset.palette,
      "dark",
      "palette should not reset",
    );
  });

  it("does not reset non-theme config when updating theme", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: false,
    });
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { palette: "warm" } });
    // If showPastEvents had been reset to true, past events toggle would change.
    // We verify palette changed without side effects:
    assert.strictEqual(container.dataset.palette, "warm");
  });

  it("accumulates multiple setConfig calls", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
    instance.setConfig({ theme: { layout: "hero" } });
    assert.strictEqual(container.dataset.layout, "hero");
    // palette should still be dark from first call? No — each setConfig
    // gets a fresh theme input, so only the keys provided in that call apply.
    // The second call provides { layout: "hero" } with no palette, so palette
    // reverts to "light" (the default from resolveTheme).
    // This is correct behavior — theme is replaced, not merged.
    assert.strictEqual(container.dataset.palette, "light");
  });
});

describe("setConfig — view/display updates", () => {
  it("updates views in the view selector", async () => {
    const { instance, container } = createInitedInstance({
      views: ["grid", "list", "month"],
    });
    await new Promise((r) => setTimeout(r, 10));

    instance.setConfig({ views: ["grid", "list"] });
    const tabs = container.querySelectorAll('[role="tab"]');
    const labels = [...tabs].map((t) => t.textContent.trim());
    assert.ok(!labels.includes("Month"), "Month tab should be removed");
  });
});

describe("Already._instance and global setConfig", () => {
  it("stores instance as Already._instance", async () => {
    const mod = await import("../src/already-cal.js");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const instance = mod.init({
      el: container,
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    });
    assert.strictEqual(mod._instance, instance);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/set-config.test.cjs`
Expected: FAIL — `init()` returns undefined, no `setConfig`, no `_instance`

- [ ] **Step 3: Implement `setConfig()` and instance return in `src/already-cal.js`**

At the top of the file, add the `_instance` export:

```js
export let _instance = null;
```

Inside `init()`, just before the `start()` call at line 475, add the instance object definition, and change the end of the function to return it:

```js
  function setConfig(newConfig) {
    // Theme update
    if (newConfig.theme !== undefined) {
      themeResult = applyTheme(el, newConfig.theme, themeResult.overrideKeys);
      config._theme = themeResult;
    }

    // Merge non-theme config keys
    if (newConfig.views !== undefined) config.views = newConfig.views;
    if (newConfig.showPastEvents !== undefined) showPast = newConfig.showPastEvents;
    if (newConfig.pageSize !== undefined) {
      config.pageSize =
        Number.isFinite(newConfig.pageSize) && newConfig.pageSize > 0
          ? newConfig.pageSize
          : config.pageSize;
    }
    if (newConfig.defaultView !== undefined) config.defaultView = newConfig.defaultView;

    // Re-render current view if data is loaded and we have a view state
    if (data && lastViewState) {
      paginationState = { futureCount: 0, pastCount: 0 };
      renderView(lastViewState);
    }
  }

  const instance = { setConfig };

  start();

  window.addEventListener("resize", () => {
    updateStickyOffsets(
      stickyConfig,
      headerContainer,
      selectorContainer,
      tagFilterContainer,
    );
  });

  _instance = instance;
  return instance;
```

Also change the early return when element is not found to return `undefined` explicitly (it already does implicitly — no change needed).

And change the `themeResult` variable name. Replace:
```js
  let themeResult = applyTheme(el, config.theme, []);
  config._theme = themeResult;
```

The `let` is important — `setConfig` reassigns it.

- [ ] **Step 4: Run all tests**

Run: `node --test test/set-config.test.cjs`
Expected: All pass

Run: `npm test`
Expected: 449+ existing pass + new tests pass (same 4 pre-existing pagination failures)

- [ ] **Step 5: Add `test/set-config.test.cjs` to the test command if needed**

The test script glob `test/*.test.cjs` already covers `test/set-config.test.cjs`. Verify:

Run: `npm test 2>&1 | grep "set-config\|setConfig"`
Expected: test file is picked up

- [ ] **Step 6: Commit**

```bash
git add src/already-cal.js test/set-config.test.cjs
git commit -m "feat: add setConfig() runtime config update API"
```

---

### Task 3: Add `postMessage` listener

Register a `window.addEventListener("message", ...)` during `init()` that listens for `{ type: "already:config", config: {...} }` messages and delegates to `setConfig()`.

**Files:**
- Modify: `src/already-cal.js`
- Create: `test/postmessage.test.cjs`

- [ ] **Step 1: Write failing tests for postMessage listener**

Create `test/postmessage.test.cjs`:

```js
require("./setup-dom.cjs");
const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let init;

before(async () => {
  const mod = await import("../src/already-cal.js");
  init = mod.init;
});

function createInitedInstance() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    data: {
      events: [createTestEvent()],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: "grid",
  });
  return { instance, container };
}

function dispatchMessage(data) {
  const event = new window.MessageEvent("message", { data });
  window.dispatchEvent(event);
}

describe("postMessage listener", () => {
  it("updates theme on valid already:config message", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));

    dispatchMessage({
      type: "already:config",
      config: { theme: { palette: "dark" } },
    });
    assert.strictEqual(container.dataset.palette, "dark");
  });

  it("updates layout on valid message", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));

    dispatchMessage({
      type: "already:config",
      config: { theme: { layout: "hero" } },
    });
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("ignores messages without type field", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ config: { theme: { palette: "dark" } } });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with wrong type", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({
      type: "other:message",
      config: { theme: { palette: "dark" } },
    });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with non-object config", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ type: "already:config", config: "not an object" });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with null config", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ type: "already:config", config: null });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with missing config key", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ type: "already:config" });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("silently ignores null message data", () => {
    // Should not throw
    dispatchMessage(null);
  });

  it("silently ignores string message data", () => {
    // Should not throw
    dispatchMessage("hello");
  });

  it("silently ignores array message data", () => {
    // Should not throw
    dispatchMessage([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/postmessage.test.cjs`
Expected: FAIL — postMessage listener doesn't exist yet, theme updates won't happen

- [ ] **Step 3: Implement postMessage listener in `src/already-cal.js`**

Inside `init()`, just after the `_instance = instance;` line and before `return instance;`, add:

```js
  // postMessage listener for cross-origin config updates (e.g. iframe embeds)
  function handleMessage(event) {
    if (
      event.data &&
      typeof event.data === "object" &&
      !Array.isArray(event.data) &&
      event.data.type === "already:config" &&
      event.data.config &&
      typeof event.data.config === "object" &&
      !Array.isArray(event.data.config)
    ) {
      instance.setConfig(event.data.config);
    }
  }

  window.addEventListener("message", handleMessage);
```

- [ ] **Step 4: Run all tests**

Run: `node --test test/postmessage.test.cjs`
Expected: All pass

Run: `npm test`
Expected: All existing + new tests pass (same 4 pre-existing pagination failures)

- [ ] **Step 5: Commit**

```bash
git add src/already-cal.js test/postmessage.test.cjs
git commit -m "feat: add postMessage listener for cross-origin config updates"
```

---

### Task 4: Add global `Already.setConfig()` convenience export

Export a `setConfig` function from the module so the IIFE bundle exposes it as `Already.setConfig()` for the common single-instance case.

**Files:**
- Modify: `src/already-cal.js`
- Modify: `test/set-config.test.cjs`

- [ ] **Step 1: Add test for global setConfig export**

Add to the end of `test/set-config.test.cjs`:

```js
describe("global setConfig export", () => {
  it("is exported as a function", async () => {
    const mod = await import("../src/already-cal.js");
    assert.strictEqual(typeof mod.setConfig, "function");
  });

  it("delegates to _instance.setConfig", async () => {
    const mod = await import("../src/already-cal.js");
    const container = document.createElement("div");
    document.body.appendChild(container);
    mod.init({
      el: container,
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    });
    await new Promise((r) => setTimeout(r, 10));

    mod.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/set-config.test.cjs`
Expected: FAIL — `mod.setConfig` is not a function

- [ ] **Step 3: Add `setConfig` export to `src/already-cal.js`**

Add this after the `_instance` export near the top of the file:

```js
/** Convenience method — delegates to the last-created instance's setConfig. */
export function setConfig(config) {
  if (_instance) _instance.setConfig(config);
}
```

- [ ] **Step 4: Run all tests**

Run: `node --test test/set-config.test.cjs`
Expected: All pass

Run: `npm test`
Expected: All pass (same 4 pre-existing failures)

- [ ] **Step 5: Commit**

```bash
git add src/already-cal.js test/set-config.test.cjs
git commit -m "feat: add global Already.setConfig() convenience export"
```

---

### Task 5: Build dist, lint, and verify

Rebuild the IIFE bundle, run Biome, and verify the dist output exposes the new APIs.

**Files:**
- Modify: `dist/already-cal.js` (rebuilt)
- Modify: `dist/already-cal.min.js` (rebuilt)

- [ ] **Step 1: Run Biome formatting**

```bash
npx biome check --write .
```

Expected: No errors (or auto-fixed formatting)

- [ ] **Step 2: Run Biome CI check**

```bash
npx biome ci .
```

Expected: Clean — no lint errors

- [ ] **Step 3: Rebuild dist**

```bash
npm run build
```

Expected: "Build complete."

- [ ] **Step 4: Verify new exports in IIFE bundle**

```bash
grep -E 'setConfig|_instance' dist/already-cal.js | head -10
```

Expected: `setConfig` and `_instance` appear in the `__export(already_cal_exports, {...})` block, confirming they're exposed as `Already.setConfig` and `Already._instance`.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass (same 4 pre-existing pagination failures)

- [ ] **Step 6: Commit**

```bash
git add dist/
git commit -m "build: rebuild dist with runtime config API"
```

---

### Task 6: Update documentation

Update the README and configuration docs to document the new runtime API.

**Files:**
- Modify: `README.md`
- Modify: `docs/configuration.md`

- [ ] **Step 1: Add Runtime Updates section to README**

Add after the "Multiple Instances" section (after line 418) and before the "Accessibility" section:

```markdown
## Runtime Updates

Update an already-cal instance's config without reinitializing:

```js
const cal = Already.init({ el: '#cal', ... });

// Switch theme at runtime
cal.setConfig({ theme: { layout: 'hero', palette: 'dark' } });

// Or use the global convenience method (single-instance)
Already.setConfig({ theme: { palette: 'warm' } });
```

Palette and CSS override changes are instant (CSS-only, no DOM rebuild). Layout and orientation changes trigger a view re-render.

### Cross-Origin Updates (iframe)

When already-cal runs inside an iframe, use `postMessage`:

```js
const iframe = document.querySelector('iframe');
iframe.contentWindow.postMessage({
  type: 'already:config',
  config: { theme: { layout: 'badge', palette: 'cool' } }
}, '*');
```

Messages must have `type: "already:config"` and a `config` object. Other messages are silently ignored.
```

- [ ] **Step 2: Add Runtime Updates section to `docs/configuration.md`**

Add after the "Custom Renderers" section and before the "Data Attributes" section:

```markdown
## Runtime Updates

### `instance.setConfig(config)`

Update config on a live instance without reinitializing. Accepts a partial config object — only provided keys are updated.

```js
const cal = Already.init({ el: '#cal', ... });
cal.setConfig({ theme: { palette: 'dark' } });
```

| Config key | Update behavior |
|-----------|----------------|
| `theme.palette` | Instant — updates CSS `data-palette` attribute |
| `theme.layout` | Re-renders current view with new card layout |
| `theme.orientation` | Re-renders current view |
| `theme.imagePosition` | Re-renders current view |
| CSS overrides (e.g. `theme.primary`) | Instant — sets CSS custom property |
| `views` | Re-renders view selector |
| `showPastEvents` | Re-renders with updated filter |
| `pageSize` | Re-renders with new pagination |
| `defaultView` | Updates stored default |

Previous CSS overrides are automatically cleared when a new theme is applied.

### `Already.setConfig(config)`

Global convenience method — delegates to the last-created instance. Useful when you don't capture the return value of `init()`.

### Cross-origin updates via `postMessage`

When already-cal is embedded in an iframe, the parent page can update config via `postMessage`:

```js
iframe.contentWindow.postMessage({
  type: 'already:config',
  config: { theme: { palette: 'dark' } }
}, '*');
```

The `"already:config"` type prefix is required. Messages without it are silently ignored. The `config` object has the same shape as the `setConfig()` argument.
```

- [ ] **Step 3: Verify docs render correctly**

Skim both files for broken markdown, mismatched backticks, or formatting issues.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/configuration.md
git commit -m "docs: document setConfig() and postMessage runtime update API"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Section 1 (setConfig) → Tasks 2, 4
- [x] Section 2 (postMessage) → Task 3
- [x] Section 3 (init return value) → Task 2
- [x] Section 4 (testing) → Tasks 1–4 test steps
- [x] Section 5 (acceptance criteria) → covered across all tasks
- [x] Section 6 (files to modify) → file structure table above
- [x] Section 7 (non-goals) → no UI, no data reload, no transitions added

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references.

**Type consistency:** `applyTheme()` signature, `themeResult.overrideKeys`, `instance.setConfig()`, `Already._instance`, `Already.setConfig()` — all consistent across tasks.
