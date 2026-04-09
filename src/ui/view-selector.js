import { setView } from '../router.js';

const DEFAULT_VIEW_LABELS = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  grid: 'Grid',
  list: 'List',
};

export function renderViewSelector(container, views, activeView, isMobile, config) {
  const i18n = (config && config.i18n) || {};
  const viewLabels = { ...DEFAULT_VIEW_LABELS, ...i18n.viewLabels };
  const mobileHiddenViews = (config && config.mobileHiddenViews) || ['week'];
  const filtered = isMobile ? views.filter(v => !mobileHiddenViews.includes(v)) : views;

  const bar = document.createElement('div');
  bar.className = 'showcal-view-selector';
  bar.setAttribute('role', 'tablist');

  for (const view of filtered) {
    const tab = document.createElement('button');
    tab.className = 'showcal-view-tab' + (view === activeView ? ' showcal-view-tab--active' : '');
    tab.textContent = viewLabels[view] || view;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', view === activeView ? 'true' : 'false');
    tab.addEventListener('click', () => setView(view, config));
    bar.appendChild(tab);
  }

  container.innerHTML = '';
  container.appendChild(bar);
}
