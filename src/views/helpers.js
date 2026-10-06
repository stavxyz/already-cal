import { compositeTags } from "../composite.js";
import { setEventDetail } from "../router.js";
import { RSVP_OPEN_CLASS } from "../ui/rsvp-state.js";
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

/** Bind click and keyboard handlers to navigate to an event's detail view. */
export function bindEventClick(
  el,
  event,
  viewName,
  config,
  { stopPropagation = false } = {},
) {
  // A card with an open RSVP form stays put: navigating would discard what
  // the visitor typed.
  const rsvpOpen = () => el.classList.contains(RSVP_OPEN_CLASS);
  function handleClick(e) {
    if (rsvpOpen()) return;
    if (stopPropagation) e.stopPropagation();
    if (config.onEventClick) {
      const result = config.onEventClick(event, viewName);
      if (result === false) return;
    }
    // A part with no id has no link of its own, so its click opens the
    // parent's detail, where the part is shown.
    setEventDetail(event.id ?? event.parentId);
  }
  el.addEventListener("click", handleClick);
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      if (rsvpOpen()) return;
      e.preventDefault();
      if (stopPropagation) e.stopPropagation();
      handleClick(e);
    }
  });
  el.setAttribute("tabindex", "0");
  el.setAttribute("role", "button");
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
