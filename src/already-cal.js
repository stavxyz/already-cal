import { loadData } from "./data.js";
import { register } from "./registry.js";
import { getInitialView, onHashChange, parseHash, setView } from "./router.js";
import { applyTheme } from "./theme.js";
import { addThemeName, getTheme, getThemeNames } from "./themes/registry.js";
import { renderHeader } from "./ui/header.js";
import { paginateEvents, renderPaginationButtons } from "./ui/pagination.js";
import { renderPastToggle } from "./ui/past-toggle.js";
import { renderEmpty, renderError, renderLoading } from "./ui/states.js";
import {
  applyStickyClasses,
  resolveSticky,
  updateStickyOffsets,
} from "./ui/sticky.js";
import { createTagFilter } from "./ui/tag-filter.js";
import { renderViewSelector } from "./ui/view-selector.js";
import { formatDate, formatDatetime, isPast } from "./util/dates.js";
import { DEFAULT_PLATFORMS } from "./util/links.js";
import { renderDayView } from "./views/day.js";
import { renderDetailView } from "./views/detail.js";
import { renderGridView } from "./views/grid.js";
import { renderListView } from "./views/list.js";
import { renderMonthView } from "./views/month.js";
import { renderWeekView } from "./views/week.js";

const DEFAULTS = {
  defaultView: "month",
  showPastEvents: false,
  views: ["month", "week", "day", "grid", "list"],
  theme: {},
  locale: null, // defaults to navigator.language || 'en-US' at runtime
  weekStartDay: 0, // 0=Sunday, 1=Monday, etc.
  storageKeyPrefix: "already",
  mobileBreakpoint: 768,
  mobileDefaultView: "list",
  mobileHiddenViews: ["week"],
  maxEventsPerDay: 3,
  locationLinkTemplate: "https://maps.google.com/?q={location}",
  imageExtensions: null, // null = use defaults in images.js
  knownPlatforms: DEFAULT_PLATFORMS,
  sanitization: null, // null = use defaults in description.js
  eventFilter: null,
  eventTransform: null,
  onEventClick: null,
  onViewChange: null,
  onError: null,
  onDataLoad: null,
  showHeader: true,
  headerTitle: null, // override calendar name
  headerDescription: null, // override calendar description
  headerIcon: null, // URL to icon/logo image
  subscribeUrl: null, // auto-generated from google.calendarId if not set
  renderEmpty: null,
  renderLoading: null,
  renderError: null,
  i18n: {},
  initialEvent: null,
  sticky: true,
  pageSize: 10,
};

const I18N_DEFAULTS = {
  viewLabels: {
    month: "Month",
    week: "Week",
    day: "Day",
    grid: "Grid",
    list: "List",
  },
  noUpcomingEvents: "No upcoming events.",
  showPastEvents: "Show past events",
  hidePastEvents: "Hide past events",
  couldNotLoad: "Could not load events.",
  retry: "Retry",
  allDay: "All Day",
  noEventsThisDay: "No events this day.",
  back: "\u2190 Back",
  moreEvents: "+{count} more",
  subscribe: "Subscribe",
  clearFilter: "Clear",
  loadMore: "Load more",
  showEarlier: "Show earlier",
};

// Expose defaults so consumers can extend (e.g. Already.DEFAULTS.knownPlatforms)
export { DEFAULTS };

/**
 * Register a custom layout render function.
 * Must return an HTMLElement. Built-in names (clean, hero, badge, compact)
 * cannot be overridden. Re-registering a custom name replaces the previous.
 */
export function registerLayout(name, renderFn) {
  register("layout", name, renderFn);
}

/**
 * Register a custom theme bundle. Packages a layout, palette/orientation
 * defaults, constraints, and CSS custom property overrides into a reusable unit.
 *
 * If `bundle.layout` is a render function, it is auto-registered in the
 * layout registry under the theme name. Built-in names cannot be overridden.
 */
export function registerTheme(name, bundle) {
  const processed = { ...bundle };
  if (typeof bundle.layout === "function") {
    register("layout", name, bundle.layout);
    processed.layout = name;
  }
  register("theme", name, processed);
  addThemeName(name);
  THEMES = buildThemesSnapshot();
}

function buildThemesSnapshot() {
  const result = {};
  for (const name of getThemeNames()) {
    const bundle = getTheme(name);
    if (bundle) {
      const copy = { layout: bundle.layout };
      if (bundle.defaults)
        copy.defaults = Object.freeze({ ...bundle.defaults });
      if (bundle.constraints)
        copy.constraints = Object.freeze({ ...bundle.constraints });
      if (bundle.overrides)
        copy.overrides = Object.freeze({ ...bundle.overrides });
      result[name] = Object.freeze(copy);
    }
  }
  return Object.freeze(result);
}

