require('../setup-dom.cjs');
const { describe, it, before, beforeEach } = require('node:test');
const assert = require('node:assert');

let renderViewSelector;

before(async () => {
  const mod = await import('../../src/ui/view-selector.js');
  renderViewSelector = mod.renderViewSelector;
});

beforeEach(() => {
  window.location.hash = '';
});

describe('renderViewSelector icons', () => {
  it('renders an SVG icon in each tab', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'week', 'day', 'grid', 'list'], 'month', false, {});
    const tabs = container.querySelectorAll('.already-view-tab');
    for (const tab of tabs) {
      const svg = tab.querySelector('svg');
      assert.ok(svg, `tab "${tab.textContent.trim()}" should contain an SVG icon`);
    }
  });

  it('sets aria-hidden on each icon', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'list'], 'month', false, {});
    const svgs = container.querySelectorAll('.already-view-tab svg');
    for (const svg of svgs) {
      assert.strictEqual(svg.getAttribute('aria-hidden'), 'true');
    }
  });

  it('uses stroke="currentColor" on each icon', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'week', 'day', 'grid', 'list'], 'month', false, {});
    const svgs = container.querySelectorAll('.already-view-tab svg');
    for (const svg of svgs) {
      assert.strictEqual(svg.getAttribute('stroke'), 'currentColor');
    }
  });

  it('renders icon before text label', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month'], 'month', false, {});
    const tab = container.querySelector('.already-view-tab');
    assert.strictEqual(tab.firstChild.tagName, 'svg');
  });

  it('preserves existing tab behavior (active class, role)', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['month', 'list'], 'list', false, {});
    const activeTab = container.querySelector('.already-view-tab--active');
    assert.ok(activeTab);
    assert.strictEqual(activeTab.textContent.trim(), 'List');
    assert.strictEqual(activeTab.getAttribute('role'), 'tab');
    assert.strictEqual(activeTab.getAttribute('aria-selected'), 'true');
  });

  it('renders icons for custom view subsets', () => {
    const container = document.createElement('div');
    renderViewSelector(container, ['grid', 'list'], 'grid', false, {});
    const svgs = container.querySelectorAll('.already-view-tab svg');
    assert.strictEqual(svgs.length, 2);
  });
});
