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
  document.querySelectorAll('.fl-notification').forEach(n => n.remove());

  const el = document.createElement('div');
  el.className = 'fl-notification';
  const isSuccess = type === 'success';
  el.style.cssText = [
    'position:fixed',
    'top:24px',
    'left:50%',
    'transform:translateX(-50%) translateY(-20px)',
    'z-index:99999',
    'padding:14px 24px 14px 18px',
    'border-radius:16px',
    'font-size:0.92rem',
    'font-weight:600',
    'max-width:480px',
    'width:calc(100% - 40px)',
    'display:flex',
    'align-items:center',
    'gap:12px',
    'opacity:0',
    'transition:opacity 0.35s,transform 0.35s cubic-bezier(0.22,1,0.36,1)',
    'pointer-events:none',
    'backdrop-filter:blur(12px)',
    '-webkit-backdrop-filter:blur(12px)',
    isSuccess
      ? 'background:rgba(10,10,10,0.97);border:1px solid rgba(110,231,160,0.5);color:#6ee7a0;box-shadow:0 8px 40px rgba(0,0,0,0.6),0 0 0 1px rgba(110,231,160,0.1)'
      : 'background:rgba(10,10,10,0.97);border:1px solid rgba(255,107,107,0.5);color:#ff6b6b;box-shadow:0 8px 40px rgba(0,0,0,0.6)'
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
    requestAnimationFrame(() => {
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
    });
  });

  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-16px)';
    setTimeout(() => el.remove(), 400);
  }, 4000);
}
