import { isSecondListing, partsOf } from "../composite.js";
import { eventDayKey, formatEventWhen } from "../util/dates.js";
import { createElement } from "../views/helpers.js";

// A card is a summary. The detail view lists every part.
const MAX_PARTS = 3;

/**
 * When a part starts, as a card line says it: the start alone, with the date
 * when the part is on another day than its parent. formatEventWhen owns the
 * formatting and the zone handling, so a part from a calendar in another zone
 * is labelled the way its parent's time is on the same card.
 */
function partWhen(part, parent, { timezone, locale, i18n }) {
  const otherDay = eventDayKey(part.start) !== eventDayKey(parent.start);
  // An all-day part on the parent's own day has no time to print.
  if (part.allDay && !otherDay) return i18n.allDay || "All Day";
  return formatEventWhen(
    { ...part, end: undefined },
    {
      sourceZoneFallback: timezone,
      locale,
      dateStyle: otherDay ? "short" : "time",
    },
  );
}

/**
 * Everything that makes a card a composite's card: the modifier class and the
 * block that lists its parts. The views apply this to every card after its
 * layout has rendered it, so a layout that knows nothing about parts still
 * shows them. That matters because composition has already taken the parts
 * out of the top level: if showing them were a layout's job, a custom layout
 * would lose those events.
 *
 * A layout chooses the position by rendering an empty element with the class
 * `already-card__parts`. Without one the block goes at the end of
 * `.already-card__body`, or of the card when it has no body.
 *
 * decorateEventCard (views/card-decoration.js) is the only supported caller.
 * It turns away an error card first, and this function does not check for
 * one. It is exported only because it lives in a module of its own.
 * `timezone` is the calendar's zone, the same fallback the layout was
 * rendered with.
 */
export function decorateParts(card, event, config, { timezone } = {}) {
  const slot = card.querySelector(".already-card__parts");
  const parts = partsOf(event);
  if (parts.length === 0) {
    slot?.remove();
    return;
  }
  card.classList.add("already-card--composite");

  // A second listing has the parent's title. A line for it adds nothing.
  const listed = parts.filter((part) => !isSecondListing(part, event));
  if (listed.length === 0) {
    slot?.remove();
    return;
  }

  const i18n = config?.i18n || {};
  const format = { timezone, locale: config?.locale, i18n };
  const block = slot || createElement("div", "already-card__parts");
  block.textContent = "";
  for (const part of listed.slice(0, MAX_PARTS)) {
    const line = createElement("div", "already-card__part");
    const when = createElement("span", "already-card__part-time");
    when.textContent = partWhen(part, event, format);
    line.appendChild(when);
    // An untitled part has nothing to print after its time.
    if (part.title) {
      const title = createElement("span", "already-card__part-title");
      title.textContent = part.title;
      line.append(" ", title);
    }
    block.appendChild(line);
  }
  if (listed.length > MAX_PARTS) {
    const more = createElement("div", "already-card__parts-more");
    more.textContent = (i18n.moreParts || "+{count} more").replaceAll(
      "{count}",
      listed.length - MAX_PARTS,
    );
    block.appendChild(more);
  }
  if (!slot) {
    (card.querySelector(".already-card__body") || card).appendChild(block);
  }
}
