import { decorateParts } from "../ui/card-parts.js";
import { decorateRsvp } from "../ui/rsvp-form.js";
import { isPast } from "../util/dates.js";
import { bindEventClick } from "./helpers.js";

/**
 * The state classes, the data attribute, and the click binding of a card.
 * Private to this module on purpose: the only way to apply it is through
 * decorateEventCard, which has already turned away an error card.
 */
function applyCardState(card, event, viewName, config) {
  if (isPast(event.end || event.start))
    card.classList.add("already-card--past");
  if (event.featured) card.classList.add("already-card--featured");
  card.dataset.eventId = event.id;
  bindEventClick(card, event, viewName, config);
}

/**
 * Everything a view adds to a card once its layout has rendered it, in one
 * fixed order: the state classes and the click binding, a composite's parts,
 * and the RSVP control. Grid, list, and the popover all call this. A card
 * site that listed its decorators by hand could leave one out, and a card
 * that misses the parts decorator silently loses events.
 *
 * What differs between sites is an option here. `timezone` is the calendar's
 * zone the site rendered the layout with. The popover passes `rsvp: false`:
 * it is a preview, and its card closes on any click.
 */
export function decorateEventCard(
  card,
  event,
  viewName,
  config,
  { timezone, rsvp = true } = {},
) {
  // An error card stands in for a layout that failed. It says the event
  // could not be displayed, so it gets no state, no click, no parts, and
  // nothing to act on. This is where the sequence asks. decorateRsvp asks
  // again on its own, because it is exported and tested as a standalone
  // decorator (ui/rsvp-form.js).
  if (card.classList.contains("already-card--error")) return;
  applyCardState(card, event, viewName, config);
  decorateParts(card, event, config, { timezone });
  if (rsvp) decorateRsvp(card, event, config);
}
