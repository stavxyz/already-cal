require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("../helpers.cjs");

let render;

before(async () => {
  const mod = await import("../../src/layouts/clean/clean.js");
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

describe("clean layout", () => {
  it("returns .already-card and .already-card--clean", () => {
    const event = createTestEvent();
    const el = render(event, baseOptions);
    assert.ok(el.classList.contains("already-card"), "missing .already-card");
    assert.ok(
      el.classList.contains("already-card--clean"),
      "missing .already-card--clean",
    );
  });

  it("includes title", () => {
    const event = createTestEvent({ title: "My Test Event" });
    const el = render(event, baseOptions);
    const titleEl = el.querySelector(".already-card__title");
    assert.ok(titleEl, "missing .already-card__title");
    assert.strictEqual(titleEl.textContent, "My Test Event");
  });

  it("includes date/time meta", () => {
    const event = createTestEvent({
      start: "2026-04-15T14:00:00Z",
      allDay: false,
    });
    const el = render(event, baseOptions);
    const metaEl = el.querySelector(".already-card__meta");
    assert.ok(metaEl, "missing .already-card__meta");
    assert.ok(metaEl.textContent.length > 0, "meta should not be empty");
    // Should include a date portion
    assert.ok(
      metaEl.textContent.includes("Apr"),
      `meta should include short month, got: ${metaEl.textContent}`,
    );
  });

  it("includes location when present", () => {
    const event = createTestEvent({ location: "123 Main St" });
    const el = render(event, baseOptions);
    const locEl = el.querySelector(".already-card__location");
    assert.ok(locEl, "missing .already-card__location");
    assert.strictEqual(locEl.textContent, "123 Main St");
  });

  it("omits location when empty", () => {
    const event = createTestEvent({ location: "" });
    const el = render(event, baseOptions);
    const locEl = el.querySelector(".already-card__location");
    assert.strictEqual(locEl, null, "should not render location when empty");
  });

  it("includes image with lazy loading when present", () => {
    const event = createTestEvent({ image: "https://example.com/pic.jpg" });
    const el = render(event, baseOptions);
    const imgWrapper = el.querySelector(".already-card__image");
    assert.ok(imgWrapper, "missing .already-card__image wrapper");
    const img = imgWrapper.querySelector("img");
    assert.ok(img, "missing img element");
    assert.strictEqual(img.src, "https://example.com/pic.jpg");
    assert.strictEqual(img.getAttribute("loading"), "lazy");
  });

  it("omits image when absent", () => {
    const event = createTestEvent({ image: null });
    const el = render(event, baseOptions);
    const imgWrapper = el.querySelector(".already-card__image");
    assert.strictEqual(imgWrapper, null, "should not render image wrapper when no image");
  });

  it("does NOT include description (clean layout omits it)", () => {
    const event = createTestEvent({ description: "Some long description here" });
    const el = render(event, baseOptions);
    // No description element should exist
    const descEl = el.querySelector(".already-card__description");
    assert.strictEqual(
      descEl,
      null,
      "clean layout should not render description",
    );
    // Also verify description text is not in the card
    assert.ok(
      !el.textContent.includes("Some long description here"),
      "clean layout should not show description text",
    );
  });

  it("applies vertical orientation class", () => {
    const event = createTestEvent();
    const el = render(event, { ...baseOptions, orientation: "vertical" });
    assert.ok(
      el.classList.contains("already-card--vertical"),
      "missing .already-card--vertical",
    );
  });

  it("applies horizontal orientation class", () => {
    const event = createTestEvent();
    const el = render(event, { ...baseOptions, orientation: "horizontal" });
    assert.ok(
      el.classList.contains("already-card--horizontal"),
      "missing .already-card--horizontal",
    );
  });

  it("applies image-right class when horizontal + right", () => {
    const event = createTestEvent();
    const el = render(event, {
      ...baseOptions,
      orientation: "horizontal",
      imagePosition: "right",
    });
    assert.ok(
      el.classList.contains("already-card--image-right"),
      "missing .already-card--image-right for horizontal+right",
    );
  });

  it("alternates image position based on index (even=left, odd=right)", () => {
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

  it("escapes title via textContent (XSS protection)", () => {
    const event = createTestEvent({
      title: '<script>alert("xss")</script>',
    });
    const el = render(event, baseOptions);
    const titleEl = el.querySelector(".already-card__title");
    assert.ok(titleEl, "missing .already-card__title");
    // textContent assignment escapes HTML — the raw string is stored, not parsed
    assert.strictEqual(
      titleEl.textContent,
      '<script>alert("xss")</script>',
    );
    // No actual script element should be injected
    assert.strictEqual(
      el.querySelectorAll("script").length,
      0,
      "XSS: no script elements should exist in card",
    );
  });
});