/**
 * Frozen snapshot of all registered theme bundles (built-in and custom).
 * Updated when registerTheme() is called. In the IIFE bundle, esbuild's
 * getter ensures each access to Already.THEMES returns the latest snapshot.
 */
export let THEMES = buildThemesSnapshot();

/** The most recently created instance. In multi-instance setups, only the last init()'d instance is stored here. */
export let _instance = null;

/** Convenience method — delegates to the last-created instance's setConfig. Single-instance only. */
export function setConfig(config) {
  if (!_instance) {
    console.warn(
      "already-cal: setConfig() called but no instance exists. Call init() first.",
    );
    return;
  }
  _instance.setConfig(config);
}

/** Initialize an already-cal instance with the given configuration. */
export function init(userConfig) {
  const config = { ...DEFAULTS, ...userConfig };
  config.i18n = { ...I18N_DEFAULTS, ...config.i18n };
  if (config.i18n.viewLabels) {
    config.i18n.viewLabels = {
      ...I18N_DEFAULTS.viewLabels,
      ...userConfig?.i18n?.viewLabels,
    };
  }
  config.locale =
    config.locale ||
    (typeof navigator !== "undefined" && navigator.language) ||
    "en-US";
  config.pageSize =
    Number.isFinite(config.pageSize) && config.pageSize > 0
      ? config.pageSize
      : DEFAULTS.pageSize;

  const el =
    typeof config.el === "string"
      ? document.querySelector(config.el)
      : config.el;

  if (!el) {
    console.error("already-cal: Element not found:", config.el);
    return;
  }

  let themeResult;
  try {
    themeResult = applyTheme(el, config.theme, []);
  } catch (err) {
    el.classList.add("already");
    el.innerHTML = `<div class="already-error"><p>${err.message}</p></div>`;
    throw err;
  }
  config._theme = themeResult;

  el.classList.add("already");

  // Create layout
  const headerContainer = document.createElement("div");
  headerContainer.className = "already-header-container";
  const selectorContainer = document.createElement("div");
  selectorContainer.className = "already-selector-container";
  const tagFilterContainer = document.createElement("div");
  tagFilterContainer.className = "already-tag-filter-container";
  const viewContainer = document.createElement("div");
  viewContainer.className = "already-view-container";
  viewContainer.setAttribute("aria-live", "polite");
  const toggleContainer = document.createElement("div");
  toggleContainer.className = "already-toggle-container";
  const paginationTopContainer = document.createElement("div");
  paginationTopContainer.className = "already-pagination-top";
  const paginationBottomContainer = document.createElement("div");
  paginationBottomContainer.className = "already-pagination-bottom";

  el.innerHTML = "";
  el.appendChild(headerContainer);
  el.appendChild(selectorContainer);
  el.appendChild(tagFilterContainer);
  el.appendChild(paginationTopContainer);
  el.appendChild(viewContainer);
  el.appendChild(paginationBottomContainer);
  el.appendChild(toggleContainer);

  const stickyConfig = resolveSticky(config.sticky);
  applyStickyClasses(
    stickyConfig,
    headerContainer,
    selectorContainer,
    tagFilterContainer,
  );

  let destroyed = false;
  let data = null;
  let showPast = config.showPastEvents;
  const currentDate = new Date();
  let lastView = null;
  let lastViewState = null;
  let paginationState = { futureCount: 0, pastCount: 0 };
  const tagFilter = createTagFilter(() => {
    paginationState = { futureCount: 0, pastCount: 0 };
    if (lastViewState) renderView(lastViewState);
  }, config);

  const isMobile = () => window.innerWidth < config.mobileBreakpoint;

  // OG meta tag management
  let originalMeta = null;

  function captureOriginalMeta() {
    originalMeta = {};
    for (const prop of ["og:title", "og:description", "og:image", "og:url"]) {
      const metaEl = document.querySelector(`meta[property="${prop}"]`);
      originalMeta[prop] = metaEl ? metaEl.getAttribute("content") : null;
    }
  }

  function setMetaTag(property, content) {
    let metaEl = document.querySelector(`meta[property="${property}"]`);
    if (!metaEl) {
      metaEl = document.createElement("meta");
      metaEl.setAttribute("property", property);
      document.head.appendChild(metaEl);
    }
    metaEl.setAttribute("content", content);
  }

  function setEventMeta(event) {
    const tz = data?.calendar?.timezone || "UTC";
    const dateStr = event.allDay
      ? formatDate(event.start, tz, config.locale)
      : formatDatetime(event.start, tz, config.locale);
    const descParts = [dateStr];
    if (event.location) descParts.push(event.location);

    setMetaTag("og:title", event.title);
    setMetaTag("og:description", descParts.join(" \u00b7 "));
    if (event.image) setMetaTag("og:image", event.image);
    setMetaTag("og:url", window.location.href);
  }

  function restoreOriginalMeta() {
    if (!originalMeta) return;
    for (const [prop, content] of Object.entries(originalMeta)) {
      if (content === null) {
        const metaEl = document.querySelector(`meta[property="${prop}"]`);
        if (metaEl) metaEl.remove();
      } else {
        setMetaTag(prop, content);
      }
    }
  }

  function getFilteredEvents() {
    if (!data) return [];
    if (showPast) return data.events;
    return data.events.filter((e) => !isPast(e.end || e.start));
  }

  function hasPastEvents() {
    if (!data) return false;
    return data.events.some((e) => isPast(e.end || e.start));
  }

  function makePaginationCallbacks(viewState) {
    return {
      onShowEarlier: () => {
        paginationState = {
          ...paginationState,
          pastCount: paginationState.pastCount + config.pageSize,
        };
        renderView(viewState);
      },
      onLoadMore: () => {
        // Scroll anchoring: remember the last visible event's viewport position,
        // re-render with more events, then restore scroll so the user doesn't jump.
        const anchorEl = viewContainer.querySelector(
          ".already-card:last-child",
        );
        const anchorOffset = anchorEl
          ? anchorEl.getBoundingClientRect().top
          : null;
        paginationState = {
          ...paginationState,
          futureCount: paginationState.futureCount + config.pageSize,
        };
        renderView(viewState);
        if (anchorEl && anchorOffset !== null) {
          const newAnchor = viewContainer.querySelector(
            `[data-event-id="${CSS.escape(anchorEl.dataset.eventId)}"]`,
          );
          if (newAnchor) {
            window.scrollTo(
              0,
              window.scrollY +
                (newAnchor.getBoundingClientRect().top - anchorOffset),
            );
          }
        }
      },
    };
  }

  function renderView(viewState) {
    lastViewState = viewState;
    const allEvents = getFilteredEvents();
    const timezone = data?.calendar?.timezone || "UTC";

    // Hidden filtering — visible events used for tag pills
    const visibleEvents = allEvents.filter((e) => !e.hidden);

    // Tag filter UI (render pills from all non-hidden events, not filtered by tags)
    if (viewState.view !== "detail") {
      tagFilter.render(tagFilterContainer, visibleEvents);
    } else {
      tagFilterContainer.innerHTML = "";
    }

    // Apply tag filter
    const tagFilterFn = tagFilter.getFilter();
    const events = tagFilterFn
      ? visibleEvents.filter(tagFilterFn)
      : visibleEvents;

    // OG meta management
    if (viewState.view !== "detail") {
      restoreOriginalMeta();
    }

    // Reset pagination on view switch (must be outside onViewChange guard)
    if (viewState.view !== "detail" && lastView !== viewState.view) {
      paginationState = { futureCount: 0, pastCount: 0 };
      if (config.onViewChange) {
        config.onViewChange(viewState.view, lastView);
      }
    }

    // Don't render selector for detail view
    if (viewState.view !== "detail") {
      renderViewSelector(
        selectorContainer,
        config.views,
        viewState.view,
        isMobile(),
        config,
      );
      lastView = viewState.view;
    }

    updateStickyOffsets(
      stickyConfig,
      headerContainer,
      selectorContainer,
      tagFilterContainer,
    );

    paginationTopContainer.innerHTML = "";
    paginationBottomContainer.innerHTML = "";

    switch (viewState.view) {
      case "month":
        renderMonthView(viewContainer, events, timezone, currentDate, config);
        break;
      case "week":
        renderWeekView(viewContainer, events, timezone, currentDate, config);
        break;
      case "day": {
        const dayDate = viewState.date ? new Date(viewState.date) : currentDate;
        renderDayView(viewContainer, events, timezone, dayDate, config);
        break;
      }
      case "grid": {
        const paginated = paginateEvents(
          events,
          showPast,
          config.pageSize,
          paginationState,
        );
        renderGridView(viewContainer, paginated.visible, timezone, config);
        renderPaginationButtons(
          paginationTopContainer,
          paginationBottomContainer,
          paginated,
          config.i18n,
          makePaginationCallbacks(viewState),
        );
        break;
      }
      case "list": {
        const paginated = paginateEvents(
          events,
          showPast,
          config.pageSize,
          paginationState,
        );
        renderListView(viewContainer, paginated.visible, timezone, config);
        renderPaginationButtons(
          paginationTopContainer,
          paginationBottomContainer,
          paginated,
          config.i18n,
          makePaginationCallbacks(viewState),
        );
        break;
      }
      case "detail": {
        const event = data?.events?.find((e) => e.id === viewState.eventId);
        if (event) {
          if (config.onEventClick) {
            const result = config.onEventClick(event, "detail");
            if (result === false) return;
          }
          setEventMeta(event);
          selectorContainer.innerHTML = "";
          renderDetailView(
            viewContainer,
            event,
            timezone,
            () => {
              setView(lastView || config.defaultView, config);
            },
            config,
          );
        } else {
          renderError(
            viewContainer,
            "Event not found.",
            () => renderView({ view: config.defaultView }),
            config,
          );
        }
        return; // skip past toggle for detail
      }
    }

    // Past events toggle
    if (hasPastEvents()) {
      renderPastToggle(
        toggleContainer,
        showPast,
        () => {
          showPast = !showPast;
          paginationState = { futureCount: 0, pastCount: 0 };
          renderView(viewState);
        },
        config,
      );
    } else {
      toggleContainer.innerHTML = "";
    }

    // Empty state
    if (events.length === 0 && viewState.view !== "detail") {
      renderEmpty(
        viewContainer,
        hasPastEvents(),
        () => {
          showPast = true;
          renderView(viewState);
        },
        config,
      );
    }
  }

  // Load and render
  let removeHashListener = null;

  async function start() {
    captureOriginalMeta();
    renderLoading(viewContainer, config);

    try {
      data = await loadData(config);
      if (destroyed) return;
      if (config.onDataLoad) {
        config.onDataLoad(data);
      }
    } catch (err) {
      if (destroyed) return;
      console.error("already-cal:", err);
      if (config.onError) {
        config.onError(err);
      }
      renderError(viewContainer, err.message, start, config);
      return;
    }

    // Render header with calendar name/description + subscribe button
    renderHeader(headerContainer, data.calendar, config);

    const initial = getInitialView(config.defaultView, config.views, config);

    // On mobile, override to mobileDefaultView if no hash specified
    if (isMobile() && !parseHash()) {
      initial.view = config.mobileDefaultView;
    }

    renderView(initial);

    removeHashListener = onHashChange((viewState) => {
      renderView(viewState);
    });
  }

  function setConfig(newConfig) {
    if (destroyed) return;
    if (!newConfig || typeof newConfig !== "object") {
      console.warn(
        "already-cal: setConfig() expects a plain object, got:",
        typeof newConfig,
      );
      return;
    }

    let needsRerender = false;

    // Theme update — palette and CSS override changes are CSS-only (instant).
    // Layout/orientation/imagePosition changes require re-rendering the card structure.
    if (newConfig.theme !== undefined) {
      try {
        const prev = config._theme;
        const newThemeResult = applyTheme(
          el,
          newConfig.theme,
          themeResult.overrideKeys,
        );
        if (
          newThemeResult.layout !== prev.layout ||
          newThemeResult.orientation !== prev.orientation ||
          newThemeResult.imagePosition !== prev.imagePosition
        ) {
          needsRerender = true;
        }
        themeResult = newThemeResult;
        config._theme = newThemeResult;
      } catch (err) {
        console.error("already-cal:", err.message);
      }
    }

    if (newConfig.views !== undefined) {
      if (Array.isArray(newConfig.views) && newConfig.views.length > 0) {
        config.views = newConfig.views;
        needsRerender = true;
      } else {
        console.warn(
          "already-cal: views must be a non-empty array, got:",
          newConfig.views,
        );
      }
    }

    if (newConfig.showPastEvents !== undefined) {
      showPast = newConfig.showPastEvents;
      needsRerender = true;
    }

    if (newConfig.pageSize !== undefined) {
      if (Number.isFinite(newConfig.pageSize) && newConfig.pageSize > 0) {
        config.pageSize = newConfig.pageSize;
        needsRerender = true;
      } else {
        console.warn(
          "already-cal: invalid pageSize ignored:",
          newConfig.pageSize,
        );
      }
    }

    if (newConfig.defaultView !== undefined) {
      if (config.views.includes(newConfig.defaultView)) {
        config.defaultView = newConfig.defaultView;
        if (lastViewState && lastViewState.view !== "detail") {
          lastViewState = { ...lastViewState, view: newConfig.defaultView };
        }
        needsRerender = true;
      } else {
        console.warn(
          "already-cal: invalid defaultView ignored:",
          newConfig.defaultView,
        );
      }
    }

    if (needsRerender && data && lastViewState) {
      paginationState = { futureCount: 0, pastCount: 0 };
      renderView(lastViewState);
    }
  }

  function handleResize() {
    updateStickyOffsets(
      stickyConfig,
      headerContainer,
      selectorContainer,
      tagFilterContainer,
    );
  }

  // postMessage listener for cross-origin config updates (e.g. iframe embeds).
  // Origin is not checked — the accepted config keys (theme, views, showPastEvents,
  // pageSize, defaultView) are purely presentational, so accepting them from any
  // origin poses no security risk.
  function handleMessage(event) {
    if (
      event.data &&
      typeof event.data === "object" &&
      !Array.isArray(event.data) &&
      event.data.type === "already:config" &&
      event.data.config &&
      typeof event.data.config === "object" &&
      !Array.isArray(event.data.config)
    ) {
      instance.setConfig(event.data.config);
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("message", handleMessage);
    if (removeHashListener) removeHashListener();
    el.innerHTML = "";
    el.classList.remove("already");
    for (const attr of ["layout", "orientation", "imagePosition", "palette"]) {
      delete el.dataset[attr];
    }
    for (const prop of themeResult.overrideKeys) {
      el.style.removeProperty(prop);
    }
    if (_instance === instance) {
      _instance = null;
    }
  }

  const instance = { setConfig, destroy };

  start();

  window.addEventListener("resize", handleResize);
  window.addEventListener("message", handleMessage);

  _instance = instance;
  return instance;
}

// Auto-init from data attributes
function autoInit() {
  const elements = document.querySelectorAll("[data-already-cal]");
  for (const el of elements) {
    const config = { el };
    const dataset = el.dataset;

    // Simple string/number configs from data attributes
    if (dataset.calendarId || dataset.apiKey) {
      config.google = {};
      if (dataset.calendarId) config.google.calendarId = dataset.calendarId;
      if (dataset.apiKey) config.google.apiKey = dataset.apiKey;
      if (dataset.maxResults)
        config.google.maxResults = parseInt(dataset.maxResults, 10);
    }
    if (dataset.fetchUrl) config.fetchUrl = dataset.fetchUrl;
    if (dataset.defaultView) config.defaultView = dataset.defaultView;
    if (dataset.locale) config.locale = dataset.locale;
    if (dataset.weekStartDay)
      config.weekStartDay = parseInt(dataset.weekStartDay, 10);
    if (dataset.storageKeyPrefix)
      config.storageKeyPrefix = dataset.storageKeyPrefix;
    if (dataset.mobileBreakpoint)
      config.mobileBreakpoint = parseInt(dataset.mobileBreakpoint, 10);
    if (dataset.mobileDefaultView)
      config.mobileDefaultView = dataset.mobileDefaultView;
    if (dataset.maxEventsPerDay)
      config.maxEventsPerDay = parseInt(dataset.maxEventsPerDay, 10);
    if (dataset.locationLinkTemplate)
      config.locationLinkTemplate = dataset.locationLinkTemplate;
    if (dataset.showPastEvents !== undefined)
      config.showPastEvents = dataset.showPastEvents === "true";

    // Theme from data attributes: data-theme-primary, data-theme-background, etc.
    const theme = {};
    let hasTheme = false;
    for (const [key, value] of Object.entries(dataset)) {
      if (key.startsWith("theme") && key.length > 5) {
        const themeProp = key.charAt(5).toLowerCase() + key.slice(6);
        theme[themeProp] = value;
        hasTheme = true;
      }
    }
    if (hasTheme) config.theme = theme;

    // Views from comma-separated data attribute
    if (dataset.views) {
      config.views = dataset.views.split(",").map((v) => v.trim());
    }
    if (dataset.mobileHiddenViews) {
      config.mobileHiddenViews = dataset.mobileHiddenViews
        .split(",")
        .map((v) => v.trim());
    }

    init(config);
  }
}

// Auto-init when DOM is ready
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    // DOM already loaded, use microtask to allow inline scripts to run first
    Promise.resolve().then(autoInit);
  }
}
