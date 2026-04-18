require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let register, has, getTheme;

before(async () => {
  const reg = await import("../../src/registry.js");
  register = reg.register;
  has = reg.has;

  // Import theme registry (triggers defineType + registerBuiltIn for "theme")
  const themes = await import("../../src/themes/registry.js");
  getTheme = themes.getTheme;
});

describe("theme registry — validator rejects invalid bundles", () => {
  it("throws when bundle is not an object", () => {
    assert.throws(
      () => register("theme", "bad-str", "not-an-object"),
      /must be a plain object/,
    );
  });

  it("throws when bundle is null", () => {
    assert.throws(
      () => register("theme", "bad-null", null),
      /must be a plain object/,
    );
  });

  it("throws when bundle is an array", () => {
    assert.throws(
      () => register("theme", "bad-arr", []),
      /must be a plain object/,
    );
  });

  it("throws on unknown top-level key", () => {
    assert.throws(
      () => register("theme", "bad-key", { layout: "clean", bogus: true }),
      /unknown key "bogus"/,
    );
  });

  it("throws when layout is not a function or string", () => {
    assert.throws(
      () => register("theme", "bad-layout-type", { layout: 42 }),
      /layout must be a function or string/,
    );
  });

  it("throws when layout string references unregistered layout", () => {
    assert.throws(
      () => register("theme", "bad-layout-ref", { layout: "nonexistent" }),
      /not a registered layout/,
    );
  });

  it("throws on unknown defaults key", () => {
    assert.throws(
      () => register("theme", "bad-def-key", { defaults: { layout: "clean" } }),
      /unknown defaults key "layout"/,
    );
  });

  it("throws on invalid defaults value", () => {
    assert.throws(
      () =>
        register("theme", "bad-def-val", {
          defaults: { orientation: "diagonal" },
        }),
      /invalid defaults value "diagonal" for "orientation"/,
    );
  });

  it("throws on unknown constraints key", () => {
    assert.throws(
      () =>
        register("theme", "bad-con-key", {
          constraints: { bogus: "value" },
        }),
      /unknown constraints key "bogus"/,
    );
  });

  it("throws on invalid constraints value", () => {
    assert.throws(
      () =>
        register("theme", "bad-con-val", {
          constraints: { palette: "neon" },
        }),
      /invalid constraints value "neon" for "palette"/,
    );
  });

  it("throws when defaults is not an object", () => {
    assert.throws(
      () => register("theme", "bad-def-type", { defaults: "nope" }),
      /defaults must be a plain object/,
    );
  });

  it("throws when constraints is not an object", () => {
    assert.throws(
      () => register("theme", "bad-con-type", { constraints: 42 }),
      /constraints must be a plain object/,
    );
  });

  it("throws when overrides is not an object", () => {
    assert.throws(
      () => register("theme", "bad-ovr-type", { overrides: "nope" }),
      /overrides must be a plain object/,
    );
  });
});

describe("theme registry — validator accepts valid bundles", () => {
  it("accepts an empty bundle", () => {
    register("theme", "valid-empty", {});
    assert.strictEqual(has("theme", "valid-empty"), true);
  });

  it("accepts a bundle with layout string", () => {
    register("theme", "valid-layout-str", { layout: "clean" });
    assert.strictEqual(has("theme", "valid-layout-str"), true);
  });

  it("accepts a bundle with layout function", () => {
    register("theme", "valid-layout-fn", {
      layout: () => document.createElement("div"),
    });
    assert.strictEqual(has("theme", "valid-layout-fn"), true);
  });

  it("accepts a bundle with all valid sections", () => {
    register("theme", "valid-full", {
      layout: "hero",
      defaults: {
        orientation: "horizontal",
        imagePosition: "alternating",
        palette: "dark",
      },
      constraints: { orientation: "horizontal" },
      overrides: { primary: "#2563eb", fontSizeSm: "0.7rem" },
    });
    assert.strictEqual(has("theme", "valid-full"), true);
  });
});

