const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginError = document.getElementById('login-error');
const registerError = document.getElementById('register-error');

function setAuthErr(el, text) {
  if (!el) return;
  if (text) {
    el.textContent = text;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setAuthErr(loginError, '');
  const payload = {
    email: document.getElementById('login-email').value,
    password: document.getElementById('login-password').value
  };
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Вход выполнен');
    window.location.href = '/dashboard';
  } catch (error) {
    const m = error.message || 'Не удалось войти';
    setAuthErr(loginError, m);
    showToast(m, 'err');
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  setAuthErr(registerError, '');
  const payload = {
    name: document.getElementById('register-name').value,
    email: document.getElementById('register-email').value,
    password: document.getElementById('register-password').value
  };
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    showToast('Аккаунт создан');
    window.location.href = '/dashboard';
  } catch (error) {
    const m = error.message || 'Ошибка регистрации';
    setAuthErr(registerError, m);
    showToast(m, 'err');
  }
});
