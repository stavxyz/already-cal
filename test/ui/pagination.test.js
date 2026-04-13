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
