/** Показ «Кабинет» / «Войти» по сессии (одинаково на всех страницах). */
(function () {
  function applyNav(user) {
    const auth = document.getElementById('nav-auth');
    const dash = document.getElementById('nav-dash');
    if (!auth || !dash) return;
    if (user && user.email) {
      auth.classList.add('hidden');
      dash.classList.remove('hidden');
    } else {
      auth.classList.remove('hidden');
      dash.classList.add('hidden');
    }
  }

  async function run() {
    try {
      const r = await fetch('/api/profile', { credentials: 'include' });
      if (r.ok) applyNav(await r.json());
      else applyNav(null);
    } catch {
      applyNav(null);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
