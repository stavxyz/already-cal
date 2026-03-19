import { loadData } from './data.js';
import { getInitialView, onHashChange, parseHash, setView } from './router.js';
import { renderViewSelector } from './ui/view-selector.js';
import { renderLoading, renderEmpty, renderError } from './ui/states.js';
import { renderPastToggle } from './ui/past-toggle.js';
import { renderMonthView } from './views/month.js';
import { renderWeekView } from './views/week.js';
import { renderDayView } from './views/day.js';
import { renderGridView } from './views/grid.js';
import { renderListView } from './views/list.js';
import { renderDetailView } from './views/detail.js';
import { isPast } from './util/dates.js';

const DEFAULTS = {
  defaultView: 'month',
  showPastEvents: false,
  views: ['month', 'week', 'day', 'grid', 'list'],
  theme: {},
};

const THEME_DEFAULTS = {
  primary: '#8B4513',
  primaryText: '#ffffff',
  background: '#f5f0eb',
  surface: '#ffffff',
  text: '#1a1a1a',
  textSecondary: '#666',
  radius: '8px',
  fontFamily: 'system-ui, sans-serif',
};

export function init(userConfig) {
  const config = { ...DEFAULTS, ...userConfig };
  const theme = { ...THEME_DEFAULTS, ...config.theme };
  const el = typeof config.el === 'string' ? document.querySelector(config.el) : config.el;

  if (!el) {
    console.error('og-cal: Element not found:', config.el);
    return;
  }

  // Apply theme as CSS custom properties
  for (const [key, value] of Object.entries(theme)) {
    const prop = `--ogcal-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    el.style.setProperty(prop, value);
  }

  el.classList.add('ogcal');

  // Create layout
  const selectorContainer = document.createElement('div');
  selectorContainer.className = 'ogcal-selector-container';
  const viewContainer = document.createElement('div');
  viewContainer.className = 'ogcal-view-container';
  viewContainer.setAttribute('aria-live', 'polite');
  const toggleContainer = document.createElement('div');
  toggleContainer.className = 'ogcal-toggle-container';

  el.innerHTML = '';
  el.appendChild(selectorContainer);
  el.appendChild(viewContainer);
  el.appendChild(toggleContainer);

  let data = null;
  let showPast = config.showPastEvents;
  let currentDate = new Date();
  let lastView = null;

  const isMobile = () => window.innerWidth < 768;

  function getFilteredEvents() {
    if (!data) return [];
    if (showPast) return data.events;
    return data.events.filter(e => !isPast(e.end || e.start));
  }

  function hasPastEvents() {
    if (!data) return false;
    return data.events.some(e => isPast(e.end || e.start));
  }

  function renderView(viewState) {
    const events = getFilteredEvents();
    const timezone = data?.calendar?.timezone || 'UTC';

    // Don't render selector for detail view
    if (viewState.view !== 'detail') {
      renderViewSelector(selectorContainer, config.views, viewState.view, isMobile());
      lastView = viewState.view;
    }

    switch (viewState.view) {
      case 'month':
        renderMonthView(viewContainer, events, timezone, currentDate);
        break;
      case 'week':
        renderWeekView(viewContainer, events, timezone, currentDate);
        break;
      case 'day': {
        const dayDate = viewState.date ? new Date(viewState.date) : currentDate;
        renderDayView(viewContainer, events, timezone, dayDate);
        break;
      }
      case 'grid':
        renderGridView(viewContainer, events, timezone);
        break;
      case 'list':
        renderListView(viewContainer, events, timezone);
        break;
      case 'detail': {
        const event = data?.events?.find(e => e.id === viewState.eventId);
        if (event) {
          selectorContainer.innerHTML = '';
          renderDetailView(viewContainer, event, timezone, () => {
            if (lastView) setView(lastView);
            else window.history.back();
          });
        } else {
          renderError(viewContainer, 'Event not found.', () => renderView({ view: config.defaultView }));
        }
        return; // skip past toggle for detail
      }
    }

    // Past events toggle
    if (hasPastEvents()) {
      renderPastToggle(toggleContainer, showPast, () => {
        showPast = !showPast;
        renderView(viewState);
      });
    } else {
      toggleContainer.innerHTML = '';
    }

    // Empty state
    if (events.length === 0 && viewState.view !== 'detail') {
      renderEmpty(viewContainer, hasPastEvents(), () => {
        showPast = true;
        renderView(viewState);
      });
    }
  }

  // Load and render
  async function start() {
    renderLoading(viewContainer);

    try {
      data = await loadData(config);
    } catch (err) {
      console.error('og-cal:', err);
      renderError(viewContainer, err.message, start);
      return;
    }

    const initial = getInitialView(config.defaultView, config.views);

    // On mobile, override to list if no hash specified
    if (isMobile() && !parseHash()) {
      initial.view = 'list';
    }

    renderView(initial);

    onHashChange((viewState) => {
      renderView(viewState);
    });
  }

  start();
}
