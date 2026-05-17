// ——— FAQ: плавное раскрытие через grid-template-rows ———
document.querySelectorAll('[data-faq]').forEach((item) => {
  const trigger = item.querySelector('.faq-trigger');
  if (!trigger) return;

  trigger.addEventListener('click', () => {
    const isOpen = item.classList.contains('is-open');

    // Закрываем все остальные
    document.querySelectorAll('[data-faq].is-open').forEach((other) => {
      if (other !== item) {
        other.classList.remove('is-open');
        other.querySelector('.faq-trigger')?.setAttribute('aria-expanded', 'false');
      }
    });

    // Переключаем текущий
    item.classList.toggle('is-open', !isOpen);
    trigger.setAttribute('aria-expanded', String(!isOpen));
  });
});

// ——— Форма тикета ———
const form = document.getElementById('ticket-form');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
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
    showToast('Обращение принято — ответим на почту');
    form.reset();
  } catch (err) {
    showToast(err.message || 'Не удалось отправить', 'err');
  }
});
