import { setView } from '../router.js';

const DEFAULT_VIEW_LABELS = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  grid: 'Grid',
  list: 'List',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

function createSvg() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('aria-hidden', 'true');
  return svg;
}

function el(tag, attrs) {
  const e = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

const VIEW_ICONS = {
  month: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '1', y: '3', width: '14', height: '12', rx: '1' }));
    svg.appendChild(el('line', { x1: '1', y1: '7', x2: '15', y2: '7' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '7', x2: '5.5', y2: '15' }));
    svg.appendChild(el('line', { x1: '10.5', y1: '7', x2: '10.5', y2: '15' }));
    return svg;
  },
  week: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '1', y: '1', width: '3', height: '14', rx: '0.5' }));
    svg.appendChild(el('rect', { x: '6.5', y: '1', width: '3', height: '14', rx: '0.5' }));
    svg.appendChild(el('rect', { x: '12', y: '1', width: '3', height: '14', rx: '0.5' }));
    return svg;
  },
  day: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '3', y: '1', width: '10', height: '14', rx: '1' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '5', x2: '10.5', y2: '5' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '8', x2: '10.5', y2: '8' }));
    svg.appendChild(el('line', { x1: '5.5', y1: '11', x2: '9', y2: '11' }));
    return svg;
  },
  grid: () => {
    const svg = createSvg();
    svg.appendChild(el('rect', { x: '1', y: '1', width: '6', height: '6', rx: '1' }));
    svg.appendChild(el('rect', { x: '9', y: '1', width: '6', height: '6', rx: '1' }));
    svg.appendChild(el('rect', { x: '1', y: '9', width: '6', height: '6', rx: '1' }));
    svg.appendChild(el('rect', { x: '9', y: '9', width: '6', height: '6', rx: '1' }));
    return svg;
  },
  list: () => {
    const svg = createSvg();
    svg.appendChild(el('line', { x1: '1', y1: '3', x2: '15', y2: '3' }));
    svg.appendChild(el('line', { x1: '1', y1: '8', x2: '15', y2: '8' }));
    svg.appendChild(el('line', { x1: '1', y1: '13', x2: '15', y2: '13' }));
    return svg;
  },
};

export function renderViewSelector(container, views, activeView, isMobile, config) {
  const i18n = (config && config.i18n) || {};
  const viewLabels = { ...DEFAULT_VIEW_LABELS, ...i18n.viewLabels };
  const mobileHiddenViews = (config && config.mobileHiddenViews) || ['week'];
  const filtered = isMobile ? views.filter(v => !mobileHiddenViews.includes(v)) : views;

  const bar = document.createElement('div');
  bar.className = 'already-view-selector';
  bar.setAttribute('role', 'tablist');

  for (const view of filtered) {
    const tab = document.createElement('button');
    tab.className = 'already-view-tab' + (view === activeView ? ' already-view-tab--active' : '');
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', view === activeView ? 'true' : 'false');

    const iconFn = VIEW_ICONS[view];
    if (iconFn) tab.appendChild(iconFn());

    tab.appendChild(document.createTextNode(viewLabels[view] || view));
    tab.addEventListener('click', () => setView(view, config));
    bar.appendChild(tab);
  }

  container.innerHTML = '';
  container.appendChild(bar);
}
