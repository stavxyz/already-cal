import { formatDate, formatTime, isSameDay } from '../util/dates.js';
import { createElement, bindEventClick, applyEventClasses, filterHidden, sortFeatured } from './helpers.js';

export function renderDayView(container, events, timezone, currentDate, config) {
  config = config || {};
  const locale = config.locale;
  const i18n = config.i18n || {};
  const allDayLabel = i18n.allDay || 'All Day';
  const noEventsLabel = i18n.noEventsThisDay || 'No events this day.';

  events = filterHidden(events);

  const day = createElement('div', 'showcal-day');

  // Navigation
  const nav = createElement('div', 'showcal-day-nav');

  const prevBtn = createElement('button', 'showcal-day-prev', { 'aria-label': 'Previous day' });
  prevBtn.textContent = '\u2039';
  prevBtn.addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    renderDayView(container, events, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement('span', 'showcal-day-title');
  title.textContent = formatDate(currentDate.toISOString(), timezone, locale);
  nav.appendChild(title);

  const nextBtn = createElement('button', 'showcal-day-next', { 'aria-label': 'Next day' });
  nextBtn.textContent = '\u203a';
  nextBtn.addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    renderDayView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  day.appendChild(nav);

  // Parse date-only strings (e.g. '2026-04-15') as local dates to avoid UTC midnight offset issues.
  const parseEventDate = (start) => /^\d{4}-\d{2}-\d{2}$/.test(start) ? new Date(`${start}T00:00:00`) : new Date(start);
  let dayEvents = events.filter(e => isSameDay(parseEventDate(e.start), currentDate));
  dayEvents = sortFeatured(dayEvents);

  if (dayEvents.length === 0) {
    const empty = createElement('div', 'showcal-day-empty');
    empty.textContent = noEventsLabel;
    day.appendChild(empty);
  } else {
    for (const event of dayEvents) {
      const item = createElement('div');
      applyEventClasses(item, event, 'showcal-day-event');
      bindEventClick(item, event, 'day', config);

      const timeEl = createElement('div', 'showcal-day-event-time');
      timeEl.textContent = event.allDay ? allDayLabel : formatTime(event.start, timezone, locale);
      item.appendChild(timeEl);

      const info = createElement('div', 'showcal-day-event-info');
      const titleEl = createElement('div', 'showcal-day-event-title');
      titleEl.textContent = event.title;
      info.appendChild(titleEl);
      if (event.location) {
        const loc = createElement('div', 'showcal-day-event-location');
        loc.textContent = event.location;
        info.appendChild(loc);
      }
      item.appendChild(info);

      day.appendChild(item);
    }
  }

  container.innerHTML = '';
  container.appendChild(day);
}
