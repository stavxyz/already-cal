# Card Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cards, day-view rows, month chips, and week blocks open their event through a real link instead of being `role="button"` elements that contain other controls, with the RSVP button named after its event and an axe-core check over every layout and view in the test suite.

**Architecture:** The router gains the one writer of the event route, `eventHref(entry)`, beside its one reader, `parseHash`. A new DOM-only module `src/ui/event-link.js` moves a title's text into a link (`linkTitle`) or makes an element the link itself (`eventAnchor`), and marks the host so one stylesheet rule stretches the link over it and one rule draws its focus ring. `bindEventClick` binds to that link, handles only plain activations, and takes a `canNavigate` predicate from the card decorator in place of knowing about cards. Controls that must stay clickable above the stretched link carry one class, `already-control`.

**Tech Stack:** Vanilla JS ES modules under `src/`, `node --test` with jsdom (`*.test.cjs`), Biome, esbuild with a committed `dist/`, axe-core (new dev dependency) for the accessibility check.

**Spec:** `docs/superpowers/specs/2026-10-06-card-links-design.md` (decisions D1 to D11). The spec is the authority; this plan is its argument.

## Global Constraints

- **Worktree:** `/Users/stavxyz/src/already-cal/.claude/worktrees/card-links`, branch `feat/card-links`, cut from `origin/main` at `446a174` (v0.13.0). `node_modules` there is a symlink to a sibling worktree's install and is untracked: never `git add .` or `git add -A`; stage files by path.
- **Every Bash command** is a plain single command that starts with `cd /Users/stavxyz/src/already-cal/.claude/worktrees/card-links && `. No heredocs, no `$(...)`, no loops, no `eval`. Before any git command, confirm `git rev-parse --show-toplevel` ends with `/worktrees/card-links` and `git branch --show-current` prints `feat/card-links`.
- **Never run:** `rm`, `git clean`, `git reset`, `git checkout --`, `git restore`, `git stash`, `git commit --amend`, `git rebase`, `git push`, `git add .`, `git add -A`, `op`. To undo an edit, edit it back.
- **Gate before every commit:** `npm test` passes, `npm run check` is clean (if it reports only formatting or import order, run `npm run format`, confirm with `git status --short` that only this task's files changed, and re-run), and after `npm run build` the only changes under `dist/` are the ones being committed. `dist/` is committed and CI fails when it is stale. `npm run test:perf` once, in Task 10.
- **Commits:** one logical change per commit, the exact subject each task gives, no body unless given, no attribution trailers or footers of any kind (no `Co-Authored-By`, no `Generated with`). A subject names one change and contains no "and".
- **Writing rules** for every comment, doc, test name, and commit message this plan adds: no em dash or en dash as punctuation (a dash inside an expected string that quotes formatter output is not punctuation), complete sentences in prose, "and" before the last item of a list, comments that state a constraint or a reason the code cannot show. Existing lines keep their dashes.
- **This repository is open source and never names the service that consumes it.** Do not write that service's name in code, comments, tests, docs, or commits.
- **Names are fixed by the spec:** `eventHref`, `linkTitle`, `eventAnchor`, classes `already-event-link`, `already-link-host`, `already-control`, `already-sr-only`, `already-card__link`, `already-day-event__link`, option `canNavigate`, i18n keys `rsvpFor` (default `"RSVP for {title}"`) and `openEvent` (default `"Open event"`).
- **Behaviour changes a host can see** (spec D8) are deliberate: cards, rows, chips, and blocks carry no `role` or `tabindex`; Space no longer opens an event; a middle or modifier click is the browser's; `onEventClick` fires for plain activations only; the Badge Details link no longer opens the detail view too; the RSVP button's accessible name includes the event title. Tests that pinned the old behaviour change as each task says. No other behaviour changes.
- **Tests are written first** and run to a failing state before the source changes. Keep the failing output for the report. A test that pins unchanged behaviour may pass before the change; say so.
- **Ruling: a plain click navigates by setting the hash from the link's own `href` after `preventDefault()`.** jsdom does not navigate on anchor activation (probe: a clicked `<a href="#event/abc">` under `test/setup-dom.cjs` leaves `location.hash` empty), and the suite navigates by clicking. The browser would have done the same navigation. The route is still built once, in `eventHref`.
- **Ruling: the visually hidden fallback link hides its text, not itself.** The link stays statically positioned with a `.already-sr-only` span inside, because an absolutely positioned link would become the containing block of its own `::after` and the stretch would cover one pixel.
- **Ruling: a title that already is or contains a link or a button is not wrapped.** A custom layout that made its title a link keeps it, and the hidden fallback link is added instead, so no link ends up inside a link (spec D1's fallback branch, applied to this case too).
- **Task 10 (release) rebases on `origin/main` first.** Another branch (`feat/detail-title`, v0.13.1) is expected to merge before this one. If `origin/main` is still at `446a174` when Task 10 is reached, stop and report; the controller decides whether to wait.

## Review Focus

Inputs the spec implies and no decision spells out, most likely to bite first. Each has a test in the task named.

1. An id with reserved characters (`/`, `?`, `=`, `&`, `:`, `@`): `eventHref` writes it as it is and `parseHash` reads it back unchanged, the way `setEventDetail` did. Task 1.
2. A title element with child elements (a custom layout's icon span): every child node moves into the link, in order, and nothing is dropped. Task 2.
3. A custom layout whose title already is a link, or contains a button: the layout's own control is left alone and the hidden fallback link is used, so no link nests in a link. Tasks 2 and 4.
4. A click on the RSVP button, and a click or key inside the open form, navigate nowhere once the form's propagation guards are gone, because the link is a sibling and not an ancestor. Task 7.
5. A modifier click or a middle click on the link: `onEventClick` does not fire, nothing is prevented, and the hash does not change, so the browser opens a new tab. Task 3.

---

### Task 1: The router writes the event link

**Files:**
- Modify: `src/router.js` (add `eventHref` after `setDayView`; `setEventDetail` is removed in Task 3, when its only caller goes)
- Create: `test/router.test.cjs`

**Interfaces:**
- Consumes: nothing new. `parseHash` (`src/router.js`) reads `#event/<id>` as `{ view: "detail", eventId: <id> }` with no decoding.
- Produces: `eventHref(entry)` exported from `src/router.js`. Returns `` `#event/${entry.id}` ``, or `` `#event/${entry.parentId}` `` when `entry.id` is `null` or `undefined`, or `null` when both are. Tasks 4, 5, and 6 call it; nothing else builds the string.

- [ ] **Step 1: Write the failing test**

Create `test/router.test.cjs`:

```js
require("./setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let eventHref, parseHash;
before(async () => {
  ({ eventHref, parseHash } = await import("../src/router.js"));
});
afterEach(() => {
  window.location.hash = "";
});

describe("eventHref", () => {
  it("links an entry by its id", () => {
    assert.strictEqual(eventHref({ id: "abc" }), "#event/abc");
  });

  it("links a part with no id of its own to its parent", () => {
    assert.strictEqual(eventHref({ parentId: "p1" }), "#event/p1");
    assert.strictEqual(eventHref({ id: undefined, parentId: "p1" }), "#event/p1");
  });

  it("prefers the entry's own id over its parent's", () => {
    assert.strictEqual(eventHref({ id: "a", parentId: "p" }), "#event/a");
  });

  it("returns null for an entry with neither id nor parent id", () => {
    assert.strictEqual(eventHref({}), null);
    assert.strictEqual(eventHref({ id: null }), null);
    assert.strictEqual(eventHref(null), null);
  });

  it("writes the id as parseHash reads it, reserved characters included", () => {
    // Characters a Google event id or a host's id can carry, none of which
    // the URL fragment encodes.
    const id = "evt/2026?x=1&y=2:z@w";
    window.location.hash = eventHref({ id });
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: id });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/router.test.cjs`
Expected: FAIL, 5 tests, each with `TypeError: eventHref is not a function`.

- [ ] **Step 3: Write the implementation**

In `src/router.js`, insert after the `setDayView` function (before `/** Navigate to an event's detail view by setting the URL hash. */`):

```js
/**
 * The href that opens an entry's detail view: the one writer of the event
 * route that parseHash reads. A part with no id of its own links to its
 * parent, where it is shown. An entry with neither has no route, so this
 * returns null and the caller renders nothing activatable in place of a
 * link to nowhere. The id is written as it is, without encoding, because
 * parseHash reads it as it is.
 */
export function eventHref(entry) {
  const id = entry?.id ?? entry?.parentId;
  return id == null ? null : `#event/${id}`;
}

```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/router.test.cjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Gate and commit**

```bash
npm test
npm run check
npm run build
git add src/router.js test/router.test.cjs dist
git commit -m "feat(router): eventHref is the one writer of an event's link"
```

---

### Task 2: One primitive puts an event link in place

**Files:**
- Create: `src/ui/event-link.js`
- Create: `test/ui/event-link.test.cjs`

**Interfaces:**
- Consumes: `createElement(tag, className, attrs)` from `src/views/helpers.js`.
- Produces, exported from `src/ui/event-link.js`:
  - `LINK_HOST_CLASS`, the string `"already-link-host"`.
  - `linkTitle(host, href, { titleSelector, linkClass, fallbackText })`: returns the `<a>` it placed, or `null` when `href` is `null`. The link carries the classes `already-event-link` and `linkClass`. The host gains `already-link-host`.
  - `eventAnchor(href, className)`: an `<a class=className href>` when `href` is not `null`, else a `<div class=className>`.
  Tasks 4, 5, and 6 consume these.

- [ ] **Step 1: Write the failing test**

Create `test/ui/event-link.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let linkTitle, eventAnchor, LINK_HOST_CLASS;
before(async () => {
  ({ linkTitle, eventAnchor, LINK_HOST_CLASS } = await import(
    "../../src/ui/event-link.js"
  ));
});

const opts = {
  titleSelector: ".card__title",
  linkClass: "card__link",
  fallbackText: "Open event",
};

function hostWithTitle(titleHtml) {
  const host = document.createElement("div");
  host.className = "card";
  host.innerHTML = `<div class="card__title">${titleHtml}</div><div class="card__meta">10:00</div>`;
  return host;
}

describe("linkTitle", () => {
  it("moves the title's text into a link appended to the title element", () => {
    const host = hostWithTitle("Burger Night");
    const link = linkTitle(host, "#event/e1", opts);
    const title = host.querySelector(".card__title");
    assert.strictEqual(title.childNodes.length, 1);
    assert.strictEqual(title.firstChild, link);
    assert.strictEqual(link.tagName, "A");
    assert.strictEqual(link.getAttribute("href"), "#event/e1");
    assert.strictEqual(link.textContent, "Burger Night");
    assert.strictEqual(title.textContent, "Burger Night");
  });

  it("gives the link both classes and marks the host", () => {
    const host = hostWithTitle("Burger Night");
    const link = linkTitle(host, "#event/e1", opts);
    assert.ok(link.classList.contains("already-event-link"));
    assert.ok(link.classList.contains("card__link"));
    assert.ok(host.classList.contains(LINK_HOST_CLASS));
    assert.strictEqual(LINK_HOST_CLASS, "already-link-host");
  });

  it("moves every child node of the title, in order", () => {
    const host = hostWithTitle('<span class="icon">*</span> Burger <em>Night</em>');
    const link = linkTitle(host, "#event/e1", opts);
    assert.strictEqual(link.childNodes.length, 3);
    assert.strictEqual(link.querySelector(".icon").textContent, "*");
    assert.strictEqual(link.querySelector("em").textContent, "Night");
    assert.strictEqual(link.textContent, "* Burger Night");
  });

  it("appends a hidden link with the fallback text when there is no title", () => {
    const host = document.createElement("div");
    host.innerHTML = '<div class="card__meta">10:00</div>';
    const link = linkTitle(host, "#event/e1", opts);
    assert.strictEqual(host.lastChild, link);
    assert.strictEqual(link.getAttribute("href"), "#event/e1");
    const hidden = link.querySelector("span.already-sr-only");
    assert.ok(hidden);
    assert.strictEqual(hidden.textContent, "Open event");
    assert.strictEqual(link.textContent, "Open event");
    assert.ok(host.classList.contains(LINK_HOST_CLASS));
  });

  it("leaves a title that is already a link alone, with the hidden link beside it", () => {
    const host = document.createElement("div");
    host.innerHTML =
      '<a class="card__title" href="https://x.example/">Burger Night</a>';
    const link = linkTitle(host, "#event/e1", opts);
    const own = host.querySelector("a.card__title");
    assert.strictEqual(own.getAttribute("href"), "https://x.example/");
    assert.strictEqual(own.querySelector("a"), null);
    assert.strictEqual(host.lastChild, link);
    assert.ok(link.querySelector(".already-sr-only"));
  });

  it("leaves a title that contains a button alone, with the hidden link beside it", () => {
    const host = hostWithTitle('Burger Night <button type="button">Pin</button>');
    const link = linkTitle(host, "#event/e1", opts);
    const title = host.querySelector(".card__title");
    assert.strictEqual(title.querySelector("a"), null);
    assert.ok(title.querySelector("button"));
    assert.strictEqual(host.lastChild, link);
  });

  it("does nothing for an entry with no route", () => {
    const host = hostWithTitle("Burger Night");
    const before = host.innerHTML;
    assert.strictEqual(linkTitle(host, null, opts), null);
    assert.strictEqual(host.innerHTML, before);
    assert.ok(!host.classList.contains(LINK_HOST_CLASS));
  });
});

describe("eventAnchor", () => {
  it("is an anchor with the href when the entry has a route", () => {
    const el = eventAnchor("#event/e1", "chip chip--featured");
    assert.strictEqual(el.tagName, "A");
    assert.strictEqual(el.getAttribute("href"), "#event/e1");
    assert.strictEqual(el.className, "chip chip--featured");
  });

  it("is a plain div when the entry has no route", () => {
    const el = eventAnchor(null, "chip");
    assert.strictEqual(el.tagName, "DIV");
    assert.strictEqual(el.hasAttribute("href"), false);
    assert.strictEqual(el.className, "chip");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test test/ui/event-link.test.cjs`
Expected: FAIL. The `before` hook rejects with `Cannot find module` for `src/ui/event-link.js`, so every test is reported as failed.

- [ ] **Step 3: Write the implementation**

Create `src/ui/event-link.js`:

```js
import { createElement } from "../views/helpers.js";

/**
 * The element an event link stretches over. The stylesheet positions it and
 * draws its focus ring, so a host needs no CSS of its own.
 */
export const LINK_HOST_CLASS = "already-link-host";

/**
 * Put an event's link in place inside `host`. The first element matching
 * `titleSelector` gives up its child nodes to a new anchor appended to it,
 * so the title's text is the link's accessible name and is read once. When
 * there is no such element, or it already is or contains a link or a
 * button (a custom layout's own control, which must not end up inside a
 * link), a link with visually hidden `fallbackText` is appended to `host`
 * instead. That link stays statically positioned and hides only its text:
 * an absolutely positioned link would be the containing block of its own
 * stretched pseudo-element.
 *
 * DOM only: this knows nothing about events or i18n. The caller resolves
 * the href (router.eventHref) and the fallback text. A null `href` means
 * the entry has no route, so nothing is added and null comes back.
 */
export function linkTitle(host, href, { titleSelector, linkClass, fallbackText }) {
  if (href == null) return null;
  const link = createElement("a", `already-event-link ${linkClass}`, { href });
  const title = host.querySelector(titleSelector);
  const holdsControl =
    title !== null &&
    (title.matches("a, button") || title.querySelector("a, button") !== null);
  if (title !== null && !holdsControl) {
    while (title.firstChild) link.appendChild(title.firstChild);
    title.appendChild(link);
  } else {
    const text = createElement("span", "already-sr-only");
    text.textContent = fallbackText;
    link.appendChild(text);
    host.appendChild(link);
  }
  host.classList.add(LINK_HOST_CLASS);
  return link;
}

/**
 * An element that is itself the event's link: an anchor when the entry has
 * a route, a plain div when it has none. The two cases are decided here so
 * no view repeats the choice.
 */
export function eventAnchor(href, className) {
  if (href == null) return createElement("div", className);
  return createElement("a", className, { href });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test test/ui/event-link.test.cjs`
Expected: PASS, 9 tests.

- [ ] **Step 5: Gate and commit**

```bash
npm test
npm run check
npm run build
git add src/ui/event-link.js test/ui/event-link.test.cjs dist
git commit -m "feat: one primitive puts an event's link in place"
```

---

### Task 3: Activation binds to the link

**Files:**
- Modify: `src/views/helpers.js` (`bindEventClick` and its imports)
- Modify: `src/router.js` (remove `setEventDetail`)
- Modify: `test/views/helpers.test.cjs` (the `bindEventClick` describe block)

**Interfaces:**
- Consumes: nothing new.
- Produces: `bindEventClick(el, event, viewName, config, { canNavigate } = {})`. `el` is the link (an `<a>` with an `href`) or `null`, in which case the call is a no-op. On a plain click it runs `canNavigate` (when given), then `config.onEventClick(event, viewName)`, and either prevents the default or prevents it and sets `window.location.hash` to the link's `href`. It sets no attribute. Tasks 4, 5, and 6 call it. `setEventDetail` no longer exists.

- [ ] **Step 1: Confirm the old option and the old helper have no other users**

Run: `grep -rn "stopPropagation: true\|setEventDetail\|RSVP_OPEN_CLASS" src`
Expected: `setEventDetail` appears in `src/router.js` (its definition) and `src/views/helpers.js` (import and one call); `RSVP_OPEN_CLASS` appears in `src/views/helpers.js`, `src/ui/rsvp-form.js`, and `src/ui/rsvp-state.js`; `stopPropagation: true` appears nowhere. If anything else shows up, stop and report.

- [ ] **Step 2: Rewrite the failing tests**

In `test/views/helpers.test.cjs`, replace the whole `describe("bindEventClick", () => { ... });` block (from `describe("bindEventClick"` through the closing `});` of the test named `"stops propagation when stopPropagation option is true"`) with:

```js
describe("bindEventClick", () => {
  const link = (href = "#event/evt-1") => {
    const a = document.createElement("a");
    a.setAttribute("href", href);
    a.textContent = "Event";
    document.body.appendChild(a);
    return a;
  };
  const click = (el, init = {}) => {
    const e = new window.MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      ...init,
    });
    el.dispatchEvent(e);
    return e;
  };

  it("navigates to the link's href on a plain click", () => {
    const el = link();
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    const e = click(el);
    assert.strictEqual(e.defaultPrevented, true);
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("calls onEventClick before navigating", () => {
    const el = link();
    const calls = [];
    bindEventClick(el, { id: "evt-1" }, "grid", {
      onEventClick: (event, view) => calls.push([event.id, view]),
    });
    click(el);
    assert.deepStrictEqual(calls, [["evt-1", "grid"]]);
    assert.strictEqual(window.location.hash, "#event/evt-1");
  });

  it("prevents navigation when onEventClick returns false", () => {
    const el = link();
    bindEventClick(el, { id: "evt-1" }, "grid", { onEventClick: () => false });
    const e = click(el);
    assert.strictEqual(e.defaultPrevented, true);
    assert.strictEqual(window.location.hash, "");
  });

  it("prevents navigation when canNavigate says no, before asking the host", () => {
    const el = link();
    let asked = false;
    bindEventClick(
      el,
      { id: "evt-1" },
      "grid",
      { onEventClick: () => (asked = true) },
      { canNavigate: () => false },
    );
    const e = click(el);
    assert.strictEqual(e.defaultPrevented, true);
    assert.strictEqual(asked, false);
    assert.strictEqual(window.location.hash, "");
  });

  it("leaves a modifier click to the browser", () => {
    const el = link();
    let asked = false;
    bindEventClick(el, { id: "evt-1" }, "grid", {
      onEventClick: () => (asked = true),
    });
    for (const init of [
      { metaKey: true },
      { ctrlKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      const e = click(el, init);
      assert.strictEqual(e.defaultPrevented, false, JSON.stringify(init));
    }
    assert.strictEqual(asked, false);
    assert.strictEqual(window.location.hash, "");
  });

  it("sets no role and no tabindex", () => {
    const el = link();
    bindEventClick(el, { id: "evt-1" }, "grid", {});
    assert.strictEqual(el.getAttribute("role"), null);
    assert.strictEqual(el.getAttribute("tabindex"), null);
  });

  it("lets the click bubble", () => {
    const parent = document.createElement("div");
    const el = link();
    parent.appendChild(el);
    document.body.appendChild(parent);
    let parentClicked = false;
    parent.addEventListener("click", () => {
      parentClicked = true;
    });
    bindEventClick(el, { id: "evt-1" }, "month", {});
    click(el);
    assert.strictEqual(parentClicked, true);
  });

  it("is a no-op for an entry with no link", () => {
    assert.doesNotThrow(() => bindEventClick(null, { title: "No id" }, "grid", {}));
    // A chip or block for an entry with no route is a plain div with no
    // href (ui/event-link.js, eventAnchor); binding it must change nothing.
    const plain = document.createElement("div");
    document.body.appendChild(plain);
    bindEventClick(plain, { title: "No id" }, "month", {});
    const e = click(plain);
    assert.strictEqual(e.defaultPrevented, false);
    assert.strictEqual(window.location.hash, "");
  });
});
```

Also add, inside the existing `beforeEach`, after `window.location.hash = "";`:

```js
  document.body.innerHTML = "";
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `node --test test/views/helpers.test.cjs`
Expected: FAIL. "sets no role and no tabindex" fails (`'button'` is not `null`), "leaves a modifier click to the browser" fails (the hash is set), "prevents navigation when canNavigate says no" fails (the hash is set), and "is a no-op for an entry with no link" fails with a TypeError on `el.addEventListener` for `null`. The others pass, because the old handler also navigates on click.

- [ ] **Step 4: Write the implementation**

In `src/views/helpers.js`, replace the imports `import { setEventDetail } from "../router.js";` and `import { RSVP_OPEN_CLASS } from "../ui/rsvp-state.js";` by removing both lines (keep every other import), and replace the whole `bindEventClick` function, from its doc comment `/** Bind click and keyboard handlers to navigate to an event's detail view. */` through its closing `}`, with:

```js
/**
 * Bind the activation of an event's link. On a plain activation (the primary
 * button with no modifier key, which is also what Enter on a focused link
 * produces) it asks the caller's `canNavigate` first (a card with its RSVP
 * form open says no), then `config.onEventClick`, whose `false` return stops
 * navigation, and then navigates by copying the link's own href into the
 * hash. That is the navigation the browser would have performed, done by
 * hand because the test environment does not navigate on anchor activation.
 * A middle or modifier click is left to the browser, which opens a new tab.
 * An entry with no route (router.eventHref) has no link: `el` is then null,
 * or a plain element with no href, and the call is a no-op.
 */
export function bindEventClick(
  el,
  event,
  viewName,
  config,
  { canNavigate } = {},
) {
  if (el === null || !el.hasAttribute("href")) return;
  el.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    if (canNavigate && !canNavigate()) return;
    if (config.onEventClick) {
      const result = config.onEventClick(event, viewName);
      if (result === false) return;
    }
    window.location.hash = el.getAttribute("href");
  });
}
```

In `src/router.js`, delete the `setEventDetail` function and its doc comment `/** Navigate to an event's detail view by setting the URL hash. */`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test test/views/helpers.test.cjs test/router.test.cjs`
Expected: PASS for every test in both files.

Run: `npm test`
Expected: tests that clicked a card, a chip, a block, or a row to navigate now fail (`grid.test.cjs` "navigates to detail on click", `list.test.cjs` "navigates to detail on click", `month.test.cjs` "navigates to detail on chip click", `week.test.cjs` "navigates to detail on event click", `day.test.cjs` "navigates to detail on click", `day-navigation.test.cjs` chip and block tests, the `event-popover.test.cjs` card tests, `composite-widget.test.cjs` and `calendar-composite.test.cjs` click tests, `rsvp-sites.test.cjs` "a card with an open RSVP form", `card-parts.test.cjs` through `bindEventClick` on cards, and `grid.test.cjs` "sets accessibility attributes"), because the views still call `bindEventClick` on a div with no `href`. Record the count of failing tests in the report. That is expected: Tasks 4, 5, and 6 move each site onto a link and bring the suite back to green, one site at a time. Commit this task only when `npm run check` is clean and the two files above pass; the global gate's `npm test` requirement is waived for Tasks 3 to 5 and restored at Task 6.

- [ ] **Step 6: Check and commit**

```bash
npm run check
npm run build
git add src/views/helpers.js src/router.js test/views/helpers.test.cjs dist
git commit -m "refactor: bindEventClick binds an event's link, with no role or key handler"
```

---

### Task 4: Cards open through their title link

**Files:**
- Modify: `src/views/card-decoration.js`
- Modify: `src/ui/rsvp-form.js` (`decorateRsvp` puts `already-control` on the row it mounts into)
- Modify: `src/layouts/badge/badge.js` (the Details link gets `already-control`)
- Modify: `src/already-cal.js` (`I18N_DEFAULTS` gains `openEvent`)
- Modify: `src/layouts/base.css` (remove `.already-card:focus-visible`)
- Modify: `src/styles/base.css` (append the event link rules)
- Modify: `test/views/grid.test.cjs`, `test/views/list.test.cjs`, `test/ui/event-popover.test.cjs`, `test/views/rsvp-sites.test.cjs`, `test/ui/card-parts.test.cjs`, `test/composite-widget.test.cjs`, `test/layouts/custom.test.cjs`
- Modify: `test/views/ordinary-card-markup.test.cjs`; replace `test/fixtures/ordinary-cards-v0.12.1.json` with `test/fixtures/ordinary-cards-v0.14.0.json`
- Create: `test/views/card-link.test.cjs`

**Interfaces:**
- Consumes: `eventHref` (Task 1), `linkTitle` and `LINK_HOST_CLASS` (Task 2), `bindEventClick` with `canNavigate` (Task 3), `RSVP_OPEN_CLASS` from `src/ui/rsvp-state.js`, `decorateParts`, `decorateRsvp`.
- Produces: every decorated card (grid, list, popover) has `a.already-event-link.already-card__link` inside `.already-card__title` with `href` from `eventHref`, the class `already-link-host` on the card, no `role` and no `tabindex`, and `already-control` on the Badge Details link and on the RSVP row. Task 8's a11y test and the consuming service's e2e specs rely on those class names.

- [ ] **Step 1: Write the failing tests**

Create `test/views/card-link.test.cjs`:

```js
require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderGridView, renderListView, register;
before(async () => {
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderListView } = await import("../../src/views/list.js"));
  ({ register } = await import("../../src/registry.js"));
});
afterEach(() => {
  document.body.innerHTML = "";
  window.location.hash = "";
});

const NAMES = ["clean", "compact", "badge", "hero"];
const cfg = (layout, over = {}) => ({
  locale: "en-US",
  i18n: {},
  _theme: { layout, orientation: "vertical", imagePosition: "left" },
  ...over,
});
const grid = (events, config) => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  renderGridView(c, events, "UTC", config);
  return c;
};

describe("a card opens through its title link", () => {
  for (const name of NAMES) {
    it(`${name}: the title holds the link, the card is no button`, () => {
      const c = grid([createTestEvent({ id: "e1", title: "Burger Night" })], cfg(name));
      const card = c.querySelector(".already-card");
      const link = card.querySelector(".already-card__title > a.already-event-link.already-card__link");
      assert.ok(link, "link inside the title");
      assert.strictEqual(link.getAttribute("href"), "#event/e1");
      assert.strictEqual(link.textContent, "Burger Night");
      assert.strictEqual(card.getAttribute("role"), null);
      assert.strictEqual(card.getAttribute("tabindex"), null);
      assert.ok(card.classList.contains("already-link-host"));
      assert.strictEqual(card.dataset.eventId, "e1");
    });
  }

  it("navigates when the link is clicked, with onEventClick asked first", () => {
    const calls = [];
    const c = grid([createTestEvent({ id: "e1" })], cfg("clean", {
      onEventClick: (event, view) => calls.push([event.id, view]),
    }));
    c.querySelector(".already-card__link").click();
    assert.deepStrictEqual(calls, [["e1", "grid"]]);
    assert.strictEqual(window.location.hash, "#event/e1");
  });

  it("list view gives the same link", () => {
    const c = document.createElement("div");
    renderListView(c, [createTestEvent({ id: "e2" })], "UTC", cfg("hero"));
    const link = c.querySelector(".already-card__title > a.already-card__link");
    assert.strictEqual(link.getAttribute("href"), "#event/e2");
    assert.strictEqual(c.querySelector(".already-card").getAttribute("role"), null);
  });

  it("links a part shown as its own card to its parent when it has no id", () => {
    // A part on another day can be a top-level item; one with no id links to
    // its parent, where it is shown.
    const part = { ...createTestEvent({ title: "Late Set" }), id: undefined, parentId: "p1" };
    const c = grid([part], cfg("clean"));
    assert.strictEqual(c.querySelector(".already-card__link").getAttribute("href"), "#event/p1");
  });

  it("gives an entry with no route no link, and the card stays inert", () => {
    const orphan = { ...createTestEvent({ title: "No id" }), id: undefined };
    const c = grid([orphan], cfg("clean"));
    const card = c.querySelector(".already-card");
    assert.strictEqual(card.querySelector("a.already-event-link"), null);
    assert.ok(!card.classList.contains("already-link-host"));
    card.click();
    assert.strictEqual(window.location.hash, "");
  });

  it("puts already-control on the Badge Details link and on the RSVP row", () => {
    const event = createTestEvent({ id: "e3", rsvp: true, htmlLink: "https://cal.example/e3" });
    const c = grid([event], cfg("badge", { onRsvp: async () => ({ partySize: 1 }) }));
    const details = c.querySelector("a.already-card__action");
    assert.ok(details.classList.contains("already-control"));
    const row = c.querySelector(".already-card__footer--rsvp");
    assert.ok(row.classList.contains("already-control"));
    assert.ok(row.contains(c.querySelector(".already-rsvp__open")));
  });

  it("puts already-control on the RSVP row a layout without a footer gets", () => {
    const event = createTestEvent({ id: "e4", rsvp: true });
    const c = grid([event], cfg("clean", { onRsvp: async () => ({ partySize: 1 }) }));
    const row = c.querySelector(".already-card__footer--rsvp");
    assert.ok(row.classList.contains("already-control"));
  });

  it("does not navigate from the link while the RSVP form is open, and does again after Cancel", () => {
    const event = createTestEvent({ id: "e5", rsvp: true });
    const c = grid([event], cfg("clean", { onRsvp: async () => ({ partySize: 1 }) }));
    c.querySelector(".already-rsvp__open").click();
    c.querySelector(".already-card__link").click();
    assert.strictEqual(window.location.hash, "");
    c.querySelector(".already-rsvp__cancel").click();
    c.querySelector(".already-card__link").click();
    assert.strictEqual(window.location.hash, "#event/e5");
  });

  it("decorates a composite's card the same way", () => {
    const c = grid([createComposite({ id: "night", title: "Burger Night" }, [{ title: "Act" }])], cfg("clean"));
    const link = c.querySelector(".already-card__title > a.already-card__link");
    assert.strictEqual(link.getAttribute("href"), "#event/night");
    assert.strictEqual(link.textContent, "Burger Night");
  });

  it("gives a custom layout with no title a hidden link, and leaves one whose title is a link alone", () => {
    register("layout", "bare", () => {
      const card = document.createElement("div");
      card.className = "already-card";
      const body = document.createElement("div");
      body.className = "already-card__body";
      body.textContent = "no title here";
      card.appendChild(body);
      return card;
    });
    register("layout", "linked", (event) => {
      const card = document.createElement("div");
      card.className = "already-card";
      const title = document.createElement("a");
      title.className = "already-card__title";
      title.href = "https://x.example/";
      title.textContent = event.title;
      card.appendChild(title);
      return card;
    });
    const bare = grid([createTestEvent({ id: "b1", title: "Bare" })], cfg("bare"));
    const hidden = bare.querySelector("a.already-event-link");
    assert.strictEqual(hidden.getAttribute("href"), "#event/b1");
    assert.strictEqual(hidden.querySelector(".already-sr-only").textContent, "Bare");

    const linked = grid([createTestEvent({ id: "l1", title: "Linked" })], cfg("linked"));
    const own = linked.querySelector("a.already-card__title");
    assert.strictEqual(own.getAttribute("href"), "https://x.example/");
    assert.strictEqual(own.querySelector("a"), null);
    assert.strictEqual(linked.querySelector("a.already-event-link").getAttribute("href"), "#event/l1");
  });

  it("uses the i18n openEvent text for a hidden link when the title is empty", () => {
    register("layout", "bare2", () => {
      const card = document.createElement("div");
      card.className = "already-card";
      return card;
    });
    const c = grid([createTestEvent({ id: "b2", title: "" })], cfg("bare2", { i18n: { openEvent: "Abrir" } }));
    assert.strictEqual(c.querySelector(".already-sr-only").textContent, "Abrir");
  });
});
```

Then update the existing tests that pinned the old behaviour:

- `test/views/grid.test.cjs`, test "sets accessibility attributes": replace its two assertions with
  ```js
    assert.strictEqual(card.getAttribute("tabindex"), null);
    assert.strictEqual(card.getAttribute("role"), null);
    assert.strictEqual(
      card.querySelector(".already-card__title > a.already-card__link").getAttribute("href"),
      `#event/${events[0].id}`,
    );
  ```
  and rename it to `"makes the title a link and the card no button"`. In the test "navigates to detail on click" (and in `test/views/list.test.cjs`, same name), change `container.querySelector(".already-card").click();` to `container.querySelector(".already-card__link").click();`.
- `test/views/rsvp-sites.test.cjs`, test "ignores clicks and Enter on the card, and navigates again after Cancel": rename to `"ignores the link while the form is open, and navigates again after Cancel"`, change both `card.querySelector(".already-card__title").click();` to `card.querySelector(".already-card__link").click();`, and delete the three lines that dispatch the Enter keydown on the card and assert the hash after it (a link handles Enter natively, and the card has no handler).
- `test/ui/event-popover.test.cjs`: the two `find().querySelector(".already-card").click()` calls (near lines 80 and 269) become `find().querySelector(".already-card__link").click()` where the test expects navigation; where a test only expects the popover to close, the click on the card may stay, because the card's own close listener is unchanged. Read each test's assertions to decide, and say which you changed. The test "popover card matches the grid card" needs no change: both cards carry the same classes.
- `test/composite-widget.test.cjs`: in `describe("what onEventClick receives", ...)`, the click on `.already-card` becomes a click on `.already-card .already-card__link`. (The day-row click in that block changes in Task 5.)
- `test/ui/card-parts.test.cjs`: no change; its error-card test asserts `role` is `null`, which still holds, and no test there clicks a card.
- `test/layouts/custom.test.cjs`: no change; the error card still has no `role`.
- `test/views/ordinary-card-markup.test.cjs`: this test exists to catch exactly this change. Regenerate the fixture after Step 4 (see Step 6), rename the fixture file to `test/fixtures/ordinary-cards-v0.14.0.json`, change the `require` to it, and change the comment to say the strings were captured at v0.14.0 and that the title now holds the event link.

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test test/views/card-link.test.cjs`
Expected: FAIL. Every test in "a card opens through its title link" fails: there is no `a.already-card__link` (the cards are still buttons), the `already-control` tests find no class, and the orphan test finds `role="button"`.

- [ ] **Step 3: Write the implementation**

`src/views/card-decoration.js`: replace the whole file with:

```js
import { decorateParts } from "../ui/card-parts.js";
import { linkTitle } from "../ui/event-link.js";
import { decorateRsvp } from "../ui/rsvp-form.js";
import { RSVP_OPEN_CLASS } from "../ui/rsvp-state.js";
import { eventHref } from "../router.js";
import { isPast } from "../util/dates.js";
import { bindEventClick } from "./helpers.js";

/**
 * The state classes, the data attribute, and the link of a card. Private to
 * this module on purpose: the only way to apply it is through
 * decorateEventCard, which has already turned away an error card.
 *
 * The link is the title (or a hidden link when the layout rendered none),
 * stretched over the card by the stylesheet, so the card is clickable
 * everywhere without being a button that contains other controls. A card
 * with its RSVP form open stays put: navigating would discard what the
 * visitor typed.
 */
function applyCardState(card, event, viewName, config) {
  if (isPast(event.end || event.start))
    card.classList.add("already-card--past");
  if (event.featured) card.classList.add("already-card--featured");
  card.dataset.eventId = event.id;
  const i18n = config.i18n || {};
  const link = linkTitle(card, eventHref(event), {
    titleSelector: ".already-card__title",
    linkClass: "already-card__link",
    fallbackText: event.title || i18n.openEvent || "Open event",
  });
  bindEventClick(link, event, viewName, config, {
    canNavigate: () => !card.classList.contains(RSVP_OPEN_CLASS),
  });
}

/**
 * Everything a view adds to a card once its layout has rendered it, in one
 * fixed order: the state classes and the link, a composite's parts, and the
 * RSVP control. Grid, list, and the popover all call this. A card site that
 * listed its decorators by hand could leave one out, and a card that misses
 * the parts decorator silently loses events.
 *
 * What differs between sites is an option here. `timezone` is the calendar's
 * zone the site rendered the layout with. The popover passes `rsvp: false`:
 * it is a preview, and its card closes on any click.
 */
export function decorateEventCard(
  card,
  event,
  viewName,
  config,
  { timezone, rsvp = true } = {},
) {
  // An error card stands in for a layout that failed. It says the event
  // could not be displayed, so it gets no state, no link, no parts, and
  // nothing to act on. This is where the sequence asks. decorateRsvp asks
  // again on its own, because it is exported and tested as a standalone
  // decorator (ui/rsvp-form.js).
  if (card.classList.contains("already-card--error")) return;
  applyCardState(card, event, viewName, config);
  decorateParts(card, event, config, { timezone });
  if (rsvp) decorateRsvp(card, event, config);
}
```

`src/ui/rsvp-form.js`, in `decorateRsvp`: change `actionFooter.classList.add("already-card__footer--rsvp");` to `actionFooter.classList.add("already-card__footer--rsvp", "already-control");` and change the created row's class string `"already-card__footer already-card__footer--rsvp already-card__rsvp"` to `"already-card__footer already-card__footer--rsvp already-card__rsvp already-control"`. Add to the `decorateRsvp` doc comment, after "meant for actions.": `The row carries already-control, which keeps it clickable above the card's stretched event link (ui/event-link.js); the controls inside it inherit that, so nothing else in this module knows about the link.`

`src/layouts/badge/badge.js`: change `const details = createElement("a", "already-card__action", {` to `const details = createElement("a", "already-card__action already-control", {`.

`src/already-cal.js`, in `I18N_DEFAULTS`, after the line `  details: "Details",` add:

```js
  openEvent: "Open event",
```

`src/layouts/base.css`: delete the rule

```css
.already-card:focus-visible {
  outline: 2px solid var(--already-primary);
  outline-offset: 2px;
}
```

(the ring now comes from the host rule below, and the card itself is no longer focusable).

`src/styles/base.css`: append at the end of the file:

```css
/* ===== Event links ===== */
/* The host of an event link (a card, a day row) is the box the link
   stretches over, so it is the positioned ancestor of the link's pseudo
   element. Hosts are marked by ui/event-link.js, not by their own class, so
   a new host needs no rule here. */
.already-link-host {
  position: relative;
}

.already-event-link {
  color: inherit;
  text-decoration: none;
}

.already-event-link::after {
  content: "";
  position: absolute;
  inset: 0;
}

/* The ring belongs on the host, which is what the visitor sees as the
   clickable thing, not on the title text. Browsers without :has() fall back
   to the ring on the link text, which is still visible. */
.already-event-link:focus-visible {
  outline: none;
}

.already-link-host:has(.already-event-link:focus-visible) {
  outline: 2px solid var(--already-primary);
  outline-offset: 2px;
}

/* Day rows sit flush in a bordered list, where an outside ring is clipped. */
.already-day-event.already-link-host:has(.already-event-link:focus-visible) {
  outline-offset: -2px;
}

@supports not selector(:has(a)) {
  .already-event-link:focus-visible {
    outline: 2px solid var(--already-primary);
    outline-offset: 2px;
  }
}

/* A control inside a host must sit above the stretched link or it cannot be
   clicked. This one class is the contract for that; custom layouts put it
   on their own controls. */
.already-control {
  position: relative;
  z-index: 1;
}

/* Text for screen readers only. Used for the event link a layout without a
   title element gets. */
.already-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/views/card-link.test.cjs test/views/grid.test.cjs test/views/list.test.cjs test/views/rsvp-sites.test.cjs test/ui/event-popover.test.cjs test/ui/card-parts.test.cjs test/layouts/custom.test.cjs test/ui/rsvp-form.test.cjs`
Expected: PASS for every test. If `test/ui/rsvp-form.test.cjs` "stops click and keydown from reaching the card" still passes, that is expected here: Task 7 removes the guards and replaces that test.

- [ ] **Step 5: Confirm the markup pin fails for the right reason**

Run: `node --test test/views/ordinary-card-markup.test.cjs`
Expected: FAIL, 4 tests. Each diff shows the title's text now wrapped in `<a class="already-event-link already-card__link" href="#event/ev-1">`, the card gaining `already-link-host`, and the card losing `tabindex="0" role="button"`. Nothing else may differ. If anything else differs, stop and report it.

- [ ] **Step 6: Regenerate the markup fixture for v0.14.0**

Create the new fixture by running the capture the old one was made with: `node --input-type=module -e "..."` is not needed; instead run this one-off script, which mirrors the test's own render, from the worktree root:

```bash
node -e "process.env.TZ='UTC';require('./test/setup-dom.cjs');const {createTestEvent}=require('./test/helpers.cjs');(async()=>{const {renderGridView}=await import('./src/views/grid.js');const out={};for(const layout of ['clean','compact','badge','hero']){const c=document.createElement('div');renderGridView(c,[createTestEvent({id:'ev-1',title:'Autumn Market',description:'Stalls and music.',location:'Town Square',start:'2099-06-15T17:00:00Z',end:'2099-06-15T21:00:00Z',tags:[{key:'tag',value:'market'}],image:'https://x.example/market.jpg',links:[]})],'UTC',{locale:'en-US',i18n:{},_theme:{layout,orientation:'vertical',imagePosition:'left'}});out[layout]=c.querySelector('.already-card').outerHTML;}require('fs').writeFileSync('test/fixtures/ordinary-cards-v0.14.0.json',JSON.stringify(out,null,2)+'\n');console.log(Object.keys(out));})()"
```

Then in `test/views/ordinary-card-markup.test.cjs` change `require("../fixtures/ordinary-cards-v0.12.1.json")` to `require("../fixtures/ordinary-cards-v0.14.0.json")`, change the header comment to:

```js
// The decorated card of an event with no parts must be the markup v0.14.0
// produces, byte for byte, in every built-in layout. The strings in the
// fixture were captured from that release's branch with this same event.
// v0.14.0 is where the title became the event link and the card stopped
// being a button, so the v0.12.1 fixture was regenerated on purpose.
```

and change each test name from `matches v0.12.1` to `matches v0.14.0`. Delete the old fixture with `git rm test/fixtures/ordinary-cards-v0.12.1.json` (a `git rm` of a tracked file is allowed; `rm` is not).

Run: `node --test test/views/ordinary-card-markup.test.cjs`
Expected: PASS, 4 tests.

- [ ] **Step 7: Run the suite**

Run: `npm test`
Expected: the only failing tests are the ones Tasks 5 and 6 own: day rows (`day.test.cjs`, `day-navigation.test.cjs` row tests, `calendar-composite.test.cjs` day tests, `composite-widget.test.cjs` "gets the part, with parentId, for a click on the part's own row"), and chips and blocks (`month.test.cjs`, `week.test.cjs`, `day-navigation.test.cjs` chip and block tests, `calendar-composite.test.cjs` month and week tests). List the failing names in the report. Any other failure stops this task.

- [ ] **Step 8: Check and commit**

```bash
npm run check
npm run build
git add src/views/card-decoration.js src/ui/rsvp-form.js src/layouts/badge/badge.js src/already-cal.js src/layouts/base.css src/styles/base.css test/views/card-link.test.cjs test/views/grid.test.cjs test/views/list.test.cjs test/views/rsvp-sites.test.cjs test/ui/event-popover.test.cjs test/composite-widget.test.cjs test/views/ordinary-card-markup.test.cjs test/fixtures/ordinary-cards-v0.14.0.json dist
git commit -m "feat: cards open through their title link"
```

(The `git rm` from Step 6 is already staged.)

---

### Task 5: Day-view rows open through their title link

**Files:**
- Modify: `src/views/day.js` (`renderRow`)
- Modify: `src/styles/base.css` (remove `.already-day-event:focus-visible`)
- Modify: `test/views/day.test.cjs`, `test/views/day-navigation.test.cjs`, `test/views/calendar-composite.test.cjs`, `test/composite-widget.test.cjs`
- Create: `test/views/day-link.test.cjs`

**Interfaces:**
- Consumes: `eventHref` (Task 1), `linkTitle` (Task 2), `bindEventClick` (Task 3).
- Produces: every `.already-day-event` row has `a.already-event-link.already-day-event__link` inside `.already-day-event-title`, the class `already-link-host`, and no `role` or `tabindex`. Task 8 relies on it.

- [ ] **Step 1: Write the failing test**

Create `test/views/day-link.test.cjs`:

```js
// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "UTC";

require("../setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent, createComposite } = require("../helpers.cjs");

let renderDayView, placeByDay, eventDayKey;
before(async () => {
  ({ renderDayView } = await import("../../src/views/day.js"));
  ({ placeByDay } = await import("../../src/views/placement.js"));
  ({ eventDayKey } = await import("../../src/util/dates.js"));
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
afterEach(() => {
  document.body.innerHTML = "";
  window.location.hash = "";
});

const day = new Date(2099, 5, 15);
const render = (events, config = {}) => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  renderDayView(c, placeByDay(events, eventDayKey), "UTC", day, config);
  return c;
};
const at = (hour, over = {}) =>
  createTestEvent({
    start: `2099-06-15T${hour}:00:00Z`,
    end: `2099-06-15T${hour}:30:00Z`,
    ...over,
  });

describe("a day row opens through its title link", () => {
  it("puts the link in the title, with no role on the row", () => {
    const c = render([at("10", { id: "d1", title: "Brunch" })]);
    const row = c.querySelector(".already-day-event");
    const link = row.querySelector(
      ".already-day-event-title > a.already-event-link.already-day-event__link",
    );
    assert.ok(link);
    assert.strictEqual(link.getAttribute("href"), "#event/d1");
    assert.strictEqual(link.textContent, "Brunch");
    assert.strictEqual(row.getAttribute("role"), null);
    assert.strictEqual(row.getAttribute("tabindex"), null);
    assert.ok(row.classList.contains("already-link-host"));
  });

  it("navigates on a click of the link, with onEventClick asked first", () => {
    const calls = [];
    const c = render([at("10", { id: "d1" })], {
      onEventClick: (event, view) => calls.push([event.id, view]),
    });
    c.querySelector(".already-day-event__link").click();
    assert.deepStrictEqual(calls, [["d1", "day"]]);
    assert.strictEqual(window.location.hash, "#event/d1");
  });

  it("links a part row under its parent by the part's own id", () => {
    const c = render([
      createComposite(
        { id: "night", title: "Burger Night", start: "2099-06-15T17:00:00Z", end: "2099-06-15T21:00:00Z" },
        [{ id: "act", title: "Act", start: "2099-06-15T18:00:00Z", end: "2099-06-15T19:00:00Z" }],
      ),
    ]);
    const part = c.querySelector(".already-day-event--part");
    assert.strictEqual(
      part.querySelector("a.already-day-event__link").getAttribute("href"),
      "#event/act",
    );
    assert.strictEqual(part.getAttribute("role"), null);
  });

  it("links a part row with no id to its parent", () => {
    const c = render([
      createComposite(
        { id: "night", title: "Burger Night", start: "2099-06-15T17:00:00Z", end: "2099-06-15T21:00:00Z" },
        [{ id: undefined, title: "Act", start: "2099-06-15T18:00:00Z", end: "2099-06-15T19:00:00Z" }],
      ),
    ]);
    assert.strictEqual(
      c.querySelector(".already-day-event--part a.already-day-event__link").getAttribute("href"),
      "#event/night",
    );
  });

  it("gives a row with no route no link", () => {
    const orphan = { ...at("10", { title: "No id" }), id: undefined };
    const c = render([orphan]);
    const row = c.querySelector(".already-day-event");
    assert.strictEqual(row.querySelector("a"), null);
    assert.ok(!row.classList.contains("already-link-host"));
  });
});
```

Then update the existing tests:

- `test/views/day.test.cjs`, "navigates to detail on click": `container.querySelector(".already-day-event").click();` becomes `container.querySelector(".already-day-event__link").click();`.
- `test/views/day-navigation.test.cjs`: run `grep -n "already-day-event" test/views/day-navigation.test.cjs`; every `.click()` on a row that is meant to open the event becomes a click on the row's `.already-day-event__link`. Leave clicks that exercise the day navigation buttons alone.
- `test/views/calendar-composite.test.cjs`, `describe("day view with a composite", ...)`: the test "opens the composite's detail from a part's row by the part's id" clicks the row's `a.already-day-event__link` instead of the row; any assertion that the row has `role="button"` or `tabindex` is replaced by an assertion that the link's `href` is `#event/<part id>`.
- `test/composite-widget.test.cjs`: both tests that click `.already-day-event--part` ("gets the part, with parentId, for a click on the part's own row" and the one in `describe("a part with no id", ...)`): `c.querySelector(".already-day-event--part").click();` becomes `c.querySelector(".already-day-event--part .already-day-event__link").click();`.

- [ ] **Step 2: Run the new test to verify it fails**

Run: `node --test test/views/day-link.test.cjs`
Expected: FAIL, every test (the row is still a button with no link).

- [ ] **Step 3: Write the implementation**

In `src/views/day.js`, add to the imports: `import { linkTitle } from "../ui/event-link.js";` and `import { eventHref } from "../router.js";` (Biome orders imports by path; let `npm run format` place them). Replace the `renderRow` function with:

```js
  function renderRow(entry, isPart) {
    const item = createElement("div");
    applyEventClasses(item, entry, "already-day-event");
    if (isPart) item.classList.add("already-day-event--part");

    const timeEl = createElement("div", "already-day-event-time");
    timeEl.textContent = formatScheduleTime(entry, {
      sourceZoneFallback: timezone,
      locale,
      allDayLabel,
    });
    item.appendChild(timeEl);

    const info = createElement("div", "already-day-event-info");
    const titleEl = createElement("div", "already-day-event-title");
    titleEl.textContent = entry.title;
    info.appendChild(titleEl);
    if (entry.location) {
      const loc = createElement("div", "already-day-event-location");
      loc.textContent = entry.location;
      info.appendChild(loc);
    }
    item.appendChild(info);

    // The title is the link, stretched over the row by the stylesheet, so
    // the row is clickable everywhere without being a button. A part with
    // no id links to its parent (router.eventHref).
    const link = linkTitle(item, eventHref(entry), {
      titleSelector: ".already-day-event-title",
      linkClass: "already-day-event__link",
      fallbackText: entry.title || config.i18n?.openEvent || "Open event",
    });
    bindEventClick(link, entry, "day", config);
    return item;
  }
```

In `src/styles/base.css`, delete the rule

```css
.already-day-event:focus-visible {
  outline: 2px solid var(--already-primary);
  outline-offset: -2px;
}
```

(the host rule with the day-row offset added in Task 4 replaces it).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test test/views/day-link.test.cjs test/views/day.test.cjs test/views/day-navigation.test.cjs test/views/calendar-composite.test.cjs test/composite-widget.test.cjs`
Expected: PASS for every test except the month and week ones Task 6 owns (in `day-navigation.test.cjs` and `calendar-composite.test.cjs`). Name them in the report.

- [ ] **Step 5: Check and commit**

```bash
npm run check
npm run build
git add src/views/day.js src/styles/base.css test/views/day-link.test.cjs test/views/day.test.cjs test/views/day-navigation.test.cjs test/views/calendar-composite.test.cjs test/composite-widget.test.cjs dist
git commit -m "feat: day rows open through their title link"
```

---

### Task 6: Month chips and week blocks are links

**Files:**
- Modify: `src/views/month.js`, `src/views/week.js`
- Modify: `src/styles/base.css` (`.already-month-chip` and `.already-week-event` rules)
- Modify: `test/views/month.test.cjs`, `test/views/week.test.cjs`, `test/views/day-navigation.test.cjs`, `test/views/calendar-composite.test.cjs`, `test/ui/event-popover.test.cjs`

**Interfaces:**
- Consumes: `eventHref` (Task 1), `eventAnchor` (Task 2), `bindEventClick` (Task 3).
- Produces: `.already-month-chip` and `.already-week-event` are `<a href="#event/<id>">` elements (a `<div>` for an entry with no route), with no `role` or `tabindex`. Task 8 relies on it.

- [ ] **Step 1: Write the failing tests**

In `test/views/month.test.cjs`, after the test "navigates to detail on chip click", add:

```js
  it("renders a chip as a link with no role", () => {
    const container = document.createElement("div");
    const events = [
      createTestEvent({ id: "m-link", start: "2026-04-15T10:00:00Z" }),
    ];
    renderMonthView(container, place(events), "UTC", april2026, {});
    const chip = container.querySelector(".already-month-chip");
    assert.strictEqual(chip.tagName, "A");
    assert.strictEqual(chip.getAttribute("href"), "#event/m-link");
    assert.strictEqual(chip.getAttribute("role"), null);
    assert.strictEqual(chip.getAttribute("tabindex"), null);
  });

  it("renders an entry with no route as a plain chip", () => {
    const container = document.createElement("div");
    const orphan = {
      ...createTestEvent({ start: "2026-04-15T10:00:00Z" }),
      id: undefined,
    };
    renderMonthView(container, place([orphan]), "UTC", april2026, {});
    const chip = container.querySelector(".already-month-chip");
    assert.strictEqual(chip.tagName, "DIV");
    chip.click();
    assert.strictEqual(window.location.hash, "");
  });
```

In `test/views/week.test.cjs`, after the test "navigates to detail on event click", add the same two tests with `renderWeekView(container, place(events), "UTC", wednesday, {})`, the selector `.already-week-event`, the id `w-link`, and the names "renders a block as a link with no role" and "renders an entry with no route as a plain block".

Existing tests: the chip and block click tests in `month.test.cjs`, `week.test.cjs`, `day-navigation.test.cjs`, `calendar-composite.test.cjs`, and `event-popover.test.cjs` click the chip or block element itself, which is now the link, so their `.click()` calls stay as they are. Replace any assertion that a chip or block has `role="button"` or `tabindex="0"` (run `grep -n 'role\|tabindex' test/views/month.test.cjs test/views/week.test.cjs test/views/day-navigation.test.cjs test/views/calendar-composite.test.cjs test/ui/event-popover.test.cjs`) with an assertion on `tagName === "A"` and the `href`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/views/month.test.cjs test/views/week.test.cjs`
Expected: FAIL. "renders a chip as a link with no role" fails on `tagName` (`'DIV'`), "navigates to detail on chip click" fails because the chip has no `href` to copy, and the week tests fail the same way.

- [ ] **Step 3: Write the implementation**

In `src/views/month.js`: add `import { eventAnchor } from "../ui/event-link.js";` and `import { eventHref } from "../router.js";` (let `npm run format` order them). Replace

```js
      const chip = createElement(
        "div",
        "already-month-chip" +
          (event.featured ? " already-month-chip--featured" : ""),
      );
```

with

```js
      // The chip is the event's link itself: one line of text, so nothing
      // to stretch. An entry with no route gets a plain div (ui/event-link.js).
      const chip = eventAnchor(
        eventHref(event),
        "already-month-chip" +
          (event.featured ? " already-month-chip--featured" : ""),
      );
```

and replace the stale comment above the cell's click listener

```js
    // Pointer-only affordance: no role="button" and no tabindex, because
    // there is deliberately no keyboard path here (adding 31 tab stops to a
    // grid whose chips are already focusable costs more than it buys).
    // Claiming to be a button while unreachable by keyboard would be worse
    // than not claiming it. Chips stopPropagation, so they win over the cell.
```

with

```js
    // Pointer-only affordance: no role="button" and no tabindex, because
    // there is deliberately no keyboard path here (adding 31 tab stops to a
    // grid whose chips are already focusable links costs more than it buys).
    // Claiming to be a button while unreachable by keyboard would be worse
    // than not claiming it. The handler bails on chip clicks by target.
```

If `createElement` has no other use left in `src/views/month.js` after this, remove it from the import; `npm run check` reports an unused import.

In `src/views/week.js`: the same two imports, and replace

```js
      const block = createElement(
        "div",
        "already-week-event" +
          (event.featured ? " already-week-event--featured" : ""),
      );
```

with

```js
      // The block is the event's link itself (see the month view's chip).
      const block = eventAnchor(
        eventHref(event),
        "already-week-event" +
          (event.featured ? " already-week-event--featured" : ""),
      );
```

In `src/styles/base.css`: a `div` is a block and an `a` is inline, so both rules keep their shape by saying so. In `.already-month-chip { ... }` add, after `font-size: 0.6875rem;`:

```css
  display: block;
  text-decoration: none;
```

and the same two lines in `.already-week-event { ... }` after its `font-size` line.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, every test. The global gate's `npm test` requirement is in force again from here on.

- [ ] **Step 5: Check and commit**

```bash
npm run check
npm run build
git add src/views/month.js src/views/week.js src/styles/base.css test/views/month.test.cjs test/views/week.test.cjs test/views/day-navigation.test.cjs test/views/calendar-composite.test.cjs test/ui/event-popover.test.cjs dist
git commit -m "feat: month chips are links, as are week blocks"
```

If `git status --short` shows a test file in that list unchanged, leave it out of `git add`.

---

### Task 7: The RSVP button names its event, with the card guards gone

**Files:**
- Modify: `src/ui/rsvp-form.js` (`appendRsvpControl`, `createRsvpForm`)
- Modify: `src/already-cal.js` (`I18N_DEFAULTS` gains `rsvpFor`)
- Modify: `test/ui/rsvp-form.test.cjs`, `test/views/rsvp-sites.test.cjs`

**Interfaces:**
- Consumes: Task 4's card link (the form is a sibling of the link, never its descendant).
- Produces: the RSVP open button has `aria-label` from `i18n.rsvpFor` (default `"RSVP for {title}"`) when the event has a title; the form and the button no longer stop click or keydown propagation.

- [ ] **Step 1: Write the failing tests**

In `test/ui/rsvp-form.test.cjs`, inside `describe("appendRsvpControl", ...)`, replace the test "stops click and keydown from reaching the card" with these two:

```js
  it("names the button after the event", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const btn = appendRsvpControl(host, flagged({ title: "Burger Night" }), cfg());
    assert.strictEqual(btn.textContent, "RSVP");
    assert.strictEqual(btn.getAttribute("aria-label"), "RSVP for Burger Night");
    const other = document.createElement("div");
    document.body.appendChild(other);
    const translated = appendRsvpControl(
      other,
      flagged({ title: "Noche" }),
      cfg({ i18n: { ...i18n, rsvpFor: "Reservar para {title}" } }),
    );
    assert.strictEqual(translated.getAttribute("aria-label"), "Reservar para Noche");
    const untitled = document.createElement("div");
    document.body.appendChild(untitled);
    assert.strictEqual(
      appendRsvpControl(untitled, flagged({ title: "" }), cfg()).hasAttribute("aria-label"),
      false,
    );
  });

  it("lets clicks and keys inside the form bubble", () => {
    // The card around the form is no longer a button, so nothing above the
    // form navigates on a click or a key; the engagement listener on the
    // widget's root needs the click to reach it.
    const card = document.createElement("div");
    let reached = 0;
    card.addEventListener("click", () => reached++);
    card.addEventListener("keydown", () => reached++);
    document.body.appendChild(card);
    appendRsvpControl(card, flagged(), cfg()).click();
    const name = card.querySelector('input[name="name"]');
    name.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: " ", bubbles: true }),
    );
    name.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    assert.strictEqual(reached, 3);
  });
```

(The open button's click counts once, the keydown once, and the click in the field once.)

In `test/views/rsvp-sites.test.cjs`, inside `describe("a card with an open RSVP form", ...)`, add:

```js
  it("navigates nowhere on a click of the RSVP button or inside the open form", () => {
    const card = gridCard("clean", createTestEvent({ id: "e-form", rsvp: true }));
    card.querySelector(".already-rsvp__open").click();
    assert.strictEqual(window.location.hash, "");
    const name = card.querySelector('input[name="name"]');
    name.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    name.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    assert.strictEqual(window.location.hash, "");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test test/ui/rsvp-form.test.cjs test/views/rsvp-sites.test.cjs`
Expected: FAIL. "names the button after the event" fails (`null` is not `'RSVP for Burger Night'`), "lets clicks and keys inside the form bubble" fails (`0` is not `3`). The rsvp-sites test passes already, because the card has no handler since Task 4; say so in the report.

- [ ] **Step 3: Write the implementation**

In `src/ui/rsvp-form.js`:

1. In `appendRsvpControl`, after `button.textContent = i18n.rsvp || "RSVP";` add:

```js
  // Every card's button reads "RSVP"; the name says which event, so a screen
  // reader user hears the difference. The visible text stays inside the name.
  if (event.title) {
    button.setAttribute(
      "aria-label",
      (i18n.rsvpFor || "RSVP for {title}").replace("{title}", event.title),
    );
  }
```

2. In the same function, change `button.addEventListener("click", (e) => {` followed by `e.stopPropagation();` to `button.addEventListener("click", () => {` with the `e.stopPropagation();` line removed, and delete the line `button.addEventListener("keydown", (e) => e.stopPropagation());`.

3. In `createRsvpForm`, replace

```js
  // The card around this form navigates on click, Space and Enter
  // (bindEventClick). Nothing typed or clicked inside the form may reach it.
  let pending = false;
  form.addEventListener("click", (e) => e.stopPropagation());
  form.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key !== "Escape") return;
```

with

```js
  // The form sits beside the card's event link, never inside it, so what is
  // typed or clicked here reaches no navigation handler and may bubble.
  let pending = false;
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
```

In `src/already-cal.js`, in `I18N_DEFAULTS`, after `  rsvp: "RSVP",` add:

```js
  rsvpFor: "RSVP for {title}",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, every test.

- [ ] **Step 5: Check and commit**

```bash
npm run check
npm run build
git add src/ui/rsvp-form.js src/already-cal.js test/ui/rsvp-form.test.cjs test/views/rsvp-sites.test.cjs dist
git commit -m "feat: the RSVP button names its event"
```

---

### Task 8: An accessibility check over every layout and view

**Files:**
- Modify: `package.json` (dev dependency `axe-core`; the `test` and `test:coverage` scripts gain `test/a11y/*.test.cjs`)
- Modify: `package-lock.json` (by `npm install`)
- Create: `test/a11y/cards.test.cjs`

**Interfaces:**
- Consumes: everything Tasks 4 to 7 render.
- Produces: `npm test` fails on any axe violation of the listed rules in any built-in layout, any view, the detail view, or the popover.

- [ ] **Step 1: Install axe-core and prove it runs under the suite's jsdom**

Run: `npm install --save-dev axe-core`
Expected: `package.json` gains `"axe-core"` under `devDependencies` and `package-lock.json` changes. `node_modules` is a symlink to another worktree's install; `npm install` follows it and installs there. If the install fails because of the symlink, stop and report.

Run this probe from the worktree root:

```bash
node -e "require('./test/setup-dom.cjs');globalThis.Element=window.Element;globalThis.NodeList=window.NodeList;const axe=require('axe-core');document.body.innerHTML='<div role=\"button\" tabindex=\"0\">Night <button type=\"button\">RSVP</button></div>';axe.run(document.body,{runOnly:{type:'rule',values:['nested-interactive','button-name','link-name']}}).then(r=>console.log(r.violations.map(v=>v.id)))"
```

Expected: `[ 'nested-interactive' ]`. If axe throws under this jsdom, stop and report the error: the spec's fallback (a homegrown nested-interactive walk) is a controller decision.

- [ ] **Step 2: Write the test, which must pass**

Create `test/a11y/cards.test.cjs`:

```js
// Day keys are computed in the VIEWER's zone, so pin it before anything loads.
const originalTZ = process.env.TZ;
process.env.TZ = "UTC";

require("../setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");
const axe = require("axe-core");
const { createTestEvent, createComposite } = require("../helpers.cjs");

// axe reads these from the global scope; setup-dom exposes the rest.
globalThis.Element = window.Element;
globalThis.NodeList = window.NodeList;

let renderGridView, renderListView, renderMonthView, renderWeekView, renderDayView;
let renderDetailView, openEventPopover, closeEventPopover, placeByDay, eventDayKey;
before(async () => {
  ({ renderGridView } = await import("../../src/views/grid.js"));
  ({ renderListView } = await import("../../src/views/list.js"));
  ({ renderMonthView } = await import("../../src/views/month.js"));
  ({ renderWeekView } = await import("../../src/views/week.js"));
  ({ renderDayView } = await import("../../src/views/day.js"));
  ({ renderDetailView } = await import("../../src/views/detail.js"));
  ({ openEventPopover, closeEventPopover } = await import(
    "../../src/ui/event-popover.js"
  ));
  ({ placeByDay } = await import("../../src/views/placement.js"));
  ({ eventDayKey } = await import("../../src/util/dates.js"));
});
after(() => {
  if (originalTZ === undefined) delete process.env.TZ;
  else process.env.TZ = originalTZ;
});
afterEach(() => {
  closeEventPopover();
  document.body.innerHTML = "";
  window.location.hash = "";
});

// The rules that catch what this suite is for: a control inside a control,
// and controls or links with no name. Layout-dependent rules (region,
// colour contrast) need a rendering engine jsdom does not have.
const RULES = [
  "nested-interactive",
  "button-name",
  "link-name",
  "aria-allowed-attr",
  "aria-roles",
  "aria-valid-attr-value",
];

async function expectClean(container, label) {
  const result = await axe.run(container, {
    runOnly: { type: "rule", values: RULES },
  });
  const report = result.violations
    .map(
      (v) =>
        `${v.id}: ${v.help}\n` +
        v.nodes.map((n) => `  ${n.target.join(" ")} ${n.html}`).join("\n"),
    )
    .join("\n");
  assert.strictEqual(result.violations.length, 0, `${label}\n${report}`);
}

const NAMES = ["clean", "compact", "badge", "hero"];
const cfg = (layout, over = {}) => ({
  locale: "en-US",
  i18n: {},
  onRsvp: async () => ({ partySize: 1 }),
  _theme: { layout, orientation: "vertical", imagePosition: "left" },
  ...over,
});
const events = () => [
  createTestEvent({
    id: "plain",
    title: "Autumn Market",
    start: "2099-06-15T15:00:00Z",
    end: "2099-06-15T17:00:00Z",
    htmlLink: "https://cal.example/plain",
  }),
  createTestEvent({
    id: "with-rsvp",
    title: "Supper Club",
    rsvp: true,
    start: "2099-06-15T19:00:00Z",
    end: "2099-06-15T21:00:00Z",
    htmlLink: "https://cal.example/supper",
  }),
  createComposite(
    {
      id: "night",
      title: "Burger Night",
      start: "2099-06-16T17:00:00Z",
      end: "2099-06-16T21:00:00Z",
    },
    [
      { id: "act-1", title: "First Set", start: "2099-06-16T18:00:00Z", end: "2099-06-16T19:00:00Z", rsvp: true },
      { id: "act-2", title: "Second Set", start: "2099-06-16T19:30:00Z", end: "2099-06-16T20:30:00Z" },
    ],
  ),
];
const mount = () => {
  const c = document.createElement("div");
  document.body.appendChild(c);
  return c;
};

describe("accessibility of event cards", () => {
  for (const name of NAMES) {
    it(`${name}: grid cards, with the RSVP form closed and open`, async () => {
      const c = mount();
      renderGridView(c, events(), "UTC", cfg(name));
      await expectClean(c, `${name} grid`);
      c.querySelector(".already-rsvp__open").click();
      await expectClean(c, `${name} grid with the form open`);
    });

    it(`${name}: list cards`, async () => {
      const c = mount();
      renderListView(c, events(), "UTC", cfg(name));
      await expectClean(c, `${name} list`);
    });
  }

  it("the hover popover's card", async () => {
    const root = mount();
    root.className = "already";
    const anchor = document.createElement("div");
    root.appendChild(anchor);
    openEventPopover(anchor, events()[2], root, cfg("badge"), "month", "UTC");
    await expectClean(root, "popover");
  });
});

describe("accessibility of the calendar views", () => {
  const placed = () => placeByDay(events(), eventDayKey);

  it("month view", async () => {
    const c = mount();
    renderMonthView(c, placed(), "UTC", new Date(2099, 5, 15), cfg("clean"));
    await expectClean(c, "month");
  });

  it("week view", async () => {
    const c = mount();
    renderWeekView(c, placed(), "UTC", new Date(2099, 5, 15), cfg("clean"));
    await expectClean(c, "week");
  });

  it("day view with a composite's part rows", async () => {
    const c = mount();
    renderDayView(c, placed(), "UTC", new Date(2099, 5, 16), cfg("clean"));
    assert.ok(c.querySelector(".already-day-event--part"), "the fixture puts a part on this day");
    await expectClean(c, "day");
  });

  it("the detail view of a composite with RSVP on a part", async () => {
    const c = mount();
    renderDetailView(c, events()[2], "UTC", () => {}, cfg("clean"), {
      focusPartId: "act-1",
    });
    await expectClean(c, "detail");
  });
});
```

Run: `node --test test/a11y/cards.test.cjs`
Expected: PASS, 13 tests. A violation here is a defect in Tasks 4 to 7 or a pre-existing one: read the printed node, and if it is in code this plan did not touch (for example duplicate ids, which these rules do not include, or an unnamed control in the detail view), stop and report it rather than loosening the rule list.

- [ ] **Step 3: Prove the test can fail**

Temporarily change `src/views/card-decoration.js` so `applyCardState` sets `card.setAttribute("role", "button")` as its last statement, run `node --test test/a11y/cards.test.cjs`, and record the failing output (`nested-interactive` on every layout with an RSVP button or a Details link). Then edit the line back out and run the file again to green. Do not commit the temporary line.

- [ ] **Step 4: Add the glob**

In `package.json`, in both the `test` and `test:coverage` scripts, append ` test/a11y/*.test.cjs` to the list of globs (after `test/themes/*.test.cjs`).

Run: `npm test`
Expected: PASS, with the 13 new tests counted in the total.

- [ ] **Step 5: Check and commit**

```bash
npm run check
npm run build
git add package.json package-lock.json test/a11y/cards.test.cjs
git commit -m "test: axe-core checks every layout, view, and the popover"
```

(`dist/` does not change: no source changed.)

---

### Task 9: Documentation

**Files:**
- Modify: `docs/configuration.md`, `docs/architecture.md`, `docs/development.md`, `README.md`

Every line this task adds is free of em dashes and en dashes. Lines already in these files that contain them stay as they are.

- [ ] **Step 1: `docs/configuration.md`**

In the Custom Layouts section, after the paragraph that begins `Register custom card layouts via` and before the `> **Note:**` block, insert:

````markdown
The view makes the card's title the link that opens the event: after your function returns, the text inside the element with the class `already-card__title` moves into an `<a>`, and the stylesheet stretches that link over the whole card. Render that element and the card opens like a built-in one; without it, the view appends a visually hidden link with the event's title. Do not make the title a link or put a button inside it: the view then leaves your title alone and adds the hidden link instead, so no link ends up inside a link.

Any control your layout renders itself (a button, a link, a form) needs the class `already-control`, or the stretched link covers it and it cannot be clicked. The widget puts that class on its own controls; the CSS behind it is the widget's and not part of the contract.

```js
const register = document.createElement('a');
register.className = 'already-card__action already-control';
register.href = event.links[0]?.url;
register.textContent = 'Register';
card.appendChild(register);
```
````

In the `onEventClick(event, viewName)` section, after the bullet `- Return anything else (or nothing) to allow default navigation`, add:

```markdown
- Fires for a plain click or Enter on the event's link (the card's title, a day row's title, a month chip, a week block). A middle click or a modifier click is left to the browser, which opens a new tab at the event's deep link, and does not fire this callback
```

In the `### i18n keys` table, directly after the row that begins ``| `compositeParts` |``, add:

```markdown
| `rsvpFor` | `'RSVP for {title}'` | Accessible name of a card's RSVP button (`{title}` is replaced); the visible text stays `rsvp` |
| `openEvent` | `'Open event'` | Text of the hidden event link a custom layout without a title element gets, when the event has no title |
```

- [ ] **Step 2: `docs/architecture.md`**

In the sentence at the line that contains `pass every card through \`decorateEventCard()\``, append after that call: ` (which makes the title the event's link, adds a composite's parts, and mounts the RSVP control)`. If the sentence already lists what the decoration does, replace that list with this one.

In the module list line that begins `- **\`views/card-decoration.js\`** imports:`, add `ui/event-link.js` and `router.js` to its import list, and after `exports \`decorateEventCard\`` keep the rest of the line.

Add a line for the new module, directly after the `views/card-decoration.js` line:

```markdown
- **`ui/event-link.js`** imports: `views/helpers.js` (createElement); exports `linkTitle` (moves a title's text into the event link and marks the host), `eventAnchor` (an element that is the link itself), `LINK_HOST_CLASS`
```

In the `### Hash Routing` section's bullet list, replace the bullet

```markdown
- `setEventDetail(eventId)` — navigates to `#event/{eventId}`.
```

with

```markdown
- `eventHref(entry)`: the `#event/{id}` link that opens an entry, written once here so every card, row, chip, and block agrees with `parseHash`. A part with no id links to its parent; an entry with neither has no link.
```

(The other bullets in that list keep their dashes; they are existing lines.)

- [ ] **Step 3: `docs/development.md`**

In the Testing section, after the "How tests work" bullet list, add:

```markdown
### Accessibility check

`test/a11y/cards.test.cjs` renders every built-in layout in the grid and list views (with the RSVP form closed and open), the month, week, and day views, a composite's detail view, and the hover popover, and runs [axe-core](https://github.com/dequelabs/axe-core) over each with the rules `nested-interactive`, `button-name`, `link-name`, `aria-allowed-attr`, `aria-roles`, and `aria-valid-attr-value`. Rules that need layout (`region`, colour contrast) are off, because jsdom has no rendering engine. It runs as part of `npm test`; to run it alone: `node --test test/a11y/cards.test.cjs`.
```

- [ ] **Step 4: `README.md`**

In the `## Accessibility` section, replace the bullet

```markdown
- All interactive elements have `tabindex="0"` and `role="button"` or `role="tab"`
- Keyboard navigation: Enter/Space to activate buttons, arrow keys in image galleries and lightbox
```

with

```markdown
- Every event opens through a real link: the card's title, a day row's title, a month chip, or a week block. Cards are not buttons, so the RSVP button and the Details link inside them are ordinary controls, and a middle click opens the event in a new tab
- The RSVP button is named after its event ("RSVP for Burger Night")
- Keyboard navigation: Enter on an event link opens it; Enter/Space on buttons; arrow keys in image galleries and lightbox
- An axe-core check runs over every layout and view in the test suite
```

Keep the other bullets of that section.

In the README's i18n example block (the object under `i18n: {` that lists `rsvp: 'RSVP',`), add `    rsvpFor: 'RSVP for {title}',` directly after the `rsvp: 'RSVP',` line and `    openEvent: 'Open event',` directly after the `details: 'Details',` line, with the block's indentation.

- [ ] **Step 5: Dash check, gate, and commit**

Run, as one plain piped command: `git diff -- docs README.md | grep "^+" | perl -CSD -ne 'print "$.: $_" if /\x{2013}|\x{2014}/'` (the two code points are the en dash and the em dash). Expected: no output.

```bash
npm run check
git add docs/configuration.md docs/architecture.md docs/development.md README.md
git commit -m "docs: cards open through a link"
```

---

### Task 10: Release v0.14.0

**Files:**
- Modify: `package.json`, `package-lock.json`, `dist/`

**Interfaces:**
- Consumes: everything above.
- Produces: the release commit. The pull request's title is this commit's subject, which the squash merge uses.

- [ ] **Step 1: Confirm the base**

Run: `git fetch` is not available to you (the SSH agent needs the owner); the controller fetches. Ask the controller, in your report, for the current `origin/main`. Expected: it is past `446a174` (v0.13.1 merged). If it is still `446a174`, stop at this step and report; the controller decides.

If the controller confirms a newer main, the controller merges `origin/main` into the branch before dispatching this task (a merge, not a rebase), and this task starts from the merged tree with `npm test` green.

- [ ] **Step 2: Bump the version**

Run: `npm version 0.14.0 --no-git-tag-version`
Expected: `package.json` and `package-lock.json` changed, and `grep '"version"' package.json` prints `0.14.0`.

- [ ] **Step 3: Rebuild and run the full gate**

```bash
npm run build
npm test
npm run test:perf
npm run check
```

Expected: every command succeeds. `npm run build` changes the bundles under `dist/` that carry the version string.

- [ ] **Step 4: Confirm nothing else is unstaged, then commit**

Run: `git status --short`
Expected: only `package.json`, `package-lock.json`, and files under `dist/` (plus the untracked `node_modules` symlink, which is never staged).

```bash
git add package.json package-lock.json dist
git commit -m "chore(release): v0.14.0 - cards open through a link"
```

- [ ] **Step 5: Confirm the branch is clean and the dist is current**

```bash
npm run build
git status --short
```

Expected: `git status --short` prints only `?? node_modules`.
