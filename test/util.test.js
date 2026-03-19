const { describe, it } = require('node:test');
const assert = require('node:assert');

describe('dates', () => {
  it('formats a datetime in a given timezone', () => {
    const dt = '2026-04-04T16:00:00-05:00';
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    });
    const result = fmt.format(new Date(dt));
    assert.strictEqual(result, 'Saturday, April 4, 2026');
  });

  it('formats time in a given timezone', () => {
    const dt = '2026-04-04T16:00:00-05:00';
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric', minute: '2-digit',
    });
    const result = fmt.format(new Date(dt));
    assert.strictEqual(result, '4:00 PM');
  });

  it('gets days in month correctly', () => {
    const d = new Date(2026, 3, 1);
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    assert.strictEqual(daysInMonth, 30);
  });

  it('gets first day of month (day of week)', () => {
    const d = new Date(2026, 3, 1);
    assert.strictEqual(d.getDay(), 3);
  });
});

describe('image extraction', () => {
  it('extracts image URL from text', () => {
    const text = 'Check out this event https://example.com/flyer.png more details';
    const pattern = /(?:^|\s)(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)(?:\s|$)/i;
    const match = text.match(pattern);
    assert.ok(match);
    assert.strictEqual(match[1], 'https://example.com/flyer.png');
  });

  it('does not match non-image URLs', () => {
    const text = 'Visit https://example.com/page for info';
    const pattern = /(?:^|\s)(https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)(?:\s|$)/i;
    assert.strictEqual(text.match(pattern), null);
  });
});

describe('link extraction', () => {
  it('detects Eventbrite URLs', () => {
    const url = 'https://www.eventbrite.com/e/save-big-bend-tickets-123';
    assert.ok(/eventbrite\.com/i.test(url));
  });

  it('detects Google Forms URLs', () => {
    const url = 'https://docs.google.com/forms/d/e/abc123/viewform';
    assert.ok(/docs\.google\.com\/forms/i.test(url));
  });
});

describe('description format detection', () => {
  it('detects HTML', () => {
    assert.ok(/<\/?[a-z][a-z0-9]*[\s>]/i.test('<p>Hello</p>'));
    assert.ok(/<\/?[a-z][a-z0-9]*[\s>]/i.test('<strong>bold</strong>'));
  });

  it('detects markdown', () => {
    const md = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;
    assert.ok(md.test('## Heading'));
    assert.ok(md.test('**bold**'));
    assert.ok(md.test('[link](http://example.com)'));
  });

  it('returns plain for plain text', () => {
    const html = /<\/?[a-z][a-z0-9]*[\s>]/i;
    const md = /(?:^|\n)#{1,6}\s|(?:^|\n)[-*]\s|\*\*|__|\[.+?\]\(.+?\)/;
    const text = 'Just a normal description of an event';
    assert.ok(!html.test(text));
    assert.ok(!md.test(text));
  });
});
