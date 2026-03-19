const VALID_VIEWS = ['month', 'week', 'day', 'grid', 'list'];
const STORAGE_KEY = 'ogcal-view';

export function parseHash() {
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

export function getInitialView(defaultView, enabledViews) {
  // Priority: hash > localStorage > config default
  const fromHash = parseHash();
  if (fromHash) return fromHash;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && enabledViews.includes(saved)) {
    return { view: saved };
  }

  return { view: defaultView || 'month' };
}

export function setView(view) {
  window.location.hash = view;
  localStorage.setItem(STORAGE_KEY, view);
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
