# Directives, View Refactor & Tag Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `featured`/`hidden` directive behavior, refactor all 6 view renderers from innerHTML to DOM factories, add tag filtering UI with union/OR logic, and support event deep-linking with OG meta tags.

**Architecture:** Extend the existing directive parser (`extractDirectives`) with `featured`/`hidden` flags that flow through `enrichEvent` onto event objects. Extract shared DOM helpers into `src/views/helpers.js` (createElement, bindEventClick, applyEventClasses, createEventImage, filterHidden, sortFeatured). Each view imports these helpers and replaces innerHTML with `.textContent` calls. Tag filtering is a stateful component in `src/ui/tag-filter.js` rendered by `og-cal.js` between header and view. Deep-linking uses path-based routes + `initialEvent` config + client-side OG meta tags.

**Tech Stack:** Vanilla JS (ES modules), esbuild IIFE bundle, node:test + jsdom for testing, CSS custom properties for theming.

**Spec:** `docs/superpowers/specs/2026-04-11-directives-views-tags-design.md`

---

## File Structure

**Create:**
| File | Responsibility |
|------|---------------|
| `test/setup-dom.js` | jsdom global setup for view tests |
| `test/helpers.js` | Shared test event factory (`createTestEvent`) |
| `src/views/helpers.js` | Shared DOM factory helpers: `createElement`, `bindEventClick`, `applyEventClasses`, `createEventImage`, `filterHidden`, `sortFeatured`, `sortFeaturedByDate` |
| `src/ui/tag-filter.js` | Tag filter pill bar component |
| `test/featured-hidden.test.js` | Featured/hidden directive + enrichEvent + sort/filter helpers |
| `test/views/helpers.test.js` | View helper function tests |
| `test/views/grid.test.js` | Grid view rendering tests |
| `test/views/list.test.js` | List view rendering tests |
| `test/views/day.test.js` | Day view rendering tests |
| `test/views/month.test.js` | Month view rendering tests |
| `test/views/week.test.js` | Week view rendering tests |
| `test/views/detail.test.js` | Detail view rendering tests |
| `test/tag-filter.test.js` | Tag filter component tests |

**Modify:**
| File | Changes |
|------|---------|
| `package.json` | Add jsdom devDep, update test script for `test/views/` |
| `src/util/directives.js` | Add `featured`/`hidden` flag extraction in `extractDirectives()` |
| `src/data.js` | Read flags in `enrichEvent()`, set `event.featured`/`event.hidden`, export `enrichEvent` |
| `src/views/grid.js` | Full DOM factory rewrite, hidden filter, featured sort+class |
| `src/views/list.js` | Full DOM factory rewrite, hidden filter, featured sort+class |
| `src/views/day.js` | DOM factory rewrite, hidden filter, featured sort |
| `src/views/month.js` | Nav DOM factory, hidden filter, featured sort in cells |
| `src/views/week.js` | Nav+header DOM factory, hidden filter, featured sort in columns |
| `src/views/detail.js` | Meta section DOM factory, remove escapeHtml |
| `src/og-cal.js` | Tag filter integration, hidden filtering in pipeline, initialEvent config, OG meta management |
| `src/router.js` | Path-based `/event/{id}` route, `initialEvent` priority |
| `og-cal.css` | Featured accent + star pseudo-element, tag filter pills |

---

### Task 1: Test Infrastructure

**Files:**
- Create: `test/setup-dom.js`, `test/helpers.js`
- Modify: `package.json`

- [ ] **Step 1: Install jsdom**

```bash
cd /Users/stavxyz/src/og-cal && npm install --save-dev jsdom
```

- [ ] **Step 2: Create test/setup-dom.js**

```javascript
// test/setup-dom.js
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
});

global.document = dom.window.document;
global.window = dom.window;
global.HTMLElement = dom.window.HTMLElement;
global.DocumentFragment = dom.window.DocumentFragment;
global.localStorage = dom.window.localStorage;
global.navigator = dom.window.navigator;
global.CustomEvent = dom.window.CustomEvent;
```

- [ ] **Step 3: Create test/helpers.js**

```javascript
// test/helpers.js
function createTestEvent(overrides = {}) {
  return {
    id: overrides.id || `event-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Event',
    description: '',
    location: '',
    start: '2026-04-15T10:00:00-05:00',
    end: '2026-04-15T11:00:00-05:00',
    allDay: false,
    image: null,
    images: [],
    links: [],
    attachments: [],
    tags: [],
    featured: false,
    hidden: false,
    ...overrides,
  };
}

module.exports = { createTestEvent };
```

- [ ] **Step 4: Update package.json test script**

Change the test script from:
```json
"test": "node --test test/*.test.js"
```
to:
```json
"test": "node --test test/*.test.js test/views/*.test.js"
```

Create the `test/views/` directory:
```bash
mkdir -p test/views
```

- [ ] **Step 5: Verify existing tests still pass**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

Expected: All 201 existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add test/setup-dom.js test/helpers.js package.json package-lock.json
git commit -m "test: add jsdom setup and shared test helpers"
```

---

### Task 2: Featured/Hidden Data Layer (TDD)

