async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

let toastTimer;

function showToast(message, variant = 'info') {
  let el = document.getElementById('fl-toast-root');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fl-toast-root';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.className = `fl-toast-root fl-toast--${variant}`;
  el.textContent = message;
  el.classList.add('fl-toast-show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('fl-toast-show'), 4000);
}

function showError(error) {
  showToast(error.message || String(error), 'err');
}

function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU');
}
