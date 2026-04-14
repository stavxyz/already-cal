require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/hero/hero.js");
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

describe("hero layout", () => {
  it("returns .already-card--hero", () => {
    const event = createTestEvent();
    const el = render(event, baseOptions);
    assert.ok(el.classList.contains("already-card"), "missing .already-card");
    assert.ok(
      el.classList.contains("already-card--hero"),
      "missing .already-card--hero",
    );
  });

  it("includes title", () => {
    const event = createTestEvent({ title: "Hero Test Event" });
    const el = render(event, baseOptions);
    const titleEl = el.querySelector(".already-card__title");
    assert.ok(titleEl, "missing .already-card__title");
    assert.strictEqual(titleEl.textContent, "Hero Test Event");
  });

  it("includes description preview when present", () => {
    const event = createTestEvent({ description: "A detailed description here" });
    const el = render(event, baseOptions);
    const descEl = el.querySelector(".already-card__description");
    assert.ok(descEl, "missing .already-card__description");
    assert.strictEqual(descEl.textContent, "A detailed description here");
  });

  it("omits description when empty", () => {
    const event = createTestEvent({ description: "" });
    const el = render(event, baseOptions);
    const descEl = el.querySelector(".already-card__description");
    assert.strictEqual(descEl, null, "should not render description when empty");
  });

  it("includes footer with location and date", () => {
    const event = createTestEvent({
      location: "Main Hall",
      start: "2026-04-15T14:00:00Z",
      end: "2026-04-15T15:00:00Z",
      allDay: false,
    });
    const el = render(event, baseOptions);
    const footer = el.querySelector(".already-card__footer");
    assert.ok(footer, "missing .already-card__footer");
    const loc = footer.querySelector(".already-card__location");
    assert.ok(loc, "missing .already-card__location");
    assert.strictEqual(loc.textContent, "Main Hall");
    const meta = footer.querySelector(".already-card__meta");
    assert.ok(meta, "missing .already-card__meta");
    assert.ok(
      meta.textContent.includes("Apr"),
      `meta should include short month, got: ${meta.textContent}`,
    );
  });

  it("includes image when present", () => {
    const event = createTestEvent({ image: "https://example.com/hero.jpg" });
    const el = render(event, baseOptions);
    const imgWrapper = el.querySelector(".already-card__image");
    assert.ok(imgWrapper, "missing .already-card__image wrapper");
    const img = imgWrapper.querySelector("img");
    assert.ok(img, "missing img element");
    assert.strictEqual(img.src, "https://example.com/hero.jpg");
    assert.strictEqual(img.getAttribute("loading"), "lazy");
  });

  it("omits image when absent", () => {
    const event = createTestEvent({ image: null });
    const el = render(event, baseOptions);
    const imgWrapper = el.querySelector(".already-card__image");
    assert.strictEqual(imgWrapper, null, "should not render image wrapper when no image");
  });

  it("applies horizontal orientation class", () => {
    const event = createTestEvent();
    const el = render(event, { ...baseOptions, orientation: "horizontal" });
    assert.ok(
      el.classList.contains("already-card--horizontal"),
      "missing .already-card--horizontal",
    );
  });

  it("alternates image position based on index", () => {
    const event = createTestEvent();
    const opts = {
      ...baseOptions,
      orientation: "horizontal",
      imagePosition: "alternating",
    };

    const even = render(event, { ...opts, index: 0 });
    assert.ok(
      !even.classList.contains("already-card--image-right"),
      "even index should be image-left (no image-right class)",
    );

    const odd = render(event, { ...opts, index: 1 });
    assert.ok(
      odd.classList.contains("already-card--image-right"),
      "odd index should be image-right",
    );
  });
});
