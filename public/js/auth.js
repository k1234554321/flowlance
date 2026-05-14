const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    email: document.getElementById('login-email').value,
    password: document.getElementById('login-password').value
  };
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    window.location.href = '/dashboard';
  } catch (error) {
    showError(error);
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById('register-name').value,
    email: document.getElementById('register-email').value,
    password: document.getElementById('register-password').value
  };
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    window.location.href = '/dashboard';
  } catch (error) {
    showError(error);
  }
});
