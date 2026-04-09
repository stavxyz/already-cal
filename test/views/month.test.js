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
    assert.ok(container.querySelector('.showcal-month'));
    assert.strictEqual(container.querySelectorAll('.showcal-month-dayname').length, 7);
  });

  it('renders correct number of day cells for April 2026', () => {
    const container = document.createElement('div');
    renderMonthView(container, [], 'UTC', april2026, {});
    const cells = container.querySelectorAll('.showcal-month-cell:not(.showcal-month-cell--empty)');
    assert.strictEqual(cells.length, 30);
  });

  it('renders navigation with month name', () => {
    const container = document.createElement('div');
    renderMonthView(container, [], 'UTC', april2026, {});
    const title = container.querySelector('.showcal-month-title');
    assert.ok(title.textContent.includes('April'));
    assert.ok(title.textContent.includes('2026'));
  });

  it('renders event chips in correct day cells', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'My Event', start: '2026-04-15T10:00:00Z' })];
    renderMonthView(container, events, 'UTC', april2026, {});
    const chips = container.querySelectorAll('.showcal-month-chip');
    assert.strictEqual(chips.length, 1);
    assert.strictEqual(chips[0].textContent, 'My Event');
  });

  it('navigates to detail on chip click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'month-click', start: '2026-04-15T10:00:00Z' })];
    renderMonthView(container, events, 'UTC', april2026, {});
    container.querySelector('.showcal-month-chip').click();
    assert.strictEqual(window.location.hash, '#event/month-click');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T10:00:00Z', hidden: false }),
      createTestEvent({ id: '2', start: '2026-04-15T14:00:00Z', hidden: true }),
    ];
    renderMonthView(container, events, 'UTC', april2026, {});
    assert.strictEqual(container.querySelectorAll('.showcal-month-chip').length, 1);
  });

  it('adds --featured class to featured event chips', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ start: '2026-04-15T10:00:00Z', featured: true })];
    renderMonthView(container, events, 'UTC', april2026, {});
    assert.ok(container.querySelector('.showcal-month-chip--featured'));
  });

  it('sorts featured events first within a day cell', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderMonthView(container, events, 'UTC', april2026, {});
    const chips = [...container.querySelectorAll('.showcal-month-chip')];
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
    assert.ok(container.querySelector('.showcal-month-more'));
    assert.ok(container.querySelector('.showcal-month-more').textContent.includes('1'));
  });
});
