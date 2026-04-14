const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractDirectives;

before(async () => {
  const mod = await import('../src/util/directives.js');
  extractDirectives = mod.extractDirectives;
});

describe('extractDirectives — platform link directives', () => {
  it('parses #already:instagram:handle into a link token with URL', () => {
    const result = extractDirectives('#already:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
    assert.strictEqual(result.tokens[0].label, 'Follow @savebigbend on Instagram');
    assert.strictEqual(result.tokens[0].url, 'https://instagram.com/savebigbend');
    assert.strictEqual(result.tokens[0].source, 'directive');
    assert.strictEqual(result.description.trim(), '');
  });

  it('is case-insensitive for the prefix (#ALREADY)', () => {
    const result = extractDirectives('#ALREADY:instagram:foo');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:foo');
  });

  it('parses #already:zoom:meetingid', () => {
    const result = extractDirectives('#already:zoom:123456789');
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'zoom:123456789');
    assert.strictEqual(result.tokens[0].label, 'Join Zoom');
    assert.strictEqual(result.tokens[0].url, 'https://zoom.us/j/123456789');
  });

  it('parses #already:discord:invitecode', () => {
    const result = extractDirectives('#already:discord:AbCdEf');
    assert.strictEqual(result.tokens[0].canonicalId, 'discord:AbCdEf');
    assert.strictEqual(result.tokens[0].label, 'Join Discord');
    assert.strictEqual(result.tokens[0].url, 'https://discord.gg/AbCdEf');
  });

  it('parses #already:eventbrite:12345', () => {
    const result = extractDirectives('#already:eventbrite:12345');
    assert.strictEqual(result.tokens[0].canonicalId, 'eventbrite:12345');
    assert.strictEqual(result.tokens[0].label, 'RSVP on Eventbrite');
    assert.strictEqual(result.tokens[0].url, 'https://eventbrite.com/e/12345');
  });
});

describe('extractDirectives — image directives', () => {
  it('parses #already:image:url with normalized canonical ID', () => {
    const result = extractDirectives('#already:image:https://example.com/flyer.png');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].url, 'https://example.com/flyer.png');
    assert.strictEqual(result.tokens[0].source, 'directive');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:example.com/flyer.png');
  });

  it('produces canonical IDs that match URL-extracted images', () => {
    const directive = extractDirectives('#already:image:https://example.com/photo.jpg');
    const { extractImageTokens } = require('../src/util/images.js');
    const extracted = extractImageTokens(
      'Check out https://example.com/photo.jpg',
      { imageExtensions: ['jpg'] }
    );
    assert.strictEqual(directive.tokens[0].canonicalId, extracted.tokens[0].canonicalId);
  });

  it('parses #already:image:drive:ABC123 into a direct lh3 URL', () => {
    const result = extractDirectives('#already:image:drive:ABC123');
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:drive:ABC123');
    assert.strictEqual(result.tokens[0].url, 'https://lh3.googleusercontent.com/d/ABC123');
  });

  it('normalizes Dropbox directive images to match URL-extracted canonical IDs', () => {
    const result = extractDirectives('#already:image:https://www.dropbox.com/scl/fi/abc123/photo.png?dl=0');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:dropbox:abc123/photo.png');
  });
});

describe('extractDirectives — scalar tag directives', () => {
  it('parses #already:tag:fundraiser as scalar tag', () => {
    const result = extractDirectives('#already:tag:fundraiser');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:fundraiser');
    assert.strictEqual(result.tokens[0].metadata.key, 'tag');
    assert.strictEqual(result.tokens[0].metadata.value, 'fundraiser');
  });

  it('parses #already:tag:outdoor', () => {
    const result = extractDirectives('#already:tag:outdoor');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:outdoor');
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
  });
});

