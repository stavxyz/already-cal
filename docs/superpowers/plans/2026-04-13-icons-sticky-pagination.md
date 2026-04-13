# View Icons, Sticky Header, and Pagination — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SVG icons to view selector tabs, make the header/selector/filter sections sticky while scrolling, and add pagination (load more / show earlier) to grid and list views.

**Architecture:** Three independent features built sequentially in one PR. Icons are a pure presentation change to `view-selector.js`. Sticky adds CSS classes and JS height measurement to `already-cal.js`. Pagination adds state + slicing logic to `already-cal.js` with "load more" / "show earlier" buttons rendered around the view container — grid/list renderers remain unchanged, receiving pre-sliced arrays.

**Tech Stack:** Vanilla JS, ES modules, CSS, `node:test` + jsdom, esbuild (`npm run build`)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/ui/view-selector.js` | Add `VIEW_ICONS` map and prepend SVG to each tab |
| `src/already-cal.js` | Normalize `sticky` config, apply sticky classes, measure heights for stacking `top` values, add `pageSize` default, manage `paginationState`, call `paginateEvents()`, render load more / show earlier buttons |
| `src/ui/sticky.js` | Export `resolveSticky(value)` — pure config normalizer. Export `applyStickyClasses()` and `updateStickyOffsets()` for DOM application |
| `src/ui/pagination.js` | Export `paginateEvents(events, showPast, pageSize, paginationState)` — pure function returning `{ visible, hasMoreFuture, hasMorePast, remainingFuture, remainingPast }` |
| `already-cal.css` | Icon flex layout on tabs, sticky positioning rules, load more / show earlier button styles |
| `test/ui/view-selector.test.js` | New test file — icon SVG rendering, aria-hidden, currentColor |
| `test/ui/sticky.test.js` | New test file — `resolveSticky()` config normalization |
| `test/ui/pagination.test.js` | New test file — `paginateEvents()` slicing logic |

---

### Task 1: View Selector Icons — Tests

**Files:**
- Create: `test/ui/view-selector.test.js`

- [ ] **Step 1: Write tests for icon rendering**

```js
// test/ui/view-selector.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');

let renderViewSelector;

