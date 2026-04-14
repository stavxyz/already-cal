require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let getLayout;

before(async () => {
  const mod = await import("../../src/layouts/registry.js");
  getLayout = mod.getLayout;
});

describe("getLayout", () => {
  it("returns a function for clean", () => {
    assert.strictEqual(typeof getLayout("clean"), "function");
  });

  it("returns a function for hero", () => {
    assert.strictEqual(typeof getLayout("hero"), "function");
  });

  it("returns a function for badge", () => {
    assert.strictEqual(typeof getLayout("badge"), "function");
  });

  it("returns a function for compact", () => {
    assert.strictEqual(typeof getLayout("compact"), "function");
  });

  it("falls back to clean for unknown name", () => {
    assert.strictEqual(getLayout("unknown"), getLayout("clean"));
  });

  it("each layout render function returns a DOM element", () => {
    const event = {
      id: "test",
      title: "Test Event",
      start: "2026-04-15T10:00:00Z",
      end: "2026-04-15T11:00:00Z",
      allDay: false,
      image: null,
      location: "",
      description: "",
      tags: [],
      featured: false,
      htmlLink: "",
    };
    const options = {
      orientation: "vertical",
      imagePosition: "left",
      index: 0,
      timezone: "UTC",
      locale: "en-US",
      config: {},
    };
    for (const name of ["clean", "hero", "badge", "compact"]) {
      const el = getLayout(name)(event, options);
      assert.ok(el instanceof HTMLElement, `${name} should return HTMLElement`);
    }
  });
});
