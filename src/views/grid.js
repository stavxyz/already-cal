import { formatDateShort, formatTime } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, createEventImage, filterHidden, sortFeaturedByDate } from './helpers.js';

export function renderGridView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const grid = createElement('div', 'ogcal-grid');

  for (const event of events) {
    const card = createElement('div');
    applyEventClasses(card, event, 'ogcal-grid-card');
    bindEventClick(card, event, 'grid', config);

    if (event.image) {
      card.appendChild(createEventImage(event, 'ogcal-grid-image'));
    }

    const body = createElement('div', 'ogcal-grid-body');

    const title = createElement('div', 'ogcal-grid-title');
    title.textContent = event.title;
    body.appendChild(title);

    const dateStr = formatDateShort(event.start, timezone, locale);
    const timeStr = event.allDay ? '' : ` \u00b7 ${formatTime(event.start, timezone, locale)}`;
    const meta = createElement('div', 'ogcal-grid-meta');
    meta.textContent = `${dateStr}${timeStr}`;
    body.appendChild(meta);

    if (event.location) {
      const loc = createElement('div', 'ogcal-grid-location');
      loc.textContent = event.location;
      body.appendChild(loc);
    }

    card.appendChild(body);
    grid.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(grid);
}
