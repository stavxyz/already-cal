import { getLayout } from "../layouts/registry.js";
import {
  bindEventClick,
  createElement,
  filterHidden,
  sortFeaturedByDate,
} from "./helpers.js";
import { isPast } from "../util/dates.js";

/** Render the card grid view with thumbnails. */
export function renderGridView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const theme = config._theme || {
    layout: "clean",
    orientation: "vertical",
    imagePosition: "left",
  };

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const grid = createElement("div", "already-grid");
  const renderCard = getLayout(theme.layout);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const card = renderCard(event, {
      orientation: theme.orientation,
      imagePosition: theme.imagePosition,
      index: i,
      timezone,
      locale,
      config,
    });

    // Add modifier classes via classList (not applyEventClasses which
    // overwrites className and would destroy layout-specific classes)
    if (isPast(event.start)) card.classList.add("already-card--past");
    if (event.featured) card.classList.add("already-card--featured");
    card.dataset.eventId = event.id;
    bindEventClick(card, event, "grid", config);

    grid.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(grid);
}
