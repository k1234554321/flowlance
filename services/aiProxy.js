const axios = require('axios');

const SYSTEM_PROMPT = `Ты консультант сервиса FlowLance — агрегатора вакансий и проектов для фриланса и удалённой работы.
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
    const detail = error.response?.data?.error?.message || error.message;
    return `Ошибка запроса к модели: ${error.response?.status || ''} ${detail}`.trim();
  }
}

module.exports = { askAi };
