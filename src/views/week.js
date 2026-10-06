import { setDayView } from "../router.js";
import { bindEventPopover, closeEventPopover } from "../ui/event-popover.js";
import {
  eventDayKey,
  formatDateShort,
  getWeekDates,
  isToday,
  toDateKey,
} from "../util/dates.js";
import {
  bindEventClick,
  createElement,
  filterHidden,
  sortFeatured,
} from "./helpers.js";

/** Render the 7-column week view. */
export function renderWeekView(
  container,
  events,
  timezone,
  currentDate,
  config,
) {
  config = config || {};
  const locale = config.locale;
  const weekStartDay = config.weekStartDay || 0;
  const dates = getWeekDates(currentDate, weekStartDay);

  events = filterHidden(events);

  const popoverRoot = container.closest?.(".already") || container;
  // The nav buttons re-render by calling this function directly, bypassing
  // already-cal.js's renderView. A block destroyed under the pointer never
  // fires mouseleave, so close here too or the card hangs.
  closeEventPopover(popoverRoot);
  // An embedder who left "day" out of `views` disabled it deliberately, and
  // renderView's switch has no guard of its own.
  const dayViewEnabled = !config.views || config.views.includes("day");

  const week = createElement("div", "already-week");

  // Navigation
  const nav = createElement("div", "already-week-nav");
  const startLabel = formatDateShort(dates[0].toISOString(), timezone, locale);
  const endLabel = formatDateShort(dates[6].toISOString(), timezone, locale);

  const prevBtn = createElement("button", "already-week-prev", {
    "aria-label": "Previous week",
  });
  prevBtn.textContent = "\u2039";
  prevBtn.addEventListener("click", () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    renderWeekView(container, events, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement("span", "already-week-title");
  title.textContent = `${startLabel} \u2013 ${endLabel}`;
  nav.appendChild(title);

  const nextBtn = createElement("button", "already-week-next", {
    "aria-label": "Next week",
  });
  nextBtn.textContent = "\u203a";
  nextBtn.addEventListener("click", () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    renderWeekView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  week.appendChild(nav);

  const columns = createElement("div", "already-week-columns");
  const dayFmt = new Intl.DateTimeFormat(locale || "en-US", {
    weekday: "short",
  });

  for (const date of dates) {
    const col = createElement(
      "div",
      `already-week-col${isToday(date) ? " already-week-col--today" : ""}`,
    );

    const header = createElement("div", "already-week-col-header");
    const dayName = dayFmt.format(date);
    const dayNameEl = createElement("span", "already-week-dayname");
    dayNameEl.textContent = dayName;
    header.appendChild(dayNameEl);
    const dayNumEl = createElement("span", "already-week-daynum");
    dayNumEl.textContent = date.getDate();
    header.appendChild(dayNumEl);
    col.appendChild(header);

    // Columns are keyed by the VIEWER's day (all-day values stay absolute) so
    // an event's column matches the viewer-local time on its card — see
    // eventDayKey.
    const dayEvents = sortFeatured(
      events.filter((e) => eventDayKey(e.start) === toDateKey(date)),
    );

    for (const event of dayEvents) {
      const block = createElement(
        "div",
        "already-week-event" +
          (event.featured ? " already-week-event--featured" : ""),
      );
      block.textContent = event.title;
      // No stopPropagation: the click has to reach the root's interaction
      // listener, which posts the cross-origin engagement signal. The column
      // handler below bails on block clicks by target instead.
      bindEventClick(block, event, "week", config);
      bindEventPopover(block, event, popoverRoot, config, "week", timezone);
      col.appendChild(block);
    }

    // Pointer-only, matching month: see the comment there for why this
    // carries no role or tabindex.
    col.addEventListener("click", (e) => {
      if (e.target.closest?.(".already-week-event")) return;
      if (!dayViewEnabled) return;
      setDayView(toDateKey(date), config);
    });

    columns.appendChild(col);
  }

  week.appendChild(columns);
  container.innerHTML = "";
  container.appendChild(week);
}
