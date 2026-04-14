require('../setup-dom.cjs');
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let resolveSticky, applyStickyClasses, updateStickyOffsets;

before(async () => {
  const mod = await import('../../src/ui/sticky.js');
  resolveSticky = mod.resolveSticky;
  applyStickyClasses = mod.applyStickyClasses;
  updateStickyOffsets = mod.updateStickyOffsets;
});

describe('resolveSticky', () => {
  it('returns all true when config is true', () => {
    const result = resolveSticky(true);
    assert.deepStrictEqual(result, { header: true, viewSelector: true, tagFilter: true });
  });

  it('returns all true when config is undefined', () => {
    const result = resolveSticky(undefined);
    assert.deepStrictEqual(result, { header: true, viewSelector: true, tagFilter: true });
  });

  it('returns all false when config is false', () => {
    const result = resolveSticky(false);
    assert.deepStrictEqual(result, { header: false, viewSelector: false, tagFilter: false });
  });

  it('accepts granular object', () => {
    const result = resolveSticky({ header: false, viewSelector: true, tagFilter: true });
    assert.deepStrictEqual(result, { header: false, viewSelector: true, tagFilter: true });
  });

  it('defaults missing keys to true in granular object', () => {
    const result = resolveSticky({ header: false });
    assert.deepStrictEqual(result, { header: false, viewSelector: true, tagFilter: true });
  });

  it('returns all true for non-boolean, non-object values', () => {
    const result = resolveSticky('yes');
    assert.deepStrictEqual(result, { header: true, viewSelector: true, tagFilter: true });
  });
});

describe('applyStickyClasses', () => {
  it('adds already-sticky class to enabled containers', () => {
    const h = document.createElement('div');
    const s = document.createElement('div');
    const t = document.createElement('div');
    applyStickyClasses({ header: true, viewSelector: true, tagFilter: true }, h, s, t);
    assert.ok(h.classList.contains('already-sticky'));
    assert.ok(s.classList.contains('already-sticky'));
    assert.ok(t.classList.contains('already-sticky'));
  });

  it('does not add already-sticky to disabled containers', () => {
    const h = document.createElement('div');
    const s = document.createElement('div');
    const t = document.createElement('div');
    applyStickyClasses({ header: false, viewSelector: true, tagFilter: false }, h, s, t);
    assert.ok(!h.classList.contains('already-sticky'));
    assert.ok(s.classList.contains('already-sticky'));
    assert.ok(!t.classList.contains('already-sticky'));
  });

  it('removes already-sticky when toggled off', () => {
    const h = document.createElement('div');
    h.classList.add('already-sticky');
    const s = document.createElement('div');
    const t = document.createElement('div');
    applyStickyClasses({ header: false, viewSelector: false, tagFilter: false }, h, s, t);
    assert.ok(!h.classList.contains('already-sticky'));
  });
});

describe('updateStickyOffsets', () => {
  it('sets top:0px on the first sticky container', () => {
    const h = document.createElement('div');
    h.classList.add('already-sticky');
    const s = document.createElement('div');
    const t = document.createElement('div');
    updateStickyOffsets({ header: true, viewSelector: false, tagFilter: false }, h, s, t);
    assert.strictEqual(h.style.top, '0px');
  });

  it('does not set top on non-sticky containers', () => {
    const h = document.createElement('div');
    const s = document.createElement('div');
    const t = document.createElement('div');
    updateStickyOffsets({ header: false, viewSelector: false, tagFilter: false }, h, s, t);
    assert.strictEqual(h.style.top, '');
    assert.strictEqual(s.style.top, '');
  });
});
