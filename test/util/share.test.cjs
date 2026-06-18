require("../setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let shareOrCopy;
before(async () => {
  ({ shareOrCopy } = await import("../../src/util/share.js"));
});

function setShare(fn) {
  Object.defineProperty(navigator, "share", { value: fn, configurable: true });
}
function setClipboard(obj) {
  Object.defineProperty(navigator, "clipboard", {
    value: obj,
    configurable: true,
  });
}
afterEach(() => {
  delete navigator.share;
  delete navigator.clipboard;
});

describe("shareOrCopy", () => {
  it("uses navigator.share when present", async () => {
    let got = null;
    setShare(async (data) => {
      got = data;
    });
    const r = await shareOrCopy({ title: "T", url: "https://x/1" });
    assert.strictEqual(r, "shared");
    assert.deepStrictEqual(got, { title: "T", url: "https://x/1" });
  });

  it("falls back to clipboard when share absent", async () => {
    let wrote = null;
    setClipboard({
      writeText: async (u) => {
        wrote = u;
      },
    });
    const r = await shareOrCopy({ title: "T", url: "https://x/2" });
    assert.strictEqual(r, "copied");
    assert.strictEqual(wrote, "https://x/2");
  });

  it("falls back to clipboard when share rejects (non-abort)", async () => {
    let wrote = null;
    setShare(async () => {
      throw new Error("not allowed");
    });
    setClipboard({
      writeText: async (u) => {
        wrote = u;
      },
    });
    const r = await shareOrCopy({ title: "T", url: "https://x/3" });
    assert.strictEqual(r, "copied");
    assert.strictEqual(wrote, "https://x/3");
  });

  it("treats AbortError as shared, does NOT copy", async () => {
    setShare(async () => {
      const e = new Error("dismissed");
      e.name = "AbortError";
      throw e;
    });
    let copied = false;
    setClipboard({
      writeText: async () => {
        copied = true;
      },
    });
    const r = await shareOrCopy({ title: "T", url: "https://x/4" });
    assert.strictEqual(r, "shared");
    assert.strictEqual(copied, false);
  });

  it("returns failed when neither share nor clipboard available", async () => {
    const r = await shareOrCopy({ title: "T", url: "https://x/5" });
    assert.strictEqual(r, "failed");
  });

  it("returns failed when clipboard write throws", async () => {
    setClipboard({
      writeText: async () => {
        throw new Error("blocked");
      },
    });
    const r = await shareOrCopy({ title: "T", url: "https://x/6" });
    assert.strictEqual(r, "failed");
  });
});
