import {
  formatDate,
  formatDateRange,
  isSameDay,
  parseEventDate,
} from "../util/dates.js";
import {
  applyEventClasses,
  bindEventClick,
  createElement,
  filterHidden,
  sortFeatured,
} from "./helpers.js";

/** Render the single-day event list view. */
export function renderDayView(
  container,
  events,
  timezone,
  currentDate,
  config,
) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || "All Day";
  const noEventsLabel = i18n.noEventsThisDay || "No events this day.";

  events = filterHidden(events);

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
    renderDayView(container, events, timezone, prev, config);
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
    renderDayView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  day.appendChild(nav);

  let dayEvents = events.filter((e) =>
    isSameDay(parseEventDate(e.start), currentDate),
  );
  dayEvents = sortFeatured(dayEvents);

  if (dayEvents.length === 0) {
    const empty = createElement("div", "already-day-empty");
    empty.textContent = noEventsLabel;
    day.appendChild(empty);
  } else {
    for (const event of dayEvents) {
      const item = createElement("div");
      applyEventClasses(item, event, "already-day-event");
      bindEventClick(item, event, "day", config);

      const timeEl = createElement("div", "already-day-event-time");
      timeEl.textContent = event.allDay
        ? allDayLabel
        : formatDateRange(event.start, event.end, {
            timeZone: timezone,
            locale,
            dateStyle: "time",
          });
      item.appendChild(timeEl);

      const info = createElement("div", "already-day-event-info");
      const titleEl = createElement("div", "already-day-event-title");
      titleEl.textContent = event.title;
      info.appendChild(titleEl);
      if (event.location) {
        const loc = createElement("div", "already-day-event-location");
        loc.textContent = event.location;
        info.appendChild(loc);
      }
      item.appendChild(info);

      day.appendChild(item);
    }
  }

  container.innerHTML = "";
  container.appendChild(day);
}
