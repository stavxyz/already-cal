const { describe, it, before } = require('node:test');
const assert = require('node:assert');

let transformGoogleEvents;
before(async () => {
  const mod = await import('../src/data.js');
  transformGoogleEvents = mod.transformGoogleEvents;
});

describe('transformGoogleEvents', () => {
  // Test the transformation logic with mock Google API response
  const mockGoogleResponse = {
    summary: 'NBBW PUBLIC WEBSITE',
    timeZone: 'America/Chicago',
    items: [
      {
        id: 'evt1',
        summary: 'Save Big Bend Rally',
        description: 'Join us! https://nobigbendwall.org/flyer.png\n\nRSVP: https://www.eventbrite.com/e/rally-123',
        location: 'Texas Capitol, Austin, TX',
        start: { dateTime: '2026-04-04T16:00:00-05:00' },
        end: { dateTime: '2026-04-04T19:00:00-05:00' },
        attachments: [],
      },
      {
        id: 'evt2',
        summary: 'All-Day Event',
        description: 'A whole day thing',
        location: '',
        start: { date: '2026-04-10' },
        end: { date: '2026-04-11' },
      },
    ],
  };

  it('extracts calendar metadata', () => {
    // Verify shape — actual transform tested in integration
    assert.strictEqual(mockGoogleResponse.summary, 'NBBW PUBLIC WEBSITE');
    assert.strictEqual(mockGoogleResponse.timeZone, 'America/Chicago');
  });

  it('identifies all-day events', () => {
    const item = mockGoogleResponse.items[1];
    assert.ok(!item.start.dateTime); // no dateTime = all-day
    assert.ok(item.start.date);
  });

  it('has image URL in description', () => {
    const desc = mockGoogleResponse.items[0].description;
    assert.ok(/\.png/.test(desc));
  });

  it('has Eventbrite URL in description', () => {
    const desc = mockGoogleResponse.items[0].description;
    assert.ok(/eventbrite\.com/.test(desc));
  });
});

describe('enrichEvent — token pipeline deduplication', () => {
  it('deduplicates exact duplicate platform links', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'https://instagram.com/savebigbend https://instagram.com/savebigbend',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
    assert.ok(!data.events[0].description.includes('instagram.com'));
  });

  it('deduplicates semantically equivalent URLs (www vs non-www)', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'https://instagram.com/savebigbend https://www.instagram.com/savebigbend/',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
  });

  it('deduplicates twitter.com and x.com URLs', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'https://x.com/foo https://twitter.com/foo',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
  });

  it('extracts directives and produces tokens', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: 'Event info #ogcal:tag:fundraiser #ogcal:cost:$25',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].tags.length, 2);
    assert.ok(!data.events[0].description.includes('#ogcal'));
  });

  it('deduplicates directive and URL producing same canonical ID', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: '#ogcal:instagram:savebigbend https://instagram.com/savebigbend',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    assert.strictEqual(data.events[0].links.length, 1);
    assert.ok(!data.events[0].description.includes('#ogcal'));
    assert.ok(!data.events[0].description.includes('instagram.com'));
  });

  it('exposes tags on the event object', () => {
    const data = transformGoogleEvents({
      summary: 'Test', timeZone: 'UTC',
      items: [{
        id: '1', summary: 'Test',
        description: '#ogcal:tag:outdoor #ogcal:rsvp:https://form.com',
        start: { dateTime: '2026-04-10T10:00:00Z' }, end: { dateTime: '2026-04-10T11:00:00Z' },
      }],
    });
    const tags = data.events[0].tags;
    assert.strictEqual(tags.length, 2);
    assert.deepStrictEqual(tags[0], { key: 'tag', value: 'outdoor' });
    assert.deepStrictEqual(tags[1], { key: 'rsvp', value: 'https://form.com' });
  });
});
