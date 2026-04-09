export function renderPastToggle(container, showingPast, onToggle, config) {
  const i18n = (config && config.i18n) || {};
  const showLabel = i18n.showPastEvents || 'Show past events';
  const hideLabel = i18n.hidePastEvents || 'Hide past events';

  const btn = document.createElement('button');
  btn.className = 'showcal-past-toggle';
  btn.textContent = showingPast ? hideLabel : showLabel;
  btn.addEventListener('click', onToggle);
  container.innerHTML = '';
  container.appendChild(btn);
}
