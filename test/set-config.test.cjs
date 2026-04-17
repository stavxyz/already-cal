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
  instances.push({ instance, container });
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

  it("compact layout constrains orientation to vertical (throws on conflict)", async () => {
    const { instance } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    assert.throws(
      () =>
        instance.setConfig({
          theme: { layout: "compact", orientation: "horizontal" },
        }),
      /constrains orientation to "vertical", but "horizontal" was passed/,
    );
  });

  it("falls back to default for invalid layout values", async () => {
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

describe("setConfig — input guards", () => {
  it("is a no-op when called with null", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const htmlBefore = container.innerHTML;
    instance.setConfig(null);
    assert.strictEqual(container.innerHTML, htmlBefore);
  });

  it("is a no-op when called with undefined", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const htmlBefore = container.innerHTML;
    instance.setConfig(undefined);
    assert.strictEqual(container.innerHTML, htmlBefore);
  });

  it("is a no-op when called with a string", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const htmlBefore = container.innerHTML;
    instance.setConfig("dark");
    assert.strictEqual(container.innerHTML, htmlBefore);
  });

  it("is a no-op when called with an array", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const htmlBefore = container.innerHTML;
    instance.setConfig([1, 2]);
    assert.strictEqual(container.innerHTML, htmlBefore);
  });
});

