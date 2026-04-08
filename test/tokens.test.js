const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let TokenSet, normalizeUrl;

before(async () => {
  const mod = await import('../src/util/tokens.js');
  TokenSet = mod.TokenSet;
  normalizeUrl = mod.normalizeUrl;
});

describe('TokenSet', () => {
  it('accepts a token and retrieves it by type', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'instagram:foo', type: 'link', source: 'url', url: 'https://instagram.com/foo', label: 'Follow @foo on Instagram', metadata: {} });
    const links = ts.ofType('link');
    assert.strictEqual(links.length, 1);
    assert.strictEqual(links[0].canonicalId, 'instagram:foo');
  });

  it('rejects duplicate canonicalId and returns false', () => {
    const ts = new TokenSet();
    const token = { canonicalId: 'instagram:foo', type: 'link', source: 'url', url: 'https://instagram.com/foo', label: 'Follow @foo', metadata: {} };
    assert.strictEqual(ts.add(token), true);
    assert.strictEqual(ts.add({ ...token, url: 'https://www.instagram.com/foo/' }), false);
    assert.strictEqual(ts.ofType('link').length, 1);
  });

  it('addAll adds multiple tokens and deduplicates', () => {
    const ts = new TokenSet();
    ts.addAll([
      { canonicalId: 'instagram:a', type: 'link', source: 'url', url: 'u1', label: 'l1', metadata: {} },
      { canonicalId: 'instagram:b', type: 'link', source: 'url', url: 'u2', label: 'l2', metadata: {} },
      { canonicalId: 'instagram:a', type: 'link', source: 'directive', url: 'u3', label: 'l3', metadata: {} },
    ]);
    assert.strictEqual(ts.ofType('link').length, 2);
  });

  it('filters by type correctly across mixed types', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'instagram:x', type: 'link', source: 'url', url: 'u', label: 'l', metadata: {} });
    ts.add({ canonicalId: 'image:y.png', type: 'image', source: 'url', url: 'u2', label: 'img', metadata: {} });
    ts.add({ canonicalId: 'tag:outdoor', type: 'tag', source: 'directive', url: null, label: 'outdoor', metadata: { key: 'tag', value: 'outdoor' } });
    assert.strictEqual(ts.ofType('link').length, 1);
    assert.strictEqual(ts.ofType('image').length, 1);
    assert.strictEqual(ts.ofType('tag').length, 1);
  });

  it('preserves insertion order', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'a', type: 'link', source: 'url', url: '1', label: 'first', metadata: {} });
    ts.add({ canonicalId: 'b', type: 'link', source: 'url', url: '2', label: 'second', metadata: {} });
    const links = ts.ofType('link');
    assert.strictEqual(links[0].label, 'first');
    assert.strictEqual(links[1].label, 'second');
  });

  it('has() returns true for existing canonicalId', () => {
    const ts = new TokenSet();
    ts.add({ canonicalId: 'instagram:foo', type: 'link', source: 'url', url: 'u', label: 'l', metadata: {} });
    assert.strictEqual(ts.has('instagram:foo'), true);
    assert.strictEqual(ts.has('instagram:bar'), false);
  });

  it('size reflects the number of unique tokens', () => {
    const ts = new TokenSet();
    assert.strictEqual(ts.size, 0);
    ts.add({ canonicalId: 'a', type: 'link', source: 'url', url: 'u', label: 'l', metadata: {} });
    assert.strictEqual(ts.size, 1);
    ts.add({ canonicalId: 'a', type: 'link', source: 'url', url: 'u2', label: 'l2', metadata: {} });
    assert.strictEqual(ts.size, 1);
    ts.add({ canonicalId: 'b', type: 'link', source: 'url', url: 'u3', label: 'l3', metadata: {} });
    assert.strictEqual(ts.size, 2);
  });
});

describe('normalizeUrl', () => {
  it('strips www. prefix', () => {
    assert.strictEqual(normalizeUrl('https://www.instagram.com/foo'), 'https://instagram.com/foo');
  });

  it('normalizes http to https', () => {
    assert.strictEqual(normalizeUrl('http://instagram.com/foo'), 'https://instagram.com/foo');
  });

  it('removes trailing slash', () => {
    assert.strictEqual(normalizeUrl('https://instagram.com/foo/'), 'https://instagram.com/foo');
  });

  it('strips utm_* params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?utm_source=twitter&utm_medium=social'), 'https://example.com/page');
  });

  it('strips fbclid param', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?fbclid=abc123'), 'https://example.com/page');
  });

  it('strips si param', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?si=abc'), 'https://example.com/page');
  });

  it('preserves non-tracking params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?id=5&ref=home'), 'https://example.com/page?id=5&ref=home');
  });

  it('handles multiple tracking and non-tracking params', () => {
    assert.strictEqual(normalizeUrl('https://example.com/page?id=5&utm_source=x&keep=1&fbclid=abc'), 'https://example.com/page?id=5&keep=1');
  });

  it('returns the URL unchanged if already normalized', () => {
    assert.strictEqual(normalizeUrl('https://instagram.com/foo'), 'https://instagram.com/foo');
  });

  it('handles URLs without path', () => {
    assert.strictEqual(normalizeUrl('https://www.example.com'), 'https://example.com');
  });

  it('handles invalid URLs gracefully', () => {
    assert.strictEqual(normalizeUrl('not-a-url'), 'not-a-url');
  });
});
