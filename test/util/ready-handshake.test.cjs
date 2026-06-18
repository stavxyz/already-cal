require("../setup-dom.cjs");
const { describe, it, before } = require("node:test");
const assert = require("node:assert");

let postReadyToParent;
let postInteractionToParent;

before(async () => {
  const mod = await import("../../src/util/ready-handshake.js");
  postReadyToParent = mod.postReadyToParent;
  postInteractionToParent = mod.postInteractionToParent;
});

/**
 * Helper: temporarily install a fake `window.parent` whose `postMessage`
 * captures calls into an array. JSDOM's default `window.parent` is the
 * window itself (signaling "not in an iframe"); we override via a
 * property descriptor and restore in afterEach so tests don't leak
 * state across the suite.
 */
function withParent(parentLike, fn) {
  const originalDesc = Object.getOwnPropertyDescriptor(window, "parent");
  Object.defineProperty(window, "parent", {
    value: parentLike,
    configurable: true,
    writable: true,
  });
  try {
    return fn();
  } finally {
    if (originalDesc) {
      Object.defineProperty(window, "parent", originalDesc);
    } else {
      delete window.parent;
    }
  }
}

/**
 * Helper: temporarily set `document.referrer`. JSDOM exposes referrer
 * as a getter — we override the descriptor and restore after.
 */
function withReferrer(referrerValue, fn) {
  const originalDesc = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(document),
    "referrer",
  );
  Object.defineProperty(document, "referrer", {
    get: () => referrerValue,
    configurable: true,
  });
  try {
    return fn();
  } finally {
    if (originalDesc) {
      Object.defineProperty(
        Object.getPrototypeOf(document),
        "referrer",
        originalDesc,
      );
    }
    delete document.referrer;
  }
}

describe("postReadyToParent — no-op contexts", () => {
  it("is a no-op when window.parent === window (not in an iframe)", () => {
    const calls = [];
    // JSDOM default: window.parent === window. Don't override; just
    // verify nothing throws and no observable side-effect occurs.
    // We can't easily spy on `window.postMessage` here because the
    // helper checks `window.parent === window` BEFORE touching
    // postMessage at all — so the right assertion is the absence of
    // any thrown error.
    assert.doesNotThrow(() =>
      withReferrer("https://parent.example/", () => {
        postReadyToParent("0.3.0");
      }),
    );
    assert.deepStrictEqual(calls, []);
  });

  it("is a no-op when document.referrer is empty", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        withReferrer("", () => {
          postReadyToParent("0.3.0");
        });
      },
    );
    assert.deepStrictEqual(calls, []);
  });

  it("is a no-op when document.referrer is unparseable", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        withReferrer("not a url", () => {
          postReadyToParent("0.3.0");
        });
      },
    );
    assert.deepStrictEqual(calls, []);
  });

  it('is a no-op when referrer origin parses to "null" (about:blank, data:, file://)', () => {
    // Opaque-origin schemes all yield `new URL(...).origin === "null"`
    // per WHATWG URL. postMessage to a parent whose origin is "null"
    // is meaningless (cross-browser semantics differ), so we skip.
    // This pins all three common cases against a future refactor that
    // narrows the guard to just one scheme.
    const opaqueReferrers = [
      "about:blank",
      "data:text/html,<p>x</p>",
      "file:///Users/x/page.html",
    ];
    for (const referrer of opaqueReferrers) {
      const calls = [];
      withParent(
        { postMessage: (msg, origin) => calls.push({ msg, origin }) },
        () => {
          withReferrer(referrer, () => {
            postReadyToParent("0.3.0");
          });
        },
      );
      assert.deepStrictEqual(
        calls,
        [],
        `Should be no-op for opaque referrer ${referrer}`,
      );
    }
  });

  it("swallows parent.postMessage throws (sandbox / CSP edge cases)", () => {
    let throwingCalled = false;
    assert.doesNotThrow(() =>
      withParent(
        {
          postMessage: () => {
            throwingCalled = true;
            throw new DOMException("Blocked by CSP", "SecurityError");
          },
        },
        () => {
          withReferrer("https://parent.example/", () => {
            postReadyToParent("0.3.0");
          });
        },
      ),
    );
    assert.strictEqual(
      throwingCalled,
      true,
      "postMessage attempt should have been made even though it throws",
    );
  });
});

