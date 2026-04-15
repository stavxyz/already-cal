require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/compact/compact.js");
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

  it("renders tag pills when present", () => {
    const el = render(
      createTestEvent({ tags: ["Outdoor", "Family"] }),
      baseOptions,
    );
    const tags = el.querySelectorAll(".already-card__tag");
    assert.strictEqual(tags.length, 2);
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
    assert.ok(!meta.textContent.includes("\u00b7"), "allDay should not contain middot");
  });

  it("ignores orientation — always renders without orientation class modifiers", () => {
    const el = render(createTestEvent(), {
      ...baseOptions,
      orientation: "horizontal",
    });
    assert.ok(!el.classList.contains("already-card--horizontal"));
  });
});
