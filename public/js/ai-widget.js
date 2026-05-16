(function () {
  function esc(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function mount() {
    if (document.getElementById('fl-ai-fab')) return;

    const root = document.createElement('div');
    root.id = 'fl-ai-root';
    root.className = 'fl-ai-root';

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'fl-ai-fab';
    fab.id = 'fl-ai-fab';
    fab.setAttribute('aria-label', 'Помощник FlowLance');
    fab.textContent = '?';

    const panel = document.createElement('div');
    panel.className = 'fl-ai-panel hidden';
    panel.id = 'fl-ai-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Чат помощника');

    const head = document.createElement('div');
    head.className = 'fl-ai-head';
    head.innerHTML =
      '<span>FlowLance · помощник</span>' +
      '<button type="button" class="fl-ai-close" id="fl-ai-close" aria-label="Закрыть">×</button>';

    const hint = document.createElement('p');
    hint.className = 'fl-ai-hint';
    hint.textContent =
      'Фриланс, удалёнка и сервис FlowLance — для пользователей из любых стран.';

    const chat = document.createElement('div');
    chat.className = 'fl-ai-chat';
    chat.id = 'fl-ai-chat';

    const form = document.createElement('form');
    form.className = 'fl-ai-form';
    form.id = 'fl-ai-form';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'fl-ai-input';
    input.maxLength = 2000;
    input.placeholder = 'Спроси про ленту, отклик или фильтры…';
    input.autocomplete = 'off';

    const submit = document.createElement('button');
    submit.type = 'submit';
    submit.className = 'fl-ai-submit';
    submit.setAttribute('aria-label', 'Отправить');
    submit.textContent = '>';

    form.append(input, submit);
    panel.append(head, hint, chat, form);
    root.append(fab, panel);

    document.documentElement.appendChild(root);

    const closeBtn = document.getElementById('fl-ai-close');

    function setPanelOpen(open) {
      panel.classList.toggle('hidden', !open);
      if (open) input.focus();
    }

    function addMessage(sender, text) {
      const d = document.createElement('div');
      d.className = 'fl-ai-msg ' + (sender === 'user' ? 'fl-ai-msg-user' : 'fl-ai-msg-ai');
      d.innerHTML = '<b>' + (sender === 'user' ? 'Вы' : 'ИИ') + ':</b> ' + esc(text);
      chat.appendChild(d);
      chat.scrollTop = chat.scrollHeight;
    }

    fab.addEventListener('click', function () {
      setPanelOpen(panel.classList.contains('hidden'));
    });

    closeBtn.addEventListener('click', function () {
      setPanelOpen(false);
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
          body: JSON.stringify({ prompt: prompt }),
        });
        const data = await res.json();
        addMessage('ai', data.reply || 'Ошибка ответа.');
      } catch {
        addMessage('ai', 'Ошибка сети.');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
