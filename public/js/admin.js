const siteMsg = document.getElementById('site-editor-msg');
const usersRoot = document.getElementById('admin-users');

const SUB_LABELS = { basic: 'Базовая', pro: 'Pro', proplus: 'Pro+' };
const SUB_COLORS = { basic: '#888880', pro: '#48bb78', proplus: '#9f7aea' };

async function loadUsers() {
  if (!usersRoot) return;
  usersRoot.innerHTML = '<p class="muted">Загрузка…</p>';
  try {
    const { users } = await api('/api/admin/users');
    if (!users.length) { usersRoot.innerHTML = '<p class="muted">Пользователей нет.</p>'; return; }
    usersRoot.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
          <thead>
            <tr style="color:#888880;text-align:left;border-bottom:1px solid rgba(255,255,255,0.08);">
              <th style="padding:8px 10px;">ID</th>
              <th style="padding:8px 10px;">Имя</th>
              <th style="padding:8px 10px;">Email</th>
              <th style="padding:8px 10px;">Роль</th>
              <th style="padding:8px 10px;">Подписка</th>
              <th style="padding:8px 10px;">Дата</th>
              <th style="padding:8px 10px;">Действия</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            ${users.map(u => renderUserRow(u)).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    usersRoot.innerHTML = `<p class="muted">${escHtml(e.message)}</p>`;
  }
}

function renderUserRow(u) {
  const sub = u.subscription || 'basic';
  const subColor = SUB_COLORS[sub] || '#888880';
  const date = u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—';
  return `<tr data-uid="${u.id}" style="border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s;" onmouseenter="this.style.background='rgba(255,255,255,0.03)'" onmouseleave="this.style.background=''">
    <td style="padding:10px;color:#555550;">#${escHtml(String(u.id))}</td>
    <td style="padding:10px;font-weight:600;color:#f5f5f0;">${escHtml(u.name || '—')}</td>
    <td style="padding:10px;color:#888880;">${escHtml(u.email || '—')}</td>
    <td style="padding:10px;">
      <select class="user-role-sel" style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);color:#f5f5f0;border-radius:8px;padding:4px 8px;font-size:0.82rem;">
        <option value="user" ${u.role==='user'?'selected':''}>user</option>
        <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
      </select>
    </td>
    <td style="padding:10px;">
      <select class="user-sub-sel" style="background:rgba(0,0,0,0.3);border:1px solid ${subColor}44;color:${subColor};border-radius:8px;padding:4px 8px;font-size:0.82rem;font-weight:700;">
        <option value="basic" ${sub==='basic'?'selected':''}>Базовая</option>
        <option value="pro" ${sub==='pro'?'selected':''}>Pro</option>
        <option value="proplus" ${sub==='proplus'?'selected':''}>Pro+</option>
      </select>
    </td>
    <td style="padding:10px;color:#555550;">${date}</td>
    <td style="padding:10px;display:flex;gap:6px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-small user-save-btn" style="font-size:0.78rem;padding:5px 10px;">Сохранить</button>
      <button class="btn btn-small user-del-btn" style="font-size:0.78rem;padding:5px 10px;background:rgba(255,107,107,0.12);border:1px solid rgba(255,107,107,0.3);color:#ff6b6b;">Удалить</button>
    </td>
  </tr>`;
}

document.getElementById('reload-users')?.addEventListener('click', loadUsers);

usersRoot?.addEventListener('click', async (e) => {
  const row = e.target.closest('[data-uid]');
  if (!row) return;
  const uid = row.dataset.uid;

  if (e.target.closest('.user-save-btn')) {
    const role = row.querySelector('.user-role-sel')?.value;
    const subscription = row.querySelector('.user-sub-sel')?.value;
    try {
      await api(`/api/admin/users/${uid}`, { method: 'PATCH', body: JSON.stringify({ role, subscription }) });
      showToast('✅ Пользователь обновлён');
      // Обновляем цвет select подписки
      const sel = row.querySelector('.user-sub-sel');
      if (sel) sel.style.color = SUB_COLORS[subscription] || '#888880';
    } catch (err) {
      showToast('Ошибка: ' + (err.message || ''), 'err');
    }
  }

  if (e.target.closest('.user-del-btn')) {
    const name = row.querySelector('td:nth-child(2)')?.textContent || uid;
    if (!confirm(`Удалить пользователя "${name}"? Это действие необратимо.`)) return;
    try {
      await api(`/api/admin/users/${uid}`, { method: 'DELETE' });
      row.remove();
      showToast('Пользователь удалён');
    } catch (err) {
      showToast('Ошибка: ' + (err.message || ''), 'err');
    }
  }
});

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
  loadUsers();
  loadTickets();
  loadReviewsPending();
  loadPublishedReviews();
})();