describe("theme registry — built-in bundles", () => {
  it("registers clean as a built-in", () => {
    assert.strictEqual(has("theme", "clean"), true);
  });

  it("registers hero as a built-in", () => {
    assert.strictEqual(has("theme", "hero"), true);
  });

  it("registers badge as a built-in", () => {
    assert.strictEqual(has("theme", "badge"), true);
  });

  it("registers compact as a built-in", () => {
    assert.strictEqual(has("theme", "compact"), true);
  });

  it("compact bundle has orientation constraint", () => {
    const bundle = getTheme("compact");
    assert.deepStrictEqual(bundle.constraints, { orientation: "vertical" });
  });

  it("clean bundle has layout only", () => {
    const bundle = getTheme("clean");
    assert.strictEqual(bundle.layout, "clean");
    assert.strictEqual(bundle.defaults, undefined);
    assert.strictEqual(bundle.constraints, undefined);
  });

  it("throws when overriding a built-in theme name", () => {
    assert.throws(
      () => register("theme", "clean", { layout: "clean" }),
      /built-in/i,
    );
  });
});

describe("theme registry — getTheme", () => {
  it("returns bundle for registered theme", () => {
    const bundle = getTheme("compact");
    assert.ok(bundle);
    assert.strictEqual(bundle.layout, "compact");
  });

  it("returns undefined for unregistered name", () => {
    assert.strictEqual(getTheme("nonexistent"), undefined);
  });
});

describe("theme registry — custom theme re-registration", () => {
  it("replaces a previously registered custom theme", () => {
    register("theme", "replaceable", { layout: "clean" });
    assert.strictEqual(getTheme("replaceable").layout, "clean");

    register("theme", "replaceable", { layout: "hero" });
    assert.strictEqual(getTheme("replaceable").layout, "hero");
  });
});

describe("registerTheme — public API", () => {
  let registerTheme;
  before(async () => {
    const mod = await import("../../src/already-cal.js");
    registerTheme = mod.registerTheme;
  });

  it("registers a theme bundle with layout string", () => {
    registerTheme("pub-api-str", {
      layout: "hero",
      defaults: { palette: "dark" },
    });
    assert.strictEqual(has("theme", "pub-api-str"), true);
    assert.strictEqual(getTheme("pub-api-str").layout, "hero");
  });

  it("auto-registers layout function under theme name", () => {
    const renderFn = () => document.createElement("div");
    registerTheme("pub-api-fn", { layout: renderFn });
    // Layout registry should have the function registered under the theme name
    assert.strictEqual(has("layout", "pub-api-fn"), true);
    // Bundle should store the layout name as a string
    assert.strictEqual(getTheme("pub-api-fn").layout, "pub-api-fn");
  });

  it("throws when overriding a built-in theme name", () => {
    assert.throws(
      () => registerTheme("compact", { layout: "compact" }),
      /built-in/i,
    );
  });

  it("allows re-registering a custom theme name", () => {
    registerTheme("pub-api-replace", { layout: "clean" });
    registerTheme("pub-api-replace", { layout: "badge" });
    assert.strictEqual(getTheme("pub-api-replace").layout, "badge");
  });
});

describe("THEMES — frozen snapshot", () => {
  let THEMES_ref;
  before(async () => {
    const mod = await import("../../src/already-cal.js");
    THEMES_ref = () => mod.THEMES;
  });

  it("includes all four built-in themes", () => {
    const themes = THEMES_ref();
    assert.ok(themes.clean);
    assert.ok(themes.hero);
    assert.ok(themes.badge);
    assert.ok(themes.compact);
  });

  it("includes custom themes registered via registerTheme", () => {
    const themes = THEMES_ref();
    assert.ok(
      themes["pub-api-str"],
      "should include custom theme registered earlier",
    );
  });

  it("compact bundle shows constraint", () => {
    const themes = THEMES_ref();
    assert.deepStrictEqual(themes.compact.constraints, {
      orientation: "vertical",
    });
  });

  it("snapshot is frozen", () => {
    const themes = THEMES_ref();
    assert.ok(Object.isFrozen(themes));
  });
});
