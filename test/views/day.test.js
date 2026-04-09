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
    assert.strictEqual(container.querySelectorAll('.showcal-day-event').length, 1);
  });

  it('shows empty state when no events', () => {
    const container = document.createElement('div');
    renderDayView(container, [], 'UTC', targetDate, {});
    assert.ok(container.querySelector('.showcal-day-empty'));
  });

  it('displays event title safely', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'Test & <b>Bold</b>', start: '2026-04-15T10:00:00Z' })];
    renderDayView(container, events, 'UTC', targetDate, {});
    const title = container.querySelector('.showcal-day-event-title');
    assert.strictEqual(title.textContent, 'Test & <b>Bold</b>');
  });

  it('shows All Day label for all-day events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ allDay: true, start: '2026-04-15' })];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.strictEqual(container.querySelector('.showcal-day-event-time').textContent, 'All Day');
  });

  it('renders navigation buttons', () => {
    const container = document.createElement('div');
    renderDayView(container, [], 'UTC', targetDate, {});
    assert.ok(container.querySelector('.showcal-day-prev'));
    assert.ok(container.querySelector('.showcal-day-next'));
    assert.ok(container.querySelector('.showcal-day-title'));
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', start: '2026-04-15T10:00:00Z', hidden: false }),
      createTestEvent({ id: '2', start: '2026-04-15T14:00:00Z', hidden: true }),
    ];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.strictEqual(container.querySelectorAll('.showcal-day-event').length, 1);
  });

  it('adds --featured class', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ start: '2026-04-15T10:00:00Z', featured: true })];
    renderDayView(container, events, 'UTC', targetDate, {});
    assert.ok(container.querySelector('.showcal-day-event--featured'));
  });

  it('sorts featured events first', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderDayView(container, events, 'UTC', targetDate, {});
    const titles = [...container.querySelectorAll('.showcal-day-event-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Star');
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'day-click', start: '2026-04-15T10:00:00Z' })];
    renderDayView(container, events, 'UTC', targetDate, {});
    container.querySelector('.showcal-day-event').click();
    assert.strictEqual(window.location.hash, '#event/day-click');
  });
});