describe('extractDirectives — key-value tag directives', () => {
  it('parses #already:cost:$25 as key-value tag', () => {
    const result = extractDirectives('#already:cost:$25');
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:cost:$25');
    assert.strictEqual(result.tokens[0].metadata.key, 'cost');
    assert.strictEqual(result.tokens[0].metadata.value, '$25');
  });

  it('parses #already:rsvp:https://form.com as key-value tag with URL value', () => {
    const result = extractDirectives('#already:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].metadata.key, 'rsvp');
    assert.strictEqual(result.tokens[0].metadata.value, 'https://form.com');
  });

  it('parses #already:capacity:50', () => {
    const result = extractDirectives('#already:capacity:50');
    assert.strictEqual(result.tokens[0].metadata.key, 'capacity');
    assert.strictEqual(result.tokens[0].metadata.value, '50');
  });
});

describe('extractDirectives — description stripping', () => {
  it('strips directive from description', () => {
    const result = extractDirectives('Join us! #already:tag:fundraiser See you there');
    assert.ok(!result.description.includes('#already'));
    assert.ok(result.description.includes('Join us!'));
    assert.ok(result.description.includes('See you there'));
  });

  it('strips multiple directives', () => {
    const result = extractDirectives('#already:tag:outdoor #already:cost:$25 Event info');
    assert.strictEqual(result.tokens.length, 2);
    assert.ok(!result.description.includes('#already'));
    assert.ok(result.description.includes('Event info'));
  });

  it('strips directive wrapped in HTML <a> tag', () => {
    const result = extractDirectives('Info <a href="#">#already:tag:fundraiser</a> here');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'fundraiser');
    assert.ok(!result.description.includes('#already'));
    assert.ok(!result.description.includes('</a>'), 'no orphaned closing tag');
  });

  it('deduplicates identical directives', () => {
    const result = extractDirectives('#already:tag:outdoor #already:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#already'));
  });

  it('deduplicates identical directives across occurrences', () => {
    const result = extractDirectives('#already:tag:outdoor #already:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#already'));
  });
});

describe('extractDirectives — platform aliases', () => {
  it('maps twitter to x canonical prefix', () => {
    const result = extractDirectives('#already:twitter:handle');
    assert.strictEqual(result.tokens[0].canonicalId, 'x:handle');
  });

  it('maps meet to googlemeet canonical prefix', () => {
    const result = extractDirectives('#already:meet:abc-defg-hij');
    assert.strictEqual(result.tokens[0].canonicalId, 'googlemeet:abc-defg-hij');
  });

  it('maps forms to googleforms canonical prefix', () => {
    const result = extractDirectives('#already:forms:abc123');
    assert.strictEqual(result.tokens[0].canonicalId, 'googleforms:abc123');
  });

  it('maps maps to googlemaps canonical prefix', () => {
    const result = extractDirectives('#already:maps:abc123');
    assert.strictEqual(result.tokens[0].canonicalId, 'googlemaps:abc123');
  });
});

describe('extractDirectives — edge cases', () => {
  it('returns empty tokens for null description', () => {
    const result = extractDirectives(null);
    assert.deepStrictEqual(result.tokens, []);
    assert.strictEqual(result.description, null);
  });

  it('returns empty tokens for description with no directives', () => {
    const result = extractDirectives('Just a plain description');
    assert.deepStrictEqual(result.tokens, []);
    assert.strictEqual(result.description, 'Just a plain description');
  });

  it('ignores malformed directive without value', () => {
    const result = extractDirectives('#already:tag');
    assert.deepStrictEqual(result.tokens, []);
  });

  it('strips malformed directive from description even when unparseable', () => {
    const result = extractDirectives('Event info #already:tag more text');
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes('#already'));
    assert.ok(result.description.includes('Event info'));
    assert.ok(result.description.includes('more text'));
  });

  it('decodes &amp; entities before parsing directives', () => {
    const result = extractDirectives('Info #already:tag:free&amp;open');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'free&open');
  });

  it('does not consume HTML closing tags in directive match', () => {
    const result = extractDirectives('<a href="#">#already:tag:outdoor</a>');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
    assert.ok(!result.description.includes('#already'));
    assert.ok(!result.description.includes('</a>'));
  });
});
