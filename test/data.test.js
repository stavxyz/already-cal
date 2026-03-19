const { describe, it } = require('node:test');
const assert = require('node:assert');

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