**Files:**
- Create: `test/featured-hidden.test.js`
- Modify: `src/util/directives.js`, `src/data.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/featured-hidden.test.js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractDirectives, enrichEvent;
let filterHidden, sortFeatured, sortFeaturedByDate;

before(async () => {
  const dirMod = await import('../src/util/directives.js');
  extractDirectives = dirMod.extractDirectives;
  const dataMod = await import('../src/data.js');
  enrichEvent = dataMod.enrichEvent;
});

// --- extractDirectives flag tests ---

describe('extractDirectives — featured flag', () => {
  it('extracts featured from #ogcal:featured', () => {
    const result = extractDirectives('Event info #ogcal:featured');
    assert.strictEqual(result.featured, true);
    assert.strictEqual(result.hidden, false);
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(result.description.includes('Event info'));
  });

  it('extracts featured from #showcal:featured', () => {
    const result = extractDirectives('#showcal:featured');
    assert.strictEqual(result.featured, true);
  });

  it('is case-insensitive for the keyword', () => {
    const result = extractDirectives('#ogcal:FEATURED');
    assert.strictEqual(result.featured, true);
  });
});

describe('extractDirectives — hidden flag', () => {
  it('extracts hidden from #ogcal:hidden', () => {
    const result = extractDirectives('#ogcal:hidden Event info');
    assert.strictEqual(result.hidden, true);
    assert.strictEqual(result.featured, false);
    assert.deepStrictEqual(result.tokens, []);
  });

  it('extracts hidden from #showcal:hidden', () => {
    const result = extractDirectives('#showcal:hidden');
    assert.strictEqual(result.hidden, true);
  });
});

describe('extractDirectives — featured/hidden interaction', () => {
  it('handles both featured and hidden in same description', () => {
    const result = extractDirectives('#ogcal:featured #ogcal:hidden');
    assert.strictEqual(result.featured, true);
    assert.strictEqual(result.hidden, true);
  });

  it('coexists with other directives without consuming them', () => {
    const result = extractDirectives('#ogcal:featured #ogcal:tag:outdoor');
    assert.strictEqual(result.featured, true);
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
  });

  it('featured/hidden are not added to tokens', () => {
    const result = extractDirectives('#ogcal:featured #ogcal:hidden');
    assert.deepStrictEqual(result.tokens, []);
  });

  it('returns false flags for plain description', () => {
    const result = extractDirectives('Just text');
    assert.strictEqual(result.featured, false);
    assert.strictEqual(result.hidden, false);
  });

  it('returns false flags for null description', () => {
    const result = extractDirectives(null);
    assert.strictEqual(result.featured, false);
    assert.strictEqual(result.hidden, false);
  });
});

// --- enrichEvent flag propagation tests ---

describe('enrichEvent — featured/hidden propagation', () => {
  const baseEvent = {
    id: '1',
    title: 'Test',
    start: '2026-04-15T10:00:00Z',
    end: '2026-04-15T11:00:00Z',
  };

  it('sets event.featured from #ogcal:featured directive', () => {
    const event = enrichEvent({ ...baseEvent, description: '#ogcal:featured' }, {});
    assert.strictEqual(event.featured, true);
    assert.strictEqual(event.hidden, false);
  });

  it('sets event.hidden from #ogcal:hidden directive', () => {
    const event = enrichEvent({ ...baseEvent, description: '#ogcal:hidden' }, {});
    assert.strictEqual(event.hidden, true);
    assert.strictEqual(event.featured, false);
  });

  it('featured directive is consumed — not in description or tags', () => {
    const event = enrichEvent({
      ...baseEvent,
      description: '#ogcal:featured #ogcal:tag:outdoor',
    }, {});
    assert.strictEqual(event.featured, true);
    assert.ok(!event.description.includes('#ogcal:featured'));
    assert.strictEqual(event.tags.length, 1);
    assert.strictEqual(event.tags[0].value, 'outdoor');
  });

  it('hidden directive is consumed — not in description or tags', () => {
    const event = enrichEvent({
      ...baseEvent,
      description: '#ogcal:hidden Some text',
    }, {});
    assert.strictEqual(event.hidden, true);
    assert.ok(!event.description.includes('#ogcal:hidden'));
    assert.ok(event.description.includes('Some text'));
  });

  it('preserves pre-set featured flag from event data', () => {
    const event = enrichEvent({ ...baseEvent, featured: true, description: '' }, {});
    assert.strictEqual(event.featured, true);
  });

  it('defaults featured and hidden to false when no directives', () => {
    const event = enrichEvent({ ...baseEvent, description: 'Plain text' }, {});
    assert.strictEqual(event.featured, false);
    assert.strictEqual(event.hidden, false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAILURES for featured/hidden tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

Expected: Featured/hidden tests fail (extractDirectives doesn't return `featured`/`hidden` yet, enrichEvent not exported). Existing 201 tests still pass.

- [ ] **Step 3: Implement featured/hidden in extractDirectives**

In `src/util/directives.js`, modify `extractDirectives()`:

Replace the current function (lines 107-134):
```javascript
export function extractDirectives(description) {
  if (!description) return { tokens: [], description, featured: false, hidden: false };
  description = description.replace(/&amp;/g, '&');

  const tokens = [];
  const seen = new Set();
  let cleaned = description;
  let featured = false;
  let hidden = false;

  const matches = [...description.matchAll(DIRECTIVE_PATTERN)];
  for (const match of matches) {
    const fullMatch = match[0];
    const body = match[1];

    // Always strip the directive from description, even if malformed
    cleaned = stripUrl(cleaned, fullMatch);

    // Featured/hidden: scalar directives (no colon in body)
    const keyword = body.toLowerCase();
    if (keyword === 'featured') {
      featured = true;
      continue;
    }
    if (keyword === 'hidden') {
      hidden = true;
      continue;
    }

    const token = parseDirective(body);
    if (!token) continue;

    if (!seen.has(token.canonicalId)) {
      seen.add(token.canonicalId);
      tokens.push(token);
    }
  }

  cleaned = cleanupHtml(cleaned);
  return { tokens, description: cleaned, featured, hidden };
}
```

- [ ] **Step 4: Implement featured/hidden in enrichEvent**

In `src/data.js`, make two changes:

1. Export `enrichEvent` — change `function enrichEvent(` to `export function enrichEvent(` (line 52).

2. Add featured/hidden tracking. After the existing variable declarations at the top of `enrichEvent` (after line 56), add:

```javascript
  let featured = event.featured || false;
  let hidden = event.hidden || false;
```

3. In the directive extraction block (after `tokenSet.addAll(result.tokens)` around line 64), add:

```javascript
    if (result.featured) featured = true;
    if (result.hidden) hidden = true;
```

4. In the return statement (line 144), add `featured, hidden`:

```javascript
  return { ...rest, description, descriptionFormat, image, images, links, attachments, tags, featured, hidden };
```

- [ ] **Step 5: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

Expected: All tests pass including new featured-hidden tests. Existing 201 tests unaffected.

- [ ] **Step 6: Commit**

```bash
git add src/util/directives.js src/data.js test/featured-hidden.test.js
git commit -m "feat: add featured/hidden directive flags to extractDirectives and enrichEvent"
```

---

### Task 3: Shared View Helpers (TDD)

**Files:**
- Create: `src/views/helpers.js`, `test/views/helpers.test.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/helpers.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');

let createElement, bindEventClick, applyEventClasses, createEventImage;
let filterHidden, sortFeatured, sortFeaturedByDate;

before(async () => {
  const mod = await import('../../src/views/helpers.js');
  createElement = mod.createElement;
  bindEventClick = mod.bindEventClick;
  applyEventClasses = mod.applyEventClasses;
  createEventImage = mod.createEventImage;
  filterHidden = mod.filterHidden;
  sortFeatured = mod.sortFeatured;
  sortFeaturedByDate = mod.sortFeaturedByDate;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('createElement', () => {
  it('creates element with tag and className', () => {
    const el = createElement('div', 'my-class');
    assert.strictEqual(el.tagName, 'DIV');
    assert.strictEqual(el.className, 'my-class');
  });

  it('creates element without className', () => {
    const el = createElement('span');
    assert.strictEqual(el.tagName, 'SPAN');
    assert.strictEqual(el.className, '');
  });

  it('applies attributes', () => {
    const el = createElement('button', 'btn', { 'aria-label': 'Close', role: 'button' });
    assert.strictEqual(el.getAttribute('aria-label'), 'Close');
    assert.strictEqual(el.getAttribute('role'), 'button');
  });
});

describe('bindEventClick', () => {
  it('navigates to event detail on click', () => {
    const el = document.createElement('div');
    bindEventClick(el, { id: 'evt-1' }, 'grid', {});
    el.click();
    assert.strictEqual(window.location.hash, '#event/evt-1');
  });

  it('calls onEventClick before navigating', () => {
    const el = document.createElement('div');
    let called = false;
    const config = { onEventClick: (event, view) => { called = true; } };
    bindEventClick(el, { id: 'evt-1' }, 'grid', config);
    el.click();
    assert.strictEqual(called, true);
    assert.strictEqual(window.location.hash, '#event/evt-1');
  });

  it('prevents navigation when onEventClick returns false', () => {
    const el = document.createElement('div');
    const config = { onEventClick: () => false };
    bindEventClick(el, { id: 'evt-1' }, 'grid', config);
    el.click();
    assert.strictEqual(window.location.hash, '');
  });

  it('sets tabindex and role', () => {
    const el = document.createElement('div');
    bindEventClick(el, { id: 'evt-1' }, 'grid', {});
    assert.strictEqual(el.getAttribute('tabindex'), '0');
    assert.strictEqual(el.getAttribute('role'), 'button');
  });

  it('handles Enter key', () => {
    const el = document.createElement('div');
    bindEventClick(el, { id: 'evt-1' }, 'grid', {});
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert.strictEqual(window.location.hash, '#event/evt-1');
  });

  it('handles Space key', () => {
    const el = document.createElement('div');
    bindEventClick(el, { id: 'evt-1' }, 'grid', {});
    el.dispatchEvent(new window.KeyboardEvent('keydown', { key: ' ', bubbles: true }));
    assert.strictEqual(window.location.hash, '#event/evt-1');
  });
});

describe('applyEventClasses', () => {
  it('sets base class', () => {
    const el = document.createElement('div');
    applyEventClasses(el, { start: '2099-01-01T00:00:00Z', featured: false }, 'ogcal-card');
    assert.strictEqual(el.className, 'ogcal-card');
  });

  it('adds --past for past events', () => {
    const el = document.createElement('div');
    applyEventClasses(el, { start: '2020-01-01T00:00:00Z', featured: false }, 'ogcal-card');
    assert.ok(el.className.includes('ogcal-card--past'));
  });

  it('adds --featured for featured events', () => {
    const el = document.createElement('div');
    applyEventClasses(el, { start: '2099-01-01T00:00:00Z', featured: true }, 'ogcal-card');
    assert.ok(el.className.includes('ogcal-card--featured'));
  });

  it('adds both --past and --featured', () => {
    const el = document.createElement('div');
    applyEventClasses(el, { start: '2020-01-01T00:00:00Z', featured: true }, 'ogcal-card');
    assert.ok(el.className.includes('ogcal-card--past'));
    assert.ok(el.className.includes('ogcal-card--featured'));
  });
});

describe('createEventImage', () => {
  it('creates image wrapper with img element', () => {
    const wrapper = createEventImage({ image: 'https://example.com/img.jpg', title: 'My Event' }, 'ogcal-grid-image');
    assert.strictEqual(wrapper.className, 'ogcal-grid-image');
    const img = wrapper.querySelector('img');
    assert.ok(img);
    assert.strictEqual(img.src, 'https://example.com/img.jpg');
    assert.strictEqual(img.alt, 'My Event');
    assert.strictEqual(img.loading, 'lazy');
  });

  it('hides wrapper on image error', () => {
    const wrapper = createEventImage({ image: 'https://bad.url/x.jpg', title: 'Test' }, 'ogcal-img');
    const img = wrapper.querySelector('img');
    img.onerror();
    assert.strictEqual(wrapper.style.display, 'none');
  });
});

describe('filterHidden', () => {
  it('removes hidden events', () => {
    const events = [
      { id: '1', hidden: false },
      { id: '2', hidden: true },
      { id: '3', hidden: false },
    ];
    const result = filterHidden(events);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].id, '1');
    assert.strictEqual(result[1].id, '3');
  });

  it('returns all events when none hidden', () => {
    const events = [{ id: '1', hidden: false }, { id: '2', hidden: false }];
    assert.strictEqual(filterHidden(events).length, 2);
  });

  it('returns empty array for all hidden', () => {
    const events = [{ id: '1', hidden: true }];
    assert.strictEqual(filterHidden(events).length, 0);
  });
});

describe('sortFeatured', () => {
  it('sorts featured events first', () => {
    const events = [
      { id: '1', featured: false },
      { id: '2', featured: true },
      { id: '3', featured: false },
    ];
    const result = sortFeatured(events);
    assert.strictEqual(result[0].id, '2');
  });

  it('preserves relative order of non-featured events', () => {
    const events = [
      { id: '1', featured: false },
      { id: '2', featured: false },
      { id: '3', featured: true },
    ];
    const result = sortFeatured(events);
    assert.strictEqual(result[0].id, '3');
    assert.strictEqual(result[1].id, '1');
    assert.strictEqual(result[2].id, '2');
  });

  it('does not mutate original array', () => {
    const events = [{ id: '1', featured: false }, { id: '2', featured: true }];
    sortFeatured(events);
    assert.strictEqual(events[0].id, '1');
  });
});

describe('sortFeaturedByDate', () => {
  it('sorts featured first within same date only', () => {
    const events = [
      { id: 'a', start: '2026-04-14T10:00:00Z', featured: false },
      { id: 'b', start: '2026-04-15T10:00:00Z', featured: false },
      { id: 'c', start: '2026-04-15T14:00:00Z', featured: true },
      { id: 'd', start: '2026-04-16T10:00:00Z', featured: false },
    ];
    const result = sortFeaturedByDate(events, 'UTC', 'en-US');
    assert.strictEqual(result[0].id, 'a');
    assert.strictEqual(result[1].id, 'c');
    assert.strictEqual(result[2].id, 'b');
    assert.strictEqual(result[3].id, 'd');
  });

  it('does not move featured events across dates', () => {
    const events = [
      { id: 'a', start: '2026-04-14T10:00:00Z', featured: false },
      { id: 'b', start: '2026-04-15T10:00:00Z', featured: true },
    ];
    const result = sortFeaturedByDate(events, 'UTC', 'en-US');
    assert.strictEqual(result[0].id, 'a');
    assert.strictEqual(result[1].id, 'b');
  });
});
```

- [ ] **Step 2: Write the helpers module**

```javascript
// src/views/helpers.js
import { isPast, getDatePartsInTz } from '../util/dates.js';
import { setEventDetail } from '../router.js';

export function createElement(tag, className, attrs) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

export function bindEventClick(el, event, viewName, config) {
  function handleClick() {
    if (config.onEventClick) {
      const result = config.onEventClick(event, viewName);
      if (result === false) return;
    }
    setEventDetail(event.id);
  }
  el.addEventListener('click', handleClick);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  });
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
}

