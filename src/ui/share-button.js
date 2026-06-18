import { shareOrCopy } from "../util/share.js";
import { createElement } from "../views/helpers.js";

// Inline "share nodes" glyph — currentColor, 16x16, decorative. Kept inline per
// the single existing icon precedent (header.js subscribe icon); the moment a
// share icon is needed in a third file, extract a shared icon helper instead.
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
  btn.innerHTML = SHARE_ICON;
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
    labelSpan.textContent = copiedLabel;
    clearRevert();
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
