import { getWeekDates, formatDateShort, formatTime, isSameDay, isToday, getDatePartsInTz } from '../util/dates.js';
import { escapeHtml } from '../util/sanitize.js';
import { setEventDetail } from '../router.js';

export function renderWeekView(container, events, timezone, currentDate) {
  const dates = getWeekDates(currentDate);

  const week = document.createElement('div');
  week.className = 'ogcal-week';

  // Navigation
  const nav = document.createElement('div');
  nav.className = 'ogcal-week-nav';
  const startLabel = formatDateShort(dates[0].toISOString(), timezone);
  const endLabel = formatDateShort(dates[6].toISOString(), timezone);
  nav.innerHTML = `
    <button class="ogcal-week-prev" aria-label="Previous week">‹</button>
    <span class="ogcal-week-title">${startLabel} – ${endLabel}</span>
    <button class="ogcal-week-next" aria-label="Next week">›</button>
  `;

  nav.querySelector('.ogcal-week-prev').addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    renderWeekView(container, events, timezone, prev);
  });
  nav.querySelector('.ogcal-week-next').addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    renderWeekView(container, events, timezone, next);
  });

  week.appendChild(nav);

  const columns = document.createElement('div');
  columns.className = 'ogcal-week-columns';

  for (const date of dates) {
    const col = document.createElement('div');
    col.className = 'ogcal-week-col' + (isToday(date) ? ' ogcal-week-col--today' : '');

    const header = document.createElement('div');
    header.className = 'ogcal-week-col-header';
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date);
    header.innerHTML = `<span class="ogcal-week-dayname">${dayName}</span><span class="ogcal-week-daynum">${date.getDate()}</span>`;
    col.appendChild(header);

    const dayEvents = events.filter(e => {
      const parts = getDatePartsInTz(e.start, timezone);
      return parts.year === date.getFullYear() && parts.month === date.getMonth() && parts.day === date.getDate();
    });
    for (const event of dayEvents) {
      const block = document.createElement('div');
      block.className = 'ogcal-week-event';
      block.textContent = event.title;
      block.addEventListener('click', () => setEventDetail(event.id));
      block.setAttribute('tabindex', '0');
      col.appendChild(block);
    }

    columns.appendChild(col);
  }

  week.appendChild(columns);
  container.innerHTML = '';
  container.appendChild(week);
}
