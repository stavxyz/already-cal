import { eventHref } from "../router.js";
import { linkTitle } from "../ui/event-link.js";
import { formatDate, formatScheduleTime, toDateKey } from "../util/dates.js";
import {
  applyEventClasses,
  bindEventClick,
  createElement,
  eventLinkText,
  sortFeatured,
} from "./helpers.js";

/** Render the single-day event list view. */
export function renderDayView(
  container,
  placement,
  timezone,
  currentDate,
  config,
) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || "All Day";
  const noEventsLabel = i18n.noEventsThisDay || "No events this day.";

  // The items of each day, and for each parent the parts folded under it on
  // its own day (see views/placement.js).
  const { byDay, sameDayParts } = placement;

  const day = createElement("div", "already-day");

  // Navigation
  const nav = createElement("div", "already-day-nav");

  const prevBtn = createElement("button", "already-day-prev", {
    "aria-label": "Previous day",
  });
  prevBtn.textContent = "\u2039";
  prevBtn.addEventListener("click", () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    renderDayView(container, placement, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement("span", "already-day-title");
  title.textContent = formatDate(currentDate.toISOString(), timezone, locale);
  nav.appendChild(title);

  const nextBtn = createElement("button", "already-day-next", {
    "aria-label": "Next day",
  });
  nextBtn.textContent = "\u203a";
  nextBtn.addEventListener("click", () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    renderDayView(container, placement, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  day.appendChild(nav);

  const dayEvents = sortFeatured(byDay.get(toDateKey(currentDate)) || []);

  function renderRow(entry, isPart) {
    const item = createElement("div");
    applyEventClasses(item, entry, "already-day-event");
    if (isPart) item.classList.add("already-day-event--part");

    const timeEl = createElement("div", "already-day-event-time");
    timeEl.textContent = formatScheduleTime(entry, {
      sourceZoneFallback: timezone,
      locale,
      allDayLabel,
    });
    item.appendChild(timeEl);

    const info = createElement("div", "already-day-event-info");
    const titleEl = createElement("div", "already-day-event-title");
    titleEl.textContent = entry.title;
    info.appendChild(titleEl);
    if (entry.location) {
      const loc = createElement("div", "already-day-event-location");
      loc.textContent = entry.location;
      info.appendChild(loc);
    }
    item.appendChild(info);

    // The title is the link, stretched over the row by the stylesheet, so
    // the row is clickable everywhere without being a button. A part with
    // no id links to its parent (router.eventHref).
    const link = linkTitle(item, eventHref(entry), {
      titleSelector: ".already-day-event-title",
      linkClass: "already-day-event__link",
      fallbackText: eventLinkText(entry, config),
    });
    bindEventClick(link, entry, "day", config);
    return item;
  }

  if (dayEvents.length === 0) {
    const empty = createElement("div", "already-day-empty");
    empty.textContent = noEventsLabel;
    day.appendChild(empty);
  } else {
    for (const event of dayEvents) {
      day.appendChild(renderRow(event, false));
      // A parent's parts on this same day sit under it. A click on one opens
      // the composite's detail at that part.
      for (const part of sameDayParts.get(event) || []) {
        day.appendChild(renderRow(part, true));
      }
    }
  }

  container.innerHTML = "";
  container.appendChild(day);
}
