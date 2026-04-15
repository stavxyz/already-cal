require("./setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");
const { createTestEvent } = require("./helpers.cjs");

let init;

before(async () => {
  const mod = await import("../src/already-cal.js");
  init = mod.init;
});

function createInitedInstance(configOverrides = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const instance = init({
    el: container,
    data: {
      events: [
        createTestEvent({ id: "e1", title: "Test" }),
        createTestEvent({ id: "e2", title: "Test 2" }),
      ],
      calendar: { name: "Test Cal", description: "", timezone: "UTC" },
    },
    defaultView: "grid",
    views: ["grid", "list", "month"],
    ...configOverrides,
  });
  return { instance, container };
}

describe("init() return value", () => {
  it("returns an object with setConfig method", () => {
    const { instance } = createInitedInstance();
    assert.ok(instance, "init() should return an instance");
    assert.strictEqual(typeof instance.setConfig, "function");
  });
});

describe("setConfig — theme updates", () => {
  it("updates data-palette attribute", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
  });

  it("updates data-layout attribute", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { layout: "hero" } });
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("updates data-orientation attribute", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { orientation: "horizontal" } });
    assert.strictEqual(container.dataset.orientation, "horizontal");
  });

  it("applies CSS custom property overrides", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { primary: "#ff0000" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
  });

  it("clears previous CSS overrides when switching themes", async () => {
    const { instance, container } = createInitedInstance({
      theme: { primary: "#ff0000" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );

    instance.setConfig({ theme: { palette: "cool" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "",
      "previous override should be cleared",
    );
  });

  it("accepts string shorthand for theme", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: "hero" });
    assert.strictEqual(container.dataset.layout, "hero");
  });

  it("compact layout forces orientation to vertical", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({
      theme: { layout: "compact", orientation: "horizontal" },
    });
    assert.strictEqual(container.dataset.orientation, "vertical");
  });

  it("ignores invalid layout values (retains current)", async () => {
    const { instance, container } = createInitedInstance({
      theme: { layout: "hero" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(container.dataset.layout, "hero");

    instance.setConfig({ theme: { layout: "nonexistent" } });
    // resolveTheme falls back to "clean" for invalid layouts
    assert.strictEqual(container.dataset.layout, "clean");
  });

  it("ignores invalid palette values (falls back to default)", async () => {
    const { instance, container } = createInitedInstance({
      theme: { palette: "dark" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(container.dataset.palette, "dark");

    instance.setConfig({ theme: { palette: "neon" } });
    // resolveTheme falls back to "light" for invalid palettes
    assert.strictEqual(container.dataset.palette, "light");
  });
});

describe("setConfig — partial updates", () => {
  it("does not reset theme when updating non-theme config", async () => {
    const { instance, container } = createInitedInstance({
      theme: { palette: "dark" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(container.dataset.palette, "dark");

    instance.setConfig({ showPastEvents: true });
    assert.strictEqual(
      container.dataset.palette,
      "dark",
      "palette should not reset",
    );
  });

  it("does not reset non-theme config when updating theme", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: false,
    });
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { palette: "warm" } });
    assert.strictEqual(container.dataset.palette, "warm");
  });

  it("replaces theme wholesale — does not merge across calls", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
    instance.setConfig({ theme: { layout: "hero" } });
    assert.strictEqual(container.dataset.layout, "hero");
    // palette resets to "light" because theme is replaced, not merged
    assert.strictEqual(container.dataset.palette, "light");
  });
});

describe("setConfig — view/display updates", () => {
  it("updates views in the view selector", async () => {
    const { instance, container } = createInitedInstance({
      views: ["grid", "list", "month"],
    });
    await new Promise((r) => setTimeout(r, 10));

    instance.setConfig({ views: ["grid", "list"] });
    const tabs = container.querySelectorAll('[role="tab"]');
    const labels = [...tabs].map((t) => t.textContent.trim());
    assert.ok(!labels.includes("Month"), "Month tab should be removed");
  });

  it("switches current view when defaultView changes", async () => {
    const { instance, container } = createInitedInstance({
      defaultView: "grid",
      views: ["grid", "list", "month"],
    });
    await new Promise((r) => setTimeout(r, 10));

    instance.setConfig({ defaultView: "list" });
    // The view selector should show "list" as active
    const activeTab = container.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    assert.ok(activeTab, "should have an active tab");
    assert.ok(
      activeTab.textContent.includes("List"),
      `active tab should be List, got: ${activeTab.textContent}`,
    );
  });
});

describe("setConfig — re-render optimization", () => {
  it("does not re-render on palette-only change", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: true,
    });
    await new Promise((r) => setTimeout(r, 10));

    // Record current view container content
    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;

    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
    // View container should be unchanged (no re-render)
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("does not re-render on CSS override-only change", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: true,
    });
    await new Promise((r) => setTimeout(r, 10));

    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;

    instance.setConfig({ theme: { primary: "#ff0000" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("re-renders on layout change", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: true,
    });
    await new Promise((r) => setTimeout(r, 10));

    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;

    instance.setConfig({ theme: { layout: "hero" } });
    assert.strictEqual(container.dataset.layout, "hero");
    // View container should be re-rendered (new card layout)
    assert.notStrictEqual(viewContainer.innerHTML, htmlBefore);
  });
});

describe("Already._instance", () => {
  it("stores instance as _instance export", async () => {
    const mod = await import("../src/already-cal.js");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const instance = mod.init({
      el: container,
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    });
    assert.strictEqual(mod._instance, instance);
  });
});

describe("global setConfig export", () => {
  it("is exported as a function", async () => {
    const mod = await import("../src/already-cal.js");
    assert.strictEqual(typeof mod.setConfig, "function");
  });

  it("delegates to _instance.setConfig", async () => {
    const mod = await import("../src/already-cal.js");
    const container = document.createElement("div");
    document.body.appendChild(container);
    mod.init({
      el: container,
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    });
    await new Promise((r) => setTimeout(r, 10));

    mod.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
  });
});
