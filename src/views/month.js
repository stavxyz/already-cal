import { eventHref, setDayView } from "../router.js";
import { eventAnchor, fillEventAnchor } from "../ui/event-link.js";
import { bindEventPopover, closeEventPopover } from "../ui/event-popover.js";
import {
  getDayNames,
  getDaysInMonth,
  getFirstDayOfMonth,
  getMonthName,
  isToday,
  toDateKey,
} from "../util/dates.js";
import {
  bindEventClick,
  createElement,
  eventLinkText,
  sortFeatured,
} from "./helpers.js";

/** Render the month calendar grid view. */
export function renderMonthView(
  container,
  placement,
  timezone,
  currentDate,
  config,
) {
  config = config || {};
  const locale = config.locale;
  const weekStartDay = config.weekStartDay || 0;
  const maxEventsPerDay = config.maxEventsPerDay || 3;
  const i18n = config.i18n || {};
  const moreEventsTemplate = i18n.moreEvents || "+{count} more";

  // The nav buttons below re-render by calling this function directly,
  // bypassing already-cal.js's renderView. A chip destroyed under the
  // pointer never fires mouseleave, so close here too or the card hangs.
  closeEventPopover(container.closest?.(".already") || container);

  // Which day each item is on comes from the placement, the one place that
  // decides it (see views/placement.js).
  const { byDay } = placement;

  // The popover parents to the `.already` root so it inherits the theme's
  // custom properties; `container` is the inner view container.
  const popoverRoot = container.closest?.(".already") || container;
  // An embedder who left "day" out of `views` disabled it deliberately, and
  // renderView's switch has no guard of its own, so navigating there would
  // strand them in a view their selector does not list.
  const dayViewEnabled = !config.views || config.views.includes("day");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month, weekStartDay);
  const monthName = getMonthName(year, month, locale);
  const dayNames = getDayNames(locale, weekStartDay);

  const grid = createElement("div", "already-month");

  // Navigation
  const nav = createElement("div", "already-month-nav");

  const prevBtn = createElement("button", "already-month-prev", {
    "aria-label": "Previous month",
  });
  prevBtn.textContent = "\u2039";
  prevBtn.addEventListener("click", () => {
    renderMonthView(
      container,
      placement,
      timezone,
      new Date(year, month - 1, 1),
      config,
    );
  });
  nav.appendChild(prevBtn);

  const title = createElement("span", "already-month-title");
  // getMonthName already formats { month: "long", year: "numeric" }, so it
  // returns "September 2026". Appending year again rendered "September 2026 2026".
  title.textContent = monthName;
  nav.appendChild(title);

  const nextBtn = createElement("button", "already-month-next", {
    "aria-label": "Next month",
  });
  nextBtn.textContent = "\u203a";
  nextBtn.addEventListener("click", () => {
    renderMonthView(
      container,
      placement,
      timezone,
      new Date(year, month + 1, 1),
      config,
    );
  });
  nav.appendChild(nextBtn);

  grid.appendChild(nav);

  // Day headers
  const headerRow = createElement("div", "already-month-header", {
    role: "row",
  });
  for (const name of dayNames) {
    const cell = createElement("div", "already-month-dayname");
    cell.textContent = name;
    headerRow.appendChild(cell);
  }
  grid.appendChild(headerRow);

  // Calendar body
  const body = createElement("div", "already-month-body", { role: "grid" });

  let row = createElement("div", "already-month-row", { role: "row" });

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    row.appendChild(
      createElement("div", "already-month-cell already-month-cell--empty", {
        role: "gridcell",
      }),
    );
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(year, month, d);
    const dayEvents = sortFeatured(byDay.get(toDateKey(cellDate)) || []);
    const today = isToday(cellDate);

    const cell = createElement("div", null, { role: "gridcell" });
    cell.className =
      "already-month-cell" +
      (today ? " already-month-cell--today" : "") +
      (dayEvents.length ? " already-month-cell--has-events" : "");

    const dayNum = createElement("div", "already-month-day");
    dayNum.textContent = d;
    cell.appendChild(dayNum);

    // Pointer-only affordance: no role="button" and no tabindex, because
    // there is deliberately no keyboard path here (adding 31 tab stops to a
    // grid whose chips are already focusable links costs more than it buys).
    // Claiming to be a button while unreachable by keyboard would be worse
    // than not claiming it. The handler bails on chip clicks by target.
    cell.addEventListener("click", (e) => {
      if (e.target.closest?.(".already-month-chip")) return;
      if (!dayViewEnabled) return;
      setDayView(toDateKey(cellDate), config);
    });

    for (const event of dayEvents.slice(0, maxEventsPerDay)) {
      // The chip is the event's link itself: one line of text, so nothing
      // to stretch. An entry with no route gets a plain div (ui/event-link.js).
      const chip = eventAnchor(
        eventHref(event),
        "already-month-chip" +
          (event.featured ? " already-month-chip--featured" : ""),
      );
      fillEventAnchor(chip, event.title, eventLinkText(event, config));
      // No stopPropagation: the click has to reach the root's interaction
      // listener, which posts the cross-origin engagement signal. The cell
      // handler above bails on chip clicks by target instead.
      bindEventClick(chip, event, "month", config);
      bindEventPopover(chip, event, popoverRoot, config, "month", timezone);
      cell.appendChild(chip);
    }

    if (dayEvents.length > maxEventsPerDay) {
      const more = createElement("div", "already-month-more");
      more.textContent = moreEventsTemplate.replace(
        "{count}",
        dayEvents.length - maxEventsPerDay,
      );
      cell.appendChild(more);
    }

    row.appendChild(cell);

    if ((firstDay + d) % 7 === 0) {
      body.appendChild(row);
      row = createElement("div", "already-month-row", { role: "row" });
    }
  }

  // Fill remaining cells
  const remaining = (firstDay + daysInMonth) % 7;
  if (remaining > 0) {
    for (let i = remaining; i < 7; i++) {
      row.appendChild(
        createElement("div", "already-month-cell already-month-cell--empty", {
          role: "gridcell",
        }),
      );
    }
    body.appendChild(row);
  }

  grid.appendChild(body);
  container.innerHTML = "";
  container.appendChild(grid);
}
