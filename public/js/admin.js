const siteMsg = document.getElementById('site-editor-msg');

async function gateAdmin() {
  try {
    const user = await api('/api/profile');
    if (user.role !== 'admin') {
      showToast('Нужны права администратора', 'err');
      window.location.href = '/dashboard';
      return false;
    }
    return true;
  } catch {
    window.location.href = '/auth';
    return false;
  }
}

async function loadStats() {
  try {
    const stats = await api('/api/admin/stats');
    document.getElementById('users-stat').textContent = stats.users;
    document.getElementById('offers-stat').textContent = stats.offers;
    document.getElementById('today-stat').textContent = stats.todayOffers;
    document.getElementById('admin-mode').textContent = `Режим: ${stats.mode}`;
  } catch (error) {
    document.getElementById('admin-mode').textContent = error.message || 'Ошибка статистики';
  }
}

async function loadSiteJson() {
  siteMsg.textContent = '';
  try {
    const data = await api('/api/admin/site/content');
    document.getElementById('site-json').value = JSON.stringify(data, null, 2);
    siteMsg.textContent = 'Загружено.';
  } catch (error) {
    siteMsg.textContent = error.message || 'Ошибка загрузки';
  }
}

document.getElementById('load-site-btn')?.addEventListener('click', () => {
  loadSiteJson();
});

document.getElementById('save-site-btn')?.addEventListener('click', async () => {
  siteMsg.textContent = '';
  const raw = document.getElementById('site-json').value.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    siteMsg.textContent = 'Невалидный JSON — исправь и попробуй снова.';
    return;
  }
  try {
    await api('/api/admin/site/content', { method: 'PUT', body: JSON.stringify(parsed) });
    siteMsg.textContent = 'Сохранено.';
    showToast('Контент сайта обновлён');
  } catch (error) {
    siteMsg.textContent = error.message || 'Ошибка сохранения';
  }
});

const ticketRoot = document.getElementById('admin-tickets');
const reviewsRoot = document.getElementById('admin-reviews');

