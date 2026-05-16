(function (root) {
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
    if (!EMAIL_RE.test(e)) return { ok: false, error: 'Некорректный email — нужен формат name@domain.com' };
    const domain = e.split('@')[1] || '';
    if (!domain.includes('.') || domain.length < 4) {
      return { ok: false, error: 'У домена должен быть символ точки (например .com)' };
    }
    return { ok: true, value: e.toLowerCase() };
  }

  function checkPassword(password) {
    const p = String(password || '');
    const rules = PASSWORD_RULES.map((r) => ({ id: r.id, label: r.label, ok: r.test(p) }));
    return { ok: rules.every((r) => r.ok), rules };
  }

  function validatePassword(password) {
    const r = checkPassword(password);
    if (r.ok) return { ok: true };
    const missing = r.rules.filter((x) => !x.ok).map((x) => x.label);
    return { ok: false, error: `Пароль должен содержать: ${missing.join(', ')}` };
  }

  function validateName(name) {
    const n = String(name || '').trim();
    if (n.length < 2) return { ok: false, error: 'Имя — минимум 2 символа' };
    return { ok: true, value: n };
  }

  root.FLValidation = {
    PASSWORD_RULES,
    validateEmail,
    validatePassword,
    checkPassword,
    validateName,
  };
})(typeof window !== 'undefined' ? window : globalThis);
