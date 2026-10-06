require("./setup-dom.cjs");
const { describe, it, before, afterEach } = require("node:test");
const assert = require("node:assert");

let eventHref, parseHash;
before(async () => {
  ({ eventHref, parseHash } = await import("../src/router.js"));
});
afterEach(() => {
  window.location.hash = "";
});

describe("eventHref", () => {
  it("links an entry by its id", () => {
    assert.strictEqual(eventHref({ id: "abc" }), "#event/abc");
  });

  it("links a part with no id of its own to its parent", () => {
    assert.strictEqual(eventHref({ parentId: "p1" }), "#event/p1");
    assert.strictEqual(
      eventHref({ id: undefined, parentId: "p1" }),
      "#event/p1",
    );
  });

  it("treats an empty id as missing", () => {
    assert.strictEqual(eventHref({ id: "", parentId: "p1" }), "#event/p1");
    assert.strictEqual(eventHref({ id: "" }), null);
  });

  it("is a relative fragment when the page has no base element", () => {
    // The browser resolves it against the page's current URL each time, so
    // it cannot go stale when a host changes the path or the query.
    assert.strictEqual(document.querySelector("base"), null);
    assert.strictEqual(eventHref({ id: "abc" }), "#event/abc");
  });

  it("is the page's absolute URL when the document has a base element", () => {
    // A relative `#event/x` would resolve against <base href>, sending a
    // middle click or a new tab to the wrong page.
    const base = document.createElement("base");
    base.setAttribute("href", "/elsewhere/");
    document.head.appendChild(base);
    try {
      assert.strictEqual(
        eventHref({ id: "abc" }),
        "http://localhost/#event/abc",
      );
    } finally {
      base.remove();
    }
  });

  it("prefers the entry's own id over its parent's", () => {
    assert.strictEqual(eventHref({ id: "a", parentId: "p" }), "#event/a");
  });

  it("returns null for an entry with neither id nor parent id", () => {
    assert.strictEqual(eventHref({}), null);
    assert.strictEqual(eventHref({ id: null }), null);
    assert.strictEqual(eventHref(null), null);
  });

  it("writes the id as parseHash reads it, reserved characters included", () => {
    // Characters a Google event id or a host's id can carry, none of which
    // the URL fragment encodes.
    const id = "evt/2026?x=1&y=2:z@w";
    window.location.hash = new URL(
      eventHref({ id }),
      window.location.href,
    ).hash;
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: id });
  });
});
