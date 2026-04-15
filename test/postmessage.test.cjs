require("./setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let init;
const instances = [];

before(async () => {
  const mod = await import("../src/already-cal.js");
  init = mod.init;
});

afterEach(() => {
  for (const inst of instances) {
    inst.instance.destroy();
    inst.container.remove();
  }
  instances.length = 0;
});

function createInitedInstance() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    data: {
      events: [createTestEvent()],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: "grid",
  });
  instances.push({ instance, container });
  return { instance, container };
}

function dispatchMessage(data) {
  const event = new window.MessageEvent("message", { data });
  window.dispatchEvent(event);
}

describe("postMessage listener", () => {
  it("updates theme on valid already:config message", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));

    dispatchMessage({
      type: "already:config",
      config: { theme: { palette: "dark" } },
    });
    assert.strictEqual(container.dataset.palette, "dark");
  });

  it("updates layout on valid message", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));

    dispatchMessage({
      type: "already:config",
      config: { theme: { layout: "hero" } },
    });
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("ignores messages without type field", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ config: { theme: { palette: "dark" } } });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with wrong type", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({
      type: "other:message",
      config: { theme: { palette: "dark" } },
    });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with non-object config", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ type: "already:config", config: "not an object" });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with null config", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ type: "already:config", config: null });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("ignores messages with missing config key", async () => {
    const { container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const originalPalette = container.dataset.palette;

    dispatchMessage({ type: "already:config" });
    assert.strictEqual(container.dataset.palette, originalPalette);
  });

  it("silently ignores null message data", () => {
    dispatchMessage(null);
  });

  it("silently ignores string message data", () => {
    dispatchMessage("hello");
  });

  it("silently ignores array message data", () => {
    dispatchMessage([1, 2, 3]);
  });
});
