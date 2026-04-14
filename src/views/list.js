import { getLayout } from "../layouts/registry.js";
import {
  bindEventClick,
  createElement,
  filterHidden,
  sortFeaturedByDate,
} from "./helpers.js";
import { isPast } from "../util/dates.js";

/** Render the list view using layout cards (horizontal by default). */
export function renderListView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const theme = config._theme || {
    layout: "clean",
    orientation: "vertical",
    imagePosition: "left",
  };

  // List view defaults to horizontal orientation
  const orientation =
    theme.layout === "compact" ? "vertical" : "horizontal";

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const list = createElement("div", "already-list");
  const renderCard = getLayout(theme.layout);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const card = renderCard(event, {
      orientation,
      imagePosition: theme.imagePosition,
      index: i,
      timezone,
      locale,
      config,
    });

    if (isPast(event.start)) card.classList.add("already-card--past");
    if (event.featured) card.classList.add("already-card--featured");
    card.dataset.eventId = event.id;
    bindEventClick(card, event, "list", config);

    list.appendChild(card);
  }

  container.innerHTML = "";
  container.appendChild(list);
}
