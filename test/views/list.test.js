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
    assert.strictEqual(container.querySelectorAll('.already-list-item').length, 2);
  });

  it('displays event title safely via textContent', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: '<img src=x onerror=alert(1)>' })];
    renderListView(container, events, 'UTC', {});
    const title = container.querySelector('.already-list-title');
    assert.strictEqual(title.textContent, '<img src=x onerror=alert(1)>');
    assert.ok(!title.innerHTML.includes('<img'));
  });

  it('displays date and time', () => {
    const container = document.createElement('div');
    const events = [createTestEvent()];
    renderListView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.already-list-date-day'));
    assert.ok(container.querySelector('.already-list-date-time'));
  });

  it('shows All Day label for all-day events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ allDay: true })];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.already-list-date-time').textContent, 'All Day');
  });

  it('displays location when present', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: 'The Venue' })];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.already-list-location').textContent, 'The Venue');
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'nav-test' })];
    renderListView(container, events, 'UTC', {});
    container.querySelector('.already-list-item').click();
    assert.strictEqual(window.location.hash, '#event/nav-test');
  });

  it('does not render hidden events', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', hidden: false }),
      createTestEvent({ id: '2', hidden: true }),
    ];
    renderListView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelectorAll('.already-list-item').length, 1);
  });

  it('adds --featured class', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ featured: true })];
    renderListView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.already-list-item--featured'));
  });

  it('sets data-event-id on each item', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: 'list-1' }),
      createTestEvent({ id: 'list-2' }),
    ];
    renderListView(container, events, 'UTC', {});
    const items = container.querySelectorAll('.already-list-item');
    assert.strictEqual(items[0].dataset.eventId, 'list-1');
    assert.strictEqual(items[1].dataset.eventId, 'list-2');
  });

  it('sorts featured first within same date', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Normal', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Featured', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderListView(container, events, 'UTC', {});
    const titles = [...container.querySelectorAll('.already-list-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Featured');
  });
});