export function applyEventClasses(el, event, baseClass) {
  let cls = baseClass;
  if (isPast(event.start)) cls += ` ${baseClass}--past`;
  if (event.featured) cls += ` ${baseClass}--featured`;
  el.className = cls;
}

export function createEventImage(event, className) {
  const wrapper = createElement('div', className);
  const img = document.createElement('img');
  img.src = event.image;
  img.alt = event.title;
  img.loading = 'lazy';
  img.onerror = () => { wrapper.style.display = 'none'; };
  wrapper.appendChild(img);
  return wrapper;
}

export function filterHidden(events) {
  return events.filter(e => !e.hidden);
}

export function sortFeatured(events) {
  return [...events].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
}

export function sortFeaturedByDate(events, timezone, locale) {
  const dateKey = (e) => {
    const p = getDatePartsInTz(e.start, timezone, locale);
    return `${p.year}-${p.month}-${p.day}`;
  };
  return [...events].sort((a, b) => {
    if (dateKey(a) !== dateKey(b)) return 0;
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/views/helpers.js test/views/helpers.test.js
git commit -m "feat: add shared view helpers with DOM factories and featured/hidden utilities"
```

---

### Task 4: Grid View Refactor + Tests

**Files:**
- Create: `test/views/grid.test.js`
- Modify: `src/views/grid.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/grid.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let renderGridView;

before(async () => {
  const mod = await import('../../src/views/grid.js');
  renderGridView = mod.renderGridView;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderGridView', () => {
  it('renders a card for each event', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Event A' }),
      createTestEvent({ id: '2', title: 'Event B' }),
    ];
    renderGridView(container, events, 'UTC', {});
    const cards = container.querySelectorAll('.ogcal-grid-card');
    assert.strictEqual(cards.length, 2);
  });

  it('displays event title via textContent', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'Concert <script>alert(1)</script>' })];
    renderGridView(container, events, 'UTC', {});
    const title = container.querySelector('.ogcal-grid-title');
    assert.strictEqual(title.textContent, 'Concert <script>alert(1)</script>');
    assert.ok(!title.innerHTML.includes('<script>'));
  });

  it('displays event location', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: 'Central Park' })];
    renderGridView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.ogcal-grid-location').textContent, 'Central Park');
  });

  it('omits location when empty', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: '' })];
    renderGridView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.ogcal-grid-location'), null);
  });

  it('renders image when present', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ image: 'https://example.com/img.jpg' })];
    renderGridView(container, events, 'UTC', {});
    const img = container.querySelector('.ogcal-grid-image img');
    assert.ok(img);
    assert.strictEqual(img.getAttribute('loading'), 'lazy');
  });

  it('omits image container when no image', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ image: null })];
    renderGridView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.ogcal-grid-image'), null);
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'click-test' })];
    renderGridView(container, events, 'UTC', {});
    container.querySelector('.ogcal-grid-card').click();
    assert.strictEqual(window.location.hash, '#event/click-test');
  });

  it('sets accessibility attributes', () => {
    const container = document.createElement('div');
    const events = [createTestEvent()];
    renderGridView(container, events, 'UTC', {});
    const card = container.querySelector('.ogcal-grid-card');
    assert.strictEqual(card.getAttribute('tabindex'), '0');
    assert.strictEqual(card.getAttribute('role'), 'button');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Visible' }),
      createTestEvent({ id: '2', title: 'Hidden', hidden: true }),
    ];
    renderGridView(container, events, 'UTC', {});
    const cards = container.querySelectorAll('.ogcal-grid-card');
    assert.strictEqual(cards.length, 1);
    assert.strictEqual(cards[0].querySelector('.ogcal-grid-title').textContent, 'Visible');
  });

  it('adds --featured class to featured events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ featured: true })];
    renderGridView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.ogcal-grid-card--featured'));
  });

  it('sorts featured events first within same date', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Regular', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderGridView(container, events, 'UTC', {});
    const titles = [...container.querySelectorAll('.ogcal-grid-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Star');
    assert.strictEqual(titles[1], 'Regular');
  });

  it('does not sort featured across different dates', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Apr14', start: '2026-04-14T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Apr15-Star', start: '2026-04-15T10:00:00Z', featured: true }),
    ];
    renderGridView(container, events, 'UTC', {});
    const titles = [...container.querySelectorAll('.ogcal-grid-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Apr14');
    assert.strictEqual(titles[1], 'Apr15-Star');
  });
});
```

- [ ] **Step 2: Rewrite grid.js with DOM factories**

Replace the entire content of `src/views/grid.js`:

```javascript
import { formatDateShort, formatTime } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, createEventImage, filterHidden, sortFeaturedByDate } from './helpers.js';

