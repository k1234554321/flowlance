(function () {
  if (document.getElementById('fl-ai-fab')) return;

  function esc(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  const root = document.createElement('div');
  root.className = 'fl-ai-root';
  root.innerHTML = `
    <button type="button" class="fl-ai-fab" id="fl-ai-fab" aria-label="Помощник FlowLance">?</button>
    <div class="fl-ai-panel hidden" id="fl-ai-panel" role="dialog" aria-label="Чат помощника">
      <div class="fl-ai-head">
        <span>FlowLance · помощник</span>
        <button type="button" class="fl-ai-close" id="fl-ai-close" aria-label="Закрыть">×</button>
      </div>
      <p class="fl-ai-hint">Фриланс, удалёнка и сервис FlowLance — для пользователей из любых стран.</p>
      <div class="fl-ai-chat" id="fl-ai-chat"></div>
      <form class="fl-ai-form" id="fl-ai-form">
        <input type="text" id="fl-ai-input" maxlength="2000" placeholder="Спроси про ленту, отклик или фильтры…" autocomplete="off" />
        <button type="submit" class="fl-ai-send">→</button>
      </form>
    </div>`;
  document.body.appendChild(root);

  const fab = document.getElementById('fl-ai-fab');
  const panel = document.getElementById('fl-ai-panel');
  const closeBtn = document.getElementById('fl-ai-close');
  const form = document.getElementById('fl-ai-form');
  const input = document.getElementById('fl-ai-input');
  const chat = document.getElementById('fl-ai-chat');

  function bubble(role, text) {
    const div = document.createElement('div');
    div.className = `fl-ai-bubble fl-ai-bubble--${role === 'Ты' ? 'user' : 'bot'}`;
    div.innerHTML = `<strong>${esc(role)}</strong><span>${esc(text)}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  fab.addEventListener('click', () => panel.classList.toggle('hidden'));
  closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = input.value.trim();
    if (!prompt) return;
    bubble('Ты', prompt);
    input.value = '';
    try {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ prompt })
      });
      const data = await r.json().catch(() => ({}));
      bubble('Помощник', data.reply || data.error || 'Нет ответа');
    } catch {
      bubble('Помощник', 'Ошибка сети. Попробуй ещё раз.');
    }
  });
})();
// Находим или создаем контейнер виджета
const aiRoot = document.querySelector('.fl-ai-root') || document.createElement('div');
aiRoot.className = 'fl-ai-root';

// Намертво прибиваем контейнер к экрану через JS стили
aiRoot.style.position = 'fixed';
aiRoot.style.bottom = '24px';
aiRoot.style.right = '24px';
aiRoot.style.zIndex = '999999';

// Находим кнопку и фиксируем её внутреннее поведение
const aiFab = aiRoot.querySelector('.fl-ai-fab');
if (aiFab) {
  aiFab.style.width = '56px';
  aiFab.style.height = '56px';
  aiFab.style.borderRadius = '50%';
  aiFab.style.background = '#ffffff';
  aiFab.style.color = '#000000';
  aiFab.style.border = 'none';
  aiFab.style.cursor = 'pointer';
  aiFab.style.fontSize = '24px';
  aiFab.style.fontWeight = 'bold';
  aiFab.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.4)';
  aiFab.style.display = 'flex';
  aiFab.style.alignItems = 'center';
  aiFab.style.justifyContent = 'center';
  aiFab.style.position = 'relative';
}

// Находим панель чата и вешаем абсолют внутри фиксированного рута
const aiPanel = aiRoot.querySelector('.fl-ai-panel');
if (aiPanel) {
  aiPanel.style.position = 'absolute';
  aiPanel.style.bottom = '72px';
  aiPanel.style.right = '0';
  aiPanel.style.width = '360px';
  aiPanel.style.height = '480px';
  aiPanel.style.background = '#0a0a0a';
  aiPanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
  aiPanel.style.borderRadius = '16px';
  aiPanel.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.6)';
  aiPanel.style.display = aiPanel.classList.contains('hidden') ? 'none' : 'flex';
  aiPanel.style.flexDirection = 'column';
  aiPanel.style.overflow = 'hidden';
}