export function renderPastToggle(container, showingPast, onToggle) {
  const btn = document.createElement('button');
  btn.className = 'ogcal-past-toggle';
  btn.textContent = showingPast ? 'Hide past events' : 'Show past events';
  btn.addEventListener('click', onToggle);
  container.innerHTML = '';
  container.appendChild(btn);
}