describe("setConfig — pageSize validation", () => {
  it("accepts a valid positive number", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.setConfig({ pageSize: 5 });
    // Should trigger a re-render without error
    const viewContainer = container.querySelector(".already-view-container");
    assert.ok(viewContainer.innerHTML.length > 0);
  });

  it("ignores zero", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;
    instance.setConfig({ pageSize: 0 });
    // Should not re-render (invalid value rejected)
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("ignores negative numbers", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;
    instance.setConfig({ pageSize: -5 });
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("ignores NaN", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;
    instance.setConfig({ pageSize: NaN });
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("ignores Infinity", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;
    instance.setConfig({ pageSize: Infinity });
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("ignores string values", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;
    instance.setConfig({ pageSize: "10" });
    assert.strictEqual(viewContainer.innerHTML, htmlBefore);
  });
});

describe("setConfig — defaultView validation", () => {
  it("ignores a view not in the configured views array", async () => {
    const { instance, container } = createInitedInstance({
      defaultView: "grid",
      views: ["grid", "list"],
    });
    await new Promise((r) => setTimeout(r, 10));
    const activeTab = container.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    const labelBefore = activeTab.textContent.trim();

    instance.setConfig({ defaultView: "month" });
    const activeTabAfter = container.querySelector(
      '[role="tab"][aria-selected="true"]',
    );
    assert.strictEqual(
      activeTabAfter.textContent.trim(),
      labelBefore,
      "should not switch to an invalid view",
    );
  });

  it("does not switch view when on detail view", async () => {
    const { instance, container } = createInitedInstance({
      defaultView: "grid",
      views: ["grid", "list", "month"],
    });
    await new Promise((r) => setTimeout(r, 10));
    // Navigate to detail view via hash
    window.location.hash = "event/e1";
    window.dispatchEvent(new window.Event("hashchange"));
    await new Promise((r) => setTimeout(r, 10));

    // Changing defaultView while on detail should not yank user out
    instance.setConfig({ defaultView: "list" });
    // The view container should still show the detail view content
    const viewContainer = container.querySelector(".already-view-container");
    assert.ok(
      viewContainer.innerHTML.length > 0,
      "detail view should still be rendered",
    );
    // Clean up hash
    window.location.hash = "";
  });
});

describe("setConfig — views validation", () => {
  it("ignores non-array values", async () => {
    const { instance, container } = createInitedInstance({
      views: ["grid", "list", "month"],
    });
    await new Promise((r) => setTimeout(r, 10));
    const tabs = container.querySelectorAll('[role="tab"]');
    const countBefore = tabs.length;

    instance.setConfig({ views: "grid" });
    const tabsAfter = container.querySelectorAll('[role="tab"]');
    assert.strictEqual(tabsAfter.length, countBefore, "should not change tabs");
  });

  it("ignores empty arrays", async () => {
    const { instance, container } = createInitedInstance({
      views: ["grid", "list", "month"],
    });
    await new Promise((r) => setTimeout(r, 10));
    const tabs = container.querySelectorAll('[role="tab"]');
    const countBefore = tabs.length;

    instance.setConfig({ views: [] });
    const tabsAfter = container.querySelectorAll('[role="tab"]');
    assert.strictEqual(
      tabsAfter.length,
      countBefore,
      "should not accept empty views",
    );
  });
});

describe("setConfig — re-render optimization (extended)", () => {
  it("re-renders on orientation change", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: true,
    });
    await new Promise((r) => setTimeout(r, 10));

    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;

    instance.setConfig({ theme: { orientation: "horizontal" } });
    assert.strictEqual(container.dataset.orientation, "horizontal");
    assert.notStrictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("re-renders on imagePosition change", async () => {
    const { instance, container } = createInitedInstance({
      showPastEvents: true,
      theme: { orientation: "horizontal" },
    });
    await new Promise((r) => setTimeout(r, 10));

    const viewContainer = container.querySelector(".already-view-container");
    const htmlBefore = viewContainer.innerHTML;

    instance.setConfig({
      theme: { orientation: "horizontal", imagePosition: "right" },
    });
    assert.strictEqual(container.dataset.imagePosition, "right");
    assert.notStrictEqual(viewContainer.innerHTML, htmlBefore);
  });

  it("tracks CSS overrides across multiple setConfig calls", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));

    // Call A: sets primary
    instance.setConfig({ theme: { primary: "#ff0000" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );

    // Call B: sets radius (primary from A should be cleared since theme is replaced)
    instance.setConfig({ theme: { radius: "20px" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "",
      "primary from call A should be cleared",
    );
    assert.strictEqual(
      container.style.getPropertyValue("--already-radius"),
      "20px",
    );

    // Call C: plain palette (radius from B should be cleared)
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(
      container.style.getPropertyValue("--already-radius"),
      "",
      "radius from call B should be cleared",
    );
  });
});

describe("setConfig — before data loads", () => {
  it("stores config but does not throw when called before data loads", () => {
    const { instance, container } = createInitedInstance();
    // Call setConfig synchronously — data hasn't loaded yet
    // Should not throw
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
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
    const instance = mod.init({
      el: container,
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    });
    instances.push({ instance, container });
    await new Promise((r) => setTimeout(r, 10));

    mod.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.dataset.palette, "dark");
  });

  it("is a safe no-op when _instance is null", async () => {
    const mod = await import("../src/already-cal.js");
    // Create and destroy to ensure _instance is null
    const container = document.createElement("div");
    document.body.appendChild(container);
    const instance = mod.init({
      el: container,
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    });
    instance.destroy();
    container.remove();
    assert.strictEqual(mod._instance, null);
    // Should not throw
    mod.setConfig({ theme: { palette: "dark" } });
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
    instances.push({ instance, container });
    assert.strictEqual(mod._instance, instance);
  });
});

describe("destroy()", () => {
  it("is returned on the instance object", () => {
    const { instance } = createInitedInstance();
    assert.strictEqual(typeof instance.destroy, "function");
  });

  it("clears the mount element", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(container.innerHTML.length > 0, "container should have content");
    instance.destroy();
    assert.strictEqual(container.innerHTML, "");
  });

  it("removes the already CSS class", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(container.classList.contains("already"));
    instance.destroy();
    assert.ok(!container.classList.contains("already"));
  });

  it("removes data attributes from the element", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(container.dataset.layout, "should have data-layout");
    instance.destroy();
    assert.strictEqual(container.dataset.layout, undefined);
    assert.strictEqual(container.dataset.palette, undefined);
    assert.strictEqual(container.dataset.orientation, undefined);
    assert.strictEqual(container.dataset.imagePosition, undefined);
  });

  it("removes CSS custom property overrides", async () => {
    const { instance, container } = createInitedInstance({
      theme: { primary: "#ff0000" },
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
    instance.destroy();
    assert.strictEqual(
      container.style.getPropertyValue("--already-primary"),
      "",
    );
  });

  it("nulls _instance when it matches", async () => {
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
    instance.destroy();
    container.remove();
    assert.strictEqual(mod._instance, null);
  });

  it("does not null _instance when a newer instance exists", async () => {
    const mod = await import("../src/already-cal.js");
    const container1 = document.createElement("div");
    const container2 = document.createElement("div");
    document.body.appendChild(container1);
    document.body.appendChild(container2);
    const cfg = {
      data: {
        events: [createTestEvent()],
        calendar: { name: "Test", description: "", timezone: "UTC" },
      },
    };
    const first = mod.init({ el: container1, ...cfg });
    const second = mod.init({ el: container2, ...cfg });
    instances.push({ instance: second, container: container2 });
    assert.strictEqual(mod._instance, second);
    first.destroy();
    container1.remove();
    assert.strictEqual(
      mod._instance,
      second,
      "_instance should still be the newer instance",
    );
  });

  it("removes the postMessage listener", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.destroy();
    // After destroy, postMessage should not update the cleared container
    window.dispatchEvent(
      new window.MessageEvent("message", {
        data: {
          type: "already:config",
          config: { theme: { palette: "dark" } },
        },
      }),
    );
    assert.strictEqual(
      container.innerHTML,
      "",
      "container should remain empty after postMessage",
    );
  });

  it("removes the resize listener", async () => {
    const { instance } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.destroy();
    // Should not throw when resize fires after destroy
    window.dispatchEvent(new window.Event("resize"));
  });

  it("is idempotent — double destroy is safe", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.destroy();
    // Second call should not throw
    instance.destroy();
    assert.strictEqual(container.innerHTML, "");
  });

  it("makes setConfig a no-op after destruction", async () => {
    const { instance, container } = createInitedInstance();
    await new Promise((r) => setTimeout(r, 10));
    instance.destroy();
    // Should not throw or modify the cleared element
    instance.setConfig({ theme: { palette: "dark" } });
    assert.strictEqual(container.innerHTML, "");
    assert.strictEqual(container.dataset.palette, undefined);
  });
});
