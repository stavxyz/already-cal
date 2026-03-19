import { getDaysInMonth, getFirstDayOfMonth, getMonthName, isSameDay, isToday, getDatePartsInTz } from '../util/dates.js';
import { escapeHtml } from '../util/sanitize.js';
import { setEventDetail } from '../router.js';

export function renderMonthView(container, events, timezone, currentDate) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthName = getMonthName(year, month);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group events by date in the CALENDAR's timezone (not browser local time)
  const eventsByDate = {};
  for (const event of events) {
    const parts = getDatePartsInTz(event.start, timezone);
    const key = `${parts.year}-${parts.month}-${parts.day}`;
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  }

  const grid = document.createElement('div');
  grid.className = 'ogcal-month';

  // Navigation
  const nav = document.createElement('div');
  nav.className = 'ogcal-month-nav';
  nav.innerHTML = `
    <button class="ogcal-month-prev" aria-label="Previous month">‹</button>
    <span class="ogcal-month-title">${monthName}</span>
    <button class="ogcal-month-next" aria-label="Next month">›</button>
  `;

  nav.querySelector('.ogcal-month-prev').addEventListener('click', () => {
    const prev = new Date(year, month - 1, 1);
    renderMonthView(container, events, timezone, prev);
  });
  nav.querySelector('.ogcal-month-next').addEventListener('click', () => {
    const next = new Date(year, month + 1, 1);
    renderMonthView(container, events, timezone, next);
  });

  grid.appendChild(nav);

  // Day headers
  const headerRow = document.createElement('div');
  headerRow.className = 'ogcal-month-header';
  headerRow.setAttribute('role', 'row');
  for (const name of dayNames) {
    const cell = document.createElement('div');
    cell.className = 'ogcal-month-dayname';
    cell.textContent = name;
    headerRow.appendChild(cell);
  }
  grid.appendChild(headerRow);

  // Calendar grid
  const body = document.createElement('div');
  body.className = 'ogcal-month-body';
  body.setAttribute('role', 'grid');

  let row = document.createElement('div');
  row.className = 'ogcal-month-row';
  row.setAttribute('role', 'row');

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement('div');
    cell.className = 'ogcal-month-cell ogcal-month-cell--empty';
    cell.setAttribute('role', 'gridcell');
    row.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cellDate = new Date(year, month, day);
    const key = `${year}-${month}-${day}`;
    const dayEvents = eventsByDate[key] || [];
    const today = isToday(cellDate);

    const cell = document.createElement('div');
    cell.className = 'ogcal-month-cell' + (today ? ' ogcal-month-cell--today' : '') +
      (dayEvents.length ? ' ogcal-month-cell--has-events' : '');
    cell.setAttribute('role', 'gridcell');

    const dayNum = document.createElement('div');
    dayNum.className = 'ogcal-month-day';
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    for (const event of dayEvents.slice(0, 3)) {
      const chip = document.createElement('div');
      chip.className = 'ogcal-month-chip';
      chip.textContent = event.title; // textContent is safe, no escaping needed
      chip.addEventListener('click', (e) => { e.stopPropagation(); setEventDetail(event.id); });
      cell.appendChild(chip);
    }

    if (dayEvents.length > 3) {
      const more = document.createElement('div');
      more.className = 'ogcal-month-more';
      more.textContent = `+${dayEvents.length - 3} more`;
      cell.appendChild(more);
    }

    row.appendChild(cell);

    if ((firstDay + day) % 7 === 0) {
      body.appendChild(row);
      row = document.createElement('div');
      row.className = 'ogcal-month-row';
      row.setAttribute('role', 'row');
    }
  }

  // Fill remaining cells
  const remaining = (firstDay + daysInMonth) % 7;
  if (remaining > 0) {
    for (let i = remaining; i < 7; i++) {
      const cell = document.createElement('div');
      cell.className = 'ogcal-month-cell ogcal-month-cell--empty';
      cell.setAttribute('role', 'gridcell');
      row.appendChild(cell);
    }
    body.appendChild(row);
  }

  grid.appendChild(body);
  container.innerHTML = '';
  container.appendChild(grid);
}
