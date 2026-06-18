# Web Share Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Share affordances to the widget so a viewer can share a specific event (from its detail view) or the whole calendar (from the header) via `navigator.share`, with a copy-to-clipboard fallback.

**Architecture:** Two pure helpers — `buildShareUrl(base, target)` (URL construction) and `shareOrCopy({title,url})` (native-share→clipboard with an outcome return) — plus a DOM factory `createShareButton(...)` that composes them into a button with inline "Copied!" feedback. A new `shareUrl` config supplies the canonical base; `already-cal.js` resolves `config.shareBase` and a `config.getShareState()` accessor once in `init` and the two render sites consume them off `config`.

**Tech Stack:** Vanilla JS ESM (no framework, no TypeScript), esbuild bundle, `node:test` + jsdom, Biome.

**Spec:** `docs/superpowers/specs/2026-06-17-web-share-button-design.md` (blessed, validated at HEAD `9284f2a2`).

## Global Constraints

- **No already.events references** anywhere — source, tests, comments, commits, PR. Use general language ("the embedding host page", "a host that server-renders per-event metadata").
- **No Claude attribution** in commits — no `Co-Authored-By: Claude`, no `🤖 Generated with Claude Code`. Use `cat <<'EOF'` HEREDOCs for commit bodies.
- **Vanilla JS ESM only** — no new dependencies, no framework, no TypeScript. DOM built by hand with the `createElement(tag, className, attrs)` helper (`src/views/helpers.js`).
- **Conventional-commit prefixes** (`feat:`, `test:`, `docs:`, `style:`).
- **Branch `spec/49-web-share-button`; never push to `main`; PR only.**
- **Test layout mirrors `src/`** under `test/`. Run all tests: `npm test`. Coverage (CI-enforced thresholds — functions 72 / lines 86): `npm run test:coverage`. Lint: `npm run lint` (= `biome ci .`). Bundle: `npm run build`.
- Tests run on jsdom (`test/setup-dom.cjs`), whose `navigator` implements neither `.share` nor `.clipboard` — both are stubbed per-test and cleaned up in `afterEach`.

---

## File Structure

**New files:**
- `src/util/share-url.js` — `buildShareUrl(base, target)` — pure URL builder.
- `src/util/share.js` — `shareOrCopy({title,url})` — pure-of-DOM async; returns `"shared"|"copied"|"failed"`.
- `src/ui/share-button.js` — `createShareButton({...})` — DOM factory; composes `shareOrCopy` + a `getUrl` thunk; owns the share icon + "Copied!" feedback.
- `test/util/share-url.test.cjs`, `test/util/share.test.cjs`, `test/ui/share-button.test.cjs`, `test/ui/header.test.cjs`, `test/share-config.test.cjs` — tests.

**Modified files:**
- `src/already-cal.js` — `DEFAULTS.shareUrl`; `I18N_DEFAULTS.share`/`.copied`; `init` sets `config.shareBase` + `config.getShareState`; `autoInit` maps `data-share-url`.
- `src/ui/header.js` — calendar-share button next to Subscribe; relax the no-name/no-description early-return so the action row still renders.
- `src/views/detail.js` — event-share button in a top action row next to Back.
- `src/styles/base.css` — styles for the two buttons + action rows.
- `docs/configuration.md` — `shareUrl` config row, `data-share-url` data-attribute, iframe `allow` note.
- `test/views/detail.test.cjs` — event-share button assertions.

---

## Task 0: Confirm branch + spec in place

**Files:** none (verification only).

- [ ] **Step 1: Verify branch + clean tree**

Run: `cd ~/src/already-cal && git branch --show-current && git status --porcelain`
Expected: `spec/49-web-share-button`; working tree clean except this plan file.

- [ ] **Step 2: Verify spec + baseline green**

Run: `ls docs/superpowers/specs/2026-06-17-web-share-button-design.md && npm test 2>&1 | tail -5`
Expected: spec exists; existing suite passes (baseline before changes).

---

## Task 1: `buildShareUrl` pure helper

**Files:**
- Create: `src/util/share-url.js`
- Test: `test/util/share-url.test.cjs`

**Interfaces:**
- Produces: `buildShareUrl(base: string, target: {kind:"event", eventId:string} | {kind:"calendar", view?:string, date?:string}) -> string`. Event → `<normBase>/event/<encodeURIComponent(eventId)>`. Calendar → `<normBase>#<view>` (or `<normBase>` when `view` is falsy). `target.date` is accepted and ignored (forward-compat). `normBase` = `origin + pathname` of `base` with any `?query`/`#fragment` dropped and a trailing `/` trimmed.

- [ ] **Step 1: Write the failing test**

```js
// test/util/share-url.test.cjs
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let buildShareUrl;
before(async () => {
  ({ buildShareUrl } = await import("../../src/util/share-url.js"));
});

describe("buildShareUrl", () => {
  it("event target → path form with encoded id", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", { kind: "event", eventId: "abc 123" }),
      "https://ex.com/cal/event/abc%20123",
    );
  });

  it("calendar target → hash form per view", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", { kind: "calendar", view: "month" }),
      "https://ex.com/cal#month",
    );
  });

  it("normalizes trailing slash + drops existing query/hash", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal/?x=1#old", { kind: "calendar", view: "week" }),
      "https://ex.com/cal#week",
    );
  });

  it("calendar with no view → bare normalized base (defensive)", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", { kind: "calendar" }),
      "https://ex.com/cal",
    );
  });

  it("ignores target.date today (forward-compat contract)", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/cal", { kind: "calendar", view: "month", date: "2026-08" }),
      "https://ex.com/cal#month",
    );
  });

  it("root path base normalizes cleanly", () => {
    assert.strictEqual(
      buildShareUrl("https://ex.com/", { kind: "event", eventId: "e1" }),
      "https://ex.com/event/e1",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/util/share-url.test.cjs`
