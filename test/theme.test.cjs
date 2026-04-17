const { describe, it, before } = require("node:test");
const assert = require("node:assert");

require("./setup-dom.cjs");

let resolveTheme, applyTheme;

before(async () => {
  const mod = await import("../src/theme.js");
  resolveTheme = mod.resolveTheme;
  applyTheme = mod.applyTheme;
});

describe("resolveTheme", () => {
  it("returns defaults when theme is undefined", () => {
    const result = resolveTheme(undefined);
    assert.strictEqual(result.layout, "clean");
    assert.strictEqual(result.orientation, "vertical");
    assert.strictEqual(result.imagePosition, "left");
    assert.strictEqual(result.palette, "light");
    assert.deepStrictEqual(result.overrides, {});
  });

  it("returns defaults when theme is empty object", () => {
    const result = resolveTheme({});
    assert.strictEqual(result.layout, "clean");
    assert.strictEqual(result.palette, "light");
    assert.deepStrictEqual(result.overrides, {});
  });

  it("expands string shorthand to layout", () => {
    const result = resolveTheme("hero");
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.orientation, "vertical");
    assert.strictEqual(result.palette, "light");
  });

  it("parses full object", () => {
    const result = resolveTheme({
      layout: "badge",
      orientation: "horizontal",
      imagePosition: "alternating",
      palette: "dark",
    });
    assert.strictEqual(result.layout, "badge");
    assert.strictEqual(result.orientation, "horizontal");
    assert.strictEqual(result.imagePosition, "alternating");
    assert.strictEqual(result.palette, "dark");
  });

  it("separates CSS custom property overrides", () => {
    const result = resolveTheme({
      layout: "hero",
      primary: "#ff0000",
      radius: "0px",
      fontFamily: "Georgia, serif",
    });
    assert.strictEqual(result.layout, "hero");
    assert.deepStrictEqual(result.overrides, {
      primary: "#ff0000",
      radius: "0px",
      fontFamily: "Georgia, serif",
    });
  });

  it("falls back to defaults for unknown layout", () => {
    const result = resolveTheme({ layout: "nonexistent" });
    assert.strictEqual(result.layout, "clean");
  });

  it("falls back to defaults for unknown palette", () => {
    const result = resolveTheme({ palette: "neon" });
    assert.strictEqual(result.palette, "light");
  });

  it("throws when user contradicts compact orientation constraint", () => {
    assert.throws(
      () => resolveTheme({ layout: "compact", orientation: "horizontal" }),
      /constrains orientation to "vertical", but "horizontal" was passed/,
    );
  });

  it("resolves compact orientation to vertical via constraint", () => {
    const result = resolveTheme({ layout: "compact" });
    assert.strictEqual(result.orientation, "vertical");
  });

  it("allows compact with explicit vertical orientation (matches constraint)", () => {
    const result = resolveTheme({
      layout: "compact",
      orientation: "vertical",
    });
    assert.strictEqual(result.orientation, "vertical");
  });

  it("ignores imagePosition when orientation is vertical", () => {
    const result = resolveTheme({
      orientation: "vertical",
      imagePosition: "right",
    });
    assert.strictEqual(result.imagePosition, "left");
  });
});

