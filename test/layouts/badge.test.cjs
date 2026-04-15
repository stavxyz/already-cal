require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/badge/badge.js");
  render = mod.render;
});

const baseOptions = {
  orientation: "vertical",
  imagePosition: "left",
  index: 0,
  timezone: "UTC",
  locale: "en-US",
  config: {},
};

describe("badge layout", () => {
  it("returns a .already-card--badge element", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.classList.contains("already-card--badge"));
  });

  it("includes date badge overlay on image", () => {
    const el = render(
      createTestEvent({ image: "https://example.com/img.jpg" }),
      baseOptions,
    );
    const badge = el.querySelector(".already-card__badge");
    assert.ok(badge);
    assert.ok(el.querySelector(".already-card__badge-day"));
    assert.ok(el.querySelector(".already-card__badge-month"));
  });

  it("includes date badge even without image", () => {
    const el = render(createTestEvent({ image: null }), baseOptions);
    assert.ok(el.querySelector(".already-card__badge"));
  });

  it("includes full date and time", () => {
    const el = render(createTestEvent(), baseOptions);
    assert.ok(el.querySelector(".already-card__meta"));
  });

  it("includes location with icon prefix", () => {
    const el = render(createTestEvent({ location: "The Venue" }), baseOptions);
    const loc = el.querySelector(".already-card__location");
    assert.ok(loc);
    assert.ok(loc.textContent.includes("The Venue"));
  });

  it("includes description preview", () => {
    const el = render(
      createTestEvent({ description: "A great event" }),
      baseOptions,
    );
    assert.ok(el.querySelector(".already-card__description"));
  });

  it("renders tag pills when tags are present", () => {
    const el = render(
      createTestEvent({ tags: ["Outdoor", "Family"] }),
      baseOptions,
    );
    const tags = el.querySelectorAll(".already-card__tag");
    assert.strictEqual(tags.length, 2);
    assert.strictEqual(tags[0].textContent, "Outdoor");
    assert.strictEqual(tags[1].textContent, "Family");
  });

  it("omits tag container when no tags", () => {
    const el = render(createTestEvent({ tags: [] }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__tags"), null);
  });

  it("renders action footer with RSVP link when htmlLink present", () => {
    const el = render(
      createTestEvent({ htmlLink: "https://calendar.google.com/event/abc" }),
      baseOptions,
    );
    const actions = el.querySelectorAll(".already-card__action");
    assert.ok(actions.length > 0);
  });

  it("omits action footer when no htmlLink", () => {
    const el = render(createTestEvent({ htmlLink: "" }), baseOptions);
    assert.strictEqual(el.querySelector(".already-card__footer"), null);
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

  it("includes end time range when end is present", () => {
    const el = render(
      createTestEvent({
        start: "2026-04-15T14:00:00Z",
        end: "2026-04-15T16:00:00Z",
        allDay: false,
      }),
      baseOptions,
    );
    const meta = el.querySelector(".already-card__meta");
    assert.ok(meta);
    assert.ok(
      meta.textContent.includes("\u2013"),
      "should contain en-dash for time range",
    );
  });

  it("applies horizontal orientation class", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(el.classList.contains("already-card--horizontal"));
  });
});
