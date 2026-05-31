function esc(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function faviconForHref(href) {
  try {
    const u = new URL(String(href));
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=32`;
  } catch {
    return '';
  }
}

function formatOffersCount(n) {
  const x = Number(n) || 0;
  return new Intl.NumberFormat('ru-RU').format(x);
}

async function fetchJson(url) {
  const r = await fetch(url, { credentials: 'same-origin' });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Ошибка ${r.status}`);
  return data;
}

function parsePriceRange(label) {
  const s = String(label || '').replaceAll('\u00a0', ' ');
  if (/\$|usd/i.test(s)) return { min: '', max: '', currency: 'USD' };
  const nums = s.match(/\d[\d ]*/g)?.map((x) => Number(x.replaceAll(' ', ''))).filter((n) => Number.isFinite(n)) || [];
  if (nums.length === 0) return { min: '', max: '', currency: '' };
  if (s.toLowerCase().includes('до')) return { min: '', max: String(nums[0]), currency: '' };
  if (s.includes('+') || s.toLowerCase().includes('от')) return { min: String(nums[0]), max: '', currency: '' };
  if (nums.length >= 2) return { min: String(nums[0]), max: String(nums[1]), currency: '' };
  return { min: String(nums[0]), max: '', currency: '' };
}

function mapPeriodToHours(label) {
  const s = String(label || '').toLowerCase();
  if (s.includes('час') && !s.includes('сут')) return '1';
  if (s.includes('сут') || s.includes('день') || s.includes('сутк')) return '24';
  if (s.includes('нед')) return '168';
  if (s.includes('мес')) return '720';
  return '';
}

function wireFilterChips() {
  document.querySelectorAll('.filter-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.filter;
      const label = btn.textContent.trim();
      const p = new URLSearchParams();
      if (type === 'price') {
        const pr = parsePriceRange(label);
        if (pr.min) p.set('min', pr.min);
        if (pr.max) p.set('max', pr.max);
        if (pr.currency) p.set('currency', pr.currency);
      } else if (type === 'period') {
        const h = mapPeriodToHours(label);
        if (h) p.set('period', h);
      } else {
        p.set('q', label);
      }
      window.location.href = `/feed?${p.toString()}`;
    });
  });
}

function wireFaqAccordion(root) {
  const stack = root || document.getElementById('faq-stack');
  if (!stack) return;
  stack.querySelectorAll('details').forEach((det) => {
    det.addEventListener('toggle', () => {
      if (!det.open) return;
      stack.querySelectorAll('details').forEach((o) => {
        if (o !== det) o.open = false;
      });
    });
  });
}

function renderJournalAndFaq(c) {
  const jn = document.getElementById('journal-news');
  if (jn) {
    jn.innerHTML = (c.news || [])
      .map(
        (n) => `
      <a class="news-row" href="/about">
        <div class="news-row-title">${esc(n.title)}</div>
        <div class="news-row-meta">${esc(n.meta || n.tag || '')} · ♥ ${esc(n.likes || '0')}</div>
      </a>`
      )
      .join('');
  }
  const fq = document.getElementById('faq-stack');
  if (fq) {
    const items = c.faq || [];
    fq.innerHTML = items
      .map(
        (item, idx) => `
      <details class="faq-i" ${idx === 0 ? 'open' : ''}>
        <summary>${esc(item.q)}</summary>
        <div class="faq-a"><div class="faq-a-inner">${esc(item.a)}</div></div>
      </details>`
      )
      .join('');
    wireFaqAccordion(fq);
  }
}

function renderReviews(c) {
  const grid = document.getElementById('reviews-hub-grid');
  const dotsEl = document.getElementById('reviews-dots');
  if (!grid) return;
  const reviews = c.reviews || [];
  if (!reviews.length) return;
  function ex(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  grid.innerHTML = reviews.map(r =>
    '<article class="review-tile hub-hover-card">' +
    '<div class="review-stars-wrap">' + (window.FLStars ? window.FLStars.renderStars(r.rating||5) : '') + '</div>' +
    '<div class="review-quote">&#8220;</div>' +
    '<p class="review-body">' + ex(r.text) + '</p>' +
    '<div class="review-name">' + ex(r.name) + '</div>' +
    '<div class="review-role">' + ex(r.role||'') + '</div></article>'
  ).join('');
  const cards = Array.from(grid.querySelectorAll('.review-tile'));
  const total = cards.length;
  const VIS = 3;
  let cur = 0, timer = null;
  if (dotsEl) dotsEl.innerHTML = reviews.map((_,i) => '<button class="review-dot' + (i===0?' active':'') + '" data-dot="' + i + '"></button>').join('');
  function show(idx) {
    cur = ((idx%total)+total)%total;
    cards.forEach((c,i) => { c.style.display = ((i-cur+total)%total < VIS) ? '' : 'none'; });
    if (dotsEl) dotsEl.querySelectorAll('.review-dot').forEach((d,i) => d.classList.toggle('active', i===cur));
  }
  function go() { show(cur+1); }
  function start() { clearInterval(timer); timer = setInterval(go, 3200); }
  show(0);
  if (dotsEl) dotsEl.addEventListener('click', function(e) { var b=e.target.closest('[data-dot]'); if(b){show(Number(b.dataset.dot));start();} });
  var sec = document.getElementById('reviews-hub');
  if (sec && 'IntersectionObserver' in window) {
    new IntersectionObserver(function(en){if(en[0].isIntersecting)start();else clearInterval(timer);},{threshold:0.2}).observe(sec);
  } else start();
}
function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}

