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
 * dropping the message. See parent-repo issue stavxyz/already.events#245.
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
  if (typeof window === "undefined") return;
  if (window.parent === window) return;
  if (!document.referrer) return;
  let parentOrigin;
  try {
    parentOrigin = new URL(document.referrer).origin;
  } catch {
    return;
  }
  if (!parentOrigin || parentOrigin === "null") return;
  try {
    window.parent.postMessage({ type: "already:ready", version }, parentOrigin);
  } catch {
    // Parent in a sandbox, or a CSP that blocks cross-frame
    // postMessage. Silent — consumer's load-event fallback path is
    // still in place for these edge cases.
  }
}
