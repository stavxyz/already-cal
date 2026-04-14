require('../setup-dom.cjs');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { createTestEvent } = require('../helpers.cjs');

let paginateEvents, renderPaginationButtons;

before(async () => {
  const mod = await import('../../src/ui/pagination.js');
  paginateEvents = mod.paginateEvents;
  renderPaginationButtons = mod.renderPaginationButtons;
});

describe('paginateEvents', () => {
  // Use far-future dates to avoid time-bomb failures
  const futureEvents = Array.from({ length: 25 }, (_, i) =>
    createTestEvent({ id: `f${i}`, title: `Future ${i}`, start: `2099-06-${String(i + 1).padStart(2, '0')}T10:00:00Z` })
  );

  const pastEvents = Array.from({ length: 15 }, (_, i) =>
    createTestEvent({ id: `p${i}`, title: `Past ${i}`, start: `2020-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`, end: `2020-01-${String(i + 1).padStart(2, '0')}T11:00:00Z` })
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

  it('handles null events', () => {
    const result = paginateEvents(null, false, 10, { futureCount: 0, pastCount: 0 });
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

  it('selects most recent past events first', () => {
    const mixed = [...pastEvents, ...futureEvents];
    const result = paginateEvents(mixed, true, 3, { futureCount: 0, pastCount: 0 });
    const pastVisible = result.visible.filter(e => e.id.startsWith('p'));
    // Most recent 3 past events selected, displayed chronologically
    assert.strictEqual(pastVisible[0].id, 'p12');
    assert.strictEqual(pastVisible[1].id, 'p13');
    assert.strictEqual(pastVisible[2].id, 'p14');
  });

  it('returns hasMorePast false when showPast is false', () => {
    const result = paginateEvents(futureEvents, false, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.hasMorePast, false);
    assert.strictEqual(result.remainingPast, 0);
  });

  it('returns all future events when showPast is true but no past events exist', () => {
    const result = paginateEvents(futureEvents, true, 10, { futureCount: 0, pastCount: 0 });
    assert.strictEqual(result.visible.length, 10);
    assert.strictEqual(result.hasMorePast, false);
    assert.strictEqual(result.remainingPast, 0);
    assert.strictEqual(result.hasMoreFuture, true);
    assert.strictEqual(result.remainingFuture, 15);
  });
});

describe('renderPaginationButtons', () => {
  it('renders load-more button when hasMoreFuture is true', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    const paginated = { hasMoreFuture: true, hasMorePast: false, remainingFuture: 15, remainingPast: 0 };
    renderPaginationButtons(top, bottom, paginated, {}, { onLoadMore: () => {}, onShowEarlier: () => {} });
    assert.strictEqual(bottom.querySelector('.already-load-more').textContent, 'Load more (15 remaining)');
    assert.strictEqual(top.children.length, 0);
  });

  it('renders show-earlier button when hasMorePast is true', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    const paginated = { hasMoreFuture: false, hasMorePast: true, remainingFuture: 0, remainingPast: 7 };
    renderPaginationButtons(top, bottom, paginated, {}, { onLoadMore: () => {}, onShowEarlier: () => {} });
    assert.strictEqual(top.querySelector('.already-show-earlier').textContent, 'Show earlier (7 remaining)');
    assert.strictEqual(bottom.children.length, 0);
  });

  it('renders both buttons when both directions have more', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    const paginated = { hasMoreFuture: true, hasMorePast: true, remainingFuture: 10, remainingPast: 5 };
    renderPaginationButtons(top, bottom, paginated, {}, { onLoadMore: () => {}, onShowEarlier: () => {} });
    assert.ok(top.querySelector('.already-show-earlier'));
    assert.ok(bottom.querySelector('.already-load-more'));
  });

  it('renders no buttons when neither direction has more', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    const paginated = { hasMoreFuture: false, hasMorePast: false, remainingFuture: 0, remainingPast: 0 };
    renderPaginationButtons(top, bottom, paginated, {}, { onLoadMore: () => {}, onShowEarlier: () => {} });
    assert.strictEqual(top.children.length, 0);
    assert.strictEqual(bottom.children.length, 0);
  });

  it('uses custom i18n labels', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    const paginated = { hasMoreFuture: true, hasMorePast: true, remainingFuture: 3, remainingPast: 2 };
    const i18n = { loadMore: 'Más eventos', showEarlier: 'Eventos anteriores' };
    renderPaginationButtons(top, bottom, paginated, i18n, { onLoadMore: () => {}, onShowEarlier: () => {} });
    assert.strictEqual(bottom.querySelector('.already-load-more').textContent, 'Más eventos (3 remaining)');
    assert.strictEqual(top.querySelector('.already-show-earlier').textContent, 'Eventos anteriores (2 remaining)');
  });

  it('calls onLoadMore callback when load-more is clicked', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    let called = false;
    const paginated = { hasMoreFuture: true, hasMorePast: false, remainingFuture: 5, remainingPast: 0 };
    renderPaginationButtons(top, bottom, paginated, {}, { onLoadMore: () => { called = true; }, onShowEarlier: () => {} });
    bottom.querySelector('.already-load-more').click();
    assert.strictEqual(called, true);
  });

  it('calls onShowEarlier callback when show-earlier is clicked', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    let called = false;
    const paginated = { hasMoreFuture: false, hasMorePast: true, remainingFuture: 0, remainingPast: 3 };
    renderPaginationButtons(top, bottom, paginated, {}, { onLoadMore: () => {}, onShowEarlier: () => { called = true; } });
    top.querySelector('.already-show-earlier').click();
    assert.strictEqual(called, true);
  });

  it('clears previous buttons on re-render', () => {
    const top = document.createElement('div');
    const bottom = document.createElement('div');
    const noop = { onLoadMore: () => {}, onShowEarlier: () => {} };
    // First render with buttons
    renderPaginationButtons(top, bottom, { hasMoreFuture: true, hasMorePast: true, remainingFuture: 5, remainingPast: 3 }, {}, noop);
    assert.strictEqual(top.children.length, 1);
    assert.strictEqual(bottom.children.length, 1);
    // Re-render with no buttons
    renderPaginationButtons(top, bottom, { hasMoreFuture: false, hasMorePast: false, remainingFuture: 0, remainingPast: 0 }, {}, noop);
    assert.strictEqual(top.children.length, 0);
    assert.strictEqual(bottom.children.length, 0);
  });
});
