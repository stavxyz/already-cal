import { isPast, getDatePartsInTz } from '../util/dates.js';
import { setEventDetail } from '../router.js';

export function createElement(tag, className, attrs) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

export function bindEventClick(el, event, viewName, config) {
  function handleClick() {
    if (config.onEventClick) {
      const result = config.onEventClick(event, viewName);
      if (result === false) return;
    }
    setEventDetail(event.id);
  }
  el.addEventListener('click', handleClick);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  });
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'button');
}

export function applyEventClasses(el, event, baseClass) {
  let cls = baseClass;
  if (isPast(event.start)) cls += ` ${baseClass}--past`;
  if (event.featured) cls += ` ${baseClass}--featured`;
  el.className = cls;
}

export function createEventImage(event, className) {
  const wrapper = createElement('div', className);
  const img = document.createElement('img');
  img.src = event.image;
  img.alt = event.title;
  img.setAttribute('loading', 'lazy');
  img.onerror = () => { wrapper.style.display = 'none'; };
  wrapper.appendChild(img);
  return wrapper;
}

export function filterHidden(events) {
  return events.filter(e => !e.hidden);
}

export function sortFeatured(events) {
  return [...events].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
}

export function sortFeaturedByDate(events, timezone, locale) {
  const dateKey = (e) => {
    const p = getDatePartsInTz(e.start, timezone, locale);
    return `${p.year}-${p.month}-${p.day}`;
  };
  return [...events].sort((a, b) => {
    if (dateKey(a) !== dateKey(b)) return 0;
    return (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
  });
}
