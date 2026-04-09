import { getWeekDates, formatDateShort, isToday, getDatePartsInTz } from '../util/dates.js';
import { createElement, filterHidden, sortFeatured } from './helpers.js';
import { setEventDetail } from '../router.js';

export function renderWeekView(container, events, timezone, currentDate, config) {
  config = config || {};
  const locale = config.locale;
  const weekStartDay = config.weekStartDay || 0;
  const dates = getWeekDates(currentDate, weekStartDay);

  events = filterHidden(events);

  const week = createElement('div', 'ogcal-week');

  // Navigation
  const nav = createElement('div', 'ogcal-week-nav');
  const startLabel = formatDateShort(dates[0].toISOString(), timezone, locale);
  const endLabel = formatDateShort(dates[6].toISOString(), timezone, locale);

  const prevBtn = createElement('button', 'ogcal-week-prev', { 'aria-label': 'Previous week' });
  prevBtn.textContent = '\u2039';
  prevBtn.addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    renderWeekView(container, events, timezone, prev, config);
  });
  nav.appendChild(prevBtn);

  const title = createElement('span', 'ogcal-week-title');
  title.textContent = `${startLabel} \u2013 ${endLabel}`;
  nav.appendChild(title);

  const nextBtn = createElement('button', 'ogcal-week-next', { 'aria-label': 'Next week' });
  nextBtn.textContent = '\u203a';
  nextBtn.addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    renderWeekView(container, events, timezone, next, config);
  });
  nav.appendChild(nextBtn);

  week.appendChild(nav);

  const columns = createElement('div', 'ogcal-week-columns');

  for (const date of dates) {
    const col = createElement('div', 'ogcal-week-col' + (isToday(date) ? ' ogcal-week-col--today' : ''));

    const header = createElement('div', 'ogcal-week-col-header');
    const dayName = new Intl.DateTimeFormat(locale || 'en-US', { weekday: 'short' }).format(date);
    const dayNameEl = createElement('span', 'ogcal-week-dayname');
    dayNameEl.textContent = dayName;
    header.appendChild(dayNameEl);
    const dayNumEl = createElement('span', 'ogcal-week-daynum');
    dayNumEl.textContent = date.getDate();
    header.appendChild(dayNumEl);
    col.appendChild(header);

    const dayEvents = sortFeatured(events.filter(e => {
      const parts = getDatePartsInTz(e.start, timezone, locale);
      return parts.year === date.getFullYear() && parts.month === date.getMonth() && parts.day === date.getDate();
    }));

    for (const event of dayEvents) {
      const block = createElement('div', 'ogcal-week-event' + (event.featured ? ' ogcal-week-event--featured' : ''));
      block.textContent = event.title;
      block.setAttribute('tabindex', '0');
      block.setAttribute('role', 'button');
      block.addEventListener('click', () => {
        if (config.onEventClick) {
          const result = config.onEventClick(event, 'week');
          if (result === false) return;
        }
        setEventDetail(event.id);
      });
      block.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (config.onEventClick) {
            const result = config.onEventClick(event, 'week');
            if (result === false) return;
          }
          setEventDetail(event.id);
        }
      });
      col.appendChild(block);
    }

    columns.appendChild(col);
  }

  week.appendChild(columns);
  container.innerHTML = '';
  container.appendChild(week);
}
