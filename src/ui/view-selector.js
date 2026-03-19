import { setView } from '../router.js';

const VIEW_LABELS = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  grid: 'Grid',
  list: 'List',
};

export function renderViewSelector(container, views, activeView, isMobile) {
  const filtered = isMobile ? views.filter(v => v !== 'week') : views;

  const bar = document.createElement('div');
  bar.className = 'ogcal-view-selector';
  bar.setAttribute('role', 'tablist');

  for (const view of filtered) {
    const tab = document.createElement('button');
    tab.className = 'ogcal-view-tab' + (view === activeView ? ' ogcal-view-tab--active' : '');
    tab.textContent = VIEW_LABELS[view] || view;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', view === activeView ? 'true' : 'false');
    tab.addEventListener('click', () => setView(view));
    bar.appendChild(tab);
  }

  container.innerHTML = '';
  container.appendChild(bar);
}
