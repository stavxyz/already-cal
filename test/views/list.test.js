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
    assert.strictEqual(container.querySelectorAll('.showcal-list-item').length, 2);
  });

  it('displays event title safely via textContent', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: '<img src=x onerror=alert(1)>' })];
    renderListView(container, events, 'UTC', {});
    const title = container.querySelector('.showcal-list-title');
    assert.strictEqual(title.textContent, '<img src=x onerror=alert(1)>');
    assert.ok(!title.innerHTML.includes('<img'));
  });

  it('displays date and time', () => {
    const container = document.createElement('div');
    const events = [createTestEvent()];
    renderListView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.showcal-list-date-day'));
    assert.ok(container.querySelector('.showcal-list-date-time'));
  });

  it('shows All Day label for all-day events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ allDay: true })];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.showcal-list-date-time').textContent, 'All Day');
  });

  it('displays location when present', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: 'The Venue' })];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.showcal-list-location').textContent, 'The Venue');
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'nav-test' })];
    renderListView(container, events, 'UTC', {});
    container.querySelector('.showcal-list-item').click();
    assert.strictEqual(window.location.hash, '#event/nav-test');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', hidden: false }),
      createTestEvent({ id: '2', hidden: true }),
    ];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelectorAll('.showcal-list-item').length, 1);
  });

  it('adds --featured class', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ featured: true })];
    renderListView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.showcal-list-item--featured'));
  });

  it('sorts featured first within same date', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Featured', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderListView(container, events, 'UTC', {});
    const titles = [...container.querySelectorAll('.showcal-list-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Featured');
  });
});
