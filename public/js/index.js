const modal = document.getElementById('ai-modal');
const openAi = document.getElementById('open-ai');
const closeAi = document.getElementById('close-ai');
const chat = document.getElementById('ai-chat');
const aiForm = document.getElementById('ai-form');
const aiInput = document.getElementById('ai-input');

openAi?.addEventListener('click', () => modal.classList.remove('hidden'));
closeAi?.addEventListener('click', () => modal.classList.add('hidden'));

aiForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = aiInput.value.trim();
  if (!prompt) return;

  chat.insertAdjacentHTML('beforeend', `<div class="chat-row"><b>Ты:</b> ${prompt}</div>`);
  aiInput.value = '';

  try {
    const data = await api('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    chat.insertAdjacentHTML('beforeend', `<div class="chat-row"><b>AI:</b> ${data.reply}</div>`);
    chat.scrollTop = chat.scrollHeight;
  } catch (error) {
    showError(error);
  }
});
