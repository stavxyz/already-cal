const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let resolveTheme;

before(async () => {
  const mod = await import("../src/theme.js");
  resolveTheme = mod.resolveTheme;
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

  it("ignores orientation for compact layout", () => {
    const result = resolveTheme({
      layout: "compact",
      orientation: "horizontal",
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
