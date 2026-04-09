const VALID_VIEWS = ['month', 'week', 'day', 'grid', 'list'];

function storageKey(config) {
  const prefix = (config && config.storageKeyPrefix) || 'ogcal';
  return `${prefix}-view`;
}

export function parseHash() {
  // Check path for /event/{id} (allows server-side routing)
  const pathMatch = window.location.pathname.match(/\/event\/([^/]+)\/?$/);
  if (pathMatch) {
    return { view: 'detail', eventId: decodeURIComponent(pathMatch[1]) };
  }

  const hash = window.location.hash.slice(1); // remove #
  if (!hash) return null;

  // #event/abc123
  if (hash.startsWith('event/')) {
    return { view: 'detail', eventId: hash.slice(6) };
  }

  // #day/2026-04-04
  if (hash.startsWith('day/')) {
    return { view: 'day', date: hash.slice(4) };
  }

  // #month, #week, #grid, #list, #day
  if (VALID_VIEWS.includes(hash)) {
    return { view: hash };
  }

  return null;
}

export function getInitialView(defaultView, enabledViews, config) {
  // Priority: initialEvent > hash/path > localStorage > config default
  if (config && config.initialEvent) {
    return { view: 'detail', eventId: config.initialEvent };
  }

  const fromHash = parseHash();
  if (fromHash) return fromHash;

  const key = storageKey(config);
  const saved = localStorage.getItem(key);
  if (saved && enabledViews.includes(saved)) {
    return { view: saved };
  }

  return { view: defaultView || 'month' };
}

export function setView(view, config) {
  window.location.hash = view;
  const key = storageKey(config);
  localStorage.setItem(key, view);
}

export function setEventDetail(eventId) {
  window.location.hash = `event/${eventId}`;
}

export function onHashChange(callback) {
  window.addEventListener('hashchange', () => {
    const parsed = parseHash();
    if (parsed) callback(parsed);
  });
}
