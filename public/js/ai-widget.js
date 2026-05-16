(function () {
  if (document.getElementById('fl-ai-fab')) return;

  function esc(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  // 1. Создаём главный контейнер виджета
  const root = document.createElement('div');
  root.className = 'fl-ai-root';
  
  // 2. СРАЗУ НАМЕРТВО КЛЕИМ КОНТЕЙНЕР К ЭКРАНУ (ИГНОРИРУЯ ЛЮБОЙ CSS НА САЙТЕ)
  root.style.setProperty('position', 'fixed', 'important');
  root.style.setProperty('bottom', '24px', 'important');
  root.style.setProperty('right', '24px', 'important');
  root.style.setProperty('z-index', '999999', 'important');

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
        <button type="submit" class="fl-ai-submit">></button>
      </form>
    </div>
  `;

  // 3. Только теперь пихаем его в body, когда он уже фиксированный
  document.body.appendChild(root);

  const fab = document.getElementById('fl-ai-fab');
  const panel = document.getElementById('fl-ai-panel');
  const closeBtn = document.getElementById('fl-ai-close');
  const form = document.getElementById('fl-ai-form');
  const input = document.getElementById('fl-ai-input');
  const chat = document.getElementById('fl-ai-chat');

  // ЖЁСТКИЕ СТИЛИ ДЛЯ КНОПКИ-КРУГА
  fab.style.setProperty('position', 'relative', 'important');
  fab.style.setProperty('width', '56px', 'important');
  fab.style.setProperty('height', '56px', 'important');
  fab.style.setProperty('border-radius', '50%', 'important');
  fab.style.setProperty('background', '#ffffff', 'important');
  fab.style.setProperty('color', '#000000', 'important');
  fab.style.setProperty('border', 'none', 'important');
  fab.style.setProperty('cursor', 'pointer', 'important');
  fab.style.setProperty('font-size', '24px', 'important');
  fab.style.setProperty('font-weight', 'bold', 'important');
  fab.style.setProperty('box-shadow', '0 8px 24px rgba(0, 0, 0, 0.4)', 'important');
  fab.style.setProperty('display', 'flex', 'important');
  fab.style.setProperty('align-items', 'center', 'important');
  fab.style.setProperty('justify-content', 'center', 'important');

  // ЖЁСТКИЕ СТИЛИ ДЛЯ ОКНА ЧАТА
  panel.style.setProperty('position', 'absolute', 'important');
  panel.style.setProperty('bottom', '72px', 'important');
  panel.style.setProperty('right', '0', 'important');
  panel.style.setProperty('width', '360px', 'important');
  panel.style.setProperty('height', '480px', 'important');
  panel.style.setProperty('background', '#0a0a0a', 'important');
  panel.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.1)', 'important');
  panel.style.setProperty('border-radius', '16px', 'important');
  panel.style.setProperty('box-shadow', '0 12px 40px rgba(0, 0, 0, 0.6)', 'important');
  panel.style.setProperty('flex-direction', 'column', 'important');
  panel.style.setProperty('overflow', 'hidden', 'important');
  
  if (panel.classList.contains('hidden')) {
    panel.style.setProperty('display', 'none', 'important');
  } else {
    panel.style.setProperty('display', 'flex', 'important');
  }

  function addMessage(sender, text) {
    const d = document.createElement('div');
    d.className = 'fl-ai-msg ' + (sender === 'user' ? 'fl-ai-msg-user' : 'fl-ai-msg-ai');
    d.innerHTML = `<b>${sender === 'user' ? 'Вы' : 'ИИ'}:</b> ${esc(text)}`;
    chat.appendChild(d);
    chat.scrollTop = chat.scrollHeight;
  }

  fab.addEventListener('click', function () {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      panel.style.setProperty('display', 'flex', 'important');
      input.focus();
    } else {
      panel.style.setProperty('display', 'none', 'important');
    }
  });

  closeBtn.addEventListener('click', function () {
    panel.classList.add('hidden');
    panel.style.setProperty('display', 'none', 'important');
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const prompt = input.value.trim();
    if (!prompt) return;

    addMessage('user', prompt);
    input.value = '';

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt })
      });
      const data = await res.json();
      addMessage('ai', data.reply || 'Ошибка ответа.');
    } catch {
      addMessage('ai', 'Ошибка сети.');
    }
  });
})();