const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractDirectives;

before(async () => {
  const mod = await import('../src/util/directives.js');
  extractDirectives = mod.extractDirectives;
});

describe('extractDirectives — platform link directives', () => {
  it('parses #ogcal:instagram:handle into a link token with URL', () => {
    const result = extractDirectives('#ogcal:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
    assert.strictEqual(result.tokens[0].label, 'Follow @savebigbend on Instagram');
    assert.strictEqual(result.tokens[0].url, 'https://instagram.com/savebigbend');
    assert.strictEqual(result.tokens[0].source, 'directive');
    assert.strictEqual(result.description.trim(), '');
  });

  it('parses #showcal:instagram:handle (showcal prefix)', () => {
    const result = extractDirectives('#showcal:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
  });

  it('is case-insensitive for the prefix', () => {
    const result = extractDirectives('#OGCAL:instagram:foo');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:foo');
  });

  it('parses #ogcal:zoom:meetingid', () => {
    const result = extractDirectives('#ogcal:zoom:123456789');
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'zoom:123456789');
    assert.strictEqual(result.tokens[0].label, 'Join Zoom');
    assert.strictEqual(result.tokens[0].url, 'https://zoom.us/j/123456789');
  });

  it('parses #ogcal:discord:invitecode', () => {
    const result = extractDirectives('#ogcal:discord:AbCdEf');
    assert.strictEqual(result.tokens[0].canonicalId, 'discord:AbCdEf');
    assert.strictEqual(result.tokens[0].label, 'Join Discord');
    assert.strictEqual(result.tokens[0].url, 'https://discord.gg/AbCdEf');
  });

  it('parses #ogcal:eventbrite:12345', () => {
    const result = extractDirectives('#ogcal:eventbrite:12345');
    assert.strictEqual(result.tokens[0].canonicalId, 'eventbrite:12345');
    assert.strictEqual(result.tokens[0].label, 'RSVP on Eventbrite');
    assert.strictEqual(result.tokens[0].url, 'https://eventbrite.com/e/12345');
  });
});

describe('extractDirectives — image directives', () => {
  it('parses #ogcal:image:url', () => {
    const result = extractDirectives('#ogcal:image:https://example.com/flyer.png');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].url, 'https://example.com/flyer.png');
    assert.strictEqual(result.tokens[0].source, 'directive');
  });

  it('parses #showcal:image:drive:ABC123 into a direct lh3 URL', () => {
    const result = extractDirectives('#showcal:image:drive:ABC123');
    assert.strictEqual(result.tokens[0].type, 'image');
    assert.strictEqual(result.tokens[0].canonicalId, 'image:drive:ABC123');
    assert.strictEqual(result.tokens[0].url, 'https://lh3.googleusercontent.com/d/ABC123');
  });
});

describe('extractDirectives — scalar tag directives', () => {
  it('parses #ogcal:tag:fundraiser as scalar tag', () => {
    const result = extractDirectives('#ogcal:tag:fundraiser');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:fundraiser');
    assert.strictEqual(result.tokens[0].metadata.key, 'tag');
    assert.strictEqual(result.tokens[0].metadata.value, 'fundraiser');
  });

  it('parses #showcal:tag:outdoor', () => {
    const result = extractDirectives('#showcal:tag:outdoor');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:outdoor');
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
  });
});

describe('extractDirectives — key-value tag directives', () => {
  it('parses #ogcal:cost:$25 as key-value tag', () => {
    const result = extractDirectives('#ogcal:cost:$25');
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:cost:$25');
    assert.strictEqual(result.tokens[0].metadata.key, 'cost');
    assert.strictEqual(result.tokens[0].metadata.value, '$25');
  });

  it('parses #ogcal:rsvp:https://form.com as key-value tag with URL value', () => {
    const result = extractDirectives('#ogcal:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].metadata.key, 'rsvp');
    assert.strictEqual(result.tokens[0].metadata.value, 'https://form.com');
  });

  it('parses #ogcal:capacity:50', () => {
    const result = extractDirectives('#ogcal:capacity:50');
    assert.strictEqual(result.tokens[0].metadata.key, 'capacity');
    assert.strictEqual(result.tokens[0].metadata.value, '50');
  });
});

describe('extractDirectives — description stripping', () => {
  it('strips directive from description', () => {
    const result = extractDirectives('Join us! #ogcal:tag:fundraiser See you there');
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(result.description.includes('Join us!'));
    assert.ok(result.description.includes('See you there'));
  });

  it('strips multiple directives', () => {
    const result = extractDirectives('#ogcal:tag:outdoor #showcal:cost:$25 Event info');
    assert.strictEqual(result.tokens.length, 2);
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(result.description.includes('Event info'));
  });

  it('strips directive wrapped in HTML <a> tag', () => {
    const result = extractDirectives('Info <a href="#">#ogcal:tag:fundraiser</a> here');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'fundraiser');
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(!result.description.includes('</a>'), 'no orphaned closing tag');
  });

  it('deduplicates identical directives', () => {
    const result = extractDirectives('#ogcal:tag:outdoor #ogcal:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#ogcal'));
  });

  it('deduplicates across prefixes (ogcal and showcal)', () => {
    const result = extractDirectives('#ogcal:tag:outdoor #showcal:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(!result.description.includes('#showcal'));
  });
});

describe('extractDirectives — platform aliases', () => {
  it('maps twitter to x canonical prefix', () => {
    const result = extractDirectives('#ogcal:twitter:handle');
    assert.strictEqual(result.tokens[0].canonicalId, 'x:handle');
  });

  it('maps meet to googlemeet canonical prefix', () => {
    const result = extractDirectives('#ogcal:meet:abc-defg-hij');
    assert.strictEqual(result.tokens[0].canonicalId, 'googlemeet:abc-defg-hij');
  });

  it('maps forms to googleforms canonical prefix', () => {
    const result = extractDirectives('#ogcal:forms:abc123');
    assert.strictEqual(result.tokens[0].canonicalId, 'googleforms:abc123');
  });

  it('maps maps to googlemaps canonical prefix', () => {
    const result = extractDirectives('#ogcal:maps:abc123');
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
    const result = extractDirectives('#ogcal:tag');
    assert.deepStrictEqual(result.tokens, []);
  });

  it('strips malformed directive from description even when unparseable', () => {
    const result = extractDirectives('Event info #ogcal:tag more text');
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(result.description.includes('Event info'));
    assert.ok(result.description.includes('more text'));
  });

  it('does not consume HTML closing tags in directive match', () => {
    const result = extractDirectives('<a href="#">#ogcal:tag:outdoor</a>');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
    assert.ok(!result.description.includes('#ogcal'));
    assert.ok(!result.description.includes('</a>'));
  });
});
