const cursor = document.querySelector('.custom-cursor');
const title = document.querySelector('.parallax-text');
const aiBtn = document.getElementById('ai-btn');
const aiModal = document.getElementById('ai-modal');
const aiClose = document.getElementById('ai-close');
const aiForm = document.getElementById('ai-form');
const aiInput = document.getElementById('ai-input');
const chatRes = document.getElementById('chat-res');

document.addEventListener('mousemove', (e) => {
  if (cursor) {
    cursor.style.left = `${e.clientX}px`;
    cursor.style.top = `${e.clientY}px`;
  }
  if (title) {
    const x = (window.innerWidth / 2 - e.clientX) / 26;
    const y = (window.innerHeight / 2 - e.clientY) / 30;
    title.style.transform = `rotateY(${x}deg) rotateX(${y}deg)`;
  }
});

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function bubble(author, text) {
  if (!chatRes) return;
  chatRes.insertAdjacentHTML('beforeend', `<div class="chat-bubble"><b>${author}:</b> ${escapeHtml(text)}</div>`);
  chatRes.scrollTop = chatRes.scrollHeight;
}

if (aiBtn && aiModal && aiClose && aiForm && aiInput && chatRes) {
  aiBtn.addEventListener('click', () => aiModal.classList.remove('hidden'));
  aiClose.addEventListener('click', () => aiModal.classList.add('hidden'));
  aiForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = aiInput.value.trim();
    if (!prompt) return;
    bubble('Ты', prompt);
    aiInput.value = '';
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const data = await response.json();
      bubble('AI', data.reply || 'Нет ответа');
    } catch {
      bubble('AI', 'Ошибка запроса, попробуй еще раз.');
    }
  });
}