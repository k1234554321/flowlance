const PLATFORMS = [
  {
    name: 'Freelancer',
    inFeed: true,
    url: 'https://www.freelancer.com/',
    blurb: 'Крупная международная биржа: от микрозадач до долгих контрактов.',
    pros: ['Огромный поток заказов', 'Международные проекты и валюты', 'Удобный поиск по навыкам'],
    cons: ['Высокая конкуренция', 'Комиссии и иногда шум в откликах', 'Нужен сильный английский для части задач']
  },
  {
    name: 'Freelancehunt',
    inFeed: true,
    url: 'https://freelancehunt.com/projects',
    blurb: 'Украинская и СНГ-биржа: проекты с прямым переходом на страницу заказа.',
    pros: ['Много задач на русском и украинском', 'Понятные карточки проектов', 'Удобный отклик'],
    cons: ['Конкуренция в популярных нишах', 'Часть заказов с жёстким бюджетом', 'Нужен аккуратный расчёт сроков']
  },
  {
    name: 'RemoteOK',
    inFeed: true,
    url: 'https://remoteok.com/',
    blurb: 'Фокус на удалённых вакансиях и контрактах в IT и смежных областях.',
    pros: ['Чистый формат вакансий', 'Много IT и продуктовых ролей', 'Быстрый просмотр условий'],
    cons: ['Меньше локальных задач на русском', 'Часть позиций только full-time', 'Нужно следить за таймзонами']
  },
  {
    name: 'FL.ru',
    inFeed: true,
    url: 'https://www.fl.ru/',
    blurb: 'Классическая российская биржа: широкий спектр digital-задач.',
    pros: ['Привычный формат для РФ', 'Разные уровни бюджета', 'Много категорий'],
    cons: ['Нужно внимательно читать ТЗ', 'Конкуренция среди исполнителей', 'Сроки обсуждаются индивидуально']
  },
  {
    name: 'Kwork',
    inFeed: true,
    url: 'https://kwork.ru/',
    blurb: 'Маркетплейс услуг и готовых кворков — удобно для типовых пакетов.',
    pros: ['Понятные пакеты «под ключ»', 'Быстрый старт для простых задач', 'Рейтинги и отзывы'],
    cons: ['Меньше гибкости в нестандартных проектах', 'Цена часто фиксирована пакетом', 'Нужно следить за доп. опциями']
  },
  {
    name: 'Habr Freelance',
    inFeed: true,
    url: 'https://freelance.habr.com/',
    blurb: 'Профильная площадка с упором на разработку, продукт и инженерные задачи.',
    pros: ['Сильное IT-комьюнити', 'Часто адекватные ТЗ', 'Удобно для команд и middle+'],
    cons: ['Планка по навыкам выше среднего', 'Не всегда много мелких задач', 'Нужно аккуратно оценивать сроки']
  },
  {
    name: 'Freelance.ru',
    inFeed: true,
    url: 'https://freelance.ru/',
    blurb: 'Универсальная биржа с разными категориями и форматами сотрудничества.',
    pros: ['Разнообразие заказов', 'Знакомый многим формат', 'Можно наращивать репутацию'],
    cons: ['Нужен дисциплинированный отклик', 'Важно фиксировать договорённости', 'Конкуренция в популярных нишах']
  }
];

function esc(s) {
  return String(s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function favHost(url) {
  try {
    const u = new URL(String(url));
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`;
  } catch {
    return '';
  }
}

function initials(name) {
  const s = String(name || '').trim();
  return (s[0] || '?').toUpperCase();
}

function render() {
  const grid = document.getElementById('sources-grid');
  if (!grid) return;
  grid.innerHTML = PLATFORMS.map((p, idx) => {
    const d = (idx % 4) + 1;
    const tag = '<span class="source-feed-tag is-live">В потоке ленты</span>';
    const fav = favHost(p.url);
    return `
    <article class="source-card glass is-live hub-hover-card reveal reveal-delay-${d}">
      <div class="source-card-top">
        <div class="source-brand">
          <span class="source-avatar-wrap">
            <span class="source-letter" aria-hidden="true">${esc(initials(p.name))}</span>
            <img class="source-fav" src="${esc(fav)}" alt="" width="44" height="44" loading="lazy" decoding="async" onerror="this.style.display='none'" />
          </span>
          <h2 class="source-card-title">${esc(p.name)}</h2>
        </div>
      </div>
      <p class="source-card-blurb">${esc(p.blurb)}</p>
      <div class="source-lists">
        <div>
          <div class="source-mini-head">
            <h3 class="source-mini source-mini-pros">Плюсы</h3>
            ${tag}
          </div>
          <ul class="source-pros-list">${p.pros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
        <div>
          <h3 class="source-mini source-mini--warn">Минусы</h3>
          <ul class="source-cons-list">${p.cons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>
      </div>
      <a class="btn btn-hub-solid source-go" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Перейти на площадку</a>
    </article>`;
  }).join('');
  window.initRevealScroll?.();
}

render();