describe("postReadyToParent — happy path", () => {
  it("posts {type, version} to the referrer's origin", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        withReferrer("https://app.example.com/views/edit/abc", () => {
          postReadyToParent("0.3.0");
        });
      },
    );
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].msg, {
      type: "already:ready",
      version: "0.3.0",
    });
    // Origin is the referrer's origin, NOT "*" — defense against
    // broadcast to hostile parents.
    assert.strictEqual(calls[0].origin, "https://app.example.com");
  });

  it("derives origin from a referrer with port + path", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        withReferrer("http://localhost:5173/?home", () => {
          postReadyToParent("0.3.0");
        });
      },
    );
    assert.strictEqual(calls[0].origin, "http://localhost:5173");
  });

  it("forwards the version arg into the message payload verbatim", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        withReferrer("https://parent.example/", () => {
          postReadyToParent("9.9.9-rc.1");
        });
      },
    );
    assert.strictEqual(calls[0].msg.version, "9.9.9-rc.1");
  });

  it("postInteractionToParent emits the same shape contract — no-ops without a parent", () => {
    const calls = [];
    withParent(window, () => {
      withReferrer("https://parent.example/", () => {
        postInteractionToParent();
      });
    });
    // window.parent === window → not in an iframe → no postMessage.
    assert.deepStrictEqual(calls, []);
  });

  it("postInteractionToParent posts {type:'already:interaction'} to derived parent origin", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        withReferrer("https://parent.example/some/path", () => {
          postInteractionToParent();
        });
      },
    );
    assert.strictEqual(calls.length, 1);
    assert.deepStrictEqual(calls[0].msg, { type: "already:interaction" });
    assert.strictEqual(calls[0].origin, "https://parent.example");
  });

  it("postInteractionToParent no-ops on opaque referrer origin", () => {
    const calls = [];
    withParent(
      { postMessage: (msg, origin) => calls.push({ msg, origin }) },
      () => {
        // about:blank referrer produces an opaque (null) origin per WHATWG URL.
        withReferrer("about:blank", () => {
          postInteractionToParent();
        });
      },
    );
    assert.deepStrictEqual(calls, []);
  });

  it("postInteractionToParent swallows postMessage throws (parent in sandbox)", () => {
    let threw = false;
    withParent(
      {
        postMessage: () => {
          throw new Error("blocked by sandbox");
        },
      },
      () => {
        withReferrer("https://parent.example/", () => {
          try {
            postInteractionToParent();
          } catch {
            threw = true;
          }
        });
      },
    );
    assert.strictEqual(threw, false, "helper must swallow postMessage throws");
  });

  it("never targets wildcard origin", () => {
    // Defense: if the helper ever drifted to `postMessage(msg, "*")`,
    // a hostile parent could receive the ready signal and mount a
    // mistaken-recipient attack on its own postMessage handlers. Pin
    // the contract with an assertion across all happy-path inputs.
    const inputs = [
      "https://parent.example/",
      "http://localhost:5173/",
      "https://app.example.com/views/edit/abc",
    ];
    for (const referrer of inputs) {
      const calls = [];
      withParent(
        { postMessage: (msg, origin) => calls.push({ msg, origin }) },
        () => {
          withReferrer(referrer, () => {
            postReadyToParent("0.3.0");
          });
        },
      );
      assert.notStrictEqual(
        calls[0].origin,
        "*",
        `Should not broadcast to wildcard for referrer ${referrer}`,
      );
    }
  });
});
