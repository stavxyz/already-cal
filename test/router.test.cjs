require("./setup-dom.cjs");
const { describe, it, before, after, afterEach } = require("node:test");
const assert = require("node:assert");

let eventHref, parseHash, onHashChange, getInitialView;
before(async () => {
  ({ eventHref, parseHash, onHashChange, getInitialView } = await import(
    "../src/router.js"
  ));
});
afterEach(() => {
  // replaceState, not `location.hash = ""`: the latter leaves a trailing `#`
  // and queues a hashchange task that would reach a later async test.
  window.history.replaceState({}, "", window.location.pathname);
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

  it("round-trips every id through the hash, whatever characters it carries", () => {
    // Google ids are ASCII letters, digits, `_`, and `@`; a host's own ids
    // can hold anything. The browser percent-encodes a space or a non-ASCII
    // character when the fragment is set, so the id is encoded on write and
    // decoded on read, and both sides agree for every row (#106).
    for (const id of [
      "plain123",
      "x@google.com",
      "evt/2026?x=1&y=2:z@w",
      "50%off",
      "a b",
      "café",
      "日本",
    ]) {
      window.location.hash = new URL(
        eventHref({ id }),
        window.location.href,
      ).hash;
      assert.deepStrictEqual(parseHash(), { view: "detail", eventId: id }, id);
    }
  });

  it("percent-encodes the id in the href", () => {
    assert.strictEqual(eventHref({ id: "a b" }), "#event/a%20b");
    assert.strictEqual(eventHref({ id: "50%off" }), "#event/50%25off");
    assert.strictEqual(eventHref({ id: "café" }), "#event/caf%C3%A9");
  });

  it("percent-encodes the id in the absolute form too", () => {
    const base = document.createElement("base");
    base.setAttribute("href", "/elsewhere/");
    document.head.appendChild(base);
    try {
      assert.strictEqual(
        eventHref({ id: "a b" }),
        "http://localhost/#event/a%20b",
      );
    } finally {
      base.remove();
    }
  });

  it("keeps an id it cannot encode as it is instead of throwing", () => {
    // A lone surrogate has no UTF-8 form; the old template string never
    // threw on one, and a link that cannot open beats a render that fails.
    assert.strictEqual(eventHref({ id: "a\uD800" }), "#event/a\uD800");
  });
});

describe("parseHash with a hand-typed event hash", () => {
  it("keeps a malformed escape as written, so an id with a bare % still opens", () => {
    // Nothing the widget writes looks like this; a visitor who typed it, or a
    // host that built the hash without encoding, gets the raw text back, as
    // every version before the encoder did.
    window.location.hash = "#event/50%off";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "50%off" });
  });

  it("still opens a Google id pasted with its bare @", () => {
    window.location.hash = "#event/x@google.com";
    assert.deepStrictEqual(parseHash(), {
      view: "detail",
      eventId: "x@google.com",
    });
  });

  it("decodes a valid escape, so an id holding one must be encoded twice", () => {
    // Earlier versions read `a%25b` as the id; the encoder writes such an id
    // as `a%2525b`, and a hand-built hash has to do the same.
    window.location.hash = "#event/a%25b";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "a%b" });
  });
});

describe("getInitialView with initialEvent", () => {
  it("passes the host's id through as it is, because it is an id and not a hash", () => {
    assert.deepStrictEqual(
      getInitialView("month", ["month"], { initialEvent: "a b" }),
      { view: "detail", eventId: "a b" },
    );
  });
});

