const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginNotice = document.getElementById('login-notice');
const registerNotice = document.getElementById('register-notice');
const pwdInput = document.getElementById('register-password');
const pwdRules = document.getElementById('pwd-rules');
const pwdRulesList = document.getElementById('pwd-rules-list');
const registerSubmit = document.getElementById('register-submit');

const V = window.FLValidation;

function showAuthNotice(slot, text, variant = 'err') {
  if (!slot) return;
  if (!text) {
    slot.innerHTML = '';
    slot.classList.remove('auth-notice-show');
    return;
  }
  slot.innerHTML = `<div class="auth-notice auth-notice--${variant}" role="alert"><span class="auth-notice-icon" aria-hidden="true">${variant === 'ok' ? '✓' : '!'}</span><span>${String(text).replace(/</g, '&lt;')}</span></div>`;
  requestAnimationFrame(() => slot.classList.add('auth-notice-show'));
}

function buildPwdRulesList() {
  if (!pwdRulesList || !V) return;
  pwdRulesList.innerHTML = V.PASSWORD_RULES.map(
    (r) => `<li class="pwd-rule" data-rule="${r.id}"><span class="pwd-rule-dot"></span>${r.label}</li>`
  ).join('');
}

function updatePwdRulesUI() {
  if (!pwdInput || !V) return;
  const { rules } = V.checkPassword(pwdInput.value);
  rules.forEach((r) => {
    const li = pwdRulesList?.querySelector(`[data-rule="${r.id}"]`);
    if (li) li.classList.toggle('pwd-rule--ok', r.ok);
  });
  if (registerSubmit) {
    const allOk = rules.every((r) => r.ok);
    registerSubmit.disabled = pwdInput.value.length > 0 && !allOk;
  }
}

pwdInput?.addEventListener('focus', () => {
  pwdRules?.removeAttribute('hidden');
  buildPwdRulesList();
  updatePwdRulesUI();
});

pwdInput?.addEventListener('input', updatePwdRulesUI);

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthNotice(loginNotice, '');
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const emailCheck = V.validateEmail(email);
  if (!emailCheck.ok) {
    showAuthNotice(loginNotice, emailCheck.error);
    return;
  }
  if (!password) {
    showAuthNotice(loginNotice, 'Введи пароль');
    return;
  }
  try {
    await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: emailCheck.value, password }),
    });
    showAuthNotice(loginNotice, 'Вход выполнен', 'ok');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 400);
  } catch (error) {
    const m = error.message || 'Не удалось войти';
    showAuthNotice(loginNotice, m);
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  showAuthNotice(registerNotice, '');
  const nameCheck = V.validateName(document.getElementById('register-name').value);
  if (!nameCheck.ok) {
    showAuthNotice(registerNotice, nameCheck.error);
    return;
  }
  const emailCheck = V.validateEmail(document.getElementById('register-email').value);
  if (!emailCheck.ok) {
    showAuthNotice(registerNotice, emailCheck.error);
    return;
  }
  const passCheck = V.validatePassword(pwdInput?.value || '');
  if (!passCheck.ok) {
    showAuthNotice(registerNotice, passCheck.error);
    pwdRules?.removeAttribute('hidden');
    updatePwdRulesUI();
    return;
  }
  const payload = {
    name: nameCheck.value,
    email: emailCheck.value,
    password: pwdInput.value,
  };
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    showAuthNotice(registerNotice, 'Аккаунт создан — перенаправляем…', 'ok');
    setTimeout(() => {
      window.location.href = '/dashboard';
    }, 500);
  } catch (error) {
    showAuthNotice(registerNotice, error.message || 'Ошибка регистрации');
  }
});

buildPwdRulesList();