export function renderGridView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const grid = createElement('div', 'ogcal-grid');

  for (const event of events) {
    const card = createElement('div');
    applyEventClasses(card, event, 'ogcal-grid-card');
    bindEventClick(card, event, 'grid', config);

    if (event.image) {
      card.appendChild(createEventImage(event, 'ogcal-grid-image'));
    }

    const body = createElement('div', 'ogcal-grid-body');

    const title = createElement('div', 'ogcal-grid-title');
    title.textContent = event.title;
    body.appendChild(title);

    const dateStr = formatDateShort(event.start, timezone, locale);
    const timeStr = event.allDay ? '' : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
    const meta = createElement('div', 'ogcal-grid-meta');
    meta.textContent = `${dateStr}${timeStr}`;
    body.appendChild(meta);

    if (event.location) {
      const loc = createElement('div', 'ogcal-grid-location');
      loc.textContent = event.location;
      body.appendChild(loc);
    }

    card.appendChild(body);
    grid.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(grid);
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

Expected: All tests pass including new grid tests.

- [ ] **Step 4: Commit**

```bash
git add src/views/grid.js test/views/grid.test.js
git commit -m "refactor: grid view to DOM factories with hidden/featured support"
```

---

### Task 5: List View Refactor + Tests

**Files:**
- Create: `test/views/list.test.js`
- Modify: `src/views/list.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/list.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let renderListView;

before(async () => {
  const mod = await import('../../src/views/list.js');
  renderListView = mod.renderListView;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderListView', () => {
  it('renders an item for each event', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1' }),
      createTestEvent({ id: '2' }),
    ];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelectorAll('.ogcal-list-item').length, 2);
  });

  it('displays event title safely via textContent', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: '<img src=x onerror=alert(1)>' })];
    renderListView(container, events, 'UTC', {});
    const title = container.querySelector('.ogcal-list-title');
    assert.strictEqual(title.textContent, '<img src=x onerror=alert(1)>');
    assert.ok(!title.innerHTML.includes('onerror'));
  });

  it('displays date and time', () => {
    const container = document.createElement('div');
    const events = [createTestEvent()];
    renderListView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.ogcal-list-date-day'));
    assert.ok(container.querySelector('.ogcal-list-date-time'));
  });

  it('shows All Day label for all-day events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ allDay: true })];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.ogcal-list-date-time').textContent, 'All Day');
  });

  it('displays location when present', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: 'The Venue' })];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.ogcal-list-location').textContent, 'The Venue');
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'nav-test' })];
    renderListView(container, events, 'UTC', {});
    container.querySelector('.ogcal-list-item').click();
    assert.strictEqual(window.location.hash, '#event/nav-test');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', hidden: false }),
      createTestEvent({ id: '2', hidden: true }),
    ];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelectorAll('.ogcal-list-item').length, 1);
  });

  it('adds --featured class', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ featured: true })];
    renderListView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.ogcal-list-item--featured'));
  });

  it('sorts featured first within same date', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Featured', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderListView(container, events, 'UTC', {});
    const titles = [...container.querySelectorAll('.ogcal-list-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Featured');
  });
});
```

- [ ] **Step 2: Rewrite list.js**

Replace the entire content of `src/views/list.js`:

```javascript
import { formatDate, formatTime } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, filterHidden, sortFeaturedByDate } from './helpers.js';

export function renderListView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || 'All Day';

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const list = createElement('div', 'ogcal-list');

  for (const event of events) {
    const item = createElement('div');
    applyEventClasses(item, event, 'ogcal-list-item');
    bindEventClick(item, event, 'list', config);

    const dateCol = createElement('div', 'ogcal-list-date');
    const dateDay = createElement('div', 'ogcal-list-date-day');
    dateDay.textContent = formatDate(event.start, timezone, locale);
    dateCol.appendChild(dateDay);
    const dateTime = createElement('div', 'ogcal-list-date-time');
    dateTime.textContent = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
    dateCol.appendChild(dateTime);
    item.appendChild(dateCol);

    const info = createElement('div', 'ogcal-list-info');
    const title = createElement('div', 'ogcal-list-title');
    title.textContent = event.title;
    info.appendChild(title);
    if (event.location) {
      const loc = createElement('div', 'ogcal-list-location');
      loc.textContent = event.location;
      info.appendChild(loc);
    }
    item.appendChild(info);

    list.appendChild(item);
  }

  container.innerHTML = '';
  container.appendChild(list);
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/views/list.js test/views/list.test.js
git commit -m "refactor: list view to DOM factories with hidden/featured support"
```

---

### Task 6: Day View Refactor + Tests

**Files:**
- Create: `test/views/day.test.js`
- Modify: `src/views/day.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/day.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let renderDayView;

before(async () => {
  const mod = await import('../../src/views/day.js');
  renderDayView = mod.renderDayView;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderDayView', () => {
  const targetDate = new Date(2026, 3, 15); // April 15, 2026

  it('renders events for the target day', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', start: '2026-04-16T10:00:00Z' }),
    ];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.strictEqual(container.querySelectorAll('.ogcal-day-event').length, 1);
  });

  it('shows empty state when no events', () => {
    const container = document.createElement('div');
    renderDayView(container, [], 'UTC', targetDate, {});
    assert.ok(container.querySelector('.ogcal-day-empty'));
  });

  it('displays event title safely', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'Test & <b>Bold</b>', start: '2026-04-15T10:00:00Z' })];
    renderDayView(container, events, 'UTC', targetDate, {});
    const title = container.querySelector('.ogcal-day-event-title');
    assert.strictEqual(title.textContent, 'Test & <b>Bold</b>');
  });

  it('shows All Day label for all-day events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ allDay: true, start: '2026-04-15' })];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.strictEqual(container.querySelector('.ogcal-day-event-time').textContent, 'All Day');
  });

  it('renders navigation buttons', () => {
    const container = document.createElement('div');
    renderDayView(container, [], 'UTC', targetDate, {});
    assert.ok(container.querySelector('.ogcal-day-prev'));
    assert.ok(container.querySelector('.ogcal-day-next'));
    assert.ok(container.querySelector('.ogcal-day-title'));
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T10:00:00Z', hidden: false }),
      createTestEvent({ id: '2', start: '2026-04-15T14:00:00Z', hidden: true }),
    ];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.strictEqual(container.querySelectorAll('.ogcal-day-event').length, 1);
  });

  it('adds --featured class', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ start: '2026-04-15T10:00:00Z', featured: true })];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.ok(container.querySelector('.ogcal-day-event--featured'));
  });

  it('sorts featured events first', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderDayView(container, events, 'UTC', targetDate, {});
    const titles = [...container.querySelectorAll('.ogcal-day-event-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Star');
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'day-click', start: '2026-04-15T10:00:00Z' })];
    renderDayView(container, events, 'UTC', targetDate, {});
    container.querySelector('.ogcal-day-event').click();
    assert.strictEqual(window.location.hash, '#event/day-click');
  });
});
```

- [ ] **Step 2: Rewrite day.js**

Replace the entire content of `src/views/day.js`:

```javascript
import { formatDate, formatTime, isSameDay } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, filterHidden, sortFeatured } from './helpers.js';

export function renderDayView(container, events, timezone, currentDate, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || 'All Day';
  const noEventsLabel = i18n.noEventsThisDay || 'No events this day.';

  events = filterHidden(events);

  const day = createElement('div', 'ogcal-day');

  // Navigation
  const nav = createElement('div', 'ogcal-day-nav');

  const prevBtn = createElement('button', 'ogcal-day-prev', { 'aria-label': 'Previous day' });
  prevBtn.textContent = '\u2039';
  prevBtn.addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    renderDayView(container, events, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement('span', 'ogcal-day-title');
  title.textContent = formatDate(currentDate.toISOString(), timezone, locale);
  nav.appendChild(title);

  const nextBtn = createElement('button', 'ogcal-day-next', { 'aria-label': 'Next day' });
  nextBtn.textContent = '\u203a';
  nextBtn.addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    renderDayView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  day.appendChild(nav);

  let dayEvents = events.filter(e => isSameDay(new Date(e.start), currentDate));
  dayEvents = sortFeatured(dayEvents);

  if (dayEvents.length === 0) {
    const empty = createElement('div', 'ogcal-day-empty');
    empty.textContent = noEventsLabel;
    day.appendChild(empty);
  } else {
    for (const event of dayEvents) {
      const item = createElement('div');
      applyEventClasses(item, event, 'ogcal-day-event');
      bindEventClick(item, event, 'day', config);

      const timeEl = createElement('div', 'ogcal-day-event-time');
      timeEl.textContent = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
      item.appendChild(timeEl);

      const info = createElement('div', 'ogcal-day-event-info');
      const titleEl = createElement('div', 'ogcal-day-event-title');
      titleEl.textContent = event.title;
      info.appendChild(titleEl);
      if (event.location) {
        const loc = createElement('div', 'ogcal-day-event-location');
        loc.textContent = event.location;
        info.appendChild(loc);
      }
      item.appendChild(info);

      day.appendChild(item);
    }
  }

  container.innerHTML = '';
  container.appendChild(day);
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/views/day.js test/views/day.test.js
git commit -m "refactor: day view to DOM factories with hidden/featured support"
```

---

### Task 7: Month View Refactor + Tests

**Files:**
- Create: `test/views/month.test.js`
- Modify: `src/views/month.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/month.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let renderMonthView;

before(async () => {
  const mod = await import('../../src/views/month.js');
  renderMonthView = mod.renderMonthView;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderMonthView', () => {
  const april2026 = new Date(2026, 3, 1);

  it('renders month grid with day headers', () => {
    const container = document.createElement('div');
    renderMonthView(container, [], 'UTC', april2026, {});
    assert.ok(container.querySelector('.ogcal-month'));
    assert.strictEqual(container.querySelectorAll('.ogcal-month-dayname').length, 7);
  });

  it('renders correct number of day cells for April 2026', () => {
    const container = document.createElement('div');
    renderMonthView(container, [], 'UTC', april2026, {});
    const cells = container.querySelectorAll('.ogcal-month-cell:not(.ogcal-month-cell--empty)');
    assert.strictEqual(cells.length, 30);
  });

  it('renders navigation with month name', () => {
    const container = document.createElement('div');
    renderMonthView(container, [], 'UTC', april2026, {});
    const title = container.querySelector('.ogcal-month-title');
    assert.ok(title.textContent.includes('April'));
    assert.ok(title.textContent.includes('2026'));
  });

  it('renders event chips in correct day cells', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'My Event', start: '2026-04-15T10:00:00Z' })];
    renderMonthView(container, events, 'UTC', april2026, {});
    const chips = container.querySelectorAll('.ogcal-month-chip');
    assert.strictEqual(chips.length, 1);
    assert.strictEqual(chips[0].textContent, 'My Event');
  });

  it('navigates to detail on chip click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'month-click', start: '2026-04-15T10:00:00Z' })];
    renderMonthView(container, events, 'UTC', april2026, {});
    container.querySelector('.ogcal-month-chip').click();
    assert.strictEqual(window.location.hash, '#event/month-click');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T10:00:00Z', hidden: false }),
      createTestEvent({ id: '2', start: '2026-04-15T14:00:00Z', hidden: true }),
    ];
    renderMonthView(container, events, 'UTC', april2026, {});
    assert.strictEqual(container.querySelectorAll('.ogcal-month-chip').length, 1);
  });

  it('adds --featured class to featured event chips', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ start: '2026-04-15T10:00:00Z', featured: true })];
    renderMonthView(container, events, 'UTC', april2026, {});
    assert.ok(container.querySelector('.ogcal-month-chip--featured'));
  });

  it('sorts featured events first within a day cell', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderMonthView(container, events, 'UTC', april2026, {});
    const chips = [...container.querySelectorAll('.ogcal-month-chip')];
    assert.strictEqual(chips[0].textContent, 'Star');
    assert.strictEqual(chips[1].textContent, 'Normal');
  });

  it('shows +N more when exceeding maxEventsPerDay', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T08:00:00Z' }),
      createTestEvent({ id: '2', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '3', start: '2026-04-15T12:00:00Z' }),
      createTestEvent({ id: '4', start: '2026-04-15T14:00:00Z' }),
    ];
    renderMonthView(container, events, 'UTC', april2026, { maxEventsPerDay: 3 });
    assert.ok(container.querySelector('.ogcal-month-more'));
    assert.ok(container.querySelector('.ogcal-month-more').textContent.includes('1'));
  });
});
```

- [ ] **Step 2: Rewrite month.js**

Replace the entire content of `src/views/month.js`:

```javascript
import { getDaysInMonth, getFirstDayOfMonth, getMonthName, isToday, getDatePartsInTz, getDayNames } from '../util/dates.js';
import { createElement, filterHidden, sortFeatured } from './helpers.js';
import { setEventDetail } from '../router.js';

export function renderMonthView(container, events, timezone, currentDate, config) {
  config = config || {};
  const locale = config.locale;
  const weekStartDay = config.weekStartDay || 0;
  const maxEventsPerDay = config.maxEventsPerDay || 3;
  const i18n = config.i18n || {};
  const moreEventsTemplate = i18n.moreEvents || '+{count} more';

  events = filterHidden(events);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month, weekStartDay);
  const monthName = getMonthName(year, month, locale);
  const dayNames = getDayNames(locale, weekStartDay);

  // Group events by date in the calendar's timezone
  const eventsByDate = {};
  for (const event of events) {
    const parts = getDatePartsInTz(event.start, timezone, locale);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  }

  const grid = createElement('div', 'ogcal-month');

  // Navigation
  const nav = createElement('div', 'ogcal-month-nav');

  const prevBtn = createElement('button', 'ogcal-month-prev', { 'aria-label': 'Previous month' });
  prevBtn.textContent = '\u2039';
  prevBtn.addEventListener('click', () => {
    renderMonthView(container, events, timezone, new Date(year, month - 1, 1), config);
  });
  nav.appendChild(prevBtn);

  const title = createElement('span', 'ogcal-month-title');
  title.textContent = monthName;
  nav.appendChild(title);

  const nextBtn = createElement('button', 'ogcal-month-next', { 'aria-label': 'Next month' });
  nextBtn.textContent = '\u203a';
  nextBtn.addEventListener('click', () => {
    renderMonthView(container, events, timezone, new Date(year, month + 1, 1), config);
  });
  nav.appendChild(nextBtn);

  grid.appendChild(nav);

  // Day headers
  const headerRow = createElement('div', 'ogcal-month-header', { role: 'row' });
  for (const name of dayNames) {
    const cell = createElement('div', 'ogcal-month-dayname');
    cell.textContent = name;
    headerRow.appendChild(cell);
  }
  grid.appendChild(headerRow);

  // Calendar body
  const body = createElement('div', 'ogcal-month-body', { role: 'grid' });

  let row = createElement('div', 'ogcal-month-row', { role: 'row' });

  for (let i = 0; i < firstDay; i++) {
    row.appendChild(createElement('div', 'ogcal-month-cell ogcal-month-cell--empty', { role: 'gridcell' }));
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const key = `${year}-${month}-${d}`;
    const dayEvents = sortFeatured(eventsByDate[key] || []);
    const today = isToday(cellDate);

    const cell = createElement('div', null, { role: 'gridcell' });
    cell.className = 'ogcal-month-cell' + (today ? ' ogcal-month-cell--today' : '') +
      (dayEvents.length ? ' ogcal-month-cell--has-events' : '');

    const dayNum = createElement('div', 'ogcal-month-day');
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    for (const event of dayEvents.slice(0, maxEventsPerDay)) {
      const chip = createElement('div', 'ogcal-month-chip' + (event.featured ? ' ogcal-month-chip--featured' : ''));
      chip.textContent = event.title;
      chip.setAttribute('tabindex', '0');
      chip.setAttribute('role', 'button');
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        if (config.onEventClick) {
          const result = config.onEventClick(event, 'month');
          if (result === false) return;
        }
        setEventDetail(event.id);
      });
      chip.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          if (config.onEventClick) {
            const result = config.onEventClick(event, 'month');
            if (result === false) return;
          }
          setEventDetail(event.id);
        }
      });
      cell.appendChild(chip);
    }

    if (dayEvents.length > maxEventsPerDay) {
      const more = createElement('div', 'ogcal-month-more');
      more.textContent = moreEventsTemplate.replace('{count}', dayEvents.length - maxEventsPerDay);
      cell.appendChild(more);
    }

    row.appendChild(cell);

    if ((firstDay + d) % 7 === 0) {
      body.appendChild(row);
      row = createElement('div', 'ogcal-month-row', { role: 'row' });
    }
  }

  const remaining = (firstDay + daysInMonth) % 7;
  if (remaining > 0) {
    for (let i = remaining; i < 7; i++) {
      row.appendChild(createElement('div', 'ogcal-month-cell ogcal-month-cell--empty', { role: 'gridcell' }));
    }
    body.appendChild(row);
  }

  grid.appendChild(body);
  container.innerHTML = '';
  container.appendChild(grid);
}
```

Note: Month chips use inline click/keydown handlers (not `bindEventClick`) because they need `e.stopPropagation()` and are visually distinct from full event cards.

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/views/month.js test/views/month.test.js
git commit -m "refactor: month view nav to DOM factories with hidden/featured support"
```

---

### Task 8: Week View Refactor + Tests

**Files:**
- Create: `test/views/week.test.js`
- Modify: `src/views/week.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/week.test.js
require('../setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let renderWeekView;

before(async () => {
  const mod = await import('../../src/views/week.js');
  renderWeekView = mod.renderWeekView;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderWeekView', () => {
  const wednesday = new Date(2026, 3, 15); // April 15, 2026 (Wednesday)

  it('renders 7 day columns', () => {
    const container = document.createElement('div');
    renderWeekView(container, [], 'UTC', wednesday, {});
    assert.strictEqual(container.querySelectorAll('.ogcal-week-col').length, 7);
  });

  it('renders navigation with date range', () => {
    const container = document.createElement('div');
    renderWeekView(container, [], 'UTC', wednesday, {});
    assert.ok(container.querySelector('.ogcal-week-prev'));
    assert.ok(container.querySelector('.ogcal-week-next'));
    assert.ok(container.querySelector('.ogcal-week-title'));
  });

  it('renders column headers with day name and number', () => {
    const container = document.createElement('div');
    renderWeekView(container, [], 'UTC', wednesday, {});
    const headers = container.querySelectorAll('.ogcal-week-col-header');
    assert.strictEqual(headers.length, 7);
    assert.ok(headers[0].querySelector('.ogcal-week-dayname'));
    assert.ok(headers[0].querySelector('.ogcal-week-daynum'));
  });

  it('renders event blocks in correct column', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'Wed Event', start: '2026-04-15T10:00:00Z' })];
    renderWeekView(container, events, 'UTC', wednesday, {});
    const blocks = container.querySelectorAll('.ogcal-week-event');
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].textContent, 'Wed Event');
  });

  it('navigates to detail on event click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'week-click', start: '2026-04-15T10:00:00Z' })];
    renderWeekView(container, events, 'UTC', wednesday, {});
    container.querySelector('.ogcal-week-event').click();
    assert.strictEqual(window.location.hash, '#event/week-click');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T10:00:00Z', hidden: false }),
      createTestEvent({ id: '2', start: '2026-04-15T14:00:00Z', hidden: true }),
    ];
    renderWeekView(container, events, 'UTC', wednesday, {});
    assert.strictEqual(container.querySelectorAll('.ogcal-week-event').length, 1);
  });

  it('adds --featured class to featured events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ start: '2026-04-15T10:00:00Z', featured: true })];
    renderWeekView(container, events, 'UTC', wednesday, {});
    assert.ok(container.querySelector('.ogcal-week-event--featured'));
  });

  it('sorts featured first within a day column', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderWeekView(container, events, 'UTC', wednesday, {});
    const blocks = [...container.querySelectorAll('.ogcal-week-event')];
    assert.strictEqual(blocks[0].textContent, 'Star');
    assert.strictEqual(blocks[1].textContent, 'Normal');
  });
});
```

- [ ] **Step 2: Rewrite week.js**

Replace the entire content of `src/views/week.js`:

```javascript
import { getWeekDates, formatDateShort, isToday, getDatePartsInTz } from '../util/dates.js';
import { createElement, filterHidden, sortFeatured } from './helpers.js';
import { setEventDetail } from '../router.js';

