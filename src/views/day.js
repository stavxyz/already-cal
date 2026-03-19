import { formatDate, formatTime, isSameDay, isPast } from '../util/dates.js';
import { escapeHtml } from '../util/sanitize.js';
import { setEventDetail } from '../router.js';

export function renderDayView(container, events, timezone, currentDate) {
  const day = document.createElement('div');
  day.className = 'ogcal-day';

  // Navigation
  const nav = document.createElement('div');
  nav.className = 'ogcal-day-nav';
  nav.innerHTML = `
    <button class="ogcal-day-prev" aria-label="Previous day">‹</button>
    <span class="ogcal-day-title">${formatDate(currentDate.toISOString(), timezone)}</span>
    <button class="ogcal-day-next" aria-label="Next day">›</button>
  `;

  nav.querySelector('.ogcal-day-prev').addEventListener('click', () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    renderDayView(container, events, timezone, prev);
  });
  nav.querySelector('.ogcal-day-next').addEventListener('click', () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    renderDayView(container, events, timezone, next);
  });

  day.appendChild(nav);

  const dayEvents = events.filter(e => isSameDay(new Date(e.start), currentDate));

  if (dayEvents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ogcal-day-empty';
    empty.textContent = 'No events this day.';
    day.appendChild(empty);
  } else {
    for (const event of dayEvents) {
      const item = document.createElement('div');
      item.className = 'ogcal-day-event';
      item.addEventListener('click', () => setEventDetail(event.id));
      item.setAttribute('tabindex', '0');

      const timeStr = event.allDay ? 'All Day' : formatTime(event.start, timezone);

      item.innerHTML = `
        <div class="ogcal-day-event-time">${timeStr}</div>
        <div class="ogcal-day-event-info">
          <div class="ogcal-day-event-title">${escapeHtml(event.title)}</div>
          ${event.location ? `<div class="ogcal-day-event-location">${escapeHtml(event.location)}</div>` : ''}
        </div>
      `;

      day.appendChild(item);
    }
  }

  container.innerHTML = '';
  container.appendChild(day);
}
