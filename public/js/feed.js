const state = { offers: [] };
const favIdSet = new Set();
const offersGrid = document.getElementById('offers-grid');
const sourceFilter = document.getElementById('source-filter');
const categoryFilter = document.getElementById('category-filter');
const searchFilter = document.getElementById('search-filter');
const periodFilter = document.getElementById('period-filter');
const currencyFilter = document.getElementById('currency-filter');
const priceMinInp = document.getElementById('price-min');
const priceMaxInp = document.getElementById('price-max');
const filteredCount = document.getElementById('filtered-count');
const applyFiltersBtn = document.getElementById('apply-filters');

const params = new URLSearchParams(window.location.search);
const initial = {
  q: params.get('q'),
  source: params.get('source'),
  category: params.get('category'),
  period: params.get('period'),
  currency: params.get('currency'),
  min: params.get('min'),
  max: params.get('max')
};

if (initial.q && searchFilter) searchFilter.value = initial.q;
if (initial.currency && currencyFilter) currencyFilter.value = initial.currency.toUpperCase();
if (initial.min && priceMinInp) priceMinInp.value = String(initial.min);
if (initial.max && priceMaxInp) priceMaxInp.value = String(initial.max);
if (initial.period && periodFilter) {
  const h = Number(initial.period);
  const periodLabels = {
    1: 'За последний час',
    3: 'За 3 часа',
    12: 'За 12 часов',
    24: 'За сутки',
    72: 'За 3 дня',
    168: 'За неделю',
    720: 'За месяц'
  };
  const label = periodLabels[h] || `Последние ${initial.period} ч`;
  ensureOption(periodFilter, initial.period, label);
  periodFilter.value = initial.period;
}

const QUICK_TAGS = ['Копирайт', 'Дизайн', 'React', 'Python', 'Тестирование', 'Маркетинг', 'SEO'];

function esc(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function ensureOption(select, value, text) {
  if (!select || !value) return;
  if ([...select.options].some((o) => o.value === value)) return;
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text || value;
  select.appendChild(o);
}

function parseOfferTime(o) {
  const t = new Date(o.posted_at).getTime();
  return Number.isFinite(t) ? t : 0;
}

function periodCutoffMs() {
  const v = periodFilter?.value;
  if (!v) return null;
  const hours = Number(v);
  if (!Number.isFinite(hours)) return null;
  return hours * 3600000;
}

function matchPeriod(o) {
  const windowMs = periodCutoffMs();
  if (windowMs == null) return true;
  return Date.now() - parseOfferTime(o) <= windowMs;
}

function matchPrice(o) {
  const minV = priceMinInp?.value !== '' ? Number(priceMinInp.value) : null;
  const maxV = priceMaxInp?.value !== '' ? Number(priceMaxInp.value) : null;
  const lo = Number(o.budget_min);
  const hi = Number(o.budget_max);
  if (minV != null && Number.isFinite(minV) && Number.isFinite(hi) && hi < minV) return false;
  if (maxV != null && Number.isFinite(maxV) && Number.isFinite(lo) && lo > maxV) return false;
  return true;
}

function matchCurrency(o) {
  const c = currencyFilter?.value;
  if (!c) return true;
  return String(o.currency || '').toUpperCase() === c;
}

function matchCategory(item, selected) {
  if (!selected) return true;
  const ic = String(item.category || '');
  if (ic === selected) return true;
  if (ic.toLowerCase() === selected.toLowerCase()) return true;
  const blob = `${item.title} ${item.description} ${ic}`.toLowerCase();
  return blob.includes(selected.toLowerCase());
}

function rebuildDynamicFilters() {
  const sources = [...new Set(state.offers.map((o) => o.source))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));
  const categories = [...new Set(state.offers.map((o) => o.category))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'ru'));

  sourceFilter.innerHTML = '<option value="">Все биржи</option>';
  sources.forEach((s) => {
    const o = document.createElement('option');
    o.value = s;
    o.textContent = s;
    sourceFilter.appendChild(o);
  });
  if (initial.source) ensureOption(sourceFilter, initial.source, initial.source);

  categoryFilter.innerHTML = '<option value="">Все категории</option>';
  categories.forEach((c) => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = c;
    categoryFilter.appendChild(o);
  });
  if (initial.category) ensureOption(categoryFilter, initial.category, initial.category);

  if (initial.source && [...sourceFilter.options].some((o) => o.value === initial.source)) {
    sourceFilter.value = initial.source;
  }
  if (initial.category && [...categoryFilter.options].some((o) => o.value === initial.category)) {
    categoryFilter.value = initial.category;
  }
}

function buildFiltered() {
  const source = sourceFilter.value;
  const category = categoryFilter.value;
  const search = searchFilter.value.trim().toLowerCase();
  return state.offers.filter((item) => {
    if (source && item.source !== source) return false;
    if (!matchCategory(item, category)) return false;
    if (search && !`${item.title} ${item.description}`.toLowerCase().includes(search)) return false;
    if (!matchPeriod(item)) return false;
    if (!matchPrice(item)) return false;
    if (!matchCurrency(item)) return false;
    return true;
  });
}

