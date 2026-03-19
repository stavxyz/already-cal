import { formatDateShort, formatTime, isPast } from '../util/dates.js';
import { escapeHtml } from '../util/sanitize.js';
import { setEventDetail } from '../router.js';

export function renderGridView(container, events, timezone) {
  const grid = document.createElement('div');
  grid.className = 'ogcal-grid';

  for (const event of events) {
    const card = document.createElement('div');
    card.className = 'ogcal-grid-card' + (isPast(event.start) ? ' ogcal-grid-card--past' : '');
    card.addEventListener('click', () => setEventDetail(event.id));
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEventDetail(event.id); }
    });

    const dateStr = formatDateShort(event.start, timezone);
    const timeStr = event.allDay ? '' : ` · ${formatTime(event.start, timezone)}`;
    const imageHtml = event.image
      ? `<div class="ogcal-grid-image"><img src="${event.image}" alt="" loading="lazy"></div>`
      : `<div class="ogcal-grid-image ogcal-grid-image--placeholder"></div>`;

    card.innerHTML = `
      ${imageHtml}
      <div class="ogcal-grid-body">
        <div class="ogcal-grid-title">${escapeHtml(event.title)}</div>
        <div class="ogcal-grid-meta">${dateStr}${timeStr}</div>
        ${event.location ? `<div class="ogcal-grid-location">${escapeHtml(event.location)}</div>` : ''}
      </div>
    `;

    grid.appendChild(card);
  }

  container.innerHTML = '';
  container.appendChild(grid);
}
