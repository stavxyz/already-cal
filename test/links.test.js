const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractLinks, DEFAULT_PLATFORMS, handleAt;

before(async () => {
  const mod = await import('../src/util/links.js');
  extractLinks = mod.extractLinks;
  DEFAULT_PLATFORMS = mod.DEFAULT_PLATFORMS;
  handleAt = mod.handleAt;
});

describe('handleAt — direct unit tests', () => {
  it('returns handle for single-segment profile path', () => {
    assert.strictEqual(handleAt('https://instagram.com/savebigbend'), 'savebigbend');
  });

  it('returns null for multi-segment content path', () => {
    assert.strictEqual(handleAt('https://instagram.com/p/ABC123/'), null);
  });

  it('returns null for bare domain (no path)', () => {
    assert.strictEqual(handleAt('https://www.instagram.com/'), null);
    assert.strictEqual(handleAt('https://www.instagram.com'), null);
  });

  it('strips leading @ from TikTok-style paths', () => {
    assert.strictEqual(handleAt('https://tiktok.com/@myhandle'), 'myhandle');
  });

  it('returns prefixed path for Reddit /r/ and /u/', () => {
    assert.strictEqual(handleAt('https://reddit.com/r/BigBend'), 'r/BigBend');
    assert.strictEqual(handleAt('https://reddit.com/u/someone'), 'u/someone');
  });

  it('returns prefixed path for Facebook /groups/', () => {
    assert.strictEqual(handleAt('https://facebook.com/groups/mygroup'), 'groups/mygroup');
  });

  it('returns null for Reddit post with >2 segments', () => {
    assert.strictEqual(handleAt('https://reddit.com/r/BigBend/comments/abc/post'), null);
  });

  it('returns null for path segments containing dots', () => {
    assert.strictEqual(handleAt('https://example.com/file.html'), null);
  });

  it('returns null for invalid URL', () => {
    assert.strictEqual(handleAt('not-a-url'), null);
  });
});

describe('Instagram link labels', () => {
  it('labels a profile URL with @handle', () => {
    const { links } = extractLinks('https://www.instagram.com/savebigbend/');
    assert.strictEqual(links[0].label, 'Follow @savebigbend on Instagram');
  });

  it('labels a post URL generically (not as a handle)', () => {
    const { links } = extractLinks('https://www.instagram.com/p/DWKAC7uFApK/');
    assert.strictEqual(links[0].label, 'View on Instagram');
  });

  it('labels a reel URL generically', () => {
    const { links } = extractLinks('https://www.instagram.com/reel/ABC123/');
    assert.strictEqual(links[0].label, 'View on Instagram');
  });

  it('labels a stories URL generically', () => {
    const { links } = extractLinks('https://www.instagram.com/stories/someone/123/');
    assert.strictEqual(links[0].label, 'View on Instagram');
  });

  it('labels a bare domain URL generically', () => {
    const { links } = extractLinks('https://www.instagram.com/');
    assert.strictEqual(links[0].label, 'View on Instagram');
  });
});

describe('X/Twitter link labels', () => {
  it('labels a profile URL with @handle', () => {
    const { links } = extractLinks('https://x.com/nobigbendwall');
    assert.strictEqual(links[0].label, 'Follow @nobigbendwall on X');
  });

  it('labels a status URL generically', () => {
    const { links } = extractLinks('https://x.com/user/status/123456');
    assert.strictEqual(links[0].label, 'View on X');
  });
});

describe('Facebook link labels', () => {
  it('labels a profile URL with name', () => {
    const { links } = extractLinks('https://www.facebook.com/savebigbend');
    assert.strictEqual(links[0].label, 'savebigbend on Facebook');
  });

  it('labels a post URL generically', () => {
    const { links } = extractLinks('https://www.facebook.com/savebigbend/posts/123');
    assert.strictEqual(links[0].label, 'View on Facebook');
  });

  it('labels a group URL with group name', () => {
    const { links } = extractLinks('https://www.facebook.com/groups/savebigbend');
    assert.strictEqual(links[0].label, 'groups/savebigbend on Facebook');
  });

  it('labels an event URL generically', () => {
    const { links } = extractLinks('https://www.facebook.com/events/123456');
    assert.strictEqual(links[0].label, 'View on Facebook');
  });
});

describe('Reddit link labels', () => {
  it('labels a subreddit URL', () => {
    const { links } = extractLinks('https://www.reddit.com/r/BigBend');
    assert.strictEqual(links[0].label, 'r/BigBend on Reddit');
  });

  it('labels a user URL', () => {
    const { links } = extractLinks('https://www.reddit.com/u/someone');
    assert.strictEqual(links[0].label, 'u/someone on Reddit');
  });

  it('labels a post URL generically', () => {
    const { links } = extractLinks('https://www.reddit.com/r/BigBend/comments/abc/some_post');
    assert.strictEqual(links[0].label, 'View on Reddit');
  });
});

describe('TikTok link labels', () => {
  it('labels a profile URL with @handle', () => {
    const { links } = extractLinks('https://www.tiktok.com/@savebigbend');
    assert.strictEqual(links[0].label, '@savebigbend on TikTok');
  });

  it('labels a video URL generically', () => {
    const { links } = extractLinks('https://www.tiktok.com/@user/video/123');
    assert.strictEqual(links[0].label, 'View on TikTok');
  });
});

describe('extractLinks — URL stripping', () => {
  it('removes matched platform URL from description', () => {
    const { links, description } = extractLinks('Check this out https://www.eventbrite.com/e/event-123 ok');
    assert.strictEqual(links.length, 1);
    assert.ok(!description.includes('eventbrite.com'));
    assert.ok(description.includes('Check this out'));
  });

  it('returns empty links for description with no platform URLs', () => {
    const { links, description } = extractLinks('Just text https://example.com/page here');
    assert.strictEqual(links.length, 0);
    assert.ok(description.includes('example.com'));
  });
});