Expected: FAIL — cannot resolve `../../src/util/share-url.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/util/share-url.js
/**
 * Build a shareable URL from a base URL and a share target.
 *
 * The base is normalized to origin + pathname (any existing query/hash is
 * dropped, trailing slash trimmed) so a messy current-page-URL fallback can't
 * produce a broken link. Then a suffix is appended per kind:
 *
 *   { kind: "event", eventId }   ->  `<base>/event/<eventId>`   (path form)
 *   { kind: "calendar", view }   ->  `<base>#<view>`            (hash form)
 *
 * Path form is used for events so a host that server-renders per-event
 * metadata can route on the path; the widget router also path-matches
 * `/event/<id>`. Calendar view state is widget-only restoration, so it rides
 * the hash, matching the router's existing `#<view>` / `#day/<date>` parsing.
 *
 * `target.date` is accepted for forward-compatibility (a future "share the
 * exact month/week window" feature) but is intentionally ignored today.
 */
export function buildShareUrl(base, target) {
  const normalized = normalizeBase(base);
  if (target.kind === "event") {
    return `${normalized}/event/${encodeURIComponent(target.eventId)}`;
  }
  return target.view ? `${normalized}#${target.view}` : normalized;
}

function normalizeBase(base) {
  try {
    const url = new URL(base);
    return `${url.origin}${url.pathname}`.replace(/\/$/, "");
  } catch {
    // Not an absolute URL — best-effort: strip query/hash + trailing slash.
    return base.split(/[?#]/)[0].replace(/\/$/, "");
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/util/share-url.test.cjs`
Expected: PASS (6/6).

- [ ] **Step 5: Lint + commit**

```bash
npx biome check src/util/share-url.js test/util/share-url.test.cjs --fix
npx biome ci src/util/share-url.js test/util/share-url.test.cjs
git add src/util/share-url.js test/util/share-url.test.cjs
git commit -m "$(cat <<'EOF'
feat: add buildShareUrl helper for share targets
EOF
)"
```

---

## Task 2: `shareOrCopy` pure-of-DOM helper

**Files:**
- Create: `src/util/share.js`
- Test: `test/util/share.test.cjs`

**Interfaces:**
- Produces: `async shareOrCopy({title:string, url:string}) -> "shared" | "copied" | "failed"`. Calls `navigator.share` when it's a function (AbortError counts as `"shared"`, other rejections fall through); else `navigator.clipboard.writeText` → `"copied"` (or `"failed"` on error/absence). Never throws.

- [ ] **Step 1: Write the failing test**

```js
// test/util/share.test.cjs
require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let shareOrCopy;
before(async () => {
  ({ shareOrCopy } = await import("../../src/util/share.js"));
});

function setShare(fn) {
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });
}
function setClipboard(obj) {
  Object.defineProperty(navigator, "clipboard", { value: obj, configurable: true });
}
afterEach(() => {
  delete navigator.share;
  delete navigator.clipboard;
});

describe("shareOrCopy", () => {
  it("uses navigator.share when present", async () => {
    let got = null;
    setShare(async (data) => { got = data; });
    const r = await shareOrCopy({ title: "T", url: "https://x/1" });
    assert.strictEqual(r, "shared");
    assert.deepStrictEqual(got, { title: "T", url: "https://x/1" });
  });

  it("falls back to clipboard when share absent", async () => {
    let wrote = null;
    setClipboard({ writeText: async (u) => { wrote = u; } });
    const r = await shareOrCopy({ title: "T", url: "https://x/2" });
    assert.strictEqual(r, "copied");
    assert.strictEqual(wrote, "https://x/2");
  });

  it("falls back to clipboard when share rejects (non-abort)", async () => {
    let wrote = null;
    setShare(async () => { throw new Error("not allowed"); });
    setClipboard({ writeText: async (u) => { wrote = u; } });
    const r = await shareOrCopy({ title: "T", url: "https://x/3" });
    assert.strictEqual(r, "copied");
    assert.strictEqual(wrote, "https://x/3");
  });

  it("treats AbortError as shared, does NOT copy", async () => {
    setShare(async () => {
      const e = new Error("dismissed");
      e.name = "AbortError";
      throw e;
    });
    let copied = false;
    setClipboard({ writeText: async () => { copied = true; } });
    const r = await shareOrCopy({ title: "T", url: "https://x/4" });
    assert.strictEqual(r, "shared");
    assert.strictEqual(copied, false);
  });

  it("returns failed when neither share nor clipboard available", async () => {
    const r = await shareOrCopy({ title: "T", url: "https://x/5" });
    assert.strictEqual(r, "failed");
  });

  it("returns failed when clipboard write throws", async () => {
    setClipboard({ writeText: async () => { throw new Error("blocked"); } });
    const r = await shareOrCopy({ title: "T", url: "https://x/6" });
    assert.strictEqual(r, "failed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/util/share.test.cjs`
Expected: FAIL — cannot resolve `../../src/util/share.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/util/share.js
/**
 * Attempt the native share sheet, falling back to copying the URL to the
 * clipboard. Pure of DOM — returns the outcome so the caller renders feedback.
 *
 *   "shared" — navigator.share resolved (or the user dismissed the sheet)
 *   "copied" — fell back to clipboard and the write succeeded
 *   "failed" — neither path worked (no throw; caller leaves the URL selectable)
 */
export async function shareOrCopy({ title, url }) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (err) {
      // User dismissed the sheet — not an error; don't fall back to copy.
      if (err && err.name === "AbortError") return "shared";
      // Any other rejection (e.g. web-share Permissions-Policy not delegated
      // to the frame) falls through to the clipboard path below.
    }
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(url);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/util/share.test.cjs`
Expected: PASS (6/6).

- [ ] **Step 5: Lint + commit**

```bash
npx biome check src/util/share.js test/util/share.test.cjs --fix
npx biome ci src/util/share.js test/util/share.test.cjs
git add src/util/share.js test/util/share.test.cjs
git commit -m "$(cat <<'EOF'
feat: add shareOrCopy native-share-with-clipboard-fallback helper
EOF
)"
```

---

## Task 3: `createShareButton` factory

**Files:**
- Create: `src/ui/share-button.js`
- Test: `test/ui/share-button.test.cjs`

**Interfaces:**
- Consumes: `createElement` (`src/views/helpers.js`), `shareOrCopy` (`src/util/share.js`).
- Produces: `createShareButton({className:string, label:string, copiedLabel:string, getUrl:()=>string, getTitle:()=>string, copiedDuration?:number}) -> HTMLButtonElement`. The returned `<button type="button">` carries the share icon + a `.already-share-label` span (with `aria-live="polite"`). On click it stores its in-flight promise on `btn._shareResult` (for tests), calls `shareOrCopy({title:getTitle(), url:getUrl()})`, and on a `"copied"` outcome swaps the label to `copiedLabel` for `copiedDuration` ms (default 2000) then reverts. `getUrl`/`getTitle` are thunks so values reflect click-time state.

- [ ] **Step 1: Write the failing test**

```js
// test/ui/share-button.test.cjs
require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let createShareButton;
before(async () => {
  ({ createShareButton } = await import("../../src/ui/share-button.js"));
});

function setShare(fn) {
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });
}
function setClipboard(obj) {
  Object.defineProperty(navigator, "clipboard", { value: obj, configurable: true });
}
afterEach(() => {
  delete navigator.share;
  delete navigator.clipboard;
});

const opts = (over = {}) => ({
  className: "already-detail-share",
  label: "Share",
  copiedLabel: "Copied!",
  getUrl: () => "https://x/cal/event/e1",
  getTitle: () => "My Event",
  ...over,
});

describe("createShareButton", () => {
  it("renders an icon + label button", () => {
    const btn = createShareButton(opts());
    assert.strictEqual(btn.tagName, "BUTTON");
    assert.strictEqual(btn.getAttribute("type"), "button");
    assert.strictEqual(btn.getAttribute("aria-label"), "Share");
    assert.ok(btn.querySelector("svg"), "has share icon");
    const lbl = btn.querySelector(".already-share-label");
    assert.strictEqual(lbl.textContent, "Share");
    assert.strictEqual(lbl.getAttribute("aria-live"), "polite");
  });

  it("calls share with click-time url + title; label unchanged on share", async () => {
    let got = null;
    setShare(async (d) => { got = d; });
    const btn = createShareButton(opts());
    btn.click();
    const outcome = await btn._shareResult;
    assert.strictEqual(outcome, "shared");
    assert.deepStrictEqual(got, { title: "My Event", url: "https://x/cal/event/e1" });
    assert.strictEqual(btn.querySelector(".already-share-label").textContent, "Share");
  });

  it("shows Copied! when the clipboard fallback runs", async () => {
    let wrote = null;
    setClipboard({ writeText: async (u) => { wrote = u; } });
    const btn = createShareButton(opts());
    btn.click();
    const outcome = await btn._shareResult;
    assert.strictEqual(outcome, "copied");
    assert.strictEqual(wrote, "https://x/cal/event/e1");
    assert.strictEqual(btn.querySelector(".already-share-label").textContent, "Copied!");
  });

  it("reverts the label after copiedDuration", async () => {
    setClipboard({ writeText: async () => {} });
    const btn = createShareButton(opts({ copiedDuration: 5 }));
    btn.click();
    await btn._shareResult;
    assert.strictEqual(btn.querySelector(".already-share-label").textContent, "Copied!");
    await new Promise((r) => setTimeout(r, 20));
    assert.strictEqual(btn.querySelector(".already-share-label").textContent, "Share");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ui/share-button.test.cjs`
Expected: FAIL — cannot resolve `../../src/ui/share-button.js`.

- [ ] **Step 3: Write minimal implementation**

```js
// src/ui/share-button.js
import { shareOrCopy } from "../util/share.js";
import { createElement } from "../views/helpers.js";

// Inline "share nodes" glyph — currentColor, 16x16, decorative. Kept inline per
// the single existing icon precedent (header.js subscribe icon); the moment a
// share icon is needed in a third file, extract a shared icon helper instead.
const SHARE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="3.5" r="1.7" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="8" r="1.7" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12.5" r="1.7" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7.2l5-2.7M5.5 8.8l5 2.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

/**
 * Build a share <button>. On click it resolves the current URL via getUrl(),
 * hands it to shareOrCopy, and — when the copy fallback ran — briefly swaps the
 * label to copiedLabel (announced via aria-live) then reverts. getUrl/getTitle
 * are thunks so values reflect state at click time.
 */
export function createShareButton({
  className,
  label,
  copiedLabel,
  getUrl,
  getTitle,
  copiedDuration = 2000,
}) {
  const btn = createElement("button", className, {
    type: "button",
    "aria-label": label,
  });
  btn.innerHTML = SHARE_ICON;
  const labelSpan = createElement("span", "already-share-label");
  labelSpan.textContent = label;
  labelSpan.setAttribute("aria-live", "polite");
  btn.appendChild(labelSpan);

  let revertTimer = null;
  function showCopied() {
    labelSpan.textContent = copiedLabel;
    if (revertTimer) clearTimeout(revertTimer);
    revertTimer = setTimeout(() => {
      labelSpan.textContent = label;
    }, copiedDuration);
  }

  btn.addEventListener("click", () => {
    btn._shareResult = (async () => {
      const outcome = await shareOrCopy({ title: getTitle(), url: getUrl() });
      if (outcome === "copied") showCopied();
      return outcome;
    })();
  });

  return btn;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ui/share-button.test.cjs`
Expected: PASS (4/4).

- [ ] **Step 5: Lint + commit**

```bash
npx biome check src/ui/share-button.js test/ui/share-button.test.cjs --fix
npx biome ci src/ui/share-button.js test/ui/share-button.test.cjs
git add src/ui/share-button.js test/ui/share-button.test.cjs
git commit -m "$(cat <<'EOF'
feat: add createShareButton factory with inline copied feedback
EOF
)"
```

---

## Task 4: Config wiring (`shareUrl`, i18n, `shareBase`, `getShareState`, data-attr)

**Files:**
- Modify: `src/already-cal.js` (DEFAULTS ~line 63; I18N_DEFAULTS ~line 90; `init` ~lines 193-197 and ~267; `autoInit` ~line 815)
- Test: `test/share-config.test.cjs`

**Interfaces:**
- Produces (on the runtime `config` object, set in `init`): `config.shareBase: string` = `config.shareUrl ?? window.location.href`; `config.getShareState: () => {view: string|null}` (returns the live current view). Consumed by Tasks 5 (header) and 6 (detail). `DEFAULTS.shareUrl = null` (exported via the existing `DEFAULTS` export). `I18N_DEFAULTS.share = "Share"`, `I18N_DEFAULTS.copied = "Copied!"`.

- [ ] **Step 1: Write the failing test**

```js
// test/share-config.test.cjs
require("./setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let DEFAULTS;
before(async () => {
  ({ DEFAULTS } = await import("../src/already-cal.js"));
});

describe("share config defaults", () => {
  it("exposes shareUrl: null in DEFAULTS", () => {
    assert.ok("shareUrl" in DEFAULTS);
    assert.strictEqual(DEFAULTS.shareUrl, null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/share-config.test.cjs`
Expected: FAIL — `"shareUrl" in DEFAULTS` is false.

- [ ] **Step 3: Add `shareUrl` to `DEFAULTS`**

In `src/already-cal.js`, in the `DEFAULTS` object, add the line right after `subscribeUrl: null, // auto-generated from google.calendarId if not set`:

```js
  shareUrl: null, // canonical page URL to share; falls back to current page URL
```

- [ ] **Step 4: Add `share`/`copied` to `I18N_DEFAULTS`**

In `src/already-cal.js`, in `I18N_DEFAULTS`, add right after `subscribe: "Subscribe",`:

```js
  share: "Share",
  copied: "Copied!",
```

- [ ] **Step 5: Resolve `config.shareBase` in `init`**

In `src/already-cal.js`, in `init`, immediately after the `config.pageSize = ...` block (the lines that end `: DEFAULTS.pageSize;`), add:

```js
  config.shareBase = config.shareUrl ?? window.location.href;
```

- [ ] **Step 6: Expose `config.getShareState` in `init`**

In `src/already-cal.js`, find the closure declarations `let lastView = null;` / `let lastViewState = null;` (just below `const currentDate = new Date();`). Immediately after `let lastViewState = null;` add:

```js
  // Single seam for share targets: returns the live view today; a future
  // date-window feature adds `date` here without touching call sites.
  config.getShareState = () => ({ view: lastView });
```

- [ ] **Step 7: Map `data-share-url` in `autoInit`**

In `src/already-cal.js`, in `autoInit`, after `if (dataset.fetchUrl) config.fetchUrl = dataset.fetchUrl;` add:

```js
    if (dataset.shareUrl) config.shareUrl = dataset.shareUrl;
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test test/share-config.test.cjs`
Expected: PASS (1/1).

- [ ] **Step 9: Run the full suite (no regressions from the edits)**

Run: `npm test 2>&1 | tail -5`
Expected: all pass (the `shareBase`/`getShareState`/i18n additions are consumed in Tasks 5-6; this step confirms the edits broke nothing).

- [ ] **Step 10: Lint + commit**

```bash
npx biome check src/already-cal.js test/share-config.test.cjs --fix
npx biome ci src/already-cal.js test/share-config.test.cjs
git add src/already-cal.js test/share-config.test.cjs
git commit -m "$(cat <<'EOF'
feat: wire shareUrl config, share/copied i18n, shareBase + getShareState
EOF
)"
```

---

## Task 5: Calendar-share button in the header

**Files:**
- Modify: `src/ui/header.js`
- Test: `test/ui/header.test.cjs`

**Interfaces:**
- Consumes: `createShareButton` (`src/ui/share-button.js`), `buildShareUrl` (`src/util/share-url.js`), `config.shareBase`, `config.getShareState` (Task 4).
- Behavior: when `config.showHeader` and `config.shareBase`, `renderHeader` appends a calendar-share button (`class="already-header-subscribe already-header-share"`) into a `.already-header-actions` row alongside the optional subscribe button. The no-name/no-description early-return is relaxed so the action row still renders when there's a share or subscribe action. Calendar-share title = `config.headerTitle || calendarData?.name || document.title || "Calendar"`; URL = `buildShareUrl(config.shareBase, {kind:"calendar", ...config.getShareState()})`.

- [ ] **Step 1: Write the failing test**

```js
// test/ui/header.test.cjs
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let renderHeader;
before(async () => {
  ({ renderHeader } = await import("../../src/ui/header.js"));
});

const baseConfig = (over = {}) => ({
  showHeader: true,
  i18n: { share: "Share", subscribe: "Subscribe" },
  shareBase: "https://host.example/cal",
  getShareState: () => ({ view: "month" }),
  ...over,
});

describe("renderHeader share button", () => {
  it("renders a calendar-share button next to the header content", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig());
    const share = c.querySelector(".already-header-share");
    assert.ok(share, "share button present");
    assert.strictEqual(share.getAttribute("aria-label"), "Share");
  });

  it("renders the share button even with no name/description", () => {
    const c = document.createElement("div");
    renderHeader(c, {}, baseConfig());
    assert.ok(
      c.querySelector(".already-header-share"),
      "share button renders when the header would otherwise be empty",
    );
  });

  it("share URL reflects the live view from getShareState", async () => {
    Object.defineProperty(navigator, "share", {
      value: async (d) => { navigator._lastShare = d; },
      configurable: true,
    });
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig({ getShareState: () => ({ view: "week" }) }));
    const share = c.querySelector(".already-header-share");
    share.click();
    await share._shareResult;
    assert.strictEqual(navigator._lastShare.url, "https://host.example/cal#week");
    delete navigator.share;
    delete navigator._lastShare;
  });

  it("omits the share button when shareBase is absent", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig({ shareBase: undefined }));
    assert.strictEqual(c.querySelector(".already-header-share"), null);
  });

  it("renders nothing when showHeader is false", () => {
    const c = document.createElement("div");
    renderHeader(c, { name: "My Cal" }, baseConfig({ showHeader: false }));
    assert.strictEqual(c.innerHTML, "");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ui/header.test.cjs`
Expected: FAIL — no `.already-header-share` element.

- [ ] **Step 3: Implement — imports + share button + relaxed early-return**

In `src/ui/header.js`, replace the import line and the body down through the early-returns + subscribe block. First, update the top:

```js
import { buildShareUrl } from "../util/share-url.js";
import { createShareButton } from "./share-button.js";
import { escapeHtml } from "../util/sanitize.js";
```

Then change the early-return / subscribe / append logic. Replace from `const i18n = config.i18n || {};` down to the end of the subscribe `if (subscribeUrl) { ... }` block and the final `container.appendChild(header);` with:

```js
  const i18n = config.i18n || {};
  const subscribeLabel = i18n.subscribe || "Subscribe";

  // Build subscribe URL: explicit config, or auto-generate from Google Calendar ID
  let subscribeUrl = config.subscribeUrl || null;
  if (!subscribeUrl && config.google?.calendarId) {
    const cid = btoa(config.google.calendarId).replace(/=+$/, "");
    subscribeUrl = `https://calendar.google.com/calendar/u/0?cid=${cid}`;
  }
  if (!subscribeUrl && calendarData?.calendarId) {
    const cid = btoa(calendarData.calendarId).replace(/=+$/, "");
    subscribeUrl = `https://calendar.google.com/calendar/u/0?cid=${cid}`;
  }

  // Calendar-share button (always available when a base is configured).
  const shareButton = config.shareBase
    ? createShareButton({
        className: "already-header-subscribe already-header-share",
        label: i18n.share || "Share",
        copiedLabel: i18n.copied || "Copied!",
        getTitle: () =>
          config.headerTitle || calendarData?.name || document.title || "Calendar",
        getUrl: () =>
          buildShareUrl(config.shareBase, {
            kind: "calendar",
            ...(config.getShareState ? config.getShareState() : {}),
          }),
      })
    : null;

  // Render the header if there's a title, a description, OR an action to show.
  if (!name && !description && !subscribeUrl && !shareButton) {
    container.innerHTML = "";
    return;
  }

  const header = document.createElement("div");
  header.className = "already-header";

  if (config.headerIcon) {
    const icon = document.createElement("img");
    icon.className = "already-header-icon";
    icon.src = config.headerIcon;
    icon.alt = "";
    icon.loading = "lazy";
    header.appendChild(icon);
  }

  const textCol = document.createElement("div");
  textCol.className = "already-header-text";

  if (name) {
    const h = document.createElement("h2");
    h.className = "already-header-name";
    h.textContent = name;
    textCol.appendChild(h);
  }

  if (description) {
    const p = document.createElement("p");
    p.className = "already-header-description";
    if (subscribeUrl && /subscribe/i.test(description)) {
      p.innerHTML = description.replace(
        /(subscribe)/i,
        `<a href="${subscribeUrl}" target="_blank" rel="noopener" class="already-header-description-link">$1</a>`,
      );
    } else {
      p.textContent = description;
    }
    textCol.appendChild(p);
  }

  header.appendChild(textCol);

  const actions = document.createElement("div");
  actions.className = "already-header-actions";

  if (subscribeUrl) {
    const btn = document.createElement("a");
    btn.className = "already-header-subscribe";
    btn.href = subscribeUrl;
    btn.target = "_blank";
    btn.rel = "noopener";
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 1v2M11 1v2M2 6h12M3 3h10a1 1 0 011 1v9a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 8v4M6 10h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> ${escapeHtml(subscribeLabel)}`;
    actions.appendChild(btn);
  }

  if (shareButton) actions.appendChild(shareButton);
  if (actions.childNodes.length > 0) header.appendChild(actions);

  container.innerHTML = "";
  container.appendChild(header);
```

Note: the two existing early-returns at the top of the function (`if (!config.showHeader)` and the `name`/`description` computation) stay as-is above this block; only the `if (!name && !description)` *return* is the one being relaxed (it's removed from the top and folded into the action-aware guard above).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ui/header.test.cjs`
Expected: PASS (5/5).

- [ ] **Step 5: Run the full suite (header is widely used)**

Run: `npm test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 6: Lint + commit**

```bash
npx biome check src/ui/header.js test/ui/header.test.cjs --fix
npx biome ci src/ui/header.js test/ui/header.test.cjs
git add src/ui/header.js test/ui/header.test.cjs
git commit -m "$(cat <<'EOF'
feat: add calendar-share button to the header
EOF
)"
```

---

## Task 6: Event-share button in the detail view

**Files:**
- Modify: `src/views/detail.js`
- Test: `test/views/detail.test.cjs`

**Interfaces:**
- Consumes: `createShareButton`, `buildShareUrl`, `config.shareBase`, `config.getShareState` (unused here), `event.id`, `event.title`.
- Behavior: the Back button is wrapped in a `.already-detail-actions` row; when `config.shareBase` is set, an event-share button (`.already-detail-share`) is appended to that row. URL = `buildShareUrl(config.shareBase, {kind:"event", eventId:event.id})`; title = `event.title`. Back stays focusable and keeps calling `onBack`.

- [ ] **Step 1: Write the failing test (append to `test/views/detail.test.cjs`)**

Add these imports at the top of the file (the `before` block already imports `renderDetailView`; add the share helper + buildShareUrl is not needed in the test). Add inside the `describe("renderDetailView", ...)` block:

```js
  it("renders an event-share button when shareBase is set", () => {
    const container = document.createElement("div");
    renderDetailView(container, baseEvent, "UTC", () => {}, {
      shareBase: "https://host.example/cal",
      i18n: { share: "Share" },
    });
    const share = container.querySelector(".already-detail-share");
    assert.ok(share, "share button present");
    assert.strictEqual(share.getAttribute("aria-label"), "Share");
  });

  it("omits the event-share button when shareBase is absent", () => {
    const container = document.createElement("div");
    renderDetailView(container, baseEvent, "UTC", () => {}, {});
    assert.strictEqual(container.querySelector(".already-detail-share"), null);
  });

  it("event-share builds a per-event path URL", async () => {
    Object.defineProperty(navigator, "share", {
      value: async (d) => { navigator._lastShare = d; },
      configurable: true,
    });
    const container = document.createElement("div");
    const event = { ...baseEvent, id: "evt-9", title: "Gig" };
    renderDetailView(container, event, "UTC", () => {}, {
      shareBase: "https://host.example/cal",
      i18n: { share: "Share" },
    });
    const share = container.querySelector(".already-detail-share");
    share.click();
    await share._shareResult;
    assert.strictEqual(navigator._lastShare.url, "https://host.example/cal/event/evt-9");
    assert.strictEqual(navigator._lastShare.title, "Gig");
    delete navigator.share;
    delete navigator._lastShare;
  });

  it("keeps the Back button working alongside share", () => {
    const container = document.createElement("div");
    let backCalled = false;
    renderDetailView(container, baseEvent, "UTC", () => { backCalled = true; }, {
      shareBase: "https://host.example/cal",
    });
    const back = container.querySelector(".already-detail-back");
    assert.ok(back);
    back.click();
    assert.strictEqual(backCalled, true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/views/detail.test.cjs`
Expected: FAIL — no `.already-detail-share` element.

- [ ] **Step 3: Implement — imports + actions row + share button**

In `src/views/detail.js`, add to the top imports (the file already imports `createElement` from `./helpers.js`; add the two new ones):

```js
import { buildShareUrl } from "../util/share-url.js";
import { createShareButton } from "../ui/share-button.js";
```

Then replace the Back-button block:

```js
  const backBtn = createElement("button", "already-detail-back");
  backBtn.textContent = backLabel;
  backBtn.addEventListener("click", onBack);
  detail.appendChild(backBtn);
```

with an action row that holds Back + (optionally) Share:

```js
  const actions = createElement("div", "already-detail-actions");

  const backBtn = createElement("button", "already-detail-back");
  backBtn.textContent = backLabel;
  backBtn.addEventListener("click", onBack);
  actions.appendChild(backBtn);

  if (config.shareBase) {
    const shareBtn = createShareButton({
      className: "already-detail-share",
      label: i18n.share || "Share",
      copiedLabel: i18n.copied || "Copied!",
      getTitle: () => event.title,
      getUrl: () =>
        buildShareUrl(config.shareBase, { kind: "event", eventId: event.id }),
    });
    actions.appendChild(shareBtn);
  }

  detail.appendChild(actions);
```

(The `backBtn.focus()` call at the end of the function is unchanged — `backBtn` is still in scope.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/views/detail.test.cjs`
Expected: PASS (all existing + 4 new).

- [ ] **Step 5: Lint + commit**

```bash
npx biome check src/views/detail.js test/views/detail.test.cjs --fix
npx biome ci src/views/detail.js test/views/detail.test.cjs
git add src/views/detail.js test/views/detail.test.cjs
git commit -m "$(cat <<'EOF'
feat: add event-share button to the detail view
EOF
)"
```

---

## Task 7: Styles

**Files:**
- Modify: `src/styles/base.css`

**Interfaces:** styles only — no test. Verified by `npm run build` + `npm run lint` + manual visual check.

- [ ] **Step 1: Add the share/action-row styles**

Append to `src/styles/base.css` (placement: after the `.already-header-subscribe svg` rule near line 140, and after the `.already-detail-back:focus-visible` rule near line 607 — grouping each with its neighbor). Add the header-side rules after the subscribe block:

```css
.already-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

/* Share reuses the subscribe sizing but reads as a secondary (outline) action */
.already-header-share {
  background: transparent;
  color: var(--already-primary);
  border: 1px solid var(--already-primary);
  cursor: pointer;
}

.already-share-label {
  white-space: nowrap;
}
```

And add the detail-side rules after the `.already-detail-back:focus-visible` block:

```css
.already-detail-share {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background: none;
  border: none;
  font-size: 0.875rem;
  color: var(--already-primary);
  cursor: pointer;
  padding: 0.25rem 0;
  font-weight: 500;
  font-family: var(--already-font-family);
  transition: opacity 0.15s;
}

.already-detail-share:hover {
  opacity: 0.7;
}

.already-detail-share:focus-visible {
  outline: 2px solid var(--already-primary);
  outline-offset: 2px;
}

.already-detail-share svg {
  flex-shrink: 0;
}

.already-detail-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
```

- [ ] **Step 2: Move the back-button bottom margin to the action row**

In `src/styles/base.css`, in the `.already-detail-back` rule (near line 587), remove the `margin-bottom: 1rem;` line (the new `.already-detail-actions` rule now owns that spacing, so Back + Share share one row without a doubled gap).

- [ ] **Step 3: Build + lint**

Run: `npm run build && npm run lint`
Expected: build emits the CSS bundle without error; biome clean.

- [ ] **Step 4: Commit**

```bash
git add src/styles/base.css
git commit -m "$(cat <<'EOF'
style: add share button + action row styles
EOF
)"
```

---

## Task 8: Documentation

**Files:**
- Modify: `docs/configuration.md`

**Interfaces:** docs only — verified by manual review + working links.

- [ ] **Step 1: Add the `shareUrl` config row**

In `docs/configuration.md`, add directly after the `subscribeUrl` table row (line 43):

```markdown
| `shareUrl` | `string \| null` | `null` | Canonical page URL used by the Share buttons. Event shares append `/event/<id>`; calendar shares append `#<view>`. Falls back to the current page URL when unset (in an iframe that's the embed's URL, so set this to the host page for shareable links). |
```

- [ ] **Step 2: Document the `data-share-url` attribute**

In `docs/configuration.md`, in the data-attributes table (the section above line 532), add a row following the existing format:

```markdown
| `data-share-url` | `shareUrl` — canonical page URL for the Share buttons |
```

(Match the exact column shape of the surrounding rows in that table.)

- [ ] **Step 3: Add the iframe permissions note**

In `docs/configuration.md`, add a short subsection (place it near the embedding/iframe guidance, or directly under the `shareUrl` row's section):

```markdown
### Sharing inside an iframe

The Share buttons use the browser's native share sheet (`navigator.share`) and
fall back to copying the link (`navigator.clipboard`). When the widget is
embedded cross-origin in an `<iframe>`, both APIs are gated by Permissions
Policy and must be delegated by the embedding page:

```html
<iframe src="…" allow="web-share; clipboard-write"></iframe>
```

Without `web-share`, sharing silently falls back to copy; without
`clipboard-write`, the copy fallback is unavailable and the button does nothing
rather than erroring.
```

- [ ] **Step 4: Verify links + render**

Run: `grep -n "shareUrl\|data-share-url\|web-share" docs/configuration.md`
Expected: the new row, data-attr, and iframe note all present. Manually skim the rendered table alignment.

- [ ] **Step 5: Commit**

```bash
git add docs/configuration.md
git commit -m "$(cat <<'EOF'
docs: document shareUrl config + iframe web-share permissions
EOF
)"
```

---

## Task 9: Full verification + open PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full suite + coverage + lint + build**

Run:
```bash
npm test 2>&1 | tail -8
npm run test:coverage 2>&1 | tail -15
npm run lint
npm run build
```
Expected: all tests pass; coverage thresholds met (functions ≥72, lines ≥86); biome clean; bundle builds.

- [ ] **Step 2: Attribution + leakage sweep**

Run:
```bash
git log --format=%B $(git merge-base origin/main HEAD)..HEAD | grep -niE "co-authored-by: claude|generated with .*claude" && echo "ATTRIBUTED" || echo "clean"
git diff origin/main..HEAD -- src docs | grep -niE "already\.events|already-events" && echo "LEAK" || echo "no leak"
```
Expected: `clean` and `no leak`.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin spec/49-web-share-button
gh pr create --repo stavxyz/already-cal --title "feat: Web Share button on event detail + calendar header (#49)" --body "$(cat <<'EOF'
## Summary

Implements #49 (blessed spec: `docs/superpowers/specs/2026-06-17-web-share-button-design.md`). Adds Share affordances:

- **Event-share** on the detail view (top row, next to Back) → shares `<shareBase>/event/<id>`.
- **Calendar-share** in the header (next to Subscribe) → shares `<shareBase>#<view>` for the current view type.

Both use `navigator.share` with a copy-to-clipboard fallback and inline "Copied!" feedback. New `shareUrl` config (+ `data-share-url`) supplies the canonical base; it falls back to the current page URL when unset.

## Design

- `buildShareUrl(base, target)` (pure) and `shareOrCopy({title,url})` (pure-of-DOM) are the two core helpers; `createShareButton(...)` composes them into a button. `shareUrl`/view state is read at click time via a `config.getShareState()` seam shaped to carry a navigated **date** later — the deferred "share the exact month/week window" feature is additive (one `buildShareUrl` branch + a `parseHash` case), not a rewrite.

## Behavior change to note

`renderHeader` previously rendered nothing for a calendar with no name *and* no description. Because the calendar is always shareable, the header's action row (Share, + Subscribe when present) now renders in that case. Existing embeds gain a Share button in the header (sharing the configured `shareUrl`, or the current page URL as fallback).

## Test plan

- [x] `buildShareUrl` — event path form + encoding, calendar hash form, base normalization, date-ignored forward-compat contract
- [x] `shareOrCopy` — share present, clipboard fallback, non-abort reject → copy, AbortError → no copy, both-absent → failed
- [x] `createShareButton` — renders icon+label, share path, copy→"Copied!" swap + revert
- [x] header + detail integration — buttons render, build correct URLs from live state, Back still works, share omitted without `shareBase`
- [x] Full suite + coverage thresholds + biome + build green
- [ ] [manual] Visual: Share buttons render correctly in header + detail across themes
- [ ] [manual] On a real device, native share sheet opens; on desktop, link copies with "Copied!" feedback
- [ ] [manual] Embedded cross-origin with `allow="web-share; clipboard-write"` — sharing works; without it, degrades to copy/no-op (no error)

Closes #49
EOF
)"
```
Expected: PR opened against `stavxyz/already-cal`.

- [ ] **Step 4: Monitor CI**

Watch the PR checks; confirm green. Do not merge (the repo owner merges).

---

## Self-Review

**Spec coverage:**
- Event-share (detail) → Task 6. ✓
- Calendar-share (header, view-type fidelity) → Task 5. ✓
- `buildShareUrl` path/hash + normalization + `date` ignored → Task 1. ✓
- `shareOrCopy` native→clipboard→failed, AbortError → Task 2. ✓
- `shareUrl` config + `data-share-url` + `shareBase`/`getShareState` seam → Task 4. ✓
- `config`-threaded seam (no positional-param growth) → Tasks 4-6 read off `config`. ✓ (validated design note)
- Inline "Copied!" + aria-live → Task 3. ✓
- Header empty-render relaxation → Task 5. ✓
- Title precedence `headerTitle || name || document.title` → Task 5. ✓
- iframe `allow="web-share; clipboard-write"` docs → Task 8. ✓
- Forward-compat (`date` additive) → Tasks 1 + 4 leave the seam. ✓

**Placeholder scan:** every code/test step has complete code; commands have expected output. No TBD/TODO.

**Type consistency:** `buildShareUrl(base, target)`, `shareOrCopy({title,url})→"shared"|"copied"|"failed"`, `createShareButton({className,label,copiedLabel,getUrl,getTitle,copiedDuration})→button`, `config.getShareState()→{view}`, `config.shareBase:string` — names/shapes match across Tasks 1-6.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-web-share-button.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, two-stage review (spec + quality) between tasks, fast iteration.

**2. Inline Execution** — I execute tasks in this session with checkpoints for review.

**Which approach?**
