import { shareOrCopy } from "../util/share.js";
import { createElement } from "../views/helpers.js";

// Inline icons — currentColor, 16x16, decorative. Two variants so the glyph
// matches what the click will actually do: where the browser has the native
// share sheet (Safari/iOS, Android Chrome) the button shows the platform
// "share" mark (box + up-arrow), which is what users there expect; otherwise it
// copies the link and shows the "share nodes" mark.
const NATIVE_SHARE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 2v8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5.25 4.25 8 1.5l2.75 2.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 6.5H4A1.5 1.5 0 0 0 2.5 8v5A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 12 6.5h-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SHARE_ICON = `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="12" cy="3.5" r="1.7" stroke="currentColor" stroke-width="1.5"/><circle cx="4" cy="8" r="1.7" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12.5" r="1.7" stroke="currentColor" stroke-width="1.5"/><path d="M5.5 7.2l5-2.7M5.5 8.8l5 2.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;

/**
 * Build a share <button>. On click it resolves the current URL via getUrl(),
 * hands it to shareOrCopy, and — when the copy fallback ran — briefly swaps the
 * label to copiedLabel (announced via aria-live) then reverts. getUrl/getTitle
 * are thunks so values reflect state at click time.
 */
export function createShareButton({
  className,
  label,
  copiedLabel,
  getUrl,
  getTitle,
  copiedDuration = 2000,
}) {
  const btn = createElement("button", className, {
    type: "button",
    "aria-label": label,
  });
  // Match the icon to the action: native share sheet vs copy-to-clipboard.
  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  btn.innerHTML = hasNativeShare ? NATIVE_SHARE_ICON : SHARE_ICON;
  const labelSpan = createElement("span", "already-share-label");
  labelSpan.textContent = label;
  labelSpan.setAttribute("aria-live", "polite");
  btn.appendChild(labelSpan);

  let revertTimer = null;
  function clearRevert() {
    if (revertTimer) {
      clearTimeout(revertTimer);
      revertTimer = null;
    }
  }
  function showCopied() {
    clearRevert();
    labelSpan.textContent = copiedLabel;
    revertTimer = setTimeout(() => {
      labelSpan.textContent = label;
      revertTimer = null;
    }, copiedDuration);
  }

  btn.addEventListener("click", () => {
    btn._shareResult = (async () => {
      const outcome = await shareOrCopy({ title: getTitle(), url: getUrl() });
      if (outcome === "copied") showCopied();
      return outcome;
    })();
  });

  // Cancel any pending "Copied!" revert timer. Call when the button is torn
  // down / removed from the DOM so a stale timer can't fire late or hold its
  // closure past the button's lifetime.
  btn.destroy = clearRevert;

  return btn;
}
