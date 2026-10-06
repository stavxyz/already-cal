const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

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

  it("preserves _sourceTimeZone from the raw item onto the transformed event", async () => {
    const out = transformGoogleEvents(
      {
        summary: "Composite",
        timeZone: "America/Chicago",
        items: [
          {
            id: "evt-ny",
            summary: "Client call",
            start: { dateTime: "2026-07-15T15:00:00-04:00" },
            end: { dateTime: "2026-07-15T16:00:00-04:00" },
            _sourceTimeZone: "America/New_York",
          },
        ],
      },
      {},
    );
    assert.strictEqual(out.events[0]._sourceTimeZone, "America/New_York");
  });
  it("leaves _sourceTimeZone undefined when the raw item omits it", async () => {
    const out = transformGoogleEvents(
      {
        items: [
          {
            id: "e",
            summary: "x",
            start: { dateTime: "2026-07-15T15:00:00Z" },
          },
        ],
      },
      {},
    );
    assert.strictEqual(out.events[0]._sourceTimeZone, undefined);
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

describe("enrichEvent website", () => {
  let isLinkTagFn;
  before(async () => {
    ({ isLinkTag: isLinkTagFn } = await import("../src/util/tags.js"));
  });

  const enrich = (description, extra = {}) =>
    enrichEvent(createTestEvent({ description, ...extra }), {});

  it("a pre-set website wins over a directive and a description URL", () => {
    const e = enrich(
      "See https://desc.example.com/\n#already:website:https://dir.example.com/",
      { website: "https://preset.example.com/" },
    );
    assert.strictEqual(e.website, "https://preset.example.com/");
  });

  it("the directive wins over an earlier plain URL in the description", () => {
    const e = enrich(
      "First https://plain.example.com/page\n#already:website:https://dir.example.com/fest",
    );
    assert.strictEqual(e.website, "https://dir.example.com/fest");
  });

  it("resolves an autolinked directive to the href value", () => {
    const e = enrich(
      '#already:website:<a href="https://example.com/fest">https://example.com/fest</a>',
    );
    assert.strictEqual(e.website, "https://example.com/fest");
  });

  it("skips platform links and keeps them as link buttons", () => {
    const e = enrich(
      "https://www.instagram.com/acl/ and https://www.aclfestival.com/lineup",
    );
    assert.strictEqual(e.website, "https://www.aclfestival.com/lineup");
    assert.ok(e.links.some((l) => /instagram/i.test(l.url)));
  });

  it("is null when the only URLs are an image and a PDF", () => {
    const e = enrich(
      "Flyer https://example.com/flyer.png and https://example.com/menu.pdf",
    );
    assert.strictEqual(e.website, null);
  });

  it("trims a trailing period", () => {
    const e = enrich("Details: https://www.aclfestival.com/.");
    assert.strictEqual(e.website, "https://www.aclfestival.com/");
  });

  it("trims an unbalanced trailing parenthesis", () => {
    const e = enrich("(see https://example.com/fest)");
    assert.strictEqual(e.website, "https://example.com/fest");
  });

  it("keeps a closing parenthesis that balances an opening one", () => {
    const e = enrich("https://example.com/a_(b)");
    assert.strictEqual(e.website, "https://example.com/a_(b)");
  });

  it("resolves an autolinked plain URL to the href value", () => {
    const e = enrich(
      'Visit <a href="https://x.example.com/">https://x.example.com/</a>',
    );
    assert.strictEqual(e.website, "https://x.example.com/");
  });

  it("is null when there is no URL", () => {
    assert.strictEqual(enrich("Just words.").website, null);
  });

  it("skips a URL that is an img src with no image extension", () => {
    const e = enrich(
      '<img src="https://cdn.example/track?id=1"> https://real.example.com/page',
    );
    assert.strictEqual(e.website, "https://real.example.com/page");
    const e2 = enrich("<img src='https://cdn.example/track?id=1'>");
    assert.strictEqual(e2.website, null);
  });

  it("trims a trailing quote or asterisks left by markup", () => {
    assert.strictEqual(
      enrich("<a href='https://x.example.com/'>go</a>").website,
      "https://x.example.com/",
    );
    assert.strictEqual(
      enrich("**https://x.example.com/page**").website,
      "https://x.example.com/page",
    );
  });

  for (const ch of [",", ";", ":", "!", "?"]) {
    it(`trims a trailing ${ch}`, () => {
      assert.strictEqual(
        enrich(`Go to https://x.example.com/p${ch}`).website,
        "https://x.example.com/p",
      );
    });
  }

  it("strips every unbalanced trailing parenthesis", () => {
    assert.strictEqual(
      enrich("https://example.com/a_(b))").website,
      "https://example.com/a_(b)",
    );
    assert.strictEqual(
      enrich("((https://example.com/fest))").website,
      "https://example.com/fest",
    );
  });

  it("is null when the URL has no host", () => {
    assert.strictEqual(enrich("see https://.").website, null);
  });

  it("honours a website tag already on the event", () => {
    const e = enrich("Text https://plain.example.com/", {
      tags: [{ key: "website", value: "https://pre.example" }],
    });
    assert.strictEqual(e.website, "https://pre.example");
  });

  it("ignores a website directive whose value is not a URL", () => {
    const e = enrich(
      "#already:website:example.com\nhttps://plain.example.com/x",
    );
    assert.strictEqual(e.website, "https://plain.example.com/x");
  });

  it("uses the first of two website directives", () => {
    const e = enrich(
      "#already:website:https://one.example.com/\n#already:website:https://two.example.com/",
    );
    assert.strictEqual(e.website, "https://one.example.com/");
  });

  it("survives loadData with pre-loaded events", async () => {
    const { loadData } = await import("../src/data.js");
    const data = await loadData({
      data: {
        events: [
          createTestEvent({
            description: "#already:website:https://pre.example.com/",
          }),
        ],
      },
    });
    assert.strictEqual(data.events[0].website, "https://pre.example.com/");
  });

  it("survives loadData with raw Google items", async () => {
    const { loadData } = await import("../src/data.js");
    const data = await loadData({
      data: {
        items: [
          {
            id: "g1",
            summary: "Fest",
            description:
              "Plain https://plain.example.com/\n#already:website:https://dir.example.com/",
            start: { dateTime: "2099-04-04T16:00:00-05:00" },
            end: { dateTime: "2099-04-04T19:00:00-05:00" },
          },
        ],
      },
    });
    assert.strictEqual(data.events[0].website, "https://dir.example.com/");
  });

  it("keeps the website tag in tags as a link tag", () => {
    const e = enrich("#already:website:https://example.com/fest");
    const tag = e.tags.find((t) => t.key === "website");
    assert.ok(tag);
    assert.strictEqual(isLinkTagFn(tag), true);
  });
});

describe("enrichEvent — AFL comments", () => {
  it("strips comment lines before processing directives", () => {
    const event = createTestEvent({
      id: "comment-test",
      description:
        "// #already:tag:disabled\n#already:tag:active\nVisible text",
    });
    const result = enrichEvent(event, {});
    // The commented-out tag directive should NOT be processed
    assert.strictEqual(result.tags.length, 1);
    assert.strictEqual(result.tags[0].value, "active");
    // The comment line should not appear in the description
    assert.ok(!result.description.includes("// #already"));
    assert.ok(result.description.includes("Visible text"));
  });

  it("strips comment lines before image extraction", () => {
    const event = createTestEvent({
      id: "comment-img",
      description:
        "// https://example.com/photo.png\nhttps://example.com/real.png",
    });
    const result = enrichEvent(event, {});
    // Only the non-commented image should be extracted
    assert.strictEqual(result.images.length, 1);
    assert.strictEqual(result.images[0], "https://example.com/real.png");
  });

  it("does not set featured when the directive is commented out", () => {
    const event = createTestEvent({
      id: "comment-featured",
      description: "// #already:featured\nRegular event",
    });
    const result = enrichEvent(event, {});
    assert.strictEqual(result.featured, false);
  });

  it("does not set hidden when the directive is commented out", () => {
    const event = createTestEvent({
      id: "comment-hidden",
      description: "// #already:hidden\nStill visible",
    });
    const result = enrichEvent(event, {});
    assert.strictEqual(result.hidden, false);
  });

  it("strips comment lines before link extraction", () => {
    const event = createTestEvent({
      id: "comment-link",
      description:
        "// https://instagram.com/disabled\nhttps://instagram.com/active",
    });
    const result = enrichEvent(event, {});
    assert.strictEqual(result.links.length, 1);
    assert.ok(result.links[0].url.includes("instagram.com/active"));
  });
});

describe("enrichGoogleEvent", () => {
  let enrichGoogleEvent;
  before(async () => {
    ({ enrichGoogleEvent } = await import("../src/data.js"));
  });

  const item = {
    id: "e1",
    summary: "Rally",
    description:
      "Join us.\n#already:tag:food\n#already:image:https://example.com/a.jpg",
    location: "Austin",
    start: { dateTime: "2026-04-04T16:00:00-05:00" },
    end: { dateTime: "2026-04-04T19:00:00-05:00" },
    attachments: [
      { mimeType: "image/png", fileUrl: "https://example.com/b.png" },
      {
        mimeType: "application/pdf",
        fileUrl: "https://example.com/c.pdf",
        title: "Flyer",
      },
    ],
    _sourceTimeZone: "America/Chicago",
  };

  // Pinned expected output for `item` above, captured by running
  // origin/main's (pre-core-entry-refactor) transformGoogleEvents against
  // the same fixture, to lock in pre-refactor behavior. `generated` is a
  // property of the top-level transformGoogleEvents() return value, not of
  // an individual event, so pinning enrichGoogleEvent's per-event output
  // here already excludes it.
  const expected = {
    id: "e1",
    title: "Rally",
    description: "Join us.",
    location: "Austin",
    start: "2026-04-04T16:00:00-05:00",
    end: "2026-04-04T19:00:00-05:00",
    allDay: false,
    image: "https://example.com/a.jpg",
    images: ["https://example.com/a.jpg", "https://example.com/b.png"],
    links: [],
    htmlLink: "",
    website: null,
    attachments: [
      { label: "Flyer", url: "https://example.com/c.pdf", type: "pdf" },
    ],
    _sourceTimeZone: "America/Chicago",
    descriptionFormat: "plain",
    tags: [{ key: "tag", value: "food" }],
    featured: false,
    hidden: false,
    imageShuffle: false,
    rsvp: false,
    composite: false,
    standalone: false,
    partOf: false,
  };

  it("matches the pinned pre-refactor output for a representative item", () => {
    assert.deepStrictEqual(enrichGoogleEvent(item, {}), expected);
  });

  it("picks the directive image first and strips directives", () => {
    const e = enrichGoogleEvent(item, {});
    assert.strictEqual(e.image, "https://example.com/a.jpg");
    assert.ok(!e.description.includes("#already:"));
    assert.deepStrictEqual(e.tags, [{ key: "tag", value: "food" }]);
  });
});