describe("parseHash on a page whose path is an event deep link", () => {
  // A host with server-side routing serves the calendar page at
  // /event/<id> too, and share links use that form. Every route the widget
  // writes afterwards is a hash; the path never changes.
  before(() => {
    window.history.replaceState({}, "", "/cal/event/abc");
  });
  after(() => {
    window.history.replaceState({}, "", "/");
  });

  it("opens the path's event when the hash names no route", () => {
    window.location.hash = "";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
    window.location.hash = "#nonsense";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
  });

  it("lets a view in the hash win over the path, so Back leaves the event", () => {
    window.location.hash = "#grid";
    assert.deepStrictEqual(parseHash(), { view: "grid" });
    window.location.hash = "#day/2026-04-04";
    assert.deepStrictEqual(parseHash(), { view: "day", date: "2026-04-04" });
  });

  it("lets another event in the hash win over the path", () => {
    window.location.hash = "#event/xyz";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "xyz" });
  });

  it("treats an empty event id in the hash as no route", () => {
    window.location.hash = "#event/";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
  });

  it("ignores a hash that names no route, including the empty one a host link makes", async () => {
    // A hash the widget does not know (#main, a skip link) names no route,
    // and so does the bare `#` an <a href="#"> leaves behind; neither may
    // pull the visitor back into the path's event they just left.
    const tick = () => new Promise((r) => setTimeout(r, 10));
    // jsdom queues one hashchange task per assignment the synchronous tests
    // before this one made; let that backlog pass before listening.
    await tick();
    const seen = [];
    const off = onHashChange((state) => seen.push(state));
    try {
      window.location.hash = "#grid";
      await tick();
      window.location.hash = "#main";
      await tick();
      const top = document.createElement("a");
      top.href = "#";
      document.body.appendChild(top);
      top.click();
      await tick();
      assert.strictEqual(
        window.location.href,
        "http://localhost/cal/event/abc#",
      );
      assert.deepStrictEqual(seen, [{ view: "grid" }]);
      top.remove();
    } finally {
      off();
    }
  });

  it("reopens the path's event when the browser's Back returns to the arrival entry", async () => {
    const tick = () => new Promise((r) => setTimeout(r, 10));
    // jsdom queues one hashchange task per assignment the synchronous tests
    // before this one made; let that backlog pass before listening.
    await tick();
    const seen = [];
    const off = onHashChange((state) => seen.push(state));
    try {
      window.location.hash = "#grid";
      await tick();
      window.history.back();
      await tick();
      assert.strictEqual(
        window.location.href,
        "http://localhost/cal/event/abc",
      );
      assert.deepStrictEqual(seen, [
        { view: "grid" },
        { view: "detail", eventId: "abc" },
      ]);
    } finally {
      off();
    }
  });

  it("reads the arrival entry like the first load even when it carries an unknown hash", async () => {
    // A shared link can carry a fragment the widget does not know
    // (/event/abc#main). Back to it must give what arriving there gave.
    const tick = () => new Promise((r) => setTimeout(r, 10));
    // jsdom queues one hashchange task per assignment the synchronous tests
    // before this one made; let that backlog pass before listening.
    await tick();
    window.history.replaceState({}, "", "/cal/event/abc#main");
    const seen = [];
    const off = onHashChange((state) => seen.push(state));
    try {
      window.location.hash = "#grid";
      await tick();
      window.history.back();
      await tick();
      assert.strictEqual(window.location.hash, "#main");
      assert.deepStrictEqual(seen, [
        { view: "grid" },
        { view: "detail", eventId: "abc" },
      ]);
    } finally {
      off();
    }
  });

  it("treats an empty day in the hash as no route", () => {
    window.location.hash = "#day/";
    assert.deepStrictEqual(parseHash(), { view: "detail", eventId: "abc" });
  });
});

describe("parseHash with a malformed event path", () => {
  before(() => {
    window.history.replaceState({}, "", "/cal/event/%E0%A4%A");
  });
  after(() => {
    window.history.replaceState({}, "", "/");
  });

  it("names no route instead of throwing", () => {
    window.location.hash = "";
    assert.strictEqual(parseHash(), null);
  });
});

describe("parseHash with an empty event id and no event path", () => {
  it("names no route", () => {
    window.location.hash = "#event/";
    assert.strictEqual(parseHash(), null);
  });
});