function escHtml(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function loadTickets() {
  if (!ticketRoot) return;
  ticketRoot.textContent = 'Загрузка…';
  try {
    const { tickets } = await api('/api/admin/tickets');
    if (!tickets.length) {
      ticketRoot.textContent = 'Пока нет обращений.';
      return;
    }
    ticketRoot.innerHTML = tickets
      .map(
        (t, ti) => `
      <article class="ticket-card glass reveal reveal-delay-${(ti % 4) + 1}" data-tid="${escHtml(t.id)}">
        <div class="ticket-head">
          <strong>${escHtml(t.subject)}</strong>
          <span class="muted">${escHtml(t.status)} · ${escHtml(t.createdAt)}</span>
        </div>
        <p class="muted">${escHtml(t.email)} ${t.name ? `· ${escHtml(t.name)}` : ''}</p>
        <p class="ticket-body">${escHtml(t.body)}</p>
        <label class="muted">Ответ пользователю</label>
        <textarea class="ticket-reply" rows="3">${escHtml(t.adminReply || '')}</textarea>
        <div class="ticket-actions">
          <select class="ticket-status">
            <option value="new" ${t.status === 'new' ? 'selected' : ''}>new</option>
            <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>in_progress</option>
            <option value="closed" ${t.status === 'closed' ? 'selected' : ''}>closed</option>
          </select>
          <button type="button" class="btn btn-hub-solid btn-small" data-save="1">Сохранить</button>
        </div>
        <p class="admin-msg ticket-save-msg"></p>
      </article>`
      )
      .join('');
    window.initRevealScroll?.();
  } catch (error) {
    ticketRoot.textContent = error.message || 'Нет доступа';
  }
}

document.getElementById('reload-tickets')?.addEventListener('click', () => loadTickets());

ticketRoot?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-save]');
  if (!btn || !ticketRoot) return;
  const card = btn.closest('.ticket-card');
  if (!card) return;
  const id = card.dataset.tid;
  const reply = card.querySelector('.ticket-reply')?.value ?? '';
  const status = card.querySelector('.ticket-status')?.value ?? 'new';
  const msg = card.querySelector('.ticket-save-msg');
  if (msg) msg.textContent = '';
  try {
    await api(`/api/admin/tickets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ adminReply: reply, status })
    });
    if (msg) msg.textContent = 'Сохранено.';
    showToast('Тикет обновлён');
  } catch (error) {
    if (msg) msg.textContent = error.message || 'Ошибка';
  }
});

async function loadReviewsPending() {
  if (!reviewsRoot) return;
  reviewsRoot.textContent = 'Загрузка…';
  try {
    const { reviews } = await api('/api/admin/reviews/pending');
    if (!reviews.length) {
      reviewsRoot.textContent = 'Очередь пуста.';
      return;
    }
    reviewsRoot.innerHTML = reviews
      .map(
        (r, i) => `
      <article class="ticket-card glass reveal reveal-delay-${(i % 4) + 1}" data-rid="${escHtml(r.id)}">
        <div class="ticket-head">
          <strong>${escHtml(r.name)}</strong>
          <span class="muted">${escHtml(r.createdAt)}</span>
        </div>
        <p class="muted">${escHtml(r.email)}</p>
        <p class="ticket-body">${escHtml(r.text)}</p>
        <div class="ticket-actions">
          <button type="button" class="btn btn-hub-solid btn-small" data-approve="1">Опубликовать на главной</button>
          <button type="button" class="btn btn-outline btn-small" data-reject="1">Отклонить (из очереди)</button>
        </div>
        <p class="admin-msg review-act-msg"></p>
      </article>`
      )
      .join('');
    window.initRevealScroll?.();
  } catch (error) {
    reviewsRoot.textContent = error.message || 'Ошибка';
  }
}

document.getElementById('reload-reviews')?.addEventListener('click', () => loadReviewsPending());

const reviewsPublishedRoot = document.getElementById('admin-reviews-published');

async function loadPublishedReviews() {
  if (!reviewsPublishedRoot) return;
  reviewsPublishedRoot.textContent = 'Загрузка…';
  try {
    const { reviews } = await api('/api/admin/reviews/published');
    if (!reviews.length) {
      reviewsPublishedRoot.textContent = 'На главной пока нет отзывов в JSON.';
      return;
    }
    reviewsPublishedRoot.innerHTML = reviews
      .map(
        (r, i) => `
      <article class="ticket-card glass reveal reveal-delay-${(i % 4) + 1}" data-pub-idx="${i}">
        <div class="ticket-head">
          <strong>${escHtml(r.name)}</strong>
          <span class="muted">#${i + 1} на главной</span>
        </div>
        <p class="muted">${escHtml(r.role || '')}</p>
        <p class="ticket-body">${escHtml(r.text)}</p>
        <div class="ticket-actions">
          <button type="button" class="btn btn-outline btn-small" data-remove-published="1">Убрать с главной</button>
        </div>
        <p class="admin-msg published-act-msg"></p>
      </article>`
      )
      .join('');
    window.initRevealScroll?.();
  } catch (error) {
    reviewsPublishedRoot.textContent = error.message || 'Ошибка';
  }
}

document.getElementById('reload-published-reviews')?.addEventListener('click', () => loadPublishedReviews());

reviewsPublishedRoot?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-remove-published]');
  if (!btn || !reviewsPublishedRoot) return;
  const card = btn.closest('[data-pub-idx]');
  if (!card) return;
  const idx = Number(card.dataset.pubIdx);
  const msg = card.querySelector('.published-act-msg');
  if (msg) msg.textContent = '';
  try {
    await api(`/api/admin/reviews/published/${idx}`, { method: 'DELETE' });
    showToast('Отзыв убран с главной');
    await loadPublishedReviews();
    await loadSiteJson();
  } catch (error) {
    if (msg) msg.textContent = error.message || 'Ошибка';
  }
});

reviewsRoot?.addEventListener('click', async (e) => {
  const approve = e.target.closest('[data-approve]');
  const reject = e.target.closest('[data-reject]');
  if (!approve && !reject) return;
  const card = e.target.closest('[data-rid]');
  if (!card) return;
  const id = card.dataset.rid;
  const msg = card.querySelector('.review-act-msg');
  if (msg) msg.textContent = '';
  try {
    if (approve) {
      await api(`/api/admin/reviews/${encodeURIComponent(id)}/approve`, { method: 'POST', body: '{}' });
      showToast('Отзыв опубликован — появится на главной после обновления страницы');
      await loadPublishedReviews();
      await loadSiteJson();
    } else {
      await api(`/api/admin/reviews/pending/${encodeURIComponent(id)}`, { method: 'DELETE' });
      showToast('Отзыв удалён из очереди');
    }
    card.remove();
    if (reviewsRoot && !reviewsRoot.querySelector('[data-rid]')) reviewsRoot.textContent = 'Очередь пуста.';
  } catch (error) {
    if (msg) msg.textContent = error.message || 'Ошибка';
  }
});

(async function boot() {
  const ok = await gateAdmin();
  if (!ok) return;
  loadStats();
  loadSiteJson();
  loadTickets();
  loadReviewsPending();
  loadPublishedReviews();
})();