export function renderWeekView(container, events, timezone, currentDate, config) {
  config = config || {};
  const locale = config.locale;
  const weekStartDay = config.weekStartDay || 0;
  const dates = getWeekDates(currentDate, weekStartDay);

  events = filterHidden(events);

  const week = createElement('div', 'ogcal-week');

  // Navigation
  const nav = createElement('div', 'ogcal-week-nav');
  const startLabel = formatDateShort(dates[0].toISOString(), timezone, locale);
  const endLabel = formatDateShort(dates[6].toISOString(), timezone, locale);

  const prevBtn = createElement('button', 'ogcal-week-prev', { 'aria-label': 'Previous week' });
  prevBtn.textContent = '\u2039';
  prevBtn.addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    renderWeekView(container, events, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement('span', 'ogcal-week-title');
  title.textContent = `${startLabel} \u2013 ${endLabel}`;
  nav.appendChild(title);

  const nextBtn = createElement('button', 'ogcal-week-next', { 'aria-label': 'Next week' });
  nextBtn.textContent = '\u203a';
  nextBtn.addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    renderWeekView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  week.appendChild(nav);

  const columns = createElement('div', 'ogcal-week-columns');

  for (const date of dates) {
    const col = createElement('div', 'ogcal-week-col' + (isToday(date) ? ' ogcal-week-col--today' : ''));

    const header = createElement('div', 'ogcal-week-col-header');
    const dayName = new Intl.DateTimeFormat(locale || 'en-US', { weekday: 'short' }).format(date);
    const dayNameEl = createElement('span', 'ogcal-week-dayname');
    dayNameEl.textContent = dayName;
    header.appendChild(dayNameEl);
    const dayNumEl = createElement('span', 'ogcal-week-daynum');
    dayNumEl.textContent = date.getDate();
    header.appendChild(dayNumEl);
    col.appendChild(header);

    const dayEvents = sortFeatured(events.filter(e => {
      const parts = getDatePartsInTz(e.start, timezone, locale);
      return parts.year === date.getFullYear() && parts.month === date.getMonth() && parts.day === date.getDate();
    }));

    for (const event of dayEvents) {
      const block = createElement('div', 'ogcal-week-event' + (event.featured ? ' ogcal-week-event--featured' : ''));
      block.textContent = event.title;
      block.setAttribute('tabindex', '0');
      block.addEventListener('click', () => {
        if (config.onEventClick) {
          const result = config.onEventClick(event, 'week');
          if (result === false) return;
        }
        setEventDetail(event.id);
      });
      block.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (config.onEventClick) {
            const result = config.onEventClick(event, 'week');
            if (result === false) return;
          }
          setEventDetail(event.id);
        }
      });
      col.appendChild(block);
    }

    columns.appendChild(col);
  }

  week.appendChild(columns);
  container.innerHTML = '';
  container.appendChild(week);
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/views/week.js test/views/week.test.js
git commit -m "refactor: week view to DOM factories with hidden/featured support"
```

---

### Task 9: Detail View Refactor + Tests

**Files:**
- Create: `test/views/detail.test.js`
- Modify: `src/views/detail.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/views/detail.test.js
require('../setup-dom.js');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.js');

