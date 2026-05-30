const profileForm = document.getElementById('profile-form');
const logoutLink = document.getElementById('logout-link');
const avatarPreview = document.getElementById('avatar-preview');
const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileBio = document.getElementById('profile-bio');
const cabUsername = document.getElementById('cab-username');
const portfolioPct = document.getElementById('portfolio-pct');
const portfolioBar = document.getElementById('portfolio-bar');
const adminLink = document.getElementById('admin-link');
const favGrid = document.getElementById('fav-grid');
const favEmpty = document.getElementById('fav-empty');
const reviewForm = document.getElementById('review-form');

let user = null;

function esc(s = '') {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

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
  cabUsername.textContent = user?.name || '—';
}

function formatProfileSince(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function renderProfile(u) {
  user = u;
  avatarPreview.src = u.avatar_url || 'https://placehold.co/96x96/0a0a0a/ffffff/png?text=FL';
  profileName.textContent = u.name || 'Без имени';
  profileEmail.textContent = u.email || '';
  profileBio.textContent = u.bio || 'Добавь описание — так проще доверять профилю.';
  const sinceEl = document.getElementById('profile-since');
  const since = formatProfileSince(u.created_at);
  if (sinceEl) {
    if (since) { sinceEl.textContent = `Профиль создан: ${since}`; sinceEl.hidden = false; }
    else { sinceEl.hidden = true; }
  }

  // Бейдж подписки
  const badge = document.getElementById('sub-badge');
  const upgradeLink = document.getElementById('sub-upgrade-link');
  if (badge) {
    const sub = String(u.subscription || 'basic').toLowerCase();
    if (sub === 'proplus') {
      badge.textContent = '[PRO+]';
      badge.style.cssText = 'display:inline-block;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:6px;letter-spacing:0.05em;background:rgba(159,122,234,0.15);color:#9f7aea;border:1px solid rgba(159,122,234,0.4);';
      if (upgradeLink) upgradeLink.style.display = 'none';
    } else if (sub === 'pro') {
      badge.textContent = '[PRO]';
      badge.style.cssText = 'display:inline-block;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:6px;letter-spacing:0.05em;background:rgba(72,187,120,0.15);color:#48bb78;border:1px solid rgba(72,187,120,0.4);';
      if (upgradeLink) { upgradeLink.textContent = 'Улучшить до Pro+ →'; upgradeLink.href = '/pricing'; }
    } else {
      badge.textContent = 'Базовая';
      badge.style.cssText = 'display:inline-block;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:6px;letter-spacing:0.05em;background:rgba(255,255,255,0.05);color:#888880;border:1px solid rgba(255,255,255,0.1);';
    }
  }

  renderPortfolio();
}

async function loadFavorites() {
  if (!favGrid) return;
  favGrid.innerHTML = '';
  try {
    const { offers } = await api('/api/favorites');
    if (!offers?.length) {
      favEmpty.hidden = false;
      return;
    }
    favEmpty.hidden = true;
    favGrid.innerHTML = offers
      .map(
        (o) => `
      <article class="fav-card glass">
        <p class="fav-meta">${esc(o.source)} · ${esc(o.category)}</p>
        <h3 class="fav-title">${esc(o.title)}</h3>
        <p class="fav-budget">${esc(o.budget)}</p>
        ${
          o.external_url && /^https?:\/\//i.test(o.external_url) && !/google\.com/i.test(o.external_url)
            ? `<a class="btn btn-outline btn-small" href="${esc(o.external_url)}" target="_blank" rel="noopener noreferrer">Открыть объявление</a>`
            : ''
        }
      </article>`
      )
      .join('');
  } catch {
    favEmpty.hidden = false;
  }
}

async function loadProfile() {
  try {
    user = await api('/api/profile');
    document.getElementById('name').value = user.name || '';
    document.getElementById('avatar_url').value = user.avatar_url || '';
    document.getElementById('bio').value = user.bio || '';
    renderProfile(user);
    if (user.role === 'admin') adminLink.classList.remove('hidden');
    await loadFavorites();
  } catch {
    window.location.href = '/auth';
  }
}

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
    showToast('Профиль сохранён');
  } catch (error) {
    showError(error);
  }
});

logoutLink?.addEventListener('click', async (e) => {
  e.preventDefault();
  await api('/api/auth/logout', { method: 'POST' }).catch(() => null);
  window.location.href = '/auth';
});

function initReviewStars() {
  const picker = document.getElementById('review-stars-picker');
  const hidden = document.getElementById('review-rating');
  if (!picker || !window.FLStars) return;
  picker.innerHTML = window.FLStars.renderStars(5, { interactive: true, name: 'rating' });
  window.FLStars.bindStarPicker(picker, (n) => {
    if (hidden) hidden.value = String(n);
  });
}

reviewForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = document.getElementById('review-text')?.value?.trim() || '';
  const rating = Number(
    document.querySelector('#review-stars-picker input[type="hidden"]')?.value || 5
  );
  try {
    await api('/api/reviews', { method: 'POST', body: JSON.stringify({ text, rating }) });
    showToast('Отзыв отправлен на модерацию');
    reviewForm.reset();
  } catch (err) {
    showError(err);
  }
});

initReviewStars();
loadProfile().then(() => initAnimatedAvatars());

function initAnimatedAvatars() {
  const grid = document.getElementById('animated-avatars-grid');
  const lock = document.getElementById('animated-lock');
  const sub = String(user?.subscription || 'basic').toLowerCase();
  if (sub === 'proplus') {
    if (grid) { grid.style.opacity = '1'; grid.style.pointerEvents = 'auto'; }
    if (lock) lock.style.display = 'none';
    grid?.querySelectorAll('.anim-avatar-pick').forEach(img => {
      img.addEventListener('click', () => {
        grid.querySelectorAll('.anim-avatar-pick').forEach(i => i.style.borderColor = 'transparent');
        img.style.borderColor = '#9f7aea';
        const avatarInput = document.getElementById('avatar_url');
        if (avatarInput) avatarInput.value = img.src;
        const avatarPreviewEl = document.getElementById('avatar-preview');
        if (avatarPreviewEl) avatarPreviewEl.src = img.src;
      });
    });
  }
}