function animateCountEl(el, end, duration, formatFn) {
  const t0 = performance.now();
  function frame(now) {
    const u = Math.min(1, (now - t0) / duration);
    const v = Math.round(end * easeOutCubic(u));
    el.textContent = formatFn(v);
    if (u < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function parseStatTarget(display) {
  const raw = String(display).replace(/\u00a0/g, ' ').trim();
  const compact = raw.replace(/\s/g, '');
  if (/^\d{4}$/.test(compact)) return { kind: 'year', end: Number(compact), finalText: raw };
  const digits = raw.replace(/[^\d]/g, '');
  const n = digits ? Number(digits) : NaN;
  if (Number.isFinite(n) && n > 0) return { kind: 'count', end: n, finalText: raw };
  return { kind: 'text', end: 0, finalText: raw };
}

function runHubStatsAnimation(statsArr) {
  const wrap = document.getElementById('stats-grid');
  if (!wrap) return;
  const blocks = [...wrap.querySelectorAll('.stat')];
  statsArr.forEach((s, i) => {
    const el = blocks[i];
    if (!el) return;
    const numEl = el.querySelector('.stat-num');
    if (!numEl) return;
    const parsed = parseStatTarget(s.value);
    if (parsed.kind === 'text') {
      numEl.textContent = s.value;
      return;
    }
    if (parsed.kind === 'year') {
      numEl.textContent = '2000';
      const t0 = performance.now();
      const dur = 1100;
      function step(now) {
        const u = Math.min(1, (now - t0) / dur);
        const cur = Math.round(2000 + (parsed.end - 2000) * easeOutCubic(u));
        numEl.textContent = String(cur);
        if (u < 1) requestAnimationFrame(step);
        else numEl.textContent = parsed.finalText;
      }
      requestAnimationFrame(step);
      return;
    }
    const plus = String(s.value).includes('+');
    numEl.textContent = plus ? '0+' : '0';
    const t0 = performance.now();
    const dur = 1200;
    function step2(now) {
      const u = Math.min(1, (now - t0) / dur);
      const cur = Math.round(parsed.end * easeOutCubic(u));
      const txt = new Intl.NumberFormat('ru-RU').format(cur);
      numEl.textContent = plus ? `${txt}+` : txt;
      if (u < 1) requestAnimationFrame(step2);
      else numEl.textContent = s.value;
    }
    requestAnimationFrame(step2);
  });
}

function animateOffersCountMeta(count) {
  const badge = document.getElementById('offers-count');
  const heroTag = document.getElementById('home-hero-tag');
  const n = Number(count) || 0;
  if (!badge) return;
  animateCountEl(
    badge,
    n,
    900,
    (v) => new Intl.NumberFormat('ru-RU').format(v)
  );
  if (heroTag) {
    const label = document.createElement('span');
    label.className = 'hero-tag-count';
    heroTag.textContent = '';
    heroTag.appendChild(label);
    animateCountEl(label, n, 900, (v) => `${new Intl.NumberFormat('ru-RU').format(v)} активных предложений`);
  }
}

async function loadHome() {
  let contentRes = null;
  let metaRes = null;

  try {
    [contentRes, metaRes] = await Promise.all([fetchJson('/api/site/content'), fetchJson('/api/offers/meta')]);
  } catch (e) {
    console.warn('home:', e.message);
  }

  const exWrap = document.getElementById('exchange-tags');
  const heroTag = document.getElementById('home-hero-tag');
  const srcSel = document.getElementById('home-source');
  const catSel = document.getElementById('home-category');
  const priceSel = document.getElementById('home-price');
  const periodSel = document.getElementById('home-period');

  try {
    if (!contentRes || contentRes.error) {
      document.getElementById('home-hero-title').textContent = 'FlowLance';
      document.getElementById('home-hero-sub').textContent =
        'Запусти локальный сервер проекта и открой главную по адресу приложения (не как файл с диска).';
      if (metaRes?.count != null) {
        document.getElementById('offers-count').textContent = formatOffersCount(metaRes.count);
        if (heroTag) heroTag.textContent = `${formatOffersCount(metaRes.count)} активных предложений`;
      }
      window.initRevealScroll?.();
      return;
    }

    const c = contentRes;
    document.getElementById('home-hero-title').textContent = c.hero?.title || '';
    document.getElementById('home-hero-sub').textContent = c.hero?.subtitle || '';

    const primary = document.getElementById('home-primary-cta');
    if (c.hero?.primaryCta) {
      primary.textContent = c.hero.primaryCta.label;
      primary.href = c.hero.primaryCta.href || '/feed';
    }

    if (metaRes && metaRes.count != null) {
      animateOffersCountMeta(metaRes.count);
    }

    if (srcSel) {
      const items = (c.exchanges || []).map((x) => x.name).filter(Boolean);
      srcSel.innerHTML = `<option value="">Все биржи</option>` + items.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }
    if (catSel) {
      const items = (c.categories || [])
        .flatMap((b) => (b.items || []).map((x) => x))
        .filter(Boolean)
        .slice(0, 60);
      catSel.innerHTML = `<option value="">Все категории</option>` + items.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }
    if (priceSel) {
      const items = (c.priceChips || []).filter(Boolean);
      priceSel.innerHTML = `<option value="">Любая цена</option>` + items.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }
    if (periodSel) {
      const items = (c.periods || []).filter(Boolean);
      periodSel.innerHTML = `<option value="">Период</option>` + items.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    }

    const chips = (c.exchanges || [])
      .map((x) => {
        const ico = faviconForHref(x.href);
        const img = ico
          ? `<img class="exchange-chip-ico" src="${esc(ico)}" alt="" width="20" height="20" loading="lazy" decoding="async" />`
          : '';
        return `<a class="exchange-chip glass chip-animate" href="${esc(x.href)}" target="_blank" rel="noopener noreferrer">${img}<span>${esc(x.name)}</span></a>`;
      })
      .join('');
    if (exWrap) exWrap.innerHTML = chips + chips;

    const cat = document.getElementById('category-grid');
    cat.innerHTML = (c.categories || [])
      .map(
        (block, bi) => `
    <article class="category-card glass card-tilt reveal reveal-delay-${(bi % 4) + 1}">
      <h3>${esc(block.title)}</h3>
      <ul>${(block.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    </article>`
      )
      .join('');

    const price = document.getElementById('price-chips');
    price.innerHTML = (c.priceChips || [])
      .map(
        (p, pi) =>
          `<button type="button" class="chip chip-glow filter-chip" data-filter="price">${esc(p)}</button>`
      )
      .join('');

    const period = document.getElementById('period-chips');
    period.innerHTML = (c.periods || [])
      .map(
        (p, pi) =>
          `<button type="button" class="chip chip-glow filter-chip" data-filter="period">${esc(p)}</button>`
      )
      .join('');

    wireFilterChips();

    const stats = document.getElementById('stats-grid');
    stats.innerHTML = (c.stats || [])
      .map(
        (_, si) => `
    <div class="stat">
      <span class="stat-num">0</span>
      <span class="stat-label"></span>
    </div>`
      )
      .join('');
    (c.stats || []).forEach((s, i) => {
      const row = stats.children[i];
      if (!row) return;
      row.querySelector('.stat-label').textContent = s.label || '';
    });
    runHubStatsAnimation(c.stats || []);

    renderJournalAndFaq(c);
    renderReviews(c);
  } finally {
    window.initRevealScroll?.();
  }
}

document.getElementById('home-search-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const src = document.getElementById('home-source')?.value || '';
  const cat = document.getElementById('home-category')?.value || '';
  const price = document.getElementById('home-price')?.value || '';
  const periodLabel = document.getElementById('home-period')?.value || '';
  const pr = parsePriceRange(price);
  const period = mapPeriodToHours(periodLabel);

  const p = new URLSearchParams();
  if (src) p.set('source', src);
  if (cat) p.set('category', cat);
  if (pr.min) p.set('min', pr.min);
  if (pr.max) p.set('max', pr.max);
  if (pr.currency) p.set('currency', pr.currency);
  if (period) p.set('period', period);
  window.location.href = `/feed?${p.toString()}`;
});

loadHome().catch((err) => {
  console.error(err);
  document.getElementById('home-hero-title').textContent = 'FlowLance';
  document.getElementById('home-hero-sub').textContent = 'Не удалось загрузить данные. Проверь, что сервер запущен.';
  document.querySelectorAll('.reveal').forEach((el) => {
    el.classList.add('visible');
    el.classList.add('is-visible');
  });
  window.initRevealScroll?.();
});