let renderDetailView;

before(async () => {
  const mod = await import('../../src/views/detail.js');
  renderDetailView = mod.renderDetailView;
});

describe('renderDetailView', () => {
  const baseEvent = createTestEvent({
    id: 'detail-1',
    title: 'Concert in the Park',
    description: '<p>A great show</p>',
    location: 'Central Park',
    start: '2026-04-15T20:00:00Z',
    end: '2026-04-15T23:00:00Z',
  });

  it('renders event title', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    assert.strictEqual(container.querySelector('.ogcal-detail-title').textContent, 'Concert in the Park');
  });

  it('renders date', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    assert.ok(container.querySelector('.ogcal-detail-date'));
    assert.ok(container.querySelector('.ogcal-detail-date').textContent.length > 0);
  });

  it('renders location with maps link', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    const locLink = container.querySelector('.ogcal-detail-location a');
    assert.ok(locLink);
    assert.strictEqual(locLink.textContent, 'Central Park');
    assert.ok(locLink.href.includes('maps.google.com'));
    assert.strictEqual(locLink.target, '_blank');
  });

  it('omits location when empty', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, location: '' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    assert.strictEqual(container.querySelector('.ogcal-detail-location'), null);
  });

  it('renders description HTML', () => {
    const container = document.createElement('div');
    renderDetailView(container, baseEvent, 'UTC', () => {}, {});
    const desc = container.querySelector('.ogcal-detail-description');
    assert.ok(desc);
  });

  it('renders scalar tags as pills', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, tags: [{ key: 'tag', value: 'outdoor' }, { key: 'cost', value: '$25' }] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const tags = container.querySelectorAll('.ogcal-detail-tag');
    assert.strictEqual(tags.length, 2);
    assert.strictEqual(tags[0].textContent, 'outdoor');
    assert.strictEqual(tags[1].textContent, 'cost: $25');
  });

  it('renders URL-valued tags as link buttons', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, tags: [{ key: 'rsvp', value: 'https://example.com' }] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const link = container.querySelector('.ogcal-detail-link');
    assert.ok(link);
    assert.strictEqual(link.textContent, 'Rsvp');
    assert.strictEqual(link.href, 'https://example.com/');
  });

  it('renders attachments', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, attachments: [{ label: 'Flyer.pdf', url: 'https://example.com/flyer.pdf' }] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const att = container.querySelector('.ogcal-detail-attachment');
    assert.ok(att);
    assert.strictEqual(att.textContent, 'Flyer.pdf');
  });

  it('renders back button and calls onBack', () => {
    const container = document.createElement('div');
    let backCalled = false;
    renderDetailView(container, baseEvent, 'UTC', () => { backCalled = true; }, {});
    const btn = container.querySelector('.ogcal-detail-back');
    assert.ok(btn);
    btn.click();
    assert.strictEqual(backCalled, true);
  });

  it('renders gallery for multiple images', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, images: ['https://a.com/1.jpg', 'https://a.com/2.jpg'], image: 'https://a.com/1.jpg' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    assert.ok(container.querySelector('.ogcal-detail-gallery'));
    assert.ok(container.querySelector('.ogcal-detail-gallery-prev'));
    assert.ok(container.querySelector('.ogcal-detail-gallery-next'));
    assert.ok(container.querySelector('.ogcal-detail-gallery-counter'));
  });

  it('renders single image without carousel controls', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, image: 'https://a.com/1.jpg', images: ['https://a.com/1.jpg'] };
    renderDetailView(container, event, 'UTC', () => {}, {});
    assert.ok(container.querySelector('.ogcal-detail-gallery'));
    assert.strictEqual(container.querySelector('.ogcal-detail-gallery-prev'), null);
  });

  it('title uses textContent (XSS safe)', () => {
    const container = document.createElement('div');
    const event = { ...baseEvent, title: '<img onerror=alert(1)>' };
    renderDetailView(container, event, 'UTC', () => {}, {});
    const title = container.querySelector('.ogcal-detail-title');
    assert.strictEqual(title.textContent, '<img onerror=alert(1)>');
    assert.ok(!title.innerHTML.includes('onerror'));
  });
});
```

- [ ] **Step 2: Rewrite detail.js**

Replace the entire content of `src/views/detail.js`:

```javascript
import { formatDatetime, formatDate } from '../util/dates.js';
import { renderDescription } from '../util/description.js';
import { createElement } from './helpers.js';

function renderGallery(images, altText) {
  const gallery = createElement('div', 'ogcal-detail-gallery');

  let loadedImages = [...images];
  let current = 0;
  let counter = null;

  const imgEl = document.createElement('img');
  imgEl.className = 'ogcal-detail-gallery-img';
  imgEl.src = images[0];
  imgEl.alt = altText;
  imgEl.loading = 'lazy';
  imgEl.onerror = () => {
    loadedImages = loadedImages.filter(u => u !== imgEl.src);
    if (loadedImages.length === 0) {
      gallery.closest('.ogcal-detail-image')?.remove();
      return;
    }
    current = 0;
    imgEl.src = loadedImages[0];
    if (counter) counter.textContent = `1 / ${loadedImages.length}`;
  };
  gallery.appendChild(imgEl);

  if (images.length <= 1) return gallery;

  counter = createElement('div', 'ogcal-detail-gallery-counter');
  counter.textContent = `1 / ${images.length}`;
  gallery.appendChild(counter);

  const prevBtn = createElement('button', 'ogcal-detail-gallery-prev', { 'aria-label': 'Previous image' });
  prevBtn.textContent = '\u2039';
  gallery.appendChild(prevBtn);

  const nextBtn = createElement('button', 'ogcal-detail-gallery-next', { 'aria-label': 'Next image' });
  nextBtn.textContent = '\u203a';
  gallery.appendChild(nextBtn);

  function goTo(idx) {
    current = (idx + loadedImages.length) % loadedImages.length;
    imgEl.src = loadedImages[current];
    counter.textContent = `${current + 1} / ${loadedImages.length}`;
  }

  prevBtn.addEventListener('click', () => goTo(current - 1));
  nextBtn.addEventListener('click', () => goTo(current + 1));

  gallery.setAttribute('tabindex', '0');
  gallery.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { goTo(current - 1); e.preventDefault(); }
    if (e.key === 'ArrowRight') { goTo(current + 1); e.preventDefault(); }
  });

  return gallery;
}

export function renderDetailView(container, event, timezone, onBack, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const backLabel = i18n.back || '\u2190 Back';
  const locationTemplate = config.locationLinkTemplate || 'https://maps.google.com/?q={location}';

  const images = event.images && event.images.length > 0 ? event.images : (event.image ? [event.image] : []);
  const hasImages = images.length > 0;

  const detail = createElement('div', 'ogcal-detail');

  const backBtn = createElement('button', 'ogcal-detail-back');
  backBtn.textContent = backLabel;
  backBtn.addEventListener('click', onBack);
  detail.appendChild(backBtn);

  const body = createElement('div', hasImages ? 'ogcal-detail-body ogcal-detail-body--has-image' : 'ogcal-detail-body');

  if (hasImages) {
    const galleryCol = createElement('div', 'ogcal-detail-image');
    galleryCol.appendChild(renderGallery(images, event.title));
    body.appendChild(galleryCol);
  }

  const content = createElement('div', 'ogcal-detail-content');

  const titleEl = createElement('h2', 'ogcal-detail-title');
  titleEl.textContent = event.title;
  content.appendChild(titleEl);

  const meta = createElement('div', 'ogcal-detail-meta');
  const dateStr = event.allDay
    ? formatDate(event.start, timezone, locale)
    : formatDatetime(event.start, timezone, locale);
  const dateDiv = createElement('div', 'ogcal-detail-date');
  dateDiv.textContent = dateStr;
  meta.appendChild(dateDiv);

  if (event.location) {
    const mapsUrl = locationTemplate.replace('{location}', encodeURIComponent(event.location));
    const locDiv = createElement('div', 'ogcal-detail-location');
    const locLink = createElement('a', null, { href: mapsUrl, target: '_blank', rel: 'noopener' });
    locLink.textContent = event.location;
    locDiv.appendChild(locLink);
    meta.appendChild(locDiv);
  }
  content.appendChild(meta);

  // Render scalar + key-value text tags
  const scalarAndTextTags = (event.tags || []).filter(t => {
    if (t.key === 'tag') return true;
    if (t.value && !t.value.startsWith('http')) return true;
    return false;
  });

  if (scalarAndTextTags.length > 0) {
    const tagsDiv = createElement('div', 'ogcal-detail-tags');
    for (const tag of scalarAndTextTags) {
      const span = createElement('span', 'ogcal-detail-tag');
      span.textContent = tag.key === 'tag' ? tag.value : `${tag.key}: ${tag.value}`;
      tagsDiv.appendChild(span);
    }
    content.appendChild(tagsDiv);
  }

  if (event.description) {
    const desc = createElement('div', 'ogcal-detail-description');
    desc.innerHTML = renderDescription(event.description, config);
    content.appendChild(desc);
  }

  if (event.attachments && event.attachments.length > 0) {
    const attachDiv = createElement('div', 'ogcal-detail-attachments');
    for (const att of event.attachments) {
      const a = createElement('a', 'ogcal-detail-attachment', { href: att.url, target: '_blank', rel: 'noopener' });
      a.textContent = att.label;
      attachDiv.appendChild(a);
    }
    content.appendChild(attachDiv);
  }

  const urlTags = (event.tags || []).filter(t => t.key !== 'tag' && t.value && t.value.startsWith('http'));
  const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const allLinks = [...(event.links || []), ...urlTags.map(t => ({ label: titleCase(t.key), url: t.value }))];

  if (allLinks.length > 0) {
    const linksDiv = createElement('div', 'ogcal-detail-links');
    for (const link of allLinks) {
      const a = createElement('a', 'ogcal-detail-link', { href: link.url, target: '_blank', rel: 'noopener' });
      a.textContent = link.label;
      linksDiv.appendChild(a);
    }
    content.appendChild(linksDiv);
  }

  body.appendChild(content);
  detail.appendChild(body);

  container.innerHTML = '';
  container.appendChild(detail);

  backBtn.focus();
}
```

Key changes from original:
- Removed `escapeHtml` import (no longer needed)
- Gallery arrow buttons use `textContent = '\u2039'` / `'\u203a'` instead of `innerHTML = '&#8249;'`
- Meta section (date + location) uses DOM factories instead of innerHTML
- Gallery alt text uses `event.title` directly (safe via `imgEl.alt` property)
- Uses `createElement` helper from `./helpers.js`

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/views/detail.js test/views/detail.test.js
git commit -m "refactor: detail view meta to DOM factories, remove escapeHtml dependency"
```

