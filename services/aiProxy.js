const axios = require('axios');

const SYSTEM_PROMPT = `Ты консультант сервиса FlowLance — агрегатора вакансий и проектов для фриланса и удалённой работы.
Пользователи могут быть из любой страны: помогай всем одинаково вежливо, не отказывай из‑за предполагаемой геолокации собеседника.
Отвечай только на темы: фриланс, удалённая работа, поиск заказов, отклики, портфолио, ценообразование, фильтры и разделы сайта FlowLance, биржи и типичные задачи на них.
Если вопрос не про фриланс, удалённую работу или FlowLance — вежливо откажись в одном коротком абзаце, без советов по другим темам.
Пиши по-русски, кратко и по делу, без выдуманных функций сайта: если не уверен, скажи что точнее подскажет раздел «Лента» или «О сервисе».`;

function resolveEndpoint() {
  const custom = process.env.OPENAI_API_URL || process.env.PROXY_API_URL;
  if (custom) return custom.replace(/\/$/, '');
  return 'https://api.openai.com/v1/chat/completions';
}

function resolveKey() {
  return process.env.OPENAI_API_KEY || process.env.PROXY_API_KEY || '';
}

function resolveModel() {
  return process.env.OPENAI_MODEL || process.env.PROXY_MODEL || 'gpt-4o-mini';
}

async function askAi(prompt) {
  const apiKey = resolveKey();
  const url = resolveEndpoint();
  const model = resolveModel();

  if (!apiKey) {
    return 'Чат с нейросетью не настроен: добавь OPENAI_API_KEY (или PROXY_API_KEY) и при необходимости OPENAI_API_URL в файл .env на сервере.';
  }

  try {
    const response = await axios.post(
      url,
      {
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: String(prompt).slice(0, 4000) }
        ],
        temperature: 0.4
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    const text =
      response.data?.choices?.[0]?.message?.content ||
      response.data?.result ||
      response.data?.reply ||
      '';

    return text || 'Модель не вернула текст.';
  } catch (error) {
    const status = error.response?.status;
    const detail = String(error.response?.data?.error?.message || error.message || '');
    const geo =
      status === 403 ||
      status === 451 ||
      /country|region|unsupported|not available|blocked|forbidden/i.test(detail);
    if (geo) {
      return 'Запрос к модели отклонён на стороне провайдера (часто из‑за региона, где стоит сервер). Решение: в .env укажи PROXY_API_URL + PROXY_API_KEY на API, доступный из страны хостинга, либо перенеси бэкенд на площадку без таких ограничений.';
    }
    return `Ошибка запроса к модели: ${status || ''} ${detail}`.trim();
  }
}

module.exports = { askAi };
