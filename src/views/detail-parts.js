import { isSecondListing, partsOf } from "../composite.js";
import {
  eventDayKey,
  formatDate,
  formatScheduleTime,
  viewerTimeZone,
} from "../util/dates.js";
import { renderEntryBody } from "./detail-entry.js";
import { createElement } from "./helpers.js";

const sameInstant = (a, b) => new Date(a).getTime() === new Date(b).getTime();

/**
 * The list of a composite's parts in the detail view, or null for an event
 * without parts or whose parts have nothing of their own to show. Each part shows what is its own: its time and title, its
 * location when that differs from the parent's, and its entry body.
 *
 * A second listing has the parent's title, so the title is not repeated, and
 * a time equal to the parent's is not repeated either. When any part starts
 * on a day other than the parent's start day, the parts are grouped under day
 * headings, by the same day key the calendar views file events under.
 */
export function renderDetailParts(
  event,
  { timezone, locale, config, focusPartId } = {},
) {
  const parts = partsOf(event);
  if (parts.length === 0) return null;
  const i18n = config?.i18n || {};

  // A labelled group, not role="list": the day headings sit between the
  // items, and a list may only contain list items.
  const list = createElement("div", "already-detail-parts", {
    role: "group",
    "aria-label": i18n.compositeParts || "Schedule",
  });

  // Day headings appear as soon as any part starts on a day other than the
  // parent's own start day. Without them a part's time would not say which
  // day of a multi-day parent it belongs to.
  const dayOf = (part) => eventDayKey(part.start);
  const parentDay = eventDayKey(event.start);
  const needsDays = parts.some((part) => dayOf(part) !== parentDay);
  let lastDay = null;
  // A day's heading waits for that day's first row, so a day whose parts all
  // render no row gets no heading standing alone.
  let pendingHeading = null;

  for (const part of parts) {
    const day = dayOf(part);
    if (needsDays && day !== lastDay) {
      // The detail title is the page's h2.
      const heading = createElement("div", "already-detail-parts-day", {
        role: "heading",
        "aria-level": "3",
      });
      heading.textContent = formatDate(part.start, viewerTimeZone(), locale);
      pendingHeading = heading;
      lastDay = day;
    }

    const item = createElement("div", "already-detail-part");
    // A part with no id cannot be linked to, so it carries no id hook and is
    // never the target, even when no part was named.
    if (part.id != null) item.dataset.eventId = part.id;
    if (focusPartId != null && part.id === focusPartId) {
      item.classList.add("already-detail-part--target");
      item.setAttribute("aria-current", "true");
    }

    // An untitled part has nothing to print, and is not a second listing.
    const showTitle = Boolean(part.title) && !isSecondListing(part, event);
    const showTime = !(
      sameInstant(part.start, event.start) && sameInstant(part.end, event.end)
    );
    if (showTime || showTitle) {
      const head = createElement("div", "already-detail-part-head");
      if (showTime) {
        // The same label a row of the day view carries, from its one owner.
        const when = createElement("span", "already-detail-part-time");
        when.textContent = formatScheduleTime(part, {
          sourceZoneFallback: timezone,
          locale,
          allDayLabel: i18n.allDay || "All Day",
        });
        head.appendChild(when);
      }
      if (showTime && showTitle) head.append(" ");
      if (showTitle) {
        // The detail title is the page's h2 and a day heading is level 3, so
        // a part's title sits one level below whichever is above it.
        const title = createElement("span", "already-detail-part-title", {
          role: "heading",
          "aria-level": needsDays ? "4" : "3",
        });
        title.textContent = part.title;
        head.appendChild(title);
      }
      item.appendChild(head);
    }

    if (part.location && part.location !== event.location) {
      const loc = createElement("div", "already-detail-part-location");
      loc.textContent = part.location;
      item.appendChild(loc);
    }

    renderEntryBody(item, part, config);
    // A second listing that adds nothing of its own (same time, no body)
    // has nothing to show, so it gets no row.
    if (item.childNodes.length > 0) {
      if (pendingHeading) list.appendChild(pendingHeading);
      pendingHeading = null;
      list.appendChild(item);
    }
  }
  if (list.querySelector(".already-detail-part") === null) return null;
  return list;
}
