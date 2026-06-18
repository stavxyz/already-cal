/**
 * Post a `{ type: 'already:ready' }` message to the parent window so a
 * framing host (e.g. an embedding iframe with a postMessage-driven
 * theme override flow) can gate its first cross-frame send on a real
 * "I'm initialized" signal from the embed — instead of inferring
 * readiness from the iframe's `load` event, which has a known race
 * window during the `about:blank` → src navigation transition.
 *
 * Why this exists
 * ---------------
 * Before this handshake, consumers had to listen for the iframe's
 * `load` event and assume the embed was ready when it fired. React
 * (and many other DOM frameworks) can dispatch a `load` event for the
 * iframe's initial `about:blank` — which inherits the *parent's*
 * origin — before the embed-origin navigation actually completes.
 * A `postMessage` fired in that window targets the embed origin but
 * the recipient is still parent-origin, throwing `SecurityError` and
 * dropping the message.
 *
 * The handshake replaces the implicit timing inference with an
 * explicit "ready" signal that the parent's `message` listener can
 * await — by definition it can only fire AFTER the embed-origin
 * navigation completes (because this function runs inside the embed's
 * own JavaScript context, which doesn't exist before navigation).
 *
 * Origin targeting
 * ----------------
 * `postMessage` requires a targetOrigin argument. We strictly forbid
 * the wildcard `"*"` here — if a hostile or unrelated parent frames
 * us, broadcasting a ready signal to them would let them mount a
 * mistaken-recipient attack on their own postMessage handlers. We
 * derive the target from `document.referrer.origin` — the origin
 * that loaded this iframe. If the referrer is missing (e.g. embed
 * served via no-referrer policy, or opened as a top-level page) the
 * helper is a no-op; consumers fall back to their pre-handshake
 * load-event path, which works fine in non-framed contexts because
 * there's no parent to message in the first place.
 *
 * No-op contexts
 * --------------
 *   - `window.parent === window` — not in an iframe; nothing to post.
 *   - `!document.referrer` — no parent origin; can't target safely.
 *   - Malformed referrer URL — same.
 *   - `postMessage` throws (e.g. parent in a sandbox that blocks
 *     postMessage, or extremely unusual cross-origin policy) — we
 *     swallow silently; the consumer's load-event fallback still works
 *     for the rare case it matters.
 *
 * @param {string} version - The already-cal package version, baked in
 *   at build time via esbuild's `define` option. Lets consumers branch
 *   on bundle capability if the handshake's message shape evolves.
 * @returns {void}
 */
export function postReadyToParent(version) {
  postToParent({ type: "already:ready", version });
}

/**
 * Post a `{ type: 'already:interaction' }` message to the parent
 * window so a framing host (e.g. an embedding landing-page demo
 * carousel) can detect user engagement inside the embed without
 * needing to instrument the iframe's content directly.
 *
 * Cross-origin iframes do not bubble inner click / scroll / keypress
 * events to the parent document; the `window.blur` heuristic catches
 * clicks but misses scroll-wheel and keyboard activity. This message
 * is the embed-side complement: the bundle emits it on the first
 * interaction observed inside the rendered surface. Consumers
 * listening for it can stop an auto-rotating carousel, surface a
 * "manual mode" affordance, etc.
 *
 * Same no-op contexts + origin-safety guarantees as {@link postReadyToParent}.
 *
 * The bundle's caller is responsible for throttling: if a user clicks
 * 10 times in 5 seconds, the caller emits ONCE (the consumer only
 * needs to know "engagement started"). The shape of the throttle is
 * up to the caller; this helper is a thin wrapper around `postMessage`.
 *
 * @returns {void}
 */
export function postInteractionToParent() {
  postToParent({ type: "already:interaction" });
}

/**
 * Private shared helper. Both public posters derive the same target
 * origin from `document.referrer`, apply the same no-op guards, and
 * swallow the same set of postMessage throws.
 *
 * @param {object} message - Plain-object payload. Caller guarantees a
 *   `type` string starting with `already:`.
 */
function postToParent(message) {
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  if (!document.referrer) return;
  let parentOrigin;
  try {
    parentOrigin = new URL(document.referrer).origin;
  } catch {
    return;
  }
  // `new URL(...).origin` always returns a non-empty string per WHATWG
  // URL, so `!parentOrigin` is defense-in-depth against a future spec
  // drift; the load-bearing guard is `=== "null"` which catches the
  // opaque-origin schemes (about:blank, data:, file://, sandboxed
  // iframes) where postMessage to "null" has undefined cross-browser
  // semantics.
  if (!parentOrigin || parentOrigin === "null") return;
  try {
    window.parent.postMessage(message, parentOrigin);
  } catch {
    // Parent in a sandbox, or a CSP that blocks cross-frame
    // postMessage. Silent — consumer's load-event fallback path is
    // still in place for these edge cases.
  }
}
