async function api(path, options = {}) {
  const { headers: extraHeaders, ...restOptions } = options;
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    credentials: 'include',
    ...restOptions
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
  el.innerHTML = `<span class="fl-toast-inner">${String(message).replace(/</g, '&lt;')}</span>`;
  el.classList.remove('fl-toast-show');
  requestAnimationFrame(() => el.classList.add('fl-toast-show'));
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove('fl-toast-show'), 4000);
}

function showError(error) {
  showToast(error.message || String(error), 'err');
}

function formatDate(date) {
  return new Date(date).toLocaleString('ru-RU');
}


function showNotification(message, type) {
  // Удаляем предыдущее если есть
  document.querySelectorAll('.fl-notification').forEach(n => n.remove());

  const el = document.createElement('div');
  el.className = 'fl-notification';
  const isSuccess = type === 'success';
  el.style.cssText = [
    'position:fixed',
    'bottom:32px',
    'left:50%',
    'transform:translateX(-50%) translateY(24px)',
    'z-index:9999',
    'padding:14px 24px 14px 18px',
    'border-radius:16px',
    'font-size:0.92rem',
    'font-weight:600',
    'max-width:460px',
    'width:calc(100% - 40px)',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'opacity:0',
    'transition:opacity 0.35s,transform 0.35s cubic-bezier(0.22,1,0.36,1)',
    'pointer-events:none',
    'backdrop-filter:blur(12px)',
    isSuccess
      ? 'background:rgba(10,10,10,0.95);border:1px solid rgba(110,231,160,0.45);color:#6ee7a0;box-shadow:0 8px 32px rgba(0,0,0,0.5),0 0 0 1px rgba(110,231,160,0.1)'
      : 'background:rgba(10,10,10,0.95);border:1px solid rgba(255,107,107,0.45);color:#ff6b6b;box-shadow:0 8px 32px rgba(0,0,0,0.5)'
  ].join(';');

  const icon = document.createElement('span');
  icon.style.cssText = 'font-size:1.2rem;flex-shrink:0;';
  icon.textContent = isSuccess ? '✅' : '❌';

  const text = document.createElement('span');
  text.style.cssText = 'flex:1;line-height:1.4;';
  text.textContent = message;

  el.appendChild(icon);
  el.appendChild(text);
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(16px)';
    setTimeout(() => el.remove(), 400);
  }, 4000);
}