describe("applyTheme", () => {
  function makeEl() {
    return document.createElement("div");
  }

  it("sets data-layout attribute on element", () => {
    const el = makeEl();
    applyTheme(el, { layout: "hero" }, []);
    assert.strictEqual(el.dataset.layout, "hero");
  });

  it("sets data-palette attribute on element", () => {
    const el = makeEl();
    applyTheme(el, { palette: "dark" }, []);
    assert.strictEqual(el.dataset.palette, "dark");
  });

  it("sets data-orientation attribute on element", () => {
    const el = makeEl();
    applyTheme(el, { orientation: "horizontal" }, []);
    assert.strictEqual(el.dataset.orientation, "horizontal");
  });

  it("sets data-imagePosition attribute on element", () => {
    const el = makeEl();
    applyTheme(el, { orientation: "horizontal", imagePosition: "right" }, []);
    assert.strictEqual(el.dataset.imagePosition, "right");
  });

  it("applies CSS custom property overrides", () => {
    const el = makeEl();
    applyTheme(el, { primary: "#ff0000", radius: "4px" }, []);
    assert.strictEqual(
      el.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
    assert.strictEqual(el.style.getPropertyValue("--already-radius"), "4px");
  });

  it("clears previous CSS overrides not in new config", () => {
    const el = makeEl();
    const result1 = applyTheme(el, { primary: "#ff0000" }, []);
    assert.strictEqual(
      el.style.getPropertyValue("--already-primary"),
      "#ff0000",
    );
    applyTheme(el, {}, result1.overrideKeys);
    assert.strictEqual(el.style.getPropertyValue("--already-primary"), "");
  });

  it("returns resolved theme object and overrideKeys array", () => {
    const el = makeEl();
    const result = applyTheme(el, { layout: "badge", primary: "#aabbcc" }, []);
    assert.strictEqual(result.layout, "badge");
    assert.ok(Array.isArray(result.overrideKeys));
    assert.ok(result.overrideKeys.includes("--already-primary"));
  });

  it("accepts string shorthand", () => {
    const el = makeEl();
    applyTheme(el, "hero", []);
    assert.strictEqual(el.dataset.layout, "hero");
  });
});

describe("resolveTheme — bundle resolution", () => {
  let register;
  before(async () => {
    // Ensure theme registry is loaded (via theme.js import chain)
    const reg = await import("../src/registry.js");
    register = reg.register;
  });

  it("applies bundle defaults when user omits dimensions", () => {
    register("theme", "bundle-defaults", {
      layout: "hero",
      defaults: { orientation: "horizontal", palette: "dark" },
    });
    const result = resolveTheme("bundle-defaults");
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.orientation, "horizontal");
    assert.strictEqual(result.palette, "dark");
  });

  it("user value overrides bundle default", () => {
    register("theme", "bundle-override", {
      layout: "clean",
      defaults: { palette: "dark" },
    });
    const result = resolveTheme({ layout: "bundle-override", palette: "warm" });
    assert.strictEqual(result.palette, "warm");
  });

  it("constraint wins over user value — throws on conflict", () => {
    register("theme", "bundle-constraint", {
      layout: "badge",
      constraints: { palette: "light" },
    });
    assert.throws(
      () => resolveTheme({ layout: "bundle-constraint", palette: "dark" }),
      /constrains palette to "light", but "dark" was passed/,
    );
  });

  it("constraint is applied when user omits dimension", () => {
    register("theme", "bundle-silent-constraint", {
      layout: "clean",
      constraints: { orientation: "horizontal" },
    });
    const result = resolveTheme("bundle-silent-constraint");
    assert.strictEqual(result.orientation, "horizontal");
  });

  it("merges bundle CSS overrides with user overrides", () => {
    register("theme", "bundle-css", {
      layout: "hero",
      overrides: { primary: "#2563eb", fontSizeSm: "0.7rem" },
    });
    const result = resolveTheme({
      layout: "bundle-css",
      primary: "#ff0000",
      radius: "4px",
    });
    assert.strictEqual(result.overrides.primary, "#ff0000");
    assert.strictEqual(result.overrides.fontSizeSm, "0.7rem");
    assert.strictEqual(result.overrides.radius, "4px");
  });

  it("string shorthand resolves bundle", () => {
    register("theme", "bundle-shorthand", {
      layout: "badge",
      defaults: { palette: "cool" },
    });
    const result = resolveTheme("bundle-shorthand");
    assert.strictEqual(result.layout, "badge");
    assert.strictEqual(result.palette, "cool");
  });

  it("non-bundle string falls back to layout lookup", () => {
    const result = resolveTheme("hero");
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.palette, "light");
  });

  it("non-bundle layout in object falls back to layout lookup", () => {
    const result = resolveTheme({ layout: "hero", palette: "dark" });
    assert.strictEqual(result.layout, "hero");
    assert.strictEqual(result.palette, "dark");
  });

  it("full priority chain: constraint > user > bundle default > THEME_DEFAULTS", () => {
    register("theme", "bundle-priority", {
      layout: "clean",
      defaults: { palette: "dark", imagePosition: "right" },
      constraints: { orientation: "horizontal" },
    });
    const result = resolveTheme({
      layout: "bundle-priority",
      palette: "warm",
    });
    assert.strictEqual(result.orientation, "horizontal");
    assert.strictEqual(result.palette, "warm");
    assert.strictEqual(result.imagePosition, "right");
  });
});
