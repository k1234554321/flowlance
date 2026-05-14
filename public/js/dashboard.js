const profileForm = document.getElementById('profile-form');
const logoutLink = document.getElementById('logout-link');
const promoLink = document.getElementById('promo-link');
const avatarPreview = document.getElementById('avatar-preview');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileBio = document.getElementById('profile-bio');
const cabUsername = document.getElementById('cab-username');
const portfolioPct = document.getElementById('portfolio-pct');
const portfolioBar = document.getElementById('portfolio-bar');
const coinBalance = document.getElementById('coin-balance');
const taskProjects = document.getElementById('task-projects');
const taskProjectsBar = document.getElementById('task-projects-bar');
const btnBumpProject = document.getElementById('btn-bump-project');
const btnClaimProjects = document.getElementById('btn-claim-projects');
const btnClaimDaily = document.getElementById('btn-claim-daily');
const btnClaimProfile = document.getElementById('btn-claim-profile');
const adminLink = document.getElementById('admin-link');

let user = null;
let cabinet = null;

function portfolioScore(u) {
  let pts = 0;
  if (u?.name && String(u.name).trim().length > 1) pts += 34;
  if (u?.avatar_url && String(u.avatar_url).trim().length > 8) pts += 33;
  if (u?.bio && String(u.bio).trim().length > 24) pts += 33;
  return Math.min(100, pts);
}

function renderPortfolio() {
  const pct = portfolioScore(user);
  portfolioPct.textContent = String(pct);
  portfolioBar.style.width = `${pct}%`;
  cabUsername.textContent = user?.name || 'Гость';
}

function renderSocial() {
  const map = {
    vkConnected: document.getElementById('soc-vk'),
    googleConnected: document.getElementById('soc-google'),
    yandexConnected: document.getElementById('soc-yandex')
  };
  Object.entries(map).forEach(([key, el]) => {
    if (!el || !cabinet) return;
    const on = Boolean(cabinet[key]);
    el.classList.toggle('connected', on);
    const btn = el.querySelector('[data-action="toggle"]');
    if (btn) btn.textContent = on ? 'Отключить' : 'Подключить';
  });
}

function renderBonuses() {
  if (!cabinet) return;
  coinBalance.textContent = String(cabinet.coins ?? 0);
  const p = cabinet.projectTaskProgress ?? 0;
  taskProjects.textContent = `Прогресс: ${p} / 10`;
  taskProjectsBar.style.width = `${Math.min(100, p * 10)}%`;

  const canClaimProjects = p >= 10 && !cabinet.projectsBonusClaimed;
  btnClaimProjects.disabled = !canClaimProjects;

  const today = new Date().toISOString().slice(0, 10);
  const dailyDone = cabinet.lastClaimDate === today;
  btnClaimDaily.disabled = dailyDone;
  btnClaimDaily.textContent = dailyDone ? 'Уже получено сегодня' : 'Получить 10 Flow Coin';

  btnClaimProfile.disabled = Boolean(cabinet.profileBonusClaimed);
  btnClaimProfile.textContent = cabinet.profileBonusClaimed ? 'Бонус получен' : 'Получить бонус';
}

async function loadCabinet() {
  cabinet = await api('/api/cabinet/state');
  renderSocial();
  renderBonuses();
}

function renderProfile(u) {
  user = u;
  avatarPreview.src = u.avatar_url || 'https://placehold.co/96x96/1a1f2e/8899cc/png?text=FL';
  profileName.textContent = u.name || 'Без имени';
  profileEmail.textContent = u.email || '';
  profileBio.textContent = u.bio || 'Расскажи о своём опыте.';
  renderPortfolio();
}

async function loadProfile() {
  try {
    user = await api('/api/profile');
    document.getElementById('name').value = user.name || '';
    document.getElementById('avatar_url').value = user.avatar_url || '';
    document.getElementById('bio').value = user.bio || '';
    renderProfile(user);
    if (user.role === 'admin') adminLink.classList.remove('hidden');
    await loadCabinet();
  } catch {
    window.location.href = '/auth';
  }
}

document.querySelectorAll('.social-card').forEach((card) => {
  const key = card.dataset.provider;
  card.querySelector('.social-btn')?.addEventListener('click', async () => {
    if (!cabinet || !key) return;
    const next = !cabinet[key];
    try {
      cabinet = await api('/api/cabinet/state', {
        method: 'PUT',
        body: JSON.stringify({ [key]: next })
      });
      renderSocial();
    } catch (e) {
      showError(e);
    }
  });
});

btnBumpProject?.addEventListener('click', async () => {
  try {
    cabinet = await api('/api/cabinet/bump-project-task', { method: 'POST' });
    renderBonuses();
  } catch (e) {
    showError(e);
  }
});

btnClaimProjects?.addEventListener('click', async () => {
  try {
    cabinet = await api('/api/cabinet/claim-projects', { method: 'POST' });
    renderBonuses();
  } catch (e) {
    showError(e);
  }
});

btnClaimDaily?.addEventListener('click', async () => {
  try {
    cabinet = await api('/api/cabinet/claim-daily', { method: 'POST' });
    renderBonuses();
  } catch (e) {
    showError(e);
  }
});

btnClaimProfile?.addEventListener('click', async () => {
  try {
    cabinet = await api('/api/cabinet/claim-profile', { method: 'POST' });
    renderBonuses();
  } catch (e) {
    showError(e);
  }
});

profileForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const payload = {
    name: document.getElementById('name').value,
    avatar_url: document.getElementById('avatar_url').value,
    bio: document.getElementById('bio').value
  };
  try {
    await api('/api/profile', { method: 'PUT', body: JSON.stringify(payload) });
    user = { ...user, ...payload };
    renderProfile(user);
    alert('Профиль сохранён');
  } catch (error) {
    showError(error);
  }
});

logoutLink?.addEventListener('click', async (e) => {
  e.preventDefault();
  await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
  window.location.href = '/auth';
});

promoLink?.addEventListener('click', (e) => {
  e.preventDefault();
  const code = window.prompt('Введите промокод (демо):', '');
  if (code && String(code).toLowerCase() === 'flow') {
    alert('Промокод принят! В реальной версии здесь будет начисление.');
  } else if (code) {
    alert('Промокод не найден.');
  }
});

loadProfile();
