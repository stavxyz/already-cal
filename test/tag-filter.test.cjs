require('./setup-dom.cjs');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('./helpers.cjs');

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
    assert.strictEqual(container.querySelectorAll('.already-tag-pill').length, 2);
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
    const pills = container.querySelectorAll('.already-tag-pill');
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
    assert.strictEqual(container.querySelectorAll('.already-tag-pill').length, 1);
  });

  it('displays key-value text tags as "key: value"', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [
      createTestEvent({ tags: [{ key: 'cost', value: '$25' }] }),
    ];
    render(container, events);
    assert.strictEqual(container.querySelector('.already-tag-pill').textContent, 'cost: $25');
  });

  it('toggles tag selection on click', () => {
    let filterChanged = 0;
    const { render, getSelectedTags } = createTagFilter(() => { filterChanged++; });
    const container = document.createElement('div');
    const events = [createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] })];
    render(container, events);

    container.querySelector('.already-tag-pill').click();
    assert.strictEqual(filterChanged, 1);
    assert.ok(getSelectedTags().has('outdoor'));

    // Click again to deselect (re-query after re-render)
    container.querySelector('.already-tag-pill').click();
    assert.strictEqual(filterChanged, 2);
    assert.strictEqual(getSelectedTags().has('outdoor'), false);
  });

  it('shows clear button when tags are selected', () => {
    const { render } = createTagFilter(() => {});
    const container = document.createElement('div');
    const events = [createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] })];
    render(container, events);

    assert.strictEqual(container.querySelector('.already-tag-clear'), null);
    container.querySelector('.already-tag-pill').click();
    assert.ok(container.querySelector('.already-tag-clear'));
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
    container.querySelectorAll('.already-tag-pill')[0].click();
    assert.strictEqual(getSelectedTags().size, 1);

    // Clear
    container.querySelector('.already-tag-clear').click();
    assert.strictEqual(getSelectedTags().size, 0);
    assert.strictEqual(container.querySelector('.already-tag-clear'), null);
  });

  it('uses i18n clearFilter label when provided', () => {
    const { render } = createTagFilter(() => {}, { i18n: { clearFilter: 'Reset' } });
    const container = document.createElement('div');
    const events = [createTestEvent({ tags: [{ key: 'tag', value: 'outdoor' }] })];
    render(container, events);
    container.querySelector('.already-tag-pill').click();
    assert.strictEqual(container.querySelector('.already-tag-clear').textContent, 'Reset');
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
    container.querySelectorAll('.already-tag-pill')[0].click();
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
    container.querySelectorAll('.already-tag-pill')[0].click();
    // After re-render, select second unselected pill
    const pills = container.querySelectorAll('.already-tag-pill:not(.already-tag-pill--active)');
    if (pills.length > 0) pills[0].click();

    const filter = getFilter();
    assert.strictEqual(filter(events[0]), true);   // outdoor ✓
    assert.strictEqual(filter(events[1]), true);   // music ✓
    assert.strictEqual(filter(events[2]), false);  // indoor ✗
  });
});
