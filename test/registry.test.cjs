const { describe, it, before, beforeEach } = require("node:test");
const assert = require("node:assert");

let defineType, registerBuiltIn, register, get, has, _resetForTesting;
before(async () => {
  const mod = await import("../src/registry.js");
  defineType = mod.defineType;
  registerBuiltIn = mod.registerBuiltIn;
  register = mod.register;
  get = mod.get;
  has = mod.has;
  _resetForTesting = mod._resetForTesting;
});

beforeEach(() => {
  _resetForTesting();
});

describe("registry — defineType", () => {
  it("creates a new registry type", () => {
    defineType("widget", () => {});
    assert.strictEqual(has("widget", "anything"), false);
  });

  it("throws on duplicate type definition", () => {
    defineType("dup", () => {});
    assert.throws(() => defineType("dup", () => {}), /already defined/);
  });

  it("throws when validator is not a function", () => {
    assert.throws(
      () => defineType("bad", "not-a-fn"),
      /validator must be a function/,
    );
  });
});

describe("registry — registerBuiltIn", () => {
  it("registers a built-in entry", () => {
    defineType("widget", () => {});
    registerBuiltIn("widget", "default", () => "built-in");
    assert.strictEqual(has("widget", "default"), true);
    assert.strictEqual(get("widget", "default")(), "built-in");
  });

  it("throws for undefined type", () => {
    assert.throws(
      () => registerBuiltIn("unknown", "x", () => {}),
      /not defined/i,
    );
  });

  it("throws on empty name", () => {
    defineType("widget", () => {});
    assert.throws(
      () => registerBuiltIn("widget", "", () => {}),
      /non-empty string/i,
    );
  });

  it("throws on duplicate built-in name", () => {
    defineType("widget", () => {});
    registerBuiltIn("widget", "core", () => {});
    assert.throws(
      () => registerBuiltIn("widget", "core", () => {}),
      /already registered/i,
    );
  });
});

describe("registry — register", () => {
  it("registers a custom entry", () => {
    defineType("widget", () => {});
    register("widget", "custom", () => "custom-val");
    assert.strictEqual(has("widget", "custom"), true);
    assert.strictEqual(get("widget", "custom")(), "custom-val");
  });

  it("throws on built-in name collision", () => {
    defineType("widget", () => {});
    registerBuiltIn("widget", "core", () => {});
    assert.throws(() => register("widget", "core", () => {}), /built-in/i);
  });

  it("throws on empty name", () => {
    defineType("widget", () => {});
    assert.throws(() => register("widget", "", () => {}), /non-empty string/i);
  });

  it("throws on non-string name", () => {
    defineType("widget", () => {});
    assert.throws(() => register("widget", 42, () => {}), /non-empty string/i);
  });

  it("throws when validator rejects", () => {
    defineType("widget", (name, impl) => {
      if (typeof impl !== "function") {
        throw new Error(`"${name}" must be a function`);
      }
    });
    assert.throws(
      () => register("widget", "bad", "not-a-fn"),
      /must be a function/,
    );
  });

  it("throws for undefined type", () => {
    assert.throws(() => register("unknown", "x", () => {}), /not defined/i);
  });

  it("allows overriding a custom entry", () => {
    defineType("widget", () => {});
    register("widget", "mine", () => "v1");
    register("widget", "mine", () => "v2");
    assert.strictEqual(get("widget", "mine")(), "v2");
  });
});

describe("registry — get", () => {
  it("returns the entry for a registered name", () => {
    defineType("widget", () => {});
    register("widget", "a", () => "found");
    assert.strictEqual(get("widget", "a")(), "found");
  });

  it("returns fallback for unknown name", () => {
    defineType("widget", () => {});
    const fb = () => "fallback";
    assert.strictEqual(get("widget", "missing", fb)(), "fallback");
  });

  it("returns undefined when no fallback and name unknown", () => {
    defineType("widget", () => {});
    assert.strictEqual(get("widget", "nope"), undefined);
  });
});

describe("registry — has", () => {
  it("returns true for registered name", () => {
    defineType("widget", () => {});
    register("widget", "present", () => {});
    assert.strictEqual(has("widget", "present"), true);
  });

  it("returns false for unregistered name", () => {
    defineType("widget", () => {});
    assert.strictEqual(has("widget", "absent"), false);
  });

  it("returns false for undefined type", () => {
    assert.strictEqual(has("nonexistent", "x"), false);
  });
});

describe("registry — type independence", () => {
  it("entries in one type do not affect another", () => {
    defineType("alpha", () => {});
    defineType("beta", () => {});
    register("alpha", "shared-name", () => "alpha-val");
    assert.strictEqual(has("alpha", "shared-name"), true);
    assert.strictEqual(has("beta", "shared-name"), false);
  });
});
