// test/featured-hidden.test.js
const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractDirectives, enrichEvent;

before(async () => {
  const dirMod = await import('../src/util/directives.js');
  extractDirectives = dirMod.extractDirectives;
  const dataMod = await import('../src/data.js');
  enrichEvent = dataMod.enrichEvent;
});

// --- extractDirectives flag tests ---

describe('extractDirectives — featured flag', () => {
  it('extracts featured from #showcal:featured', () => {
    const result = extractDirectives('Event info #showcal:featured');
    assert.strictEqual(result.featured, true);
    assert.strictEqual(result.hidden, false);
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(result.description.includes('Event info'));
  });

  it('extracts featured from #showcal:featured', () => {
    const result = extractDirectives('#showcal:featured');
    assert.strictEqual(result.featured, true);
  });

  it('is case-insensitive for the keyword', () => {
    const result = extractDirectives('#showcal:FEATURED');
    assert.strictEqual(result.featured, true);
  });
});

describe('extractDirectives — hidden flag', () => {
  it('extracts hidden from #showcal:hidden', () => {
    const result = extractDirectives('#showcal:hidden Event info');
    assert.strictEqual(result.hidden, true);
    assert.strictEqual(result.featured, false);
    assert.deepStrictEqual(result.tokens, []);
  });

  it('extracts hidden from #showcal:hidden', () => {
    const result = extractDirectives('#showcal:hidden');
    assert.strictEqual(result.hidden, true);
  });
});

describe('extractDirectives — featured/hidden interaction', () => {
  it('handles both featured and hidden in same description', () => {
    const result = extractDirectives('#showcal:featured #showcal:hidden');
    assert.strictEqual(result.featured, true);
    assert.strictEqual(result.hidden, true);
  });

  it('coexists with other directives without consuming them', () => {
    const result = extractDirectives('#showcal:featured #showcal:tag:outdoor');
    assert.strictEqual(result.featured, true);
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
  });

  it('featured/hidden are not added to tokens', () => {
    const result = extractDirectives('#showcal:featured #showcal:hidden');
    assert.deepStrictEqual(result.tokens, []);
  });

  it('returns false flags for plain description', () => {
    const result = extractDirectives('Just text');
    assert.strictEqual(result.featured, false);
    assert.strictEqual(result.hidden, false);
  });

  it('returns false flags for null description', () => {
    const result = extractDirectives(null);
    assert.strictEqual(result.featured, false);
    assert.strictEqual(result.hidden, false);
  });
});

// --- enrichEvent flag propagation tests ---

describe('enrichEvent — featured/hidden propagation', () => {
  const baseEvent = {
    id: '1',
    title: 'Test',
    start: '2026-04-15T10:00:00Z',
    end: '2026-04-15T11:00:00Z',
  };

  it('sets event.featured from #showcal:featured directive', () => {
    const event = enrichEvent({ ...baseEvent, description: '#showcal:featured' }, {});
    assert.strictEqual(event.featured, true);
    assert.strictEqual(event.hidden, false);
  });

  it('sets event.hidden from #showcal:hidden directive', () => {
    const event = enrichEvent({ ...baseEvent, description: '#showcal:hidden' }, {});
    assert.strictEqual(event.hidden, true);
    assert.strictEqual(event.featured, false);
  });

  it('featured directive is consumed — not in description or tags', () => {
    const event = enrichEvent({
      ...baseEvent,
      description: '#showcal:featured #showcal:tag:outdoor',
    }, {});
    assert.strictEqual(event.featured, true);
    assert.ok(!event.description.includes('#showcal:featured'));
    assert.strictEqual(event.tags.length, 1);
    assert.strictEqual(event.tags[0].value, 'outdoor');
  });

  it('hidden directive is consumed — not in description or tags', () => {
    const event = enrichEvent({
      ...baseEvent,
      description: '#showcal:hidden Some text',
    }, {});
    assert.strictEqual(event.hidden, true);
    assert.ok(!event.description.includes('#showcal:hidden'));
    assert.ok(event.description.includes('Some text'));
  });

  it('preserves pre-set featured flag from event data', () => {
    const event = enrichEvent({ ...baseEvent, featured: true, description: '' }, {});
    assert.strictEqual(event.featured, true);
  });

  it('defaults featured and hidden to false when no directives', () => {
    const event = enrichEvent({ ...baseEvent, description: 'Plain text' }, {});
    assert.strictEqual(event.featured, false);
    assert.strictEqual(event.hidden, false);
  });
});
