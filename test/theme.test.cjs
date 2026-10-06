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

  it("ignores invalid user dimension and falls back to bundle default", () => {
    register("theme", "bundle-fallback-invalid", {
      layout: "hero",
      defaults: { orientation: "horizontal" },
    });
    const result = resolveTheme({
      layout: "bundle-fallback-invalid",
      orientation: "diagonal",
    });
    assert.strictEqual(result.orientation, "horizontal");
  });

  it("ignores invalid user dimension and falls back to THEME_DEFAULTS when no bundle default", () => {
    const result = resolveTheme({ palette: "neon" });
    assert.strictEqual(result.palette, "light");
  });

  it("uses theme name as layout when bundle omits layout property", () => {
    register("theme", "no-layout-bundle", { defaults: { palette: "dark" } });
    const result = resolveTheme("no-layout-bundle");
    assert.strictEqual(result.layout, "no-layout-bundle");
    assert.strictEqual(result.palette, "dark");
  });
});

describe("applyTheme — camelCase to kebab-case CSS conversion", () => {
  function makeEl() {
    return document.createElement("div");
  }

  it("converts camelCase override keys to kebab-case CSS properties", () => {
    const el = makeEl();
    applyTheme(el, { fontSizeSm: "0.7rem" }, []);
    assert.strictEqual(
      el.style.getPropertyValue("--already-font-size-sm"),
      "0.7rem",
    );
  });

  it("converts multi-capital camelCase correctly", () => {
    const el = makeEl();
    applyTheme(el, { bgColor: "red" }, []);
    assert.strictEqual(el.style.getPropertyValue("--already-bg-color"), "red");
  });
});

describe("semantic border tokens", () => {
  // These are declared as `var(--already-border)`, and `var()` inside a custom
  // property substitutes at computed-value time ON THE ELEMENT THE DECLARATION
  // LANDS ON, not lazily at each use site. Declared on :root they captured
  // :root's --already-border and inherited that literal down, so a palette
  // (.already[data-palette]) and a runtime setProperty on .already never
  // reached them: the dark palette rendered 6%-black borders on #1a1a1a, and a
  // theme setting only `border` silently lost it everywhere.
  //
  // jsdom does not resolve var() at all (getComputedStyle returns the literal
  // "var(--x)"), so a computed-style test is not possible in this harness and
  // a browser is disproportionate here. This asserts the structural property
  // the cascade depends on: the declarations must live on the same element the
  // overrides land on. It fails if they are moved back to :root.
  const cssPath = require("node:path").join(
    __dirname,
    "../src/styles/base.css",
  );
  const css = require("node:fs").readFileSync(cssPath, "utf8");
  const blockFor = (selector) => {
    const start = css.indexOf(`${selector} {`);
    assert.notStrictEqual(start, -1, `no ${selector} block`);
    return css.slice(start, css.indexOf("}", start));
  };

  for (const token of ["--already-border-control", "--already-border-grid"]) {
    it(`declares ${token} on .already, not :root, so overrides reach it`, () => {
      assert.ok(
        blockFor(".already").includes(`${token}: var(--already-border)`),
        `${token} must be declared on .already`,
      );
      assert.ok(
        !blockFor(":root").includes(token),
        `${token} on :root freezes at the base default and ignores palettes`,
      );
    });
  }

  it("maps borderControl and borderGrid to their custom properties", () => {
    const el = document.createElement("div");
    applyTheme(
      el,
      { borderControl: "#1a1a1a", borderGrid: "rgba(0,0,0,.12)" },
      [],
    );
    assert.strictEqual(
      el.style.getPropertyValue("--already-border-control"),
      "#1a1a1a",
    );
    assert.strictEqual(
      el.style.getPropertyValue("--already-border-grid"),
      "rgba(0,0,0,.12)",
    );
  });

  it("does not use a border token as a background fill", () => {
    // A border color as a hover FILL was harmless while `border` was always
    // subtle. Now that a host may set a hard control color for a strong frame,
    // it would fill nav buttons with near-black on hover.
    assert.ok(
      !/background:\s*var\(--already-border/.test(css),
      "border tokens are for edges; use --already-highlight for fills",
    );
  });
});

describe("the --already-* namespace holds theme tokens only", () => {
  // Any theme key becomes `--already-<kebab-key>` on the mount element
  // (applyTheme), so every `--already-*` property the stylesheet declares or
  // reads is one a host can set, and the README and docs/configuration.md list
  // them. A property the stylesheet uses for its own mechanics is named
  // `--_already-*` instead; a consumer that keeps an allowlist of tokens would
  // otherwise have to learn each one. This census fails when a property joins
  // the public namespace without joining both lists, or leaves the stylesheet
  // while a list still names it. It reads the built stylesheet (CI fails when
  // dist is stale) and only the stylesheet: a property set from JavaScript
  // would escape it, and today the only such write is applyTheme's.
  const fs = require("node:fs");
  const path = require("node:path");
  const read = (rel) =>
    fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  const css = read("dist/already-cal.css");
  const readme = read("README.md");
  const configuration = read("docs/configuration.md");
  const toProperty = (key) =>
    `--already-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

  // Declarations are matched at the start of a line, which the unminified
  // build guarantees; reads are matched anywhere.
  const inStylesheet = new Set([
    ...[...css.matchAll(/^\s*(--already-[a-z0-9-]+)\s*:/gm)].map((m) => m[1]),
    ...[...css.matchAll(/var\(\s*(--already-[a-z0-9-]+)/g)].map((m) => m[1]),
  ]);

  // The README's list is the one paragraph of backticked keys under the
  // heading, not the prose around it, so a backticked word in a sentence
  // cannot widen the allowed set.
  const heading = "### CSS Custom Properties";
  const start = readme.indexOf(heading);
  const sectionEnd = readme.indexOf("\n### ", start + heading.length);
  const section = readme.slice(
    start,
    sectionEnd === -1 ? readme.length : sectionEnd,
  );
  const listLine = section
    .split("\n")
    .find((line) => /^`[a-z][A-Za-z0-9]*`(, `[a-z][A-Za-z0-9]*`)*$/.test(line));
  const listed = new Set(
    [...(listLine ?? "").matchAll(/`([a-z][A-Za-z0-9]*)`/g)].map((m) =>
      toProperty(m[1]),
    ),
  );

  // docs/configuration.md has the same tokens as a table whose second column
  // is the property itself.
  const inConfiguration = new Set(
    [
      ...configuration.matchAll(
        /^\| `[a-z][A-Za-z0-9]*` \| `(--already-[a-z0-9-]+)` \|/gm,
      ),
    ].map((m) => m[1]),
  );

  it("finds the lists and the stylesheet's properties", () => {
    assert.notStrictEqual(start, -1, "no CSS Custom Properties section");
    assert.ok(listLine, "no list paragraph under the heading");
    assert.ok(listed.has("--already-primary"));
    assert.ok(inConfiguration.has("--already-primary"));
    assert.ok(inStylesheet.has("--already-primary"));
  });

  it("lists every --already-* property the stylesheet declares or reads", () => {
    const unlisted = [...inStylesheet].filter((p) => !listed.has(p)).sort();
    assert.deepStrictEqual(unlisted, []);
  });

  it("uses every property the README lists", () => {
    const unused = [...listed].filter((p) => !inStylesheet.has(p)).sort();
    assert.deepStrictEqual(unused, []);
  });

  it("keeps the configuration table equal to the README's list", () => {
    assert.deepStrictEqual([...inConfiguration].sort(), [...listed].sort());
  });
});
