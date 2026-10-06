import { isSecondListing, partsOf } from "../composite.js";
import { startOrder } from "../util/dates.js";

/**
 * Day placement for the month, week, and day views: which items are on which
 * day. Those views ask this for a day's items and never work out an event's
 * day themselves, so a month cell, a week column, and the day view cannot
 * disagree with each other or with what is folded.
 *
 * Each event is filed under the day of its start. A composite's part is
 * folded wherever its parent is shown: on the parent's own day it is filed
 * under no day, and on any other day, where the parent is not shown, it is an
 * item of its own. That rule lives here and nowhere else.
 *
 * Nothing in the input is changed. A parent is the object every other view
 * receives, with every part still in `parts`. Which parts are folded on the
 * parent's day is recorded only in `sameDayParts`. It is keyed by the parent
 * object, not its id, because two calendars can each carry an event with the
 * same id.
 *
 * Within a day, the top-level events keep the order they came in: the widget
 * does not sort what a producer hands it, and this does not start to. A part
 * that becomes an item is placed among the items of its day by start (before
 * the first that starts later, else last), which holds whatever order the
 * input is in.
 *
 * @param {object[]} events the top-level list, after the past and tag filters
 * @param {(start: string) => string} dayKeyOf the viewer-zone day key
 * @returns {{ byDay: Map<string, object[]>, sameDayParts: Map<object, object[]> }}
 */
export function placeByDay(events, dayKeyOf) {
  const byDay = new Map();
  const sameDayParts = new Map();
  const elsewhere = [];

  const itemsOn = (day) => {
    let items = byDay.get(day);
    if (!items) {
      items = [];
      byDay.set(day, items);
    }
    return items;
  };

  for (const event of events) {
    const day = dayKeyOf(event.start);
    // An event with no usable start is on no day.
    if (day === "") continue;
    itemsOn(day).push(event);

    const folded = [];
    for (const part of partsOf(event)) {
      const partDay = dayKeyOf(part.start);
      // A part with no usable start is on no day, like an event with none.
      if (partDay === "") continue;
      if (partDay !== day) elsewhere.push({ part, day: partDay });
      // A second listing adds nothing under its own parent's row.
      else if (!isSecondListing(part, event)) folded.push(part);
    }
    if (folded.length > 0) sameDayParts.set(event, folded);
  }

  for (const { part, day } of elsewhere) {
    const items = itemsOn(day);
    const when = startOrder(part);
    const later = items.findIndex((item) => startOrder(item) > when);
    items.splice(later === -1 ? items.length : later, 0, part);
  }

  return { byDay, sameDayParts };
}
