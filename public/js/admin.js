const siteMsg = document.getElementById('site-editor-msg');

async function loadStats() {
  try {
    const stats = await api('/api/admin/stats');
    document.getElementById('users-stat').textContent = stats.users;
    document.getElementById('offers-stat').textContent = stats.offers;
    document.getElementById('today-stat').textContent = stats.todayOffers;
    document.getElementById('admin-mode').textContent = `Режим: ${stats.mode}`;
  } catch (error) {
    document.getElementById('admin-mode').textContent = error.message || 'Нужен вход под администратором.';
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
    siteMsg.textContent = 'Сохранено. Обнови главную страницу.';
  } catch (error) {
    siteMsg.textContent = error.message || 'Ошибка сохранения';
  }
});

loadStats();
loadSiteJson();

const ticketRoot = document.getElementById('admin-tickets');

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
          <button type="button" class="btn btn-neon btn-small" data-save="1">Сохранить</button>
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
  } catch (error) {
    if (msg) msg.textContent = error.message || 'Ошибка';
  }
});

loadTickets();
