import { safeRenderCard } from "../layouts/helpers.js";
import { getLayout } from "../layouts/registry.js";
import { THEME_DEFAULTS } from "../theme.js";
import { decorateCard } from "../views/helpers.js";

/**
 * The event card, shown on hover (pointer) or tap (touch) from the month and
 * week views.
 *
 * The card is built by the same getLayout() + safeRenderCard() call the grid
 * view makes and then handed to the same decorateCard(), so it carries the
 * past and featured modifiers, the data-event-id hook, and the click binding
 * that honors config.onEventClick. Skipping decorateCard made this a lookalike
 * rather than the same component.
 *
 * ONE popover exists at a time across every mounted calendar, which is the
 * behavior a hover card should have. It is keyed by its owning root so that a
 * second calendar re-rendering cannot close a card the reader is looking at in
 * the first.
 *
 * Getting stuck is the failure mode worth designing against, so every exit
 * runs through one close(). mouseleave alone is not enough: it never fires
 * when the anchor is destroyed under the pointer, which happens on every
 * re-render.
 */

// Long enough that sweeping the pointer across a month does not strobe, short
// enough to feel like a response. No source beyond that judgement.
const OPEN_DELAY_MS = 150;
// Covers the gap between the anchor and the card so travelling to it does not
// close the card en route.
const CLOSE_GRACE_MS = 120;
// Half of the 1rem that `.already-event-popover`'s max-width reserves.
const EDGE_GAP_PX = 8;

let active = null;
let openTimer = null;
let closeTimer = null;
// Set by a touch pointerdown and read by the mouseenter handler. A MouseEvent
// carries no pointerType, so the hover path cannot tell on its own that iOS
// synthesised it after a tap.
let lastPointerWasTouch = false;

function clearTimers() {
  if (openTimer) {
    clearTimeout(openTimer);
    openTimer = null;
  }
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

/**
 * Close the open popover.
 *
 * Pass `root` to close only a popover belonging to that calendar; omit it to
 * close whatever is open. Every caller that closes on its own re-render passes
 * its root, so two calendars on one page do not close each other's cards.
 */
export function closeEventPopover(root) {
  if (root && active && active.root !== root) return;
  clearTimers();
  if (!active) return;
  const { el, detach } = active;
  active = null;
  detach();
  el.remove();
}

/**
 * Open the popover for `event`, anchored to `anchorEl`, inside `root`.
 *
 * Parented to the `.already` root so it inherits the theme's custom properties
 * and stays inside the embed's stacking context. `.already` sets
 * `position: relative` so that root is also the containing block these
 * coordinates are measured against.
 */
export function openEventPopover(anchorEl, event, root, config, viewName) {
  closeEventPopover();
  config = config || {};
  const theme = config._theme || THEME_DEFAULTS;

  const el = document.createElement("div");
  el.className = "already-event-popover";

  const card = safeRenderCard(getLayout(theme.layout), event, {
    orientation: theme.orientation,
    imagePosition: theme.imagePosition,
    index: 0,
    timezone: config.timezone,
    locale: config.locale,
    config,
  });
  card.classList.add("already-event-popover__card");
  // decorateCard binds the click through bindEventClick, so config.onEventClick
  // is consulted and can veto navigation exactly as it does from the grid.
  decorateCard(card, event, viewName || "month", config);
  // decorateCard bound navigation above; this only dismisses the card so it
  // does not outlive the view it was opened from.
  card.addEventListener("click", () => closeEventPopover());
  el.appendChild(card);

  root.appendChild(el);
  position(el, anchorEl, root);

  const onKeydown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      closeEventPopover();
    }
  };
  const onPointerDown = (e) => {
    if (el.contains(e.target) || anchorEl.contains(e.target)) return;
    closeEventPopover();
  };
  // Scroll and resize move the anchor out from under an absolutely positioned
  // card; blur and visibilitychange mean the pointer left without a mouseleave.
  const onDismiss = () => closeEventPopover();

  document.addEventListener("keydown", onKeydown, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("visibilitychange", onDismiss);
  window.addEventListener("scroll", onDismiss, true);
  window.addEventListener("resize", onDismiss);
  window.addEventListener("blur", onDismiss);

  el.addEventListener("mouseenter", clearTimers);
  el.addEventListener("mouseleave", scheduleClose);

  active = {
    el,
    root,
    anchorEl,
    detach() {
      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("visibilitychange", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("resize", onDismiss);
      window.removeEventListener("blur", onDismiss);
    },
  };
  return el;
}

/**
 * Place the card below its anchor, flipping above when it would overflow the
 * root's bottom edge and clamping horizontally at the right.
 *
 * Must run after the card is in the DOM: the flip needs the card's own height.
 * Returns without positioning when layout metrics are unavailable, which is
 * every rect in jsdom.
 */
function position(el, anchorEl, root) {
  const rootRect = root.getBoundingClientRect?.();
  const anchorRect = anchorEl.getBoundingClientRect?.();
  if (!rootRect || !anchorRect || !rootRect.width) return;
  const elRect = el.getBoundingClientRect();

  // The containing block of an absolutely positioned child is the padding box,
  // so the usable width excludes the root's border but not its padding.
  const style = window.getComputedStyle?.(root);
  const borderX =
    (Number.parseFloat(style?.borderLeftWidth) || 0) +
    (Number.parseFloat(style?.borderRightWidth) || 0);
  const usableWidth = rootRect.width - borderX;

  let top = anchorRect.bottom - rootRect.top;
  if (top + elRect.height > rootRect.height) {
    const flipped = anchorRect.top - rootRect.top - elRect.height;
    top = flipped >= 0 ? flipped : Math.max(0, rootRect.height - elRect.height);
  }

  // max-width leaves a 1rem gap in total when the card is capped; splitting it
  // across both sides keeps a capped card centred instead of flush right.
  let left = anchorRect.left - rootRect.left;
  if (left + elRect.width > usableWidth - EDGE_GAP_PX) {
    left = Math.max(EDGE_GAP_PX, usableWidth - elRect.width - EDGE_GAP_PX);
  }

  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
}

function scheduleClose() {
  clearTimers();
  closeTimer = setTimeout(() => closeEventPopover(), CLOSE_GRACE_MS);
}

/**
 * Bind hover and tap on an event label so it shows the card.
 *
 * Touch opens on pointerdown and calls preventDefault, because the tap
 * otherwise synthesises a click that reaches the anchor's own bindEventClick
 * and navigates straight to the detail view, collapsing the two-step into one.
 * A second tap on the same anchor is allowed through to do exactly that.
 */
export function bindEventPopover(anchorEl, event, root, config, viewName) {
  anchorEl.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "touch") {
      lastPointerWasTouch = false;
      return;
    }
    lastPointerWasTouch = true;
    clearTimers();
    if (active?.anchorEl === anchorEl) return;
    if (e.cancelable) e.preventDefault();
    openEventPopover(anchorEl, event, root, config, viewName);
  });

  anchorEl.addEventListener("mouseenter", () => {
    if (lastPointerWasTouch) return;
    clearTimers();
    openTimer = setTimeout(() => {
      openEventPopover(anchorEl, event, root, config, viewName);
    }, OPEN_DELAY_MS);
  });

  anchorEl.addEventListener("mouseleave", () => {
    // Cancels a pending open too, so sweeping across a month never leaves a
    // ghost popover opening behind the pointer.
    scheduleClose();
  });
}
