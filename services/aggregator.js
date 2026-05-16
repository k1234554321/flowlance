const { createHash } = require('crypto');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');

/** Только реальные площадки с URL объявления (не заглушки). */
const SOURCE_HOME = {
  Freelancer: 'https://www.freelancer.com/jobs/',
  RemoteOK: 'https://remoteok.com/',
  Freelancehunt: 'https://freelancehunt.com/projects',
  'FL.ru': 'https://www.fl.ru/projects/',
  'Habr Freelance': 'https://freelance.habr.com/tasks',
  Kwork: 'https://kwork.ru/projects',
  Upwork: 'https://www.upwork.com/nx/search/jobs/',
};

const RSS_FEEDS = [
  { source: 'Freelancehunt', url: 'https://freelancehunt.com/projects.rss' },
  { source: 'FL.ru', url: 'https://www.fl.ru/rss/all.xml' },
];

const xmlParser = new XMLParser({ ignoreAttributes: false });

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

/** Убираем битые ссылки (в т.ч. старый fallback на google.com). */
function sanitizeExternalUrl(url, source) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return '';
  if (/google\.com/i.test(trimmed)) return '';
  try {
    const u = new URL(trimmed);
    if (!u.hostname || u.hostname === 'localhost') return '';
    return u.href;
  } catch {
    return SOURCE_HOME[source] || '';
  }
}

function stripHtml(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pickRssLink(item) {
  const raw =
    item.link ||
    item.guid?.['#text'] ||
    item.guid ||
    item['atom:link']?.['@_href'] ||
    '';
  if (typeof raw === 'object' && raw !== null) {
    return raw['#text'] || raw.href || '';
  }
  return String(raw || '').trim();
}

function currencyForSource(source) {
  if (['FL.ru', 'Freelancehunt', 'Kwork', 'Habr Freelance'].includes(source)) return 'RUB';
  return 'USD';
}

async function fetchRssOffers(source, feedUrl, limit = 15) {
  try {
    const { data } = await axios.get(feedUrl, {
      timeout: 14000,
      headers: {
        'User-Agent': 'FlowLance/1.0 (+https://flowlance.io)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      maxRedirects: 5,
    });
    const json = xmlParser.parse(data);
    const channel = json?.rss?.channel || json?.feed;
    let items = channel?.item || channel?.entry || [];
    if (!items) return [];
    if (!Array.isArray(items)) items = [items];

    const out = [];
    for (const item of items) {
      if (out.length >= limit) break;
      const title = (item.title?.['#text'] ?? item.title ?? '').toString().trim() || `${source} project`;
      const description = stripHtml(item.description || item.summary || item['content:encoded'] || '');
      let link = pickRssLink(item);
      if (link && !/^https?:/i.test(link)) {
        try {
          link = new URL(link, SOURCE_HOME[source] || feedUrl).href;
        } catch {
          link = '';
        }
      }
      link = sanitizeExternalUrl(link, source);
      if (!link) continue;

      const budget = parseBudget(`${title} ${description}`, currencyForSource(source));
      out.push({
        id: toOfferId(source, link, title),
        title,
        description: description.slice(0, 290) || `Новый проект с ${source}.`,
        source,
        category: detectCategory(title, description),
        external_url: link,
        ...budget,
        posted_at: item.pubDate
          ? new Date(item.pubDate).toISOString()
          : item.published
            ? new Date(item.published).toISOString()
            : item.updated
              ? new Date(item.updated).toISOString()
              : new Date().toISOString(),
      });
    }
    return out;
  } catch (err) {
    console.warn(`RSS ${source}:`, err.message);
    return [];
  }
}

async function fetchFreelancerOffers(limit = 20) {
  return fetchRssOffers('Freelancer', 'https://www.freelancer.com/jobs/rss', limit);
}

async function fetchRemoteOkOffers(limit = 20) {
  try {
    const { data } = await axios.get('https://remoteok.com/api', {
      timeout: 12000,
      headers: { 'User-Agent': 'FlowLance/1.0' },
    });
    if (!Array.isArray(data)) return [];
    const rows = data.filter((item) => item && item.position && item.url).slice(0, limit);

    return rows
      .map((item) => {
        const description = `${item.company || ''} ${Array.isArray(item.tags) ? item.tags.join(', ') : ''}`.trim();
        const link = sanitizeExternalUrl(item.url, 'RemoteOK');
        if (!link) return null;
        return {
          id: toOfferId('RemoteOK', link, item.position),
          title: item.position,
          description: description || 'Удаленный проект с RemoteOK.',
          source: 'RemoteOK',
          category: detectCategory(item.position, description),
          external_url: link,
          budget_min: 200,
          budget_max: 2000,
          currency: 'USD',
          posted_at: item.date ? new Date(item.date).toISOString() : new Date().toISOString(),
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.warn('RemoteOK:', err.message);
    return [];
  }
}

async function fetchExternalOffers(limitPerSource = 12) {
  const perFeed = Math.max(4, Math.ceil(limitPerSource / 2));
  const tasks = [
    fetchFreelancerOffers(perFeed),
    fetchRemoteOkOffers(perFeed),
    ...RSS_FEEDS.filter((f) => f.source !== 'Freelancer').map((f) => fetchRssOffers(f.source, f.url, perFeed)),
  ];
  const chunks = await Promise.all(tasks);
  const merged = chunks.flat();
  const byId = new Map();
  for (const offer of merged) {
    if (!offer.external_url) continue;
    byId.set(offer.id, offer);
  }
  return [...byId.values()].sort((a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime());
}

async function getFallbackOffers(limit = 24) {
  const external = await fetchExternalOffers(limit);
  return external.slice(0, limit);
}

module.exports = {
  getFallbackOffers,
  fetchExternalOffers,
  sanitizeExternalUrl,
  SOURCE_HOME,
};
