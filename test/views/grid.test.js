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
    const cards = container.querySelectorAll('.showcal-grid-card');
    assert.strictEqual(cards.length, 2);
  });

  it('displays event title via textContent', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ title: 'Concert <script>alert(1)</script>' })];
    renderGridView(container, events, 'UTC', {});
    const title = container.querySelector('.showcal-grid-title');
    assert.strictEqual(title.textContent, 'Concert <script>alert(1)</script>');
    assert.ok(!title.innerHTML.includes('<script>'));
  });

  it('displays event location', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: 'Central Park' })];
    renderGridView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.showcal-grid-location').textContent, 'Central Park');
  });

  it('omits location when empty', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ location: '' })];
    renderGridView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.showcal-grid-location'), null);
  });

  it('renders image when present', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ image: 'https://example.com/img.jpg' })];
    renderGridView(container, events, 'UTC', {});
    const img = container.querySelector('.showcal-grid-image img');
    assert.ok(img);
    assert.strictEqual(img.getAttribute('loading'), 'lazy');
  });

  it('omits image container when no image', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ image: null })];
    renderGridView(container, events, 'UTC', {});
    assert.strictEqual(container.querySelector('.showcal-grid-image'), null);
  });

  it('navigates to detail on click', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ id: 'click-test' })];
    renderGridView(container, events, 'UTC', {});
    container.querySelector('.showcal-grid-card').click();
    assert.strictEqual(window.location.hash, '#event/click-test');
  });

  it('sets accessibility attributes', () => {
    const container = document.createElement('div');
    const events = [createTestEvent()];
    renderGridView(container, events, 'UTC', {});
    const card = container.querySelector('.showcal-grid-card');
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
    const cards = container.querySelectorAll('.showcal-grid-card');
    assert.strictEqual(cards.length, 1);
    assert.strictEqual(cards[0].querySelector('.showcal-grid-title').textContent, 'Visible');
  });

  it('adds --featured class to featured events', () => {
    const container = document.createElement('div');
    const events = [createTestEvent({ featured: true })];
    renderGridView(container, events, 'UTC', {});
    assert.ok(container.querySelector('.showcal-grid-card--featured'));
  });

  it('sorts featured events first within same date', () => {
    const container = document.createElement('div');
    const events = [
      createTestEvent({ id: '1', title: 'Regular', start: '2026-04-15T10:00:00Z' }),
      createTestEvent({ id: '2', title: 'Star', start: '2026-04-15T14:00:00Z', featured: true }),
    ];
    renderGridView(container, events, 'UTC', {});
    const titles = [...container.querySelectorAll('.showcal-grid-title')].map(t => t.textContent);
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
    const titles = [...container.querySelectorAll('.showcal-grid-title')].map(t => t.textContent);
    assert.strictEqual(titles[0], 'Apr14');
    assert.strictEqual(titles[1], 'Apr15-Star');
  });
});
