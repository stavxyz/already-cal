import { compositeTags } from "../composite.js";
import { eventDayKey, isPast } from "../util/dates.js";
import { isCategoryTag, tagLabel } from "../util/tags.js";

/** Create a DOM element with optional class name and attributes. */
export function createElement(tag, className, attrs) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

/**
 * The text of an event link that has no visible title to carry it (a layout
 * that rendered no title element). One resolver for every host, so the rule
 * cannot drift between cards and rows.
 */
export function eventLinkText(entry, config) {
  return (
    String(entry?.title ?? "").trim() || config?.i18n?.openEvent || "Open event"
  );
}

/**
 * Category tag pills for an event as a whole. A composite shows its parts'
 * tags with its own, so this reads through the composite accessor. Returns
 * null when there is nothing to show. The one owner of pill markup: the badge
 * and compact layouts and the detail view all call it.
 */
export function createTagPills(event, wrapperClass, pillClass) {
  const tags = compositeTags(event).filter(isCategoryTag);
  if (tags.length === 0) return null;
  const wrapper = createElement("div", wrapperClass);
  for (const tag of tags) {
    const pill = createElement("span", pillClass);
    pill.textContent = tagLabel(tag);
    wrapper.appendChild(pill);
  }
  return wrapper;
}

/**
 * Bind the activation of an event's link. On a plain activation (the primary
 * button with no modifier key, which is also what Enter on a focused link
 * produces) it asks the caller's `canNavigate` first (a card with its RSVP
 * form open says no), then `config.onEventClick`, whose `false` return stops
 * navigation, and then navigates by copying the link's own href into the
 * hash. That is the navigation the browser would have performed, done by
 * hand because the test environment does not navigate on anchor activation.
 * A middle or modifier click is left to the browser, which opens a new tab
 * (browsers send those as auxclick, so the button check is a guard). An
 * entry with no route (router.eventHref) has no link: `el` is then null, or a
 * plain element with no href, and the call is a no-op.
 */
export function bindEventClick(
  el,
  event,
  viewName,
  config,
  { canNavigate } = {},
) {
  if (el === null || !el.hasAttribute("href")) return;
  el.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    e.preventDefault();
    if (canNavigate && !canNavigate()) return;
    if (config.onEventClick) {
      const result = config.onEventClick(event, viewName);
      if (result === false) return;
    }
    window.location.hash = el.getAttribute("href");
  });
}

/** Apply base class plus --past and --featured modifier classes to an event element. */
export function applyEventClasses(el, event, baseClass) {
  let cls = baseClass;
  if (isPast(event.end || event.start)) cls += ` ${baseClass}--past`;
  if (event.featured) cls += ` ${baseClass}--featured`;
  el.className = cls;
}

/** Sort events so featured events come first. */
export function sortFeatured(events) {
  return [...events].sort(
    (a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0),
  );
}

/**
 * Sort events so featured events come first within each date group. Groups are
 * keyed by the VIEWER's day (all-day values stay absolute) to match the
 * viewer-local time shown on each card. See eventDayKey.
 */
export function sortFeaturedByDate(events) {
  const dateKey = (e) => eventDayKey(e.start);
  // Group by date preserving original order, sort featured first within each group
  const groups = new Map();
  for (const e of events) {
    const key = dateKey(e);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  return [...groups.values()].flatMap((group) =>
    [...group].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)),
  );
}
