/* ============================================================
   FlowLance Tracker — логика
   ============================================================ */
(function () {

  /* ——— Константы ——— */
  const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
  const DAILY_XP = 30;
  const DAILY_COINS = 10;

  const ACHIEVEMENTS = [
    { id: 'first_task',   icon: '🎯', name: 'Первый шаг',      desc: 'Выполни первое задание',       check: (s) => s.doneTasks >= 1 },
    { id: 'five_tasks',   icon: '🔥', name: 'В потоке',         desc: 'Выполни 5 заданий',            check: (s) => s.doneTasks >= 5 },
    { id: 'ten_tasks',    icon: '💪', name: 'Машина',           desc: 'Выполни 10 заданий',           check: (s) => s.doneTasks >= 10 },
    { id: 'level_3',      icon: '⭐', name: 'Уровень 3',        desc: 'Достигни 3-го уровня',         check: (s) => s.level >= 3 },
    { id: 'level_5',      icon: '🌟', name: 'Уровень 5',        desc: 'Достигни 5-го уровня',         check: (s) => s.level >= 5 },
    { id: 'streak_3',     icon: '📅', name: '3 дня подряд',     desc: 'Заходи 3 дня подряд',          check: (s) => s.streak >= 3 },
    { id: 'daily_bonus',  icon: '🎁', name: 'Ранняя пташка',    desc: 'Забери первый дневной бонус',  check: (s) => s.totalDailyClaims >= 1 },
    { id: 'epic_task',    icon: '🏆', name: 'Эпик',             desc: 'Выполни эпическое задание',    check: (s) => s.doneEpic >= 1 },
  ];

  /* ——— Состояние (localStorage) ——— */
  const STORE_KEY = 'fl_tracker_v1';

  function defaultState() {
    return {
      xp: 0,
      level: 1,
      coins: 0,
      doneTasks: 0,
      doneEpic: 0,
      streak: 0,
      lastLoginDate: null,
      lastDailyDate: null,
      totalDailyClaims: 0,
      unlockedAchievements: [],
      tasks: [],
      log: ['Добро пожаловать в Трекер!'],
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return defaultState();
      return Object.assign(defaultState(), JSON.parse(raw));
    } catch { return defaultState(); }
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {}
  }

  let state = loadState();

  /* ——— Уровень по XP ——— */
  function calcLevel(xp) {
    let lvl = 1;
    for (let i = 1; i < XP_PER_LEVEL.length; i++) {
      if (xp >= XP_PER_LEVEL[i]) lvl = i + 1;
      else break;
    }
    return Math.min(lvl, XP_PER_LEVEL.length);
  }

  function xpForLevel(lvl) {
    return XP_PER_LEVEL[Math.min(lvl - 1, XP_PER_LEVEL.length - 1)] || 0;
  }

  function xpForNextLevel(lvl) {
    return XP_PER_LEVEL[Math.min(lvl, XP_PER_LEVEL.length - 1)] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
  }

  /* ——— DOM-ссылки ——— */
  const $ = (id) => document.getElementById(id);
  const elLevel    = $('trk-level');
  const elXpText   = $('trk-xp-text');
  const elXpFill   = $('trk-xp-fill');
  const elCoins    = $('trk-coins');
  const elDoneCount= $('trk-done-count');
  const elStreak   = $('trk-streak');
  const elDailyBtn = $('trk-daily-btn');
  const elDailyHint= $('trk-daily-hint');
  const elTasksList= $('tasks-list');
  const elTasksEmpty=$('tasks-empty');
  const elAddBtn   = $('trk-add-btn');
  const elAddForm  = $('task-add-form');
  const elSaveBtn  = $('task-save-btn');
  const elCancelBtn= $('task-cancel-btn');
  const elTitleIn  = $('task-title-input');
  const elDescIn   = $('task-desc-input');
  const elXpSel    = $('task-xp-select');
  const elAchieve  = $('achieve-list');
  const elLog      = $('event-log');
  const elCharName = $('trk-char-name');
  const elAnimLabel= $('char-anim-label');
  const canvas     = $('pixel-char');

  /* ============================================================
     ПИКСЕЛЬНЫЙ ПЕРСОНАЖ (Canvas)
     ============================================================ */
  const C = canvas ? canvas.getContext('2d') : null;
  const SCALE = 6; // 1 пиксель = 6px → 16×16 = 96px

  // Палитра
  const P = {
    skin:  '#f5c8a0',
    hair:  '#3a2a1a',
    shirt: '#4a7fff',
    pants: '#2a3a6a',
    shoes: '#1a1a1a',
    eye:   '#1a1a1a',
    mouth: '#c07060',
    bg:    'transparent',
    shine: '#ffffff',
    gold:  '#f5c842',
  };

  // 16×16 спрайт (0=прозрачно, буква=цвет из P)
  const SPRITE_IDLE = [
    '0000HHHHHH00000',
    '000HSSSSSSSH000',
    '000HSEEEESH000',
    '000HSEMSESH000',
    '000HSSSSSSSH000',
    '0000HHHHHH00000',
    '000TTTTTTTTT000',
    '00TTTTTTTTTTT00',
    '00TTTTTTTTTTT00',
    '000TTTTTTTTT000',
    '000LLLLLLLL0000',
    '000LLLLLLLL0000',
    '00PPPPPPPPPP000',
    '00PPPPPPPPPP000',
    '00BBBB00BBBB000',
    '00BBBB00BBBB000',
  ];

  const colorMap = {
    H: P.skin, S: P.skin, E: P.eye, M: P.mouth,
    T: P.shirt, L: P.pants, P: P.pants, B: P.shoes,
  };

  let animFrame = 0;
  let animTimer = null;
  let currentAnim = 'idle';
  let idleTimer = 0;

  function drawSprite(sprite, offsetY = 0) {
    if (!C) return;
    C.clearRect(0, 0, 96, 96);
    sprite.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '0') return;
        C.fillStyle = colorMap[ch] || '#fff';
        C.fillRect(x * SCALE, (y + offsetY) * SCALE, SCALE, SCALE);
      });
    });
  }

  // Idle: лёгкое покачивание (2 кадра)
  const IDLE_FRAMES = [0, -0.1]; // смещение Y в пикселях (дробное — через transform)
  function animIdle() {
    if (!C) return;
    const bob = Math.sin(Date.now() / 400) * 1.5;
    C.clearRect(0, 0, 96, 96);
    C.save();
    C.translate(0, bob);
    drawSprite(SPRITE_IDLE);
    C.restore();
  }

  // Победная анимация: прыжок + вращение
  let celebFrames = 0;
  function animCelebrate() {
    if (!C) return;
    celebFrames++;
    const t = celebFrames / 30;
    const jumpY = -Math.sin(t * Math.PI) * 18;
    const rot   = Math.sin(t * Math.PI * 2) * 0.3;
    C.clearRect(0, 0, 96, 96);
    C.save();
    C.translate(48, 48 + jumpY);
    C.rotate(rot);
    C.translate(-48, -48);
    drawSprite(SPRITE_IDLE);
    C.restore();
    if (celebFrames >= 60) {
      celebFrames = 0;
      currentAnim = 'idle';
      setAnimLabel('');
    }
  }

  function setAnimLabel(text) {
    if (elAnimLabel) elAnimLabel.textContent = text;
  }

  function triggerCelebrate(label = 'DONE!') {
    currentAnim = 'celebrate';
    celebFrames = 0;
    setAnimLabel(label);
    setTimeout(() => setAnimLabel(''), 1800);
  }

  function gameLoop() {
    if (currentAnim === 'celebrate') animCelebrate();
    else animIdle();
    requestAnimationFrame(gameLoop);
  }

  if (C) gameLoop();

  /* ============================================================
     РЕНДЕР UI
     ============================================================ */
  function render() {
    const lvl  = calcLevel(state.xp);
    const xpCur = state.xp - xpForLevel(lvl);
    const xpNeed = xpForNextLevel(lvl) - xpForLevel(lvl);
    const pct  = Math.min(100, Math.round((xpCur / xpNeed) * 100));

    if (elLevel)    elLevel.textContent    = lvl;
    if (elXpText)   elXpText.textContent   = `${state.xp} / ${xpForNextLevel(lvl)} XP`;
    if (elXpFill)   elXpFill.style.width   = pct + '%';
    if (elCoins)    elCoins.textContent    = state.coins + ' 🪙';
    if (elDoneCount)elDoneCount.textContent = state.doneTasks;
    if (elStreak)   elStreak.textContent   = state.streak + ' 🔥';

    // Имя персонажа = имя пользователя
    const userName = window._flUser?.name || 'Фрилансер';
    if (elCharName) elCharName.textContent = userName;

    // Дневной бонус
    const today = new Date().toISOString().slice(0, 10);
    const claimed = state.lastDailyDate === today;
    if (elDailyBtn) {
      elDailyBtn.disabled = claimed;
      elDailyBtn.textContent = claimed ? '✓ Бонус получен' : '🎁 Забрать дневной бонус';
    }
    if (elDailyHint) {
      elDailyHint.textContent = claimed ? 'Возвращайся завтра!' : `+${DAILY_XP} XP и +${DAILY_COINS} монет`;
    }

    renderTasks();
    renderAchievements();
    renderLog();
  }

  function renderTasks() {
    if (!elTasksList) return;
    elTasksList.innerHTML = '';
    const tasks = state.tasks;
    if (!tasks.length) {
      elTasksEmpty?.classList.remove('hidden');
      return;
    }
    elTasksEmpty?.classList.add('hidden');

    tasks.forEach((task) => {
      const el = document.createElement('div');
      el.className = 'task-item' + (task.done ? ' is-done' : '');
      el.dataset.id = task.id;
      el.innerHTML = `
        <button class="task-check" data-action="check" title="Отметить выполненным">${task.done ? '✓' : ''}</button>
        <div class="task-body">
          <div class="task-title">${escHtml(task.title)}</div>
          ${task.desc ? `<div class="task-desc">${escHtml(task.desc)}</div>` : ''}
          <div class="task-meta">
            <span class="task-xp-badge">+${task.xp} XP</span>
            ${task.done ? '<span style="font-size:0.75rem;color:#6ee7a0;">✓ Выполнено</span>' : ''}
          </div>
        </div>
        <button class="task-del" data-action="delete" title="Удалить">✕</button>
      `;
      elTasksList.appendChild(el);
    });
  }

  function renderAchievements() {
    if (!elAchieve) return;
    elAchieve.innerHTML = '';
    ACHIEVEMENTS.forEach((a) => {
      const unlocked = state.unlockedAchievements.includes(a.id);
      const el = document.createElement('div');
      el.className = 'achieve-item' + (unlocked ? ' unlocked' : '');
      el.innerHTML = `
        <span class="achieve-icon">${unlocked ? a.icon : '🔒'}</span>
        <div class="achieve-info">
          <div class="achieve-name">${a.name}</div>
          <div class="achieve-desc">${a.desc}</div>
        </div>
      `;
      elAchieve.appendChild(el);
    });
  }

  function renderLog() {
    if (!elLog) return;
    elLog.innerHTML = '';
    const entries = state.log.slice(-20).reverse();
    entries.forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'log-entry ' + (entry.type || 'log-info');
      li.textContent = entry.text || entry;
      elLog.appendChild(li);
    });
  }

  /* ============================================================
     ЛОГИКА
     ============================================================ */
  function addLog(text, type = 'log-info') {
    state.log.push({ text, type });
    if (state.log.length > 60) state.log = state.log.slice(-60);
  }

  function addXp(amount, sourceEl) {
    const oldLevel = calcLevel(state.xp);
    state.xp += amount;
    const newLevel = calcLevel(state.xp);
    state.level = newLevel;

    addLog(`+${amount} XP`, 'log-xp');

    // Popup над кнопкой
    if (sourceEl) spawnXpPopup(amount, sourceEl);

    if (newLevel > oldLevel) {
      addLog(`🎉 Уровень ${newLevel}!`, 'log-level');
      showLevelUp(newLevel);
    }

    checkAchievements();
    saveState();
    render();
  }

  function spawnXpPopup(amount, refEl) {
    const rect = refEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'xp-popup';
    el.textContent = `+${amount} XP`;
    el.style.left = rect.left + rect.width / 2 - 30 + 'px';
    el.style.top  = rect.top + window.scrollY - 10 + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function showLevelUp(lvl) {
    const overlay = document.createElement('div');
    overlay.className = 'levelup-overlay';
    overlay.innerHTML = `
      <div class="levelup-box">
        <div class="levelup-title">LEVEL UP!</div>
        <span class="levelup-num">${lvl}</span>
        <div class="levelup-sub">Ты достиг ${lvl}-го уровня. Так держать!</div>
        <button class="btn btn-neon btn-glow" style="padding:12px 28px;" id="lvlup-close">Продолжить</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#lvlup-close').addEventListener('click', () => overlay.remove());
    setTimeout(() => overlay.remove(), 6000);
  }

  function checkAchievements() {
    ACHIEVEMENTS.forEach((a) => {
      if (state.unlockedAchievements.includes(a.id)) return;
      if (a.check(state)) {
        state.unlockedAchievements.push(a.id);
        addLog(`🏆 Достижение: ${a.name}`, 'log-bonus');
        showToast?.(`🏆 ${a.name} — разблокировано!`);
      }
    });
  }

  function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastLoginDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (state.lastLoginDate === yesterday) {
      state.streak += 1;
    } else if (state.lastLoginDate !== today) {
      state.streak = 1;
    }
    state.lastLoginDate = today;
    saveState();
  }

  /* ——— Дневной бонус ——— */
  if (elDailyBtn) {
    elDailyBtn.addEventListener('click', async () => {
      const today = new Date().toISOString().slice(0, 10);
      if (state.lastDailyDate === today) return;

      // Пробуем серверный endpoint (если есть сессия)
      try {
        const r = await fetch('/api/cabinet/claim-daily', { method: 'POST' });
        if (!r.ok && r.status !== 400) throw new Error();
      } catch {}

      state.lastDailyDate = today;
      state.totalDailyClaims += 1;
      state.coins += DAILY_COINS;
      addLog(`🎁 Дневной бонус: +${DAILY_XP} XP, +${DAILY_COINS} монет`, 'log-bonus');
      addXp(DAILY_XP, elDailyBtn);
      triggerCelebrate('BONUS!');
      checkAchievements();
      saveState();
      render();
    });
  }

  /* ——— Добавление задания ——— */
  if (elAddBtn) {
    elAddBtn.addEventListener('click', () => {
      elAddForm?.classList.toggle('hidden');
      elTitleIn?.focus();
    });
  }

  if (elCancelBtn) {
    elCancelBtn.addEventListener('click', () => {
      elAddForm?.classList.add('hidden');
      if (elTitleIn) elTitleIn.value = '';
      if (elDescIn)  elDescIn.value  = '';
    });
  }

  if (elSaveBtn) {
    elSaveBtn.addEventListener('click', () => {
      const title = elTitleIn?.value.trim();
      if (!title) { elTitleIn?.focus(); return; }
      const xp = Number(elXpSel?.value || 50);
      const task = {
        id: 't' + Date.now(),
        title,
        desc: elDescIn?.value.trim() || '',
        xp,
        done: false,
        createdAt: new Date().toISOString(),
      };
      state.tasks.unshift(task);
      addLog(`📋 Задание добавлено: ${title}`, 'log-info');
      saveState();
      render();
      elAddForm?.classList.add('hidden');
      if (elTitleIn) elTitleIn.value = '';
      if (elDescIn)  elDescIn.value  = '';
    });
  }

  /* ——— Клики по заданиям (делегирование) ——— */
  if (elTasksList) {
    elTasksList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const item = btn.closest('.task-item');
      if (!item) return;
      const id = item.dataset.id;
      const task = state.tasks.find((t) => t.id === id);
      if (!task) return;

      if (btn.dataset.action === 'check' && !task.done) {
        task.done = true;
        state.doneTasks += 1;
        if (task.xp >= 200) state.doneEpic += 1;
        addLog(`✓ Выполнено: ${task.title}`, 'log-xp');
        addXp(task.xp, btn);
        triggerCelebrate('DONE!');
        checkAchievements();
        saveState();
        render();
      }

      if (btn.dataset.action === 'delete') {
        state.tasks = state.tasks.filter((t) => t.id !== id);
        addLog(`🗑 Удалено: ${task.title}`, 'log-info');
        saveState();
        render();
      }
    });
  }

  /* ——— Enter в поле ввода ——— */
  elTitleIn?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elSaveBtn?.click();
  });

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ
     ============================================================ */
  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function init() {
    // Проверяем авторизацию
    let user = null;
    try {
      const r = await fetch('/api/profile');
      if (r.ok) user = await r.json();
    } catch {}

    const guestEl = $('tracker-guest');
    const appEl   = $('tracker-app');

    if (!user) {
      guestEl?.classList.remove('hidden');
      appEl?.classList.add('hidden');
      drawGatePixel();
      return;
    }

    window._flUser = user;
    guestEl?.classList.add('hidden');
    appEl?.classList.remove('hidden');

    updateStreak();
    state.level = calcLevel(state.xp);
    render();
  }

  /* Декоративный пиксель-арт на заглушке */
  function drawGatePixel() {
    const c = $('gate-pixel-canvas');
    if (!c) return;
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    c.width  = 200;
    c.height = 200;
    const sc = 12;
    SPRITE_IDLE.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch === '0') return;
        ctx.fillStyle = colorMap[ch] || '#fff';
        ctx.fillRect(x * sc + 8, y * sc + 8, sc, sc);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
