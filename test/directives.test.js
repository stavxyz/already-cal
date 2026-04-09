const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractDirectives;

before(async () => {
  const mod = await import('../src/util/directives.js');
  extractDirectives = mod.extractDirectives;
});

describe('extractDirectives — platform link directives', () => {
  it('parses #showcal:instagram:handle into a link token with URL', () => {
    const result = extractDirectives('#showcal:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
    assert.strictEqual(result.tokens[0].label, 'Follow @savebigbend on Instagram');
    assert.strictEqual(result.tokens[0].url, 'https://instagram.com/savebigbend');
    assert.strictEqual(result.tokens[0].source, 'directive');
    assert.strictEqual(result.description.trim(), '');
  });

  it('parses #ogcal:instagram:handle (backwards-compat alias)', () => {
    const result = extractDirectives('#ogcal:instagram:savebigbend');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:savebigbend');
  });

  it('is case-insensitive for the prefix (#OGCAL alias)', () => {
    const result = extractDirectives('#OGCAL:instagram:foo');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].canonicalId, 'instagram:foo');
  });

  it('parses #showcal:zoom:meetingid', () => {
    const result = extractDirectives('#showcal:zoom:123456789');
    assert.strictEqual(result.tokens[0].type, 'link');
    assert.strictEqual(result.tokens[0].canonicalId, 'zoom:123456789');
    assert.strictEqual(result.tokens[0].label, 'Join Zoom');
    assert.strictEqual(result.tokens[0].url, 'https://zoom.us/j/123456789');
  });

  it('parses #showcal:discord:invitecode', () => {
    const result = extractDirectives('#showcal:discord:AbCdEf');
    assert.strictEqual(result.tokens[0].canonicalId, 'discord:AbCdEf');
    assert.strictEqual(result.tokens[0].label, 'Join Discord');
    assert.strictEqual(result.tokens[0].url, 'https://discord.gg/AbCdEf');
  });

  it('parses #showcal:eventbrite:12345', () => {
    const result = extractDirectives('#showcal:eventbrite:12345');
    assert.strictEqual(result.tokens[0].canonicalId, 'eventbrite:12345');
    assert.strictEqual(result.tokens[0].label, 'RSVP on Eventbrite');
    assert.strictEqual(result.tokens[0].url, 'https://eventbrite.com/e/12345');
  });
});

describe('extractDirectives — image directives', () => {
  it('parses #showcal:image:url', () => {
    const result = extractDirectives('#showcal:image:https://example.com/flyer.png');
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
  it('parses #showcal:tag:fundraiser as scalar tag', () => {
    const result = extractDirectives('#showcal:tag:fundraiser');
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
  it('parses #showcal:cost:$25 as key-value tag', () => {
    const result = extractDirectives('#showcal:cost:$25');
    assert.strictEqual(result.tokens[0].type, 'tag');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:cost:$25');
    assert.strictEqual(result.tokens[0].metadata.key, 'cost');
    assert.strictEqual(result.tokens[0].metadata.value, '$25');
  });

  it('parses #showcal:rsvp:https://form.com as key-value tag with URL value', () => {
    const result = extractDirectives('#showcal:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].canonicalId, 'tag:rsvp:https://form.com');
    assert.strictEqual(result.tokens[0].metadata.key, 'rsvp');
    assert.strictEqual(result.tokens[0].metadata.value, 'https://form.com');
  });

  it('parses #showcal:capacity:50', () => {
    const result = extractDirectives('#showcal:capacity:50');
    assert.strictEqual(result.tokens[0].metadata.key, 'capacity');
    assert.strictEqual(result.tokens[0].metadata.value, '50');
  });
});

describe('extractDirectives — description stripping', () => {
  it('strips directive from description', () => {
    const result = extractDirectives('Join us! #showcal:tag:fundraiser See you there');
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(result.description.includes('Join us!'));
    assert.ok(result.description.includes('See you there'));
  });

  it('strips multiple directives', () => {
    const result = extractDirectives('#showcal:tag:outdoor #showcal:cost:$25 Event info');
    assert.strictEqual(result.tokens.length, 2);
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(result.description.includes('Event info'));
  });

  it('strips directive wrapped in HTML <a> tag', () => {
    const result = extractDirectives('Info <a href="#">#showcal:tag:fundraiser</a> here');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'fundraiser');
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(!result.description.includes('</a>'), 'no orphaned closing tag');
  });

  it('deduplicates identical directives', () => {
    const result = extractDirectives('#showcal:tag:outdoor #showcal:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#showcal'));
  });

  it('deduplicates across prefixes (showcal and showcal)', () => {
    const result = extractDirectives('#showcal:tag:outdoor #showcal:tag:outdoor');
    assert.strictEqual(result.tokens.length, 1);
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(!result.description.includes('#showcal'));
  });
});

describe('extractDirectives — platform aliases', () => {
  it('maps twitter to x canonical prefix', () => {
    const result = extractDirectives('#showcal:twitter:handle');
    assert.strictEqual(result.tokens[0].canonicalId, 'x:handle');
  });

  it('maps meet to googlemeet canonical prefix', () => {
    const result = extractDirectives('#showcal:meet:abc-defg-hij');
    assert.strictEqual(result.tokens[0].canonicalId, 'googlemeet:abc-defg-hij');
  });

  it('maps forms to googleforms canonical prefix', () => {
    const result = extractDirectives('#showcal:forms:abc123');
    assert.strictEqual(result.tokens[0].canonicalId, 'googleforms:abc123');
  });

  it('maps maps to googlemaps canonical prefix', () => {
    const result = extractDirectives('#showcal:maps:abc123');
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
    const result = extractDirectives('#showcal:tag');
    assert.deepStrictEqual(result.tokens, []);
  });

  it('strips malformed directive from description even when unparseable', () => {
    const result = extractDirectives('Event info #showcal:tag more text');
    assert.deepStrictEqual(result.tokens, []);
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(result.description.includes('Event info'));
    assert.ok(result.description.includes('more text'));
  });

  it('decodes &amp; entities before parsing directives', () => {
    const result = extractDirectives('Info #showcal:tag:free&amp;open');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'free&open');
  });

  it('does not consume HTML closing tags in directive match', () => {
    const result = extractDirectives('<a href="#">#showcal:tag:outdoor</a>');
    assert.strictEqual(result.tokens.length, 1);
    assert.strictEqual(result.tokens[0].metadata.value, 'outdoor');
    assert.ok(!result.description.includes('#showcal'));
    assert.ok(!result.description.includes('</a>'));
  });
});