before(async () => {
  const mod = await import('../../src/ui/view-selector.js');
  renderViewSelector = mod.renderViewSelector;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderViewSelector icons', () => {
  it('renders an SVG icon in each tab', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'week', 'day', 'grid', 'list'], 'month', false, {});
    const tabs = container.querySelectorAll('.already-view-tab');
    for (const tab of tabs) {
      const svg = tab.querySelector('svg');
      assert.ok(svg, `tab "${tab.textContent.trim()}" should contain an SVG icon`);
    }
  });

  it('sets aria-hidden on each icon', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'list'], 'month', false, {});
    const svgs = container.querySelectorAll('.already-view-tab svg');
    for (const svg of svgs) {
      assert.strictEqual(svg.getAttribute('aria-hidden'), 'true');
    }
  });

  it('uses stroke="currentColor" on each icon', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'week', 'day', 'grid', 'list'], 'month', false, {});
    const svgs = container.querySelectorAll('.already-view-tab svg');
    for (const svg of svgs) {
      assert.strictEqual(svg.getAttribute('stroke'), 'currentColor');
    }
  });

  it('renders icon before text label', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month'], 'month', false, {});
    const tab = container.querySelector('.already-view-tab');
    assert.strictEqual(tab.firstChild.tagName, 'svg');
  });

  it('preserves existing tab behavior (active class, role)', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'list'], 'list', false, {});
    const activeTab = container.querySelector('.already-view-tab--active');
    assert.ok(activeTab);
    assert.strictEqual(activeTab.textContent.trim(), 'List');
    assert.strictEqual(activeTab.getAttribute('role'), 'tab');
    assert.strictEqual(activeTab.getAttribute('aria-selected'), 'true');
  });

  it('renders icons for custom view subsets', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['grid', 'list'], 'grid', false, {});
    const svgs = container.querySelectorAll('.already-view-tab svg');
    assert.strictEqual(svgs.length, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/ui/view-selector.test.js`
Expected: FAIL — no SVG elements found in tabs (icons not yet implemented).

- [ ] **Step 3: Commit test file**

```bash
git add test/ui/view-selector.test.js
git commit -m "test: add view selector icon tests"
```

---

### Task 2: View Selector Icons — Implementation

**Files:**
- Modify: `src/ui/view-selector.js`
- Modify: `already-cal.css:136-168`

- [ ] **Step 1: Add VIEW_ICONS map and update renderViewSelector**

Replace the entire content of `src/ui/view-selector.js` with:

```js
import { setView } from '../router.js';

const DEFAULT_VIEW_LABELS = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  grid: 'Grid',
  list: 'List',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function el(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

const VIEW_ICONS = {
  month: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '1', y: '3', width: '14', height: '12', rx: '1' }));
    svg.appendChild(el('line', { x1: '1', y1: '7', x2: '15', y2: '7' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '7', x2: '5.5', y2: '15' }));
    svg.appendChild(el('line', { x1: '10.5', y1: '7', x2: '10.5', y2: '15' }));
    return svg;
  },
  week: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '1', y: '1', width: '3', height: '14', rx: '0.5' }));
    svg.appendChild(el('rect', { x: '6.5', y: '1', width: '3', height: '14', rx: '0.5' }));
    svg.appendChild(el('rect', { x: '12', y: '1', width: '3', height: '14', rx: '0.5' }));
    return svg;
  },
  day: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '3', y: '1', width: '10', height: '14', rx: '1' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '5', x2: '10.5', y2: '5' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '8', x2: '10.5', y2: '8' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '11', x2: '9', y2: '11' }));
    return svg;
  },
  grid: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '1', y: '1', width: '6', height: '6', rx: '1' }));
    svg.appendChild(el('rect', { x: '9', y: '1', width: '6', height: '6', rx: '1' }));
    svg.appendChild(el('rect', { x: '1', y: '9', width: '6', height: '6', rx: '1' }));
    svg.appendChild(el('rect', { x: '9', y: '9', width: '6', height: '6', rx: '1' }));
    return svg;
  },
  list: () => {
    const svg = createSvg();
    svg.appendChild(el('line', { x1: '1', y1: '3', x2: '15', y2: '3' }));
    svg.appendChild(el('line', { x1: '1', y1: '8', x2: '15', y2: '8' }));
    svg.appendChild(el('line', { x1: '1', y1: '13', x2: '15', y2: '13' }));
    return svg;
  },
};

export function renderViewSelector(container, views, activeView, isMobile, config) {
  const i18n = (config && config.i18n) || {};
  const viewLabels = { ...DEFAULT_VIEW_LABELS, ...i18n.viewLabels };
  const mobileHiddenViews = (config && config.mobileHiddenViews) || ['week'];
  const filtered = isMobile ? views.filter(v => !mobileHiddenViews.includes(v)) : views;

  const bar = document.createElement('div');
  bar.className = 'already-view-selector';
  bar.setAttribute('role', 'tablist');

  for (const view of filtered) {
    const tab = document.createElement('button');
    tab.className = 'already-view-tab' + (view === activeView ? ' already-view-tab--active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', view === activeView ? 'true' : 'false');

    const iconFn = VIEW_ICONS[view];
    if (iconFn) tab.appendChild(iconFn());

    tab.appendChild(document.createTextNode(viewLabels[view] || view));
    tab.addEventListener('click', () => setView(view, config));
    bar.appendChild(tab);
  }

  container.innerHTML = '';
  container.appendChild(bar);
}
```

- [ ] **Step 2: Add CSS for icon layout in tabs**

In `already-cal.css`, replace the `.already-view-tab` rule (lines 136-147):

Old:
```css
.already-view-tab {
  flex: 1;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--already-text-secondary);
  font-family: var(--already-font-family);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
