import { formatDate, formatTime } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, filterHidden, sortFeaturedByDate } from './helpers.js';

export function renderListView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || 'All Day';

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const list = createElement('div', 'already-list');

  for (const event of events) {
    const item = createElement('div');
    applyEventClasses(item, event, 'already-list-item');
    item.dataset.eventId = event.id;
    bindEventClick(item, event, 'list', config);

    const dateCol = createElement('div', 'already-list-date');
    const dateDay = createElement('div', 'already-list-date-day');
    dateDay.textContent = formatDate(event.start, timezone, locale);
    dateCol.appendChild(dateDay);
    const dateTime = createElement('div', 'already-list-date-time');
    dateTime.textContent = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
    dateCol.appendChild(dateTime);
    item.appendChild(dateCol);

    const info = createElement('div', 'already-list-info');
    const title = createElement('div', 'already-list-title');
    title.textContent = event.title;
    info.appendChild(title);
    if (event.location) {
      const loc = createElement('div', 'already-list-location');
      loc.textContent = event.location;
      info.appendChild(loc);
    }
    item.appendChild(info);

    list.appendChild(item);
  }

  container.innerHTML = '';
  container.appendChild(list);
}
