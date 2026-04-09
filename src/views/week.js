import { getWeekDates, formatDateShort, isToday, getDatePartsInTz } from '../util/dates.js';
import { createElement, bindEventClick, filterHidden, sortFeatured } from './helpers.js';

export function renderWeekView(container, events, timezone, currentDate, config) {
  config = config || {};
  const locale = config.locale;
  const weekStartDay = config.weekStartDay || 0;
  const dates = getWeekDates(currentDate, weekStartDay);

  events = filterHidden(events);

  const week = createElement('div', 'showcal-week');

  // Navigation
  const nav = createElement('div', 'showcal-week-nav');
  const startLabel = formatDateShort(dates[0].toISOString(), timezone, locale);
  const endLabel = formatDateShort(dates[6].toISOString(), timezone, locale);

  const prevBtn = createElement('button', 'showcal-week-prev', { 'aria-label': 'Previous week' });
  prevBtn.textContent = '\u2039';
  prevBtn.addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    renderWeekView(container, events, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement('span', 'showcal-week-title');
  title.textContent = `${startLabel} \u2013 ${endLabel}`;
  nav.appendChild(title);

  const nextBtn = createElement('button', 'showcal-week-next', { 'aria-label': 'Next week' });
  nextBtn.textContent = '\u203a';
  nextBtn.addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    renderWeekView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  week.appendChild(nav);

  const columns = createElement('div', 'showcal-week-columns');
  const dayFmt = new Intl.DateTimeFormat(locale || 'en-US', { weekday: 'short' });

  for (const date of dates) {
    const col = createElement('div', 'showcal-week-col' + (isToday(date) ? ' showcal-week-col--today' : ''));

    const header = createElement('div', 'showcal-week-col-header');
    const dayName = dayFmt.format(date);
    const dayNameEl = createElement('span', 'showcal-week-dayname');
    dayNameEl.textContent = dayName;
    header.appendChild(dayNameEl);
    const dayNumEl = createElement('span', 'showcal-week-daynum');
    dayNumEl.textContent = date.getDate();
    header.appendChild(dayNumEl);
    col.appendChild(header);

    const dayEvents = sortFeatured(events.filter(e => {
      const parts = getDatePartsInTz(e.start, timezone, locale);
      return parts.year === date.getFullYear() && parts.month === date.getMonth() && parts.day === date.getDate();
    }));

    for (const event of dayEvents) {
      const block = createElement('div', 'showcal-week-event' + (event.featured ? ' showcal-week-event--featured' : ''));
      block.textContent = event.title;
      bindEventClick(block, event, 'week', config);
      col.appendChild(block);
    }

    columns.appendChild(col);
  }

  week.appendChild(columns);
  container.innerHTML = '';
  container.appendChild(week);
}