```

New:
```css
.already-view-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: var(--already-text-secondary);
  font-family: var(--already-font-family);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.already-view-tab svg {
  flex-shrink: 0;
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `node --test test/ui/view-selector.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 4: Run full test suite**

Run: `node --test test/`
Expected: All tests pass (no regressions).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 6: Commit**

```bash
git add src/ui/view-selector.js already-cal.css test/ui/view-selector.test.js
git commit -m "feat: add inline SVG icons to view selector tabs"
```

---

### Task 3: Sticky Header — Tests

**Files:**
- Create: `test/ui/sticky.test.js`

- [ ] **Step 1: Write tests for sticky config resolution**

```js
// test/ui/sticky.test.js
require('../setup-dom.js');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let resolveSticky;

before(async () => {
  const mod = await import('../../src/ui/sticky.js');
  resolveSticky = mod.resolveSticky;
});

describe('resolveSticky', () => {
  it('returns all true when config is true', () => {
    const result = resolveSticky(true);
    assert.deepStrictEqual(result, { header: true, viewSelector: true, tagFilter: true });
  });

  it('returns all true when config is undefined', () => {
    const result = resolveSticky(undefined);
    assert.deepStrictEqual(result, { header: true, viewSelector: true, tagFilter: true });
  });

  it('returns all false when config is false', () => {
    const result = resolveSticky(false);
    assert.deepStrictEqual(result, { header: false, viewSelector: false, tagFilter: false });
  });

  it('accepts granular object', () => {
    const result = resolveSticky({ header: false, viewSelector: true, tagFilter: true });
    assert.deepStrictEqual(result, { header: false, viewSelector: true, tagFilter: true });
  });

  it('defaults missing keys to true in granular object', () => {
    const result = resolveSticky({ header: false });
    assert.deepStrictEqual(result, { header: false, viewSelector: true, tagFilter: true });
  });

  it('returns all true for non-boolean, non-object values', () => {
    const result = resolveSticky('yes');
    assert.deepStrictEqual(result, { header: true, viewSelector: true, tagFilter: true });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/ui/sticky.test.js`
Expected: FAIL — `src/ui/sticky.js` does not exist.

- [ ] **Step 3: Commit test file**

```bash
git add test/ui/sticky.test.js
git commit -m "test: add sticky config resolution tests"
```

---

### Task 4: Sticky Header — Implementation

**Files:**
- Create: `src/ui/sticky.js`
- Modify: `src/already-cal.js:17-48` (DEFAULTS), `src/already-cal.js:102-122` (layout), `src/already-cal.js:193-229` (renderView)
- Modify: `already-cal.css`

- [ ] **Step 1: Create `src/ui/sticky.js`**

```js
// src/ui/sticky.js

const ALL_ON = { header: true, viewSelector: true, tagFilter: true };
const ALL_OFF = { header: false, viewSelector: false, tagFilter: false };

export function resolveSticky(value) {
  if (value === false) return { ...ALL_OFF };
  if (value === true || value === undefined || value === null || typeof value !== 'object') {
    return { ...ALL_ON };
  }
  return {
    header: value.header !== false,
    viewSelector: value.viewSelector !== false,
    tagFilter: value.tagFilter !== false,
  };
}

export function applyStickyClasses(stickyConfig, headerContainer, selectorContainer, tagFilterContainer) {
  const containers = [
    [stickyConfig.header, headerContainer],
    [stickyConfig.viewSelector, selectorContainer],
    [stickyConfig.tagFilter, tagFilterContainer],
  ];
  for (const [enabled, container] of containers) {
    container.classList.toggle('already-sticky', enabled);
  }
}

export function updateStickyOffsets(stickyConfig, headerContainer, selectorContainer, tagFilterContainer) {
  let offset = 0;

  if (stickyConfig.header && headerContainer.classList.contains('already-sticky')) {
    headerContainer.style.top = offset + 'px';
    offset += headerContainer.offsetHeight;
  }

  if (stickyConfig.viewSelector && selectorContainer.classList.contains('already-sticky')) {
    selectorContainer.style.top = offset + 'px';
    offset += selectorContainer.offsetHeight;
  }

  if (stickyConfig.tagFilter && tagFilterContainer.classList.contains('already-sticky')) {
    tagFilterContainer.style.top = offset + 'px';
  }
}
```

- [ ] **Step 2: Run sticky tests to verify they pass**

Run: `node --test test/ui/sticky.test.js`
Expected: All 6 tests PASS.

- [ ] **Step 3: Add `sticky: true` to DEFAULTS in `src/already-cal.js`**

In `src/already-cal.js`, add after `initialEvent: null,`:

Old:
```js
  i18n: {},
  initialEvent: null,
};
```

New:
```js
  i18n: {},
  initialEvent: null,
  sticky: true,
};
```

- [ ] **Step 4: Import sticky module and wire up in init()**

Add import at the top of `src/already-cal.js`:

Old:
```js
import { createTagFilter } from './ui/tag-filter.js';
```

New:
```js
import { createTagFilter } from './ui/tag-filter.js';
import { resolveSticky, applyStickyClasses, updateStickyOffsets } from './ui/sticky.js';
```

After `el.appendChild(toggleContainer);`, add sticky setup:

Old:
```js
  el.appendChild(toggleContainer);

  let data = null;
```

New:
```js
  el.appendChild(toggleContainer);

  const stickyConfig = resolveSticky(config.sticky);
  applyStickyClasses(stickyConfig, headerContainer, selectorContainer, tagFilterContainer);

  let data = null;
```

- [ ] **Step 5: Add updateStickyOffsets call after render**

Inside `renderView`, after the view selector is rendered:

Old:
```js
      renderViewSelector(selectorContainer, config.views, viewState.view, isMobile(), config);
      lastView = viewState.view;
    }

    switch (viewState.view) {
```

New:
```js
      renderViewSelector(selectorContainer, config.views, viewState.view, isMobile(), config);
      lastView = viewState.view;
    }

    updateStickyOffsets(stickyConfig, headerContainer, selectorContainer, tagFilterContainer);

    switch (viewState.view) {
```

- [ ] **Step 6: Add resize listener**

After `start();` at the bottom of `init()`:

Old:
```js
  start();
}
```

New:
```js
  start();

  window.addEventListener('resize', () => {
    updateStickyOffsets(stickyConfig, headerContainer, selectorContainer, tagFilterContainer);
  });
}
```

- [ ] **Step 7: Add CSS for sticky positioning**

In `already-cal.css`, after `.already-selector-container` rule (line 38):

Old:
```css
.already-selector-container {
  margin-bottom: 1rem;
}

/* ===== Header ===== */
```

New:
```css
.already-selector-container {
  margin-bottom: 1rem;
}

/* ===== Sticky ===== */
.already-header-container.already-sticky {
  position: sticky;
  z-index: 10;
  background: var(--already-background);
}

.already-selector-container.already-sticky {
  position: sticky;
  z-index: 9;
  background: var(--already-background);
}

.already-tag-filter-container.already-sticky {
  position: sticky;
  z-index: 8;
  background: var(--already-background);
}

/* ===== Header ===== */
```

- [ ] **Step 8: Run all tests**

Run: `node --test test/`
Expected: All tests pass.

- [ ] **Step 9: Build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 10: Commit**

```bash
git add src/ui/sticky.js src/already-cal.js already-cal.css test/ui/sticky.test.js
git commit -m "feat: add configurable sticky header, view selector, and tag filter"
```

---

### Task 5: Pagination — Pure Logic Tests

**Files:**
- Create: `test/ui/pagination.test.js`

- [ ] **Step 1: Write tests for paginateEvents**

```js
// test/ui/pagination.test.js
require('../setup-dom.js');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let paginateEvents;

before(async () => {
  const mod = await import('../../src/ui/pagination.js');
  paginateEvents = mod.paginateEvents;
});

describe('paginateEvents', () => {
  const futureEvents = Array.from({ length: 25 }, (_, i) =>
    createTestEvent({ id: `f${i}`, title: `Future ${i}`, start: `2026-05-${String(i + 1).padStart(2, '0')}T10:00:00Z` })
  );

  const pastEvents = Array.from({ length: 15 }, (_, i) =>
    createTestEvent({ id: `p${i}`, title: `Past ${i}`, start: `2025-01-${String(i + 1).padStart(2, '0')}T10:00:00Z` })
  );

  it('returns first pageSize events when showPast is false', () => {
    const result = paginateEvents(futureEvents, false, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.visible.length, 10);
    assert.strictEqual(result.visible[0].id, 'f0');
    assert.strictEqual(result.visible[9].id, 'f9');
  });

  it('reports hasMoreFuture correctly', () => {
    const result = paginateEvents(futureEvents, false, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.hasMoreFuture, true);
    assert.strictEqual(result.remainingFuture, 15);
  });

  it('expands with futureCount', () => {
    const result = paginateEvents(futureEvents, false, 10, { futureCount: 10, pastCount: 0 });
    assert.strictEqual(result.visible.length, 20);
    assert.strictEqual(result.remainingFuture, 5);
  });

  it('does not exceed total events', () => {
    const result = paginateEvents(futureEvents, false, 10, { futureCount: 100, pastCount: 0 });
    assert.strictEqual(result.visible.length, 25);
    assert.strictEqual(result.hasMoreFuture, false);
    assert.strictEqual(result.remainingFuture, 0);
  });

  it('returns no hasMoreFuture when all fit in one page', () => {
    const small = futureEvents.slice(0, 5);
    const result = paginateEvents(small, false, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.visible.length, 5);
    assert.strictEqual(result.hasMoreFuture, false);
  });

  it('handles empty events', () => {
    const result = paginateEvents([], false, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.visible.length, 0);
    assert.strictEqual(result.hasMoreFuture, false);
    assert.strictEqual(result.hasMorePast, false);
  });

  it('splits past and future when showPast is true', () => {
    const mixed = [...pastEvents, ...futureEvents];
    const result = paginateEvents(mixed, true, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.visible.length, 20);
    assert.strictEqual(result.hasMorePast, true);
    assert.strictEqual(result.remainingPast, 5);
    assert.strictEqual(result.hasMoreFuture, true);
    assert.strictEqual(result.remainingFuture, 15);
  });

  it('expands past events with pastCount', () => {
    const mixed = [...pastEvents, ...futureEvents];
    const result = paginateEvents(mixed, true, 10, { futureCount: 0, pastCount: 5 });
    assert.strictEqual(result.hasMorePast, false);
    assert.strictEqual(result.remainingPast, 0);
  });

  it('shows past events in reverse chronological order (most recent first)', () => {
    const mixed = [...pastEvents, ...futureEvents];
    const result = paginateEvents(mixed, true, 3, { futureCount: 0, pastCount: 0 });
    const pastVisible = result.visible.filter(e => e.id.startsWith('p'));
    assert.strictEqual(pastVisible[0].id, 'p12');
    assert.strictEqual(pastVisible[1].id, 'p13');
    assert.strictEqual(pastVisible[2].id, 'p14');
  });

  it('returns hasMorePast false when showPast is false', () => {
    const result = paginateEvents(futureEvents, false, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.hasMorePast, false);
    assert.strictEqual(result.remainingPast, 0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/ui/pagination.test.js`
Expected: FAIL — `src/ui/pagination.js` does not exist.

- [ ] **Step 3: Commit test file**

```bash
git add test/ui/pagination.test.js
git commit -m "test: add pagination slicing logic tests"
```

---

### Task 6: Pagination — Pure Logic Implementation

**Files:**
- Create: `src/ui/pagination.js`

- [ ] **Step 1: Implement paginateEvents**

```js
// src/ui/pagination.js

export function paginateEvents(events, showPast, pageSize, paginationState) {
  if (!events || events.length === 0) {
    return { visible: [], hasMoreFuture: false, hasMorePast: false, remainingFuture: 0, remainingPast: 0 };
  }

  if (!showPast) {
    const limit = pageSize + paginationState.futureCount;
    const visible = events.slice(0, limit);
    const remainingFuture = Math.max(0, events.length - limit);
    return {
      visible,
      hasMoreFuture: remainingFuture > 0,
      hasMorePast: false,
      remainingFuture,
      remainingPast: 0,
    };
  }

  // showPast is true — split into past and future by checking event dates
  const now = new Date();
  const past = [];
  const future = [];
  for (const event of events) {
    const endOrStart = event.end || event.start;
    if (new Date(endOrStart) < now) {
      past.push(event);
    } else {
      future.push(event);
    }
  }

  // Past events: reverse chronological (most recent past first)
  const pastReversed = [...past].reverse();
  const pastLimit = pageSize + paginationState.pastCount;
  const visiblePast = pastReversed.slice(0, pastLimit);
  const remainingPast = Math.max(0, pastReversed.length - pastLimit);

  // Future events: chronological (soonest first)
  const futureLimit = pageSize + paginationState.futureCount;
  const visibleFuture = future.slice(0, futureLimit);
  const remainingFuture = Math.max(0, future.length - futureLimit);

  // Combine: past (re-reversed to chronological for display) + future
  const visiblePastChronological = [...visiblePast].reverse();
  const visible = [...visiblePastChronological, ...visibleFuture];

  return {
    visible,
    hasMoreFuture: remainingFuture > 0,
    hasMorePast: remainingPast > 0,
    remainingFuture,
    remainingPast,
  };
}
```

- [ ] **Step 2: Run pagination tests**

Run: `node --test test/ui/pagination.test.js`
Expected: All 10 tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `node --test test/`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/ui/pagination.js test/ui/pagination.test.js
git commit -m "feat: add paginateEvents pure function for grid/list slicing"
```

---

### Task 7: Pagination — Integration into already-cal.js

**Files:**
- Modify: `src/already-cal.js` (DEFAULTS, I18N_DEFAULTS, state, renderView)
- Modify: `src/views/grid.js`
- Modify: `src/views/list.js`
- Modify: `already-cal.css`

- [ ] **Step 1: Add pageSize to DEFAULTS and i18n keys**

In `src/already-cal.js`, add `pageSize: 10,` to DEFAULTS after `sticky: true,`:

Old:
```js
  sticky: true,
};
```

New:
```js
  sticky: true,
  pageSize: 10,
};
```

Add i18n keys to `I18N_DEFAULTS` after `clearFilter: 'Clear',`:

Old:
```js
  clearFilter: 'Clear',
};
```

New:
```js
  clearFilter: 'Clear',
  loadMore: 'Load more',
  showEarlier: 'Show earlier',
};
```

- [ ] **Step 2: Import paginateEvents and add state**

Add import at the top of `src/already-cal.js`:

Old:
```js
import { resolveSticky, applyStickyClasses, updateStickyOffsets } from './ui/sticky.js';
```

New:
```js
import { resolveSticky, applyStickyClasses, updateStickyOffsets } from './ui/sticky.js';
import { paginateEvents } from './ui/pagination.js';
```

After `let lastViewState = null;`, add pagination state:

Old:
```js
  let lastViewState = null;
  const tagFilter = createTagFilter(() => {
    if (lastViewState) renderView(lastViewState);
  }, config);
```

New:
```js
  let lastViewState = null;
  let paginationState = { futureCount: 0, pastCount: 0 };
  const tagFilter = createTagFilter(() => {
    paginationState = { futureCount: 0, pastCount: 0 };
    if (lastViewState) renderView(lastViewState);
  }, config);
```

- [ ] **Step 3: Add pagination containers to layout**

Old:
```js
  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'already-toggle-container';

  el.innerHTML = '';
  el.appendChild(headerContainer);
  el.appendChild(selectorContainer);
  el.appendChild(tagFilterContainer);
  el.appendChild(viewContainer);
  el.appendChild(toggleContainer);
```

New:
```js
  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'already-toggle-container';
  const paginationTopContainer = document.createElement('div');
  paginationTopContainer.className = 'already-pagination-top';
  const paginationBottomContainer = document.createElement('div');
  paginationBottomContainer.className = 'already-pagination-bottom';

  el.innerHTML = '';
  el.appendChild(headerContainer);
  el.appendChild(selectorContainer);
  el.appendChild(tagFilterContainer);
  el.appendChild(paginationTopContainer);
  el.appendChild(viewContainer);
  el.appendChild(paginationBottomContainer);
  el.appendChild(toggleContainer);
```

- [ ] **Step 4: Reset pagination on view change**

Old:
```js
    // Fire onViewChange callback
    if (config.onViewChange && viewState.view !== 'detail') {
      const oldView = lastView;
      if (oldView !== viewState.view) {
        config.onViewChange(viewState.view, oldView);
      }
    }
```

New:
```js
    // Fire onViewChange callback
    if (config.onViewChange && viewState.view !== 'detail') {
      const oldView = lastView;
      if (oldView !== viewState.view) {
        config.onViewChange(viewState.view, oldView);
        paginationState = { futureCount: 0, pastCount: 0 };
      }
    }
```

- [ ] **Step 5: Clear pagination containers and integrate into grid/list**

Before the `switch` statement, clear pagination containers:

Old:
```js
    updateStickyOffsets(stickyConfig, headerContainer, selectorContainer, tagFilterContainer);

    switch (viewState.view) {
```

New:
```js
    updateStickyOffsets(stickyConfig, headerContainer, selectorContainer, tagFilterContainer);

    paginationTopContainer.innerHTML = '';
    paginationBottomContainer.innerHTML = '';

    switch (viewState.view) {
```

Replace the grid and list cases:

Old:
```js
      case 'grid':
        renderGridView(viewContainer, events, timezone, config);
        break;
      case 'list':
        renderListView(viewContainer, events, timezone, config);
        break;
```

New:
```js
      case 'grid': {
        const paginated = paginateEvents(events, showPast, config.pageSize, paginationState);
        renderGridView(viewContainer, paginated.visible, timezone, config);
        renderPaginationButtons(paginationTopContainer, paginationBottomContainer, paginated, viewState, config);
        break;
      }
      case 'list': {
        const paginated = paginateEvents(events, showPast, config.pageSize, paginationState);
        renderListView(viewContainer, paginated.visible, timezone, config);
        renderPaginationButtons(paginationTopContainer, paginationBottomContainer, paginated, viewState, config);
        break;
      }
```

- [ ] **Step 6: Add renderPaginationButtons helper**

Add this function inside `init()`, after the `hasPastEvents()` function and before `function renderView(viewState)`:

```js
  function renderPaginationButtons(topContainer, bottomContainer, paginated, viewState, cfg) {
    const i18n = cfg.i18n || {};
    topContainer.innerHTML = '';
    bottomContainer.innerHTML = '';

    if (paginated.hasMorePast) {
      const btn = document.createElement('button');
      btn.className = 'already-show-earlier';
      btn.textContent = `${i18n.showEarlier || 'Show earlier'} (${paginated.remainingPast} remaining)`;
      btn.addEventListener('click', () => {
        paginationState = { ...paginationState, pastCount: paginationState.pastCount + cfg.pageSize };
        renderView(viewState);
      });
      topContainer.appendChild(btn);
    }

    if (paginated.hasMoreFuture) {
      const btn = document.createElement('button');
      btn.className = 'already-load-more';
      btn.textContent = `${i18n.loadMore || 'Load more'} (${paginated.remainingFuture} remaining)`;
      btn.addEventListener('click', () => {
        const anchorEl = viewContainer.querySelector('.already-grid-card:last-child, .already-list-item:last-child');
        const anchorOffset = anchorEl ? anchorEl.getBoundingClientRect().top : null;
        paginationState = { ...paginationState, futureCount: paginationState.futureCount + cfg.pageSize };
        renderView(viewState);
        if (anchorEl && anchorOffset !== null) {
          const newAnchor = viewContainer.querySelector(`[data-event-id="${anchorEl.dataset.eventId}"]`);
          if (newAnchor && newAnchor.getBoundingClientRect) {
            window.scrollTo(0, window.scrollY + (newAnchor.getBoundingClientRect().top - anchorOffset));
          }
        }
      });
      bottomContainer.appendChild(btn);
    }
  }
```

- [ ] **Step 7: Reset pagination on past toggle**

Old:
```js
      renderPastToggle(toggleContainer, showPast, () => {
        showPast = !showPast;
        renderView(viewState);
      }, config);
```

New:
```js
      renderPastToggle(toggleContainer, showPast, () => {
        showPast = !showPast;
        paginationState = { futureCount: 0, pastCount: 0 };
        renderView(viewState);
      }, config);
```

- [ ] **Step 8: Add data-event-id to grid cards and list items**

In `src/views/grid.js`, after `applyEventClasses(card, event, 'already-grid-card');`:

Old:
```js
    applyEventClasses(card, event, 'already-grid-card');
    bindEventClick(card, event, 'grid', config);
```

New:
```js
    applyEventClasses(card, event, 'already-grid-card');
    card.dataset.eventId = event.id;
    bindEventClick(card, event, 'grid', config);
```

In `src/views/list.js`, after `applyEventClasses(item, event, 'already-list-item');`:

Old:
```js
    applyEventClasses(item, event, 'already-list-item');
    bindEventClick(item, event, 'list', config);
```

New:
```js
    applyEventClasses(item, event, 'already-list-item');
    item.dataset.eventId = event.id;
    bindEventClick(item, event, 'list', config);
```

- [ ] **Step 9: Add CSS for pagination buttons**

In `already-cal.css`, after the `.already-past-toggle:focus-visible` rule (around line 1129), add:

```css
/* ===== Pagination ===== */
.already-pagination-top,
.already-pagination-bottom {
  text-align: center;
}

.already-pagination-top:empty,
.already-pagination-bottom:empty {
  display: none;
}

.already-pagination-top {
  margin-bottom: 0.75rem;
}

.already-pagination-bottom {
  margin-top: 0.75rem;
}

.already-load-more,
.already-show-earlier {
  background: none;
  border: 1px solid rgba(0, 0, 0, 0.15);
  color: var(--already-text-secondary);
  font-size: 0.8125rem;
  padding: 0.375rem 0.75rem;
  border-radius: var(--already-radius);
  cursor: pointer;
  font-family: var(--already-font-family);
  transition: border-color 0.15s, color 0.15s;
}

.already-load-more:hover,
.already-show-earlier:hover {
  border-color: var(--already-primary);
  color: var(--already-primary);
}

.already-load-more:focus-visible,
.already-show-earlier:focus-visible {
  outline: 2px solid var(--already-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 10: Run all tests**

Run: `node --test test/`
Expected: All tests pass.

- [ ] **Step 11: Build**

Run: `npm run build`
Expected: Clean build.

- [ ] **Step 12: Commit**

```bash
git add src/already-cal.js src/ui/pagination.js src/views/grid.js src/views/list.js already-cal.css test/ui/pagination.test.js
git commit -m "feat: add pagination with load more/show earlier for grid and list views"
```

---

### Task 8: Final Build and Dist Update

**Files:**
- Modify: `dist/*` (rebuilt)

- [ ] **Step 1: Rebuild dist**

Run: `npm run build`
Expected: Clean build, dist files updated.

- [ ] **Step 2: Run full test suite one final time**

Run: `node --test test/`
Expected: All tests pass.

- [ ] **Step 3: Commit dist**

```bash
git add dist/
git commit -m "build: rebuild dist with icons, sticky header, and pagination"
```
