const { randomUUID, createHash } = require('crypto');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

const SOURCES = ['Upwork', 'Freelancehunt', 'Kwork', 'FL.ru', 'Habr Freelance'];
const CATEGORIES = ['Frontend', 'Backend', 'Design', 'Mobile', 'DevOps', 'AI'];
const SOURCE_URLS = {
  Freelancer: 'https://www.freelancer.com/jobs/',
  RemoteOK: 'https://remoteok.com/',
  'FL.ru': 'https://www.fl.ru/',
  'Freelance.ru': 'https://freelance.ru/',
  Kwork: 'https://kwork.ru/',
  'Habr Freelance': 'https://freelance.habr.com/'
};

const seedOffers = [
  {
    id: randomUUID(),
    title: 'Разработка React dashboard для SaaS',
    budget_min: 500,
    budget_max: 1200,
    currency: 'USD',
    source: 'Upwork',
    category: 'Frontend',
    description: 'Нужен современный адаптивный dashboard с графиками и авторизацией.',
    posted_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    title: 'Node.js API + платежная интеграция',
    budget_min: 45000,
    budget_max: 90000,
    currency: 'RUB',
    source: 'FL.ru',
    category: 'Backend',
    description: 'REST API на Express + интеграция ЮKassa, валидации и логирование.',
    posted_at: new Date().toISOString()
  },
  {
    id: randomUUID(),
    title: 'UI/UX дизайн лендинга в Figma',
    budget_min: 350,
    budget_max: 700,
    currency: 'USD',
    source: 'Freelancehunt',
    category: 'Design',
    description: 'Требуется стильный интерфейс в dark-тематике с современными анимациями.',
    posted_at: new Date().toISOString()
  }
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function detectCategory(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('react') || text.includes('frontend') || text.includes('vue') || text.includes('html')) return 'Frontend';
  if (text.includes('node') || text.includes('backend') || text.includes('api') || text.includes('python')) return 'Backend';
  if (text.includes('design') || text.includes('figma') || text.includes('ui') || text.includes('ux')) return 'Design';
  if (text.includes('mobile') || text.includes('android') || text.includes('ios') || text.includes('flutter')) return 'Mobile';
  if (text.includes('devops') || text.includes('docker') || text.includes('kubernetes') || text.includes('aws')) return 'DevOps';
  if (text.includes('ai') || text.includes('llm') || text.includes('machine learning')) return 'AI';
  return 'General';
}

function parseBudget(text = '', currencyFallback = 'USD') {
  const nums = (text.match(/\d[\d,\.]*/g) || [])
    .map((raw) => Number(raw.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return { budget_min: 100, budget_max: 600, currency: currencyFallback };
  if (nums.length === 1) return { budget_min: nums[0], budget_max: Math.round(nums[0] * 1.4), currency: currencyFallback };
  return { budget_min: Math.min(...nums), budget_max: Math.max(...nums), currency: currencyFallback };
}

function toOfferId(source, link, title) {
  return createHash('sha1').update(`${source}|${link}|${title}`).digest('hex').slice(0, 40);
}

function createLiveOffer() {
  const category = CATEGORIES[randomInt(0, CATEGORIES.length - 1)];
  const source = SOURCES[randomInt(0, SOURCES.length - 1)];
  const amount = randomInt(300, 2500);
  const isRub = Math.random() > 0.6;
  return {
    id: randomUUID(),
    title: `${category}: проект #${randomInt(1000, 9999)}`,
    budget_min: isRub ? amount * 100 : amount,
    budget_max: isRub ? amount * 170 : amount + randomInt(150, 900),
    currency: isRub ? 'RUB' : 'USD',
    source,
    category,
    description: 'Свежий заказ из агрегированной ленты. Отклик желательно в течение 15 минут.',
    external_url: SOURCE_URLS[source] || 'https://www.google.com',
    posted_at: new Date().toISOString()
  };
}

async function getFallbackOffers(limit = 24) {
  const dynamic = Array.from({ length: Math.max(0, limit - seedOffers.length) }, createLiveOffer);
  return [...seedOffers, ...dynamic]
    .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime())
    .slice(0, limit);
}

async function fetchFreelancerOffers(limit = 20) {
  try {
    const { data } = await axios.get('https://www.freelancer.com/jobs/rss', { timeout: 12000 });
    const parser = new XMLParser({ ignoreAttributes: false });
    const json = parser.parse(data);
    const items = json?.rss?.channel?.item || [];
    const list = Array.isArray(items) ? items : [items];

    return list.slice(0, limit).map((item) => {
      const title = item.title || 'Freelancer project';
      const description = String(item.description || '').replace(/<[^>]+>/g, ' ').trim();
      const link = item.link || '';
      const budget = parseBudget(`${title} ${description}`, 'USD');
      return {
        id: toOfferId('Freelancer', link, title),
        title,
        description: description.slice(0, 290) || 'Новый проект с биржи Freelancer.',
        source: 'Freelancer',
        category: detectCategory(title, description),
        external_url: link || SOURCE_URLS.Freelancer,
        ...budget,
        posted_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString()
      };
    });
  } catch {
    return [];
  }
}

async function fetchRemoteOkOffers(limit = 20) {
  try {
    const { data } = await axios.get('https://remoteok.com/api', {
      timeout: 12000,
      headers: { 'User-Agent': 'FlowLance/1.0' }
    });
    if (!Array.isArray(data)) return [];
    const rows = data.filter((item) => item && item.position && item.url).slice(0, limit);

    return rows.map((item) => {
      const description = `${item.company || ''} ${Array.isArray(item.tags) ? item.tags.join(', ') : ''}`.trim();
      return {
        id: toOfferId('RemoteOK', item.url, item.position),
        title: item.position,
        description: description || 'Удаленный проект с RemoteOK.',
        source: 'RemoteOK',
        category: detectCategory(item.position, description),
        external_url: item.url || SOURCE_URLS.RemoteOK,
        budget_min: 200,
        budget_max: 2000,
        currency: 'USD',
        posted_at: item.date ? new Date(item.date).toISOString() : new Date().toISOString()
      };
    });
  } catch {
    return [];
  }
}

async function fetchExternalOffers(limitPerSource = 20) {
  const [freelancer, remoteOk] = await Promise.all([fetchFreelancerOffers(limitPerSource), fetchRemoteOkOffers(limitPerSource)]);
  return [...freelancer, ...remoteOk]
    .sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
}

module.exports = { getFallbackOffers, createLiveOffer, fetchExternalOffers };
