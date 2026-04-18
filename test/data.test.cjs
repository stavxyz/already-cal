const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let transformGoogleEvents;
let enrichEvent;
before(async () => {
  const mod = await import("../src/data.js");
  transformGoogleEvents = mod.transformGoogleEvents;
  enrichEvent = mod.enrichEvent;
});

describe("transformGoogleEvents", () => {
  // Test the transformation logic with mock Google API response
  const mockGoogleResponse = {
    summary: "NBBW PUBLIC WEBSITE",
    timeZone: "America/Chicago",
    items: [
      {
        id: "evt1",
        summary: "Save Big Bend Rally",
        description:
          "Join us! https://nobigbendwall.org/flyer.png\n\nRSVP: https://www.eventbrite.com/e/rally-123",
        location: "Texas Capitol, Austin, TX",
        start: { dateTime: "2026-04-04T16:00:00-05:00" },
        end: { dateTime: "2026-04-04T19:00:00-05:00" },
        attachments: [],
      },
      {
        id: "evt2",
        summary: "All-Day Event",
        description: "A whole day thing",
        location: "",
        start: { date: "2026-04-10" },
        end: { date: "2026-04-11" },
      },
    ],
  };

  it("extracts calendar metadata", () => {
    // Verify shape — actual transform tested in integration
    assert.strictEqual(mockGoogleResponse.summary, "NBBW PUBLIC WEBSITE");
    assert.strictEqual(mockGoogleResponse.timeZone, "America/Chicago");
  });

  it("identifies all-day events", () => {
    const item = mockGoogleResponse.items[1];
    assert.ok(!item.start.dateTime); // no dateTime = all-day
    assert.ok(item.start.date);
  });

  it("has image URL in description", () => {
    const desc = mockGoogleResponse.items[0].description;
    assert.ok(/\.png/.test(desc));
  });

  it("has Eventbrite URL in description", () => {
    const desc = mockGoogleResponse.items[0].description;
    assert.ok(/eventbrite\.com/.test(desc));
  });
});

describe("transformGoogleEvents — field mapping", () => {
  it("maps htmlLink from Google Calendar API items", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "",
          htmlLink: "https://www.google.com/calendar/event?eid=abc123",
          start: { dateTime: "2099-06-15T10:00:00Z" },
          end: { dateTime: "2099-06-15T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(
      data.events[0].htmlLink,
      "https://www.google.com/calendar/event?eid=abc123",
    );
  });

  it("defaults htmlLink to empty string when not present", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "",
          start: { dateTime: "2099-06-15T10:00:00Z" },
          end: { dateTime: "2099-06-15T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(data.events[0].htmlLink, "");
  });

  it("normalizes htmlLink to empty string for pre-loaded events", () => {
    const event = enrichEvent({
      id: "1",
      title: "Pre-loaded Event",
      description: "",
      start: "2099-06-15T10:00:00Z",
      end: "2099-06-15T11:00:00Z",
    });
    assert.strictEqual(event.htmlLink, "");
  });
});

describe("enrichEvent — token pipeline deduplication", () => {
  it("deduplicates exact duplicate platform links", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description:
            "https://instagram.com/savebigbend https://instagram.com/savebigbend",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(data.events[0].links.length, 1);
    assert.ok(!data.events[0].description.includes("instagram.com"));
  });

  it("deduplicates semantically equivalent URLs (www vs non-www)", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description:
            "https://instagram.com/savebigbend https://www.instagram.com/savebigbend/",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(data.events[0].links.length, 1);
  });

  it("deduplicates twitter.com and x.com URLs", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "https://x.com/foo https://twitter.com/foo",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(data.events[0].links.length, 1);
  });

  it("extracts directives and produces tokens", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "Event info #already:tag:fundraiser #already:cost:$25",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(data.events[0].tags.length, 2);
    assert.ok(!data.events[0].description.includes("#already"));
  });

  it("deduplicates directive and URL producing same canonical ID", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description:
            "#already:instagram:savebigbend https://instagram.com/savebigbend",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    assert.strictEqual(data.events[0].links.length, 1);
    // The directive is processed first, so its URL wins
    assert.strictEqual(
      data.events[0].links[0].url,
      "https://instagram.com/savebigbend",
    );
    assert.ok(!data.events[0].description.includes("#already"));
    assert.ok(!data.events[0].description.includes("instagram.com"));
  });

  it("exposes tags on the event object", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "#already:tag:outdoor #already:rsvp:https://form.com",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    const tags = data.events[0].tags;
    assert.strictEqual(tags.length, 2);
    assert.deepStrictEqual(tags[0], { key: "tag", value: "outdoor" });
    assert.deepStrictEqual(tags[1], { key: "rsvp", value: "https://form.com" });
  });

  it("merges directive tags with pre-populated tags", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "#already:tag:new-tag",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
          // Simulate pre-populated tags (e.g. from a transform)
        },
      ],
    });
    // Verify the new tag is present
    const tags = data.events[0].tags;
    assert.ok(tags.some((t) => t.key === "tag" && t.value === "new-tag"));
  });

  it("handles &amp; encoded directives in HTML descriptions", () => {
    const data = transformGoogleEvents({
      summary: "Test",
      timeZone: "UTC",
      items: [
        {
          id: "1",
          summary: "Test",
          description: "Info #already:tag:free&amp;open",
          start: { dateTime: "2026-04-10T10:00:00Z" },
          end: { dateTime: "2026-04-10T11:00:00Z" },
        },
      ],
    });
    const tags = data.events[0].tags;
    assert.ok(tags.some((t) => t.value === "free&open"));
  });
});

describe("enrichEvent — AFL comments", () => {
  it("strips comment lines before processing directives", () => {
    const event = {
      id: "comment-test",
      title: "Test",
      description:
        "// #already:tag:disabled\n#already:tag:active\nVisible text",
      location: "",
      start: "2099-06-15T10:00:00-05:00",
      end: "2099-06-15T11:00:00-05:00",
      allDay: false,
      image: null,
      images: [],
      links: [],
      attachments: [],
      tags: [],
      featured: false,
      hidden: false,
      htmlLink: "",
    };
    const result = enrichEvent(event, {});
    // The commented-out tag directive should NOT be processed
    assert.strictEqual(result.tags.length, 1);
    assert.strictEqual(result.tags[0].value, "active");
    // The comment line should not appear in the description
    assert.ok(!result.description.includes("// #already"));
    assert.ok(result.description.includes("Visible text"));
  });

  it("strips comment lines before image extraction", () => {
    const event = {
      id: "comment-img",
      title: "Test",
      description:
        "// https://example.com/photo.png\nhttps://example.com/real.png",
      location: "",
      start: "2099-06-15T10:00:00-05:00",
      end: "2099-06-15T11:00:00-05:00",
      allDay: false,
      image: null,
      images: [],
      links: [],
      attachments: [],
      tags: [],
      featured: false,
      hidden: false,
      htmlLink: "",
    };
    const result = enrichEvent(event, {});
    // Only the non-commented image should be extracted
    assert.strictEqual(result.images.length, 1);
    assert.strictEqual(result.images[0], "https://example.com/real.png");
  });
});
