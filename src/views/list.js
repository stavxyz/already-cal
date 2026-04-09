import { formatDate, formatTime } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, filterHidden, sortFeaturedByDate } from './helpers.js';

export function renderListView(container, events, timezone, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || 'All Day';

  events = filterHidden(events);
  events = sortFeaturedByDate(events, timezone, locale);

  const list = createElement('div', 'ogcal-list');

  for (const event of events) {
    const item = createElement('div');
    applyEventClasses(item, event, 'ogcal-list-item');
    bindEventClick(item, event, 'list', config);

    const dateCol = createElement('div', 'ogcal-list-date');
    const dateDay = createElement('div', 'ogcal-list-date-day');
    dateDay.textContent = formatDate(event.start, timezone, locale);
    dateCol.appendChild(dateDay);
    const dateTime = createElement('div', 'ogcal-list-date-time');
    dateTime.textContent = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
    dateCol.appendChild(dateTime);
    item.appendChild(dateCol);

    const info = createElement('div', 'ogcal-list-info');
    const title = createElement('div', 'ogcal-list-title');
    title.textContent = event.title;
    info.appendChild(title);
    if (event.location) {
      const loc = createElement('div', 'ogcal-list-location');
      loc.textContent = event.location;
      info.appendChild(loc);
    }
    item.appendChild(info);

    list.appendChild(item);
  }

  container.innerHTML = '';
  container.appendChild(list);
}