function offerListingUrl(offer) {
  const u = String(offer?.external_url || '').trim();
  if (!u || !/^https?:\/\//i.test(u) || /google\.com/i.test(u)) return '';
  return u;
}

function offerCard(offer, idx) {
  const link = offerListingUrl(offer);
  const action = link
    ? `<a class="btn btn-outline" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Открыть объявление</a>`
    : `<span class="btn btn-outline offer-link-missing" aria-disabled="true">Ссылка недоступна</span>`;
  const d = (idx % 4) + 1;
  const favOn = favIdSet.has(offer.id) ? ' fav-on' : '';
  return `
    <article class="card glass offer-card feed-card hub-hover-card reveal reveal-delay-${d}">
      <div class="offer-card-top">
        <p class="price accent-price">${esc(offer.budget)}</p>
        <button type="button" class="offer-fav${favOn}" data-fav="${esc(offer.id)}" title="В избранное" aria-label="В избранное">★</button>
      </div>
      <small class="meta">${esc(offer.source)} · ${esc(offer.category)}</small>
      <h3>${esc(offer.title)}</h3>
      <p class="offer-snippet">${esc(offer.description)}</p>
      <small class="meta">Опубликовано: ${formatDate(offer.posted_at)}</small>
      <div class="offer-card-actions">
        ${action}
      </div>
    </article>
  `;
}

function renderOffers() {
  const filtered = buildFiltered();
  if (filteredCount) filteredCount.textContent = String(filtered.length);
  offersGrid.innerHTML = filtered.map((o, i) => offerCard(o, i)).join('');
  window.initRevealScroll?.();
}

let searchDebounce;
function scheduleRender() {
  window.clearTimeout(searchDebounce);
  searchDebounce = window.setTimeout(() => renderOffers(), 220);
}

function appendOffer(offer) {
  if (state.offers.some((item) => item.id === offer.id)) return;
  state.offers.unshift(offer);
  ensureOption(sourceFilter, offer.source, offer.source);
  ensureOption(categoryFilter, offer.category, offer.category);
  if (state.offers.length > 300) state.offers = state.offers.slice(0, 300);
  renderOffers();
}

async function refreshFavIds() {
  try {
    const { ids } = await api('/api/favorites/ids');
    favIdSet.clear();
    (ids || []).forEach((id) => favIdSet.add(id));
  } catch {
    favIdSet.clear();
  }
}

offersGrid?.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-fav]');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  const id = btn.getAttribute('data-fav');
  try {
    const { inList } = await api('/api/favorites/toggle', { method: 'POST', body: JSON.stringify({ id }) });
    btn.classList.toggle('fav-on', inList);
    showToast(inList ? 'В избранном' : 'Убрано из избранного');
  } catch (err) {
    const m = err.message || '';
    if (m.includes('авториза') || m.includes('401')) {
      showToast('Войди в аккаунт, чтобы сохранять заказы', 'err');
      return;
    }
    showError(err);
  }
});

async function loadOffers() {
  try {
    const sub = window._feedSub || 'basic';
    const limit = sub === 'basic' ? 24 : 120;
    const offers = await api('/api/offers?limit=' + limit);
    state.offers = offers;
    await refreshFavIds();
    rebuildDynamicFilters();
    renderOffers();
  } catch (error) {
    showError(error);
  }
}

sourceFilter?.addEventListener('change', renderOffers);
categoryFilter?.addEventListener('change', renderOffers);
periodFilter?.addEventListener('change', renderOffers);
currencyFilter?.addEventListener('change', renderOffers);
priceMinInp?.addEventListener('input', scheduleRender);
priceMaxInp?.addEventListener('input', scheduleRender);
searchFilter?.addEventListener('input', scheduleRender);

applyFiltersBtn?.addEventListener('click', () => {
  renderOffers();
  offersGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

const pillsWrap = document.getElementById('feed-cat-pills');
if (pillsWrap) {
  pillsWrap.innerHTML = QUICK_TAGS.map(
    (t) => `<button type="button" class="chip chip-glow feed-quick">${esc(t)}</button>`
  ).join('');
  pillsWrap.querySelectorAll('.feed-quick').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.textContent.trim();
      const matchOpt = [...categoryFilter.options].find((o) => o.value && (o.value === t || o.textContent.trim() === t));
      if (matchOpt) {
        categoryFilter.value = matchOpt.value;
        searchFilter.value = '';
      } else {
        categoryFilter.value = '';
        searchFilter.value = t;
      }
      renderOffers();
      offersGrid?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function connectLive() {
  const socket = io();
  socket.on('offer:new', appendOffer);
}

// Ждём пока checkFeedAccess установит _feedSub, потом грузим
setTimeout(function() {
  loadOffers();
  connectLive();
}, 300);
