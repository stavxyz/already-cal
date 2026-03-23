const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let extractLinks, DEFAULT_PLATFORMS;

before(async () => {
  const mod = await import('../src/util/links.js');
  extractLinks = mod.extractLinks;
  DEFAULT_PLATFORMS = mod.DEFAULT_PLATFORMS;
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
