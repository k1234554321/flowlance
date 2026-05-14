const form = document.getElementById('ticket-form');
const msg = document.getElementById('ticket-msg');

document.querySelectorAll('#faq .faq-stack details').forEach((det) => {
  det.addEventListener('toggle', () => {
    if (!det.open) return;
    document.querySelectorAll('#faq .faq-stack details').forEach((o) => {
      if (o !== det) o.open = false;
    });
  });
});

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const payload = {
    email: document.getElementById('ticket-email').value.trim(),
    name: document.getElementById('ticket-name').value.trim(),
    subject: document.getElementById('ticket-subject').value.trim(),
    body: document.getElementById('ticket-body').value.trim()
  };
  try {
    const r = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `Ошибка ${r.status}`);
    msg.textContent = 'Обращение принято. Мы ответим на почту.';
    form.reset();
  } catch (err) {
    msg.textContent = err.message || 'Не удалось отправить';
  }
});