---

### Task 10: Tag Filter Component (TDD)

**Files:**
- Create: `src/ui/tag-filter.js`, `test/tag-filter.test.js`

- [ ] **Step 1: Write the test file**

```javascript
// test/tag-filter.test.js
require('./setup-dom.js');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('./helpers.js');

let createTagFilter;

before(async () => {
  const mod = await import('../src/ui/tag-filter.js');
  createTagFilter = mod.createTagFilter;
});

describe('createTagFilter', () => {
  it('renders nothing when no events have tags', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    render(container, [createTestEvent()]);
    assert.strictEqual(container.innerHTML, '');
  });

  it('renders tag pills for unique tags', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'music' }] }),
    ];
    render(container, events);
    assert.strictEqual(container.querySelectorAll('.ogcal-tag-pill').length, 2);
  });

  it('orders tags by frequency (most common first)', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'music' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] }),
    ];
    render(container, events);
    const pills = container.querySelectorAll('.ogcal-tag-pill');
    assert.strictEqual(pills[0].textContent, 'outdoor');
    assert.strictEqual(pills[1].textContent, 'music');
  });

  it('excludes URL-valued tags from pills', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [
        { key: 'tag', value: 'outdoor' },
        { key: 'rsvp', value: 'https://example.com' },
      ]}),
    ];
    render(container, events);
    assert.strictEqual(container.querySelectorAll('.ogcal-tag-pill').length, 1);
  });

  it('displays key-value text tags as "key: value"', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'cost', value: '$25' }] }),
    ];
    render(container, events);
    assert.strictEqual(container.querySelector('.ogcal-tag-pill').textContent, 'cost: $25');
  });

  it('toggles tag selection on click', () => {
    let filterChanged = 0;
    const { render, getSelectedTags } = createTagFilter(() => { filterChanged++; });
    const container = document.createElement('div');
    const events = [createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] })];
    render(container, events);

    container.querySelector('.ogcal-tag-pill').click();
    assert.strictEqual(filterChanged, 1);
    assert.ok(getSelectedTags().has('outdoor'));

    // Click again to deselect (re-query after re-render)
    container.querySelector('.ogcal-tag-pill').click();
    assert.strictEqual(filterChanged, 2);
    assert.strictEqual(getSelectedTags().has('outdoor'), false);
  });

  it('shows clear button when tags are selected', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] })];
    render(container, events);

    assert.strictEqual(container.querySelector('.ogcal-tag-clear'), null);
    container.querySelector('.ogcal-tag-pill').click();
    assert.ok(container.querySelector('.ogcal-tag-clear'));
  });

  it('clear button deselects all tags', () => {
    const { render, getSelectedTags } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'music' }] }),
    ];
    render(container, events);

    // Select first tag
    container.querySelectorAll('.ogcal-tag-pill')[0].click();
    assert.strictEqual(getSelectedTags().size, 1);

    // Clear
    container.querySelector('.ogcal-tag-clear').click();
    assert.strictEqual(getSelectedTags().size, 0);
    assert.strictEqual(container.querySelector('.ogcal-tag-clear'), null);
  });

  it('getFilter returns null when no tags selected', () => {
    const { getFilter } = createTagFilter(() => {});
    assert.strictEqual(getFilter(), null);
  });

  it('getFilter returns union/OR filter function', () => {
    const { render, getFilter } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'music' }] }),
    ];
    render(container, events);

    // Select 'outdoor'
    container.querySelectorAll('.ogcal-tag-pill')[0].click();
    const filter = getFilter();
    assert.ok(filter);
    assert.strictEqual(filter(events[0]), true);  // has 'outdoor'
    assert.strictEqual(filter(events[1]), false);  // only 'music'
  });

  it('union filter passes events matching any selected tag', () => {
    const { render, getFilter } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'music' }] }),
      createTestEvent({ tags: [{ key: 'tag', value: 'indoor' }] }),
    ];
    render(container, events);

    // Select 'outdoor' then 'music'
    container.querySelectorAll('.ogcal-tag-pill')[0].click();
    // After re-render, select second unselected pill
    const pills = container.querySelectorAll('.ogcal-tag-pill:not(.ogcal-tag-pill--active)');
    if (pills.length > 0) pills[0].click();

    const filter = getFilter();
    assert.strictEqual(filter(events[0]), true);   // outdoor ✓
    assert.strictEqual(filter(events[1]), true);   // music ✓
    assert.strictEqual(filter(events[2]), false);  // indoor ✗
  });
});
```

- [ ] **Step 2: Write the tag filter component**

```javascript
// src/ui/tag-filter.js

export function createTagFilter(onFilterChange) {
  const selectedTags = new Set();

  function getTagLabel(tag) {
    return tag.key === 'tag' ? tag.value : `${tag.key}: ${tag.value}`;
  }

  function render(container, events) {
    // Collect unique tags from visible events, count frequency
    const tagCounts = new Map();
    for (const event of events) {
      for (const tag of (event.tags || [])) {
        // Skip URL-valued tags (they're links, not categories)
        if (tag.key !== 'tag' && tag.value && tag.value.startsWith('http')) continue;
        const label = getTagLabel(tag);
        tagCounts.set(label, (tagCounts.get(label) || 0) + 1);
      }
    }

    if (tagCounts.size === 0) {
      container.innerHTML = '';
      return;
    }

    // Sort by frequency (most common first)
    const sortedTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);

    const bar = document.createElement('div');
    bar.className = 'ogcal-tag-filter';

    for (const [label] of sortedTags) {
      const pill = document.createElement('button');
      pill.className = 'ogcal-tag-pill' + (selectedTags.has(label) ? ' ogcal-tag-pill--active' : '');
      pill.textContent = label;
      pill.addEventListener('click', () => {
        if (selectedTags.has(label)) {
          selectedTags.delete(label);
        } else {
          selectedTags.add(label);
        }
        render(container, events);
        onFilterChange();
      });
      bar.appendChild(pill);
    }

    if (selectedTags.size > 0) {
      const clear = document.createElement('button');
      clear.className = 'ogcal-tag-clear';
      clear.textContent = 'Clear';
      clear.addEventListener('click', () => {
        selectedTags.clear();
        render(container, events);
        onFilterChange();
      });
      bar.appendChild(clear);
    }

    container.innerHTML = '';
    container.appendChild(bar);
  }

  function getFilter() {
    if (selectedTags.size === 0) return null;
    return (event) => {
      for (const tag of (event.tags || [])) {
        const label = getTagLabel(tag);
        if (selectedTags.has(label)) return true;
      }
      return false;
    };
  }

  function getSelectedTags() {
    return new Set(selectedTags);
  }

  return { render, getFilter, getSelectedTags };
}
```

- [ ] **Step 3: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 4: Commit**

```bash
git add src/ui/tag-filter.js test/tag-filter.test.js
git commit -m "feat: add tag filter component with union/OR logic and frequency ordering"
```

---

### Task 11: Tag Filter + Hidden Integration in og-cal.js

**Files:**
- Modify: `src/og-cal.js`

- [ ] **Step 1: Add imports and DEFAULTS**

At the top of `src/og-cal.js`, add the import (after the existing view imports):

```javascript
import { createTagFilter } from './ui/tag-filter.js';
```

Add to `DEFAULTS` object (around line 33):

```javascript
  initialEvent: null,
```

Add to `I18N_DEFAULTS`:

