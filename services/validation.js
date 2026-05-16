const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const PASSWORD_RULES = [
  { id: 'len', test: (p) => p.length >= 8, label: 'не менее 8 символов' },
  { id: 'letter', test: (p) => /[a-zA-Zа-яА-ЯёЁ]/.test(p), label: 'буквы (латиница или кириллица)' },
  { id: 'digit', test: (p) => /\d/.test(p), label: 'цифру' },
  { id: 'upper', test: (p) => /[A-ZА-ЯЁ]/.test(p), label: 'заглавную букву' },
  { id: 'special', test: (p) => /[^a-zA-Zа-яА-ЯёЁ0-9\s]/.test(p), label: 'спецсимвол (!@#$…)' },
];

function validateEmail(email) {
  const e = String(email || '').trim();
  if (!e) return { ok: false, error: 'Укажи email' };
  if (e.length > 120) return { ok: false, error: 'Слишком длинный email' };
  if (!EMAIL_RE.test(e)) return { ok: false, error: 'Некорректный email — нужен формат name@domain.com' };
  const parts = e.split('@');
  if (parts[1].length < 4 || !parts[1].includes('.')) {
    return { ok: false, error: 'У домена должен быть символ точки (например .com)' };
  }
  return { ok: true, value: e.toLowerCase() };
}

function checkPassword(password) {
  const p = String(password || '');
  const rules = PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(p) }));
  const ok = rules.every((r) => r.ok);
  return { ok, rules };
}

function validatePassword(password) {
  const { ok, rules } = checkPassword(password);
  if (ok) return { ok: true };
  const missing = rules.filter((r) => !r.ok).map((r) => r.label);
  return { ok: false, error: `Пароль должен содержать: ${missing.join(', ')}` };
}

function validateName(name) {
  const n = String(name || '').trim();
  if (n.length < 2) return { ok: false, error: 'Имя — минимум 2 символа' };
  if (n.length > 80) return { ok: false, error: 'Имя слишком длинное' };
  return { ok: true, value: n };
}

module.exports = {
  EMAIL_RE,
  PASSWORD_RULES,
  validateEmail,
  validatePassword,
  checkPassword,
  validateName,
};
