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
  locale: null, // defaults to navigator.language || 'en-US' at runtime
  weekStartDay: 0, // 0=Sunday, 1=Monday, etc.
  storageKeyPrefix: 'ogcal',
  mobileBreakpoint: 768,
  mobileDefaultView: 'list',
  mobileHiddenViews: ['week'],
  maxEventsPerDay: 3,
  locationLinkTemplate: 'https://maps.google.com/?q={location}',
  imageExtensions: null, // null = use defaults in images.js
  knownPlatforms: null, // null = use defaults in links.js
  sanitization: null, // null = use defaults in description.js
  eventFilter: null,
  eventTransform: null,
  onEventClick: null,
  onViewChange: null,
  onError: null,
  onDataLoad: null,
  renderEmpty: null,
  renderLoading: null,
  renderError: null,
  i18n: {},
};

const I18N_DEFAULTS = {
  viewLabels: { month: 'Month', week: 'Week', day: 'Day', grid: 'Grid', list: 'List' },
  noUpcomingEvents: 'No upcoming events.',
  showPastEvents: 'Show past events',
  hidePastEvents: 'Hide past events',
  couldNotLoad: 'Could not load events.',
  retry: 'Retry',
  allDay: 'All Day',
  noEventsThisDay: 'No events this day.',
  back: '\u2190 Back',
  moreEvents: '+{count} more',
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
  config.i18n = { ...I18N_DEFAULTS, ...config.i18n };
  if (config.i18n.viewLabels) {
    config.i18n.viewLabels = { ...I18N_DEFAULTS.viewLabels, ...(userConfig && userConfig.i18n && userConfig.i18n.viewLabels) };
  }
  config.locale = config.locale || (typeof navigator !== 'undefined' && navigator.language) || 'en-US';

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

  const isMobile = () => window.innerWidth < config.mobileBreakpoint;

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

    // Fire onViewChange callback
    if (config.onViewChange && viewState.view !== 'detail') {
      const oldView = lastView;
      if (oldView !== viewState.view) {
        config.onViewChange(viewState.view, oldView);
      }
    }

    // Don't render selector for detail view
    if (viewState.view !== 'detail') {
      renderViewSelector(selectorContainer, config.views, viewState.view, isMobile(), config);
      lastView = viewState.view;
    }

    switch (viewState.view) {
      case 'month':
        renderMonthView(viewContainer, events, timezone, currentDate, config);
        break;
      case 'week':
        renderWeekView(viewContainer, events, timezone, currentDate, config);
        break;
      case 'day': {
        const dayDate = viewState.date ? new Date(viewState.date) : currentDate;
        renderDayView(viewContainer, events, timezone, dayDate, config);
        break;
      }
      case 'grid':
        renderGridView(viewContainer, events, timezone, config);
        break;
      case 'list':
        renderListView(viewContainer, events, timezone, config);
        break;
      case 'detail': {
        const event = data?.events?.find(e => e.id === viewState.eventId);
        if (event) {
          if (config.onEventClick) {
            const result = config.onEventClick(event, 'detail');
            if (result === false) return;
          }
          selectorContainer.innerHTML = '';
          renderDetailView(viewContainer, event, timezone, () => {
            setView(lastView || config.defaultView, config);
          }, config);
        } else {
          renderError(viewContainer, 'Event not found.', () => renderView({ view: config.defaultView }), config);
        }
        return; // skip past toggle for detail
      }
    }

    // Past events toggle
    if (hasPastEvents()) {
      renderPastToggle(toggleContainer, showPast, () => {
        showPast = !showPast;
        renderView(viewState);
      }, config);
    } else {
      toggleContainer.innerHTML = '';
    }

    // Empty state
    if (events.length === 0 && viewState.view !== 'detail') {
      renderEmpty(viewContainer, hasPastEvents(), () => {
        showPast = true;
        renderView(viewState);
      }, config);
    }
  }

  // Load and render
  async function start() {
    renderLoading(viewContainer, config);

    try {
      data = await loadData(config);
      if (config.onDataLoad) {
        config.onDataLoad(data);
      }
    } catch (err) {
      console.error('og-cal:', err);
      if (config.onError) {
        config.onError(err);
      }
      renderError(viewContainer, err.message, start, config);
      return;
    }

    const initial = getInitialView(config.defaultView, config.views, config);

    // On mobile, override to mobileDefaultView if no hash specified
    if (isMobile() && !parseHash()) {
      initial.view = config.mobileDefaultView;
    }

    renderView(initial);

    onHashChange((viewState) => {
      renderView(viewState);
    });
  }

  start();
}

// Auto-init from data attributes
function autoInit() {
  const elements = document.querySelectorAll('[data-og-cal]');
  for (const el of elements) {
    const config = { el };
    const dataset = el.dataset;

    // Simple string/number configs from data attributes
    if (dataset.calendarId || dataset.apiKey) {
      config.google = {};
      if (dataset.calendarId) config.google.calendarId = dataset.calendarId;
      if (dataset.apiKey) config.google.apiKey = dataset.apiKey;
      if (dataset.maxResults) config.google.maxResults = parseInt(dataset.maxResults, 10);
    }
    if (dataset.fetchUrl) config.fetchUrl = dataset.fetchUrl;
    if (dataset.defaultView) config.defaultView = dataset.defaultView;
    if (dataset.locale) config.locale = dataset.locale;
    if (dataset.weekStartDay) config.weekStartDay = parseInt(dataset.weekStartDay, 10);
    if (dataset.storageKeyPrefix) config.storageKeyPrefix = dataset.storageKeyPrefix;
    if (dataset.mobileBreakpoint) config.mobileBreakpoint = parseInt(dataset.mobileBreakpoint, 10);
    if (dataset.mobileDefaultView) config.mobileDefaultView = dataset.mobileDefaultView;
    if (dataset.maxEventsPerDay) config.maxEventsPerDay = parseInt(dataset.maxEventsPerDay, 10);
    if (dataset.locationLinkTemplate) config.locationLinkTemplate = dataset.locationLinkTemplate;
    if (dataset.showPastEvents !== undefined) config.showPastEvents = dataset.showPastEvents === 'true';

    // Theme from data attributes: data-theme-primary, data-theme-background, etc.
    const theme = {};
    let hasTheme = false;
    for (const [key, value] of Object.entries(dataset)) {
      if (key.startsWith('theme') && key.length > 5) {
        const themeProp = key.charAt(5).toLowerCase() + key.slice(6);
        theme[themeProp] = value;
        hasTheme = true;
      }
    }
    if (hasTheme) config.theme = theme;

    // Views from comma-separated data attribute
    if (dataset.views) {
      config.views = dataset.views.split(',').map(v => v.trim());
    }
    if (dataset.mobileHiddenViews) {
      config.mobileHiddenViews = dataset.mobileHiddenViews.split(',').map(v => v.trim());
    }

    init(config);
  }
}

// Auto-init when DOM is ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // DOM already loaded, use microtask to allow inline scripts to run first
    Promise.resolve().then(autoInit);
  }
}