```javascript
  clearFilter: 'Clear',
```

- [ ] **Step 2: Add tag filter container and instance in init()**

In the `init()` function, after creating `selectorContainer` (around line 105), add the tag filter container:

```javascript
  const tagFilterContainer = document.createElement('div');
  tagFilterContainer.className = 'ogcal-tag-filter-container';
```

In the DOM layout section (around lines 112-116), insert `tagFilterContainer` between `selectorContainer` and `viewContainer`:

```javascript
  el.innerHTML = '';
  el.appendChild(headerContainer);
  el.appendChild(selectorContainer);
  el.appendChild(tagFilterContainer);
  el.appendChild(viewContainer);
  el.appendChild(toggleContainer);
```

After the state variables (around line 121), add:

```javascript
  let lastViewState = null;
  const tagFilter = createTagFilter(() => {
    if (lastViewState) renderView(lastViewState);
  });
```

- [ ] **Step 3: Update renderView() to integrate hidden + tag filtering**

Replace the first few lines of `renderView()` (the `const events = getFilteredEvents()` line) with the new filtering pipeline:

```javascript
  function renderView(viewState) {
    lastViewState = viewState;
    const allEvents = getFilteredEvents();
    const timezone = data?.calendar?.timezone || 'UTC';

    // Hidden filtering — visible events used for tag pills
    const visibleEvents = allEvents.filter(e => !e.hidden);

    // Tag filter UI (render pills from all non-hidden events, not filtered by tags)
    if (viewState.view !== 'detail') {
      tagFilter.render(tagFilterContainer, visibleEvents);
    } else {
      tagFilterContainer.innerHTML = '';
    }

    // Apply tag filter
    const tagFilterFn = tagFilter.getFilter();
    const events = tagFilterFn ? visibleEvents.filter(tagFilterFn) : visibleEvents;
```

Then continue with the rest of `renderView()` unchanged (onViewChange, switch statement, etc.), but using the new `events` variable.

- [ ] **Step 4: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/og-cal.js
git commit -m "feat: integrate tag filter and hidden filtering into render pipeline"
```

---

### Task 12: Event Deep-Linking — Router, initialEvent, OG Meta

**Files:**
- Modify: `src/router.js`, `src/og-cal.js`

- [ ] **Step 1: Add path-based route support to router.js**

In `src/router.js`, modify `parseHash()` to check the URL path first (before the hash check). Replace the function (lines 8-28):

```javascript
export function parseHash() {
  // Check path for /event/{id} (allows server-side routing)
  const pathMatch = window.location.pathname.match(/\/event\/([^/]+)\/?$/);
  if (pathMatch) {
    return { view: 'detail', eventId: decodeURIComponent(pathMatch[1]) };
  }

  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  if (hash.startsWith('event/')) {
    return { view: 'detail', eventId: hash.slice(6) };
  }

  if (hash.startsWith('day/')) {
    return { view: 'day', date: hash.slice(4) };
  }

  if (VALID_VIEWS.includes(hash)) {
    return { view: hash };
  }

  return null;
}
```

- [ ] **Step 2: Add initialEvent priority to getInitialView()**

Modify `getInitialView()` to check `config.initialEvent` first (lines 30-42):

```javascript
export function getInitialView(defaultView, enabledViews, config) {
  // Priority: initialEvent > hash/path > localStorage > config default
  if (config && config.initialEvent) {
    return { view: 'detail', eventId: config.initialEvent };
  }

  const fromHash = parseHash();
  if (fromHash) return fromHash;

  const key = storageKey(config);
  const saved = localStorage.getItem(key);
  if (saved && enabledViews.includes(saved)) {
    return { view: saved };
  }

  return { view: defaultView || 'month' };
}
```

- [ ] **Step 3: Add OG meta tag management to og-cal.js**

In `src/og-cal.js`, add the following imports at the top (if not already present):

```javascript
import { formatDate, formatDatetime } from './util/dates.js';
```

Note: `isPast` is already imported. Add `formatDate` and `formatDatetime` to the existing import from `./util/dates.js`.

In the `init()` function, after the state variables, add meta tag management functions:

```javascript
  // OG meta tag management
  let originalMeta = null;

  function captureOriginalMeta() {
    originalMeta = {};
    for (const prop of ['og:title', 'og:description', 'og:image', 'og:url']) {
      const el = document.querySelector(`meta[property="${prop}"]`);
      originalMeta[prop] = el ? el.getAttribute('content') : null;
    }
  }

  function setMetaTag(property, content) {
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setEventMeta(event) {
    const tz = data?.calendar?.timezone || 'UTC';
    const dateStr = event.allDay
      ? formatDate(event.start, tz, config.locale)
      : formatDatetime(event.start, tz, config.locale);
    const descParts = [dateStr];
    if (event.location) descParts.push(event.location);

    setMetaTag('og:title', event.title);
    setMetaTag('og:description', descParts.join(' \u00b7 '));
    if (event.image) setMetaTag('og:image', event.image);
    setMetaTag('og:url', window.location.href);
  }

  function restoreOriginalMeta() {
    if (!originalMeta) return;
    for (const [prop, content] of Object.entries(originalMeta)) {
      if (content === null) {
        const el = document.querySelector(`meta[property="${prop}"]`);
        if (el) el.remove();
      } else {
        setMetaTag(prop, content);
      }
    }
  }
```

- [ ] **Step 4: Wire OG meta into renderView()**

In `renderView()`, add meta tag management. After the tag filter section and before the switch statement, add:

```javascript
    // OG meta management
    if (viewState.view !== 'detail') {
      restoreOriginalMeta();
    }
```

In the `case 'detail':` block, after verifying the event exists and before calling `renderDetailView()`, add:

```javascript
        setEventMeta(event);
```

- [ ] **Step 5: Capture original meta on start**

In the `start()` function, add `captureOriginalMeta()` as the first line:

```javascript
  async function start() {
    captureOriginalMeta();
    renderLoading(viewContainer, config);
    // ... rest unchanged
```

- [ ] **Step 6: Run all tests**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

- [ ] **Step 7: Commit**

```bash
git add src/router.js src/og-cal.js
git commit -m "feat: add event deep-linking with path routes, initialEvent config, and OG meta tags"
```

---

### Task 13: Featured + Tag Filter CSS

**Files:**
- Modify: `og-cal.css`

- [ ] **Step 1: Add featured event styles**

Append to `og-cal.css`:

```css
/* Featured events — accent border + star indicator */
.ogcal-grid-card--featured,
.ogcal-list-item--featured,
.ogcal-day-event--featured {
  border-left: 3px solid var(--ogcal-primary);
}

.ogcal-month-chip--featured,
.ogcal-week-event--featured {
  border-left: 2px solid var(--ogcal-primary);
}

.ogcal-grid-card--featured .ogcal-grid-title::before,
.ogcal-list-item--featured .ogcal-list-title::before,
.ogcal-day-event--featured .ogcal-day-event-title::before,
.ogcal-month-chip--featured::before,
.ogcal-week-event--featured::before {
  content: '\2605';
  font-size: 0.75em;
  color: var(--ogcal-primary);
  margin-right: 0.25em;
}
```

- [ ] **Step 2: Add tag filter styles**

Append to `og-cal.css`:

```css
/* Tag filter */
.ogcal-tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.ogcal-tag-pill {
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid var(--ogcal-text-secondary);
  background: transparent;
  color: var(--ogcal-text);
  cursor: pointer;
  font-size: 0.85rem;
  font-family: var(--ogcal-font-family);
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.ogcal-tag-pill:hover {
  border-color: var(--ogcal-primary);
  color: var(--ogcal-primary);
}

.ogcal-tag-pill--active {
  background: var(--ogcal-primary);
  color: var(--ogcal-primary-text);
  border-color: var(--ogcal-primary);
}

.ogcal-tag-clear {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: var(--ogcal-text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  font-family: var(--ogcal-font-family);
  text-decoration: underline;
}

.ogcal-tag-clear:hover {
  color: var(--ogcal-text);
}
```

- [ ] **Step 3: Run the build to verify CSS bundles correctly**

```bash
cd /Users/stavxyz/src/og-cal && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add og-cal.css
git commit -m "style: add featured event accent styling and tag filter pill bar"
```

---

### Task 14: Build Dist + ShowCal Integration

**Files:**
- Modify: dist files (generated), ShowCal `workers/embed/static/`

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/stavxyz/src/og-cal && npm test
```

Expected: All tests pass (201 existing + new tests).

- [ ] **Step 2: Build dist**

```bash
cd /Users/stavxyz/src/og-cal && npm run build
```

- [ ] **Step 3: Commit dist**

```bash
cd /Users/stavxyz/src/og-cal && git add dist/
git commit -m "build: rebuild dist with directives, view refactor, and tag filtering"
```

- [ ] **Step 4: Update ShowCal embed worker**

Run the copy script to sync og-cal assets into the ShowCal embed worker:

```bash
cd /Users/stavxyz/src/showcal && node workers/embed/scripts/copy-ogcal.js
```

If the script doesn't exist or the path differs, manually copy:
```bash
cp /Users/stavxyz/src/og-cal/dist/og-cal.min.js /Users/stavxyz/src/showcal/workers/embed/static/
cp /Users/stavxyz/src/og-cal/dist/og-cal.min.css /Users/stavxyz/src/showcal/workers/embed/static/
```

- [ ] **Step 5: Commit ShowCal update**

```bash
cd /Users/stavxyz/src/showcal && git add workers/embed/static/
git commit -m "chore: update og-cal dist with directives, view refactor, and tag filtering"
```
