require("../setup-dom.cjs");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/compact/compact.js");
  render = mod.render;
});

// These fixtures use fixed ISO instants and the card's date surfaces (the meta
// line via formatEventWhen, the badge via getEventDateParts) are rendered in
// the VIEWER's zone. Loose "includes Apr" style assertions only survive on an
// arbitrary machine because the fixtures happen to sit mid-month; pin the
// viewer zone so the structure is deterministic everywhere, and restore it
// afterward so no state leaks into other test files.
let originalTZ;

before(() => {
  originalTZ = process.env.TZ;
  process.env.TZ = "UTC";
});

after(() => {
  if (originalTZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = originalTZ;
  }
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("compact layout", () => {
  it("returns a .already-card--compact element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card--compact"));
  });

  it("never renders an image, even when present", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    assert.strictEqual(el.querySelector(".already-card__image"), null);
    assert.strictEqual(el.querySelector("img"), null);
  });

  it("includes inline date badge", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__badge"));
    assert.ok(el.querySelector(".already-card__badge-day"));
    assert.ok(el.querySelector(".already-card__badge-month"));
  });

  it("includes title", () => {
    const el = render(createTestEvent({ title: "My Event" }), baseOptions);
    assert.strictEqual(
      el.querySelector(".already-card__title").textContent,
      "My Event",
    );
  });

  it("includes date/time", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__meta"));
  });

  it("includes location", () => {
    const el = render(
      createTestEvent({ location: "Central Park" }),
      baseOptions,
    );
    const loc = el.querySelector(".already-card__location");
    assert.ok(loc);
    assert.ok(loc.textContent.includes("Central Park"));
  });

  // enrichEvent produces tags as { key, value } objects (docs/event-schema.md).
  it("labels tag pills from the enriched { key, value } shape", () => {
    const el = render(
      createTestEvent({
        tags: [
          { key: "tag", value: "Outdoor" },
          { key: "level", value: "beginner" },
          { key: "signup", value: "https://example.com/form" },
        ],
      }),
      baseOptions,
    );
    const tags = [...el.querySelectorAll(".already-card__tag")].map(
      (t) => t.textContent,
    );
    assert.deepStrictEqual(tags, ["Outdoor", "level: beginner"]);
  });

  it("omits the tag row when every tag is a link", () => {
    const el = render(
      createTestEvent({
        tags: [{ key: "rsvp", value: "https://example.com/form" }],
      }),
      baseOptions,
    );
    assert.strictEqual(el.querySelector(".already-card__tags"), null);
  });

  it("renders a tag directive from a real description", async () => {
    const { enrichEvent } = await import("../../src/data.js");
    const event = enrichEvent(
      createTestEvent({ description: "Brisket.\n#already:tag:food" }),
      {},
    );
    const el = render(event, baseOptions);
    const tags = [...el.querySelectorAll(".already-card__tag")].map(
      (t) => t.textContent,
    );
    assert.deepStrictEqual(tags, ["food"]);
  });

  it("omits tags when empty", () => {
    const el = render(createTestEvent({ tags: [] }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__tags"), null);
  });

  it("does not include description", () => {
    const el = render(
      createTestEvent({ description: "Some text" }),
      baseOptions,
    );
    assert.strictEqual(el.querySelector(".already-card__description"), null);
  });

  it("shows only date (no middot or time) for allDay events", () => {
    const el = render(
      createTestEvent({ start: "2026-04-15T00:00:00Z", allDay: true }),
      baseOptions,
    );
    const meta = el.querySelector(".already-card__meta");
    assert.ok(meta);
    assert.ok(
      !meta.textContent.includes("\u00b7"),
      "allDay should not contain middot",
    );
  });

  it("ignores orientation — always renders without orientation class modifiers", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(!el.classList.contains("already-card--horizontal"));
  });
});
