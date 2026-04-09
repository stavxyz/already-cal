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
