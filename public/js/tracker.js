/* ============================================================
   FlowLance Tracker — логика
   ============================================================ */
(function () {

  const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
  const DAILY_XP = 30;
  const DAILY_COINS = 10;

  const ACHIEVEMENTS = [
    { id: 'first_task',  icon: '🎯', name: 'Первый шаг',    desc: 'Выполни первое задание',      check: (s) => s.doneTasks >= 1 },
    { id: 'five_tasks',  icon: '🔥', name: 'В потоке',       desc: 'Выполни 5 заданий',           check: (s) => s.doneTasks >= 5 },
    { id: 'ten_tasks',   icon: '💪', name: 'Машина',         desc: 'Выполни 10 заданий',          check: (s) => s.doneTasks >= 10 },
    { id: 'level_3',     icon: '⭐', name: 'Уровень 3',      desc: 'Достигни 3-го уровня',        check: (s) => s.level >= 3 },
    { id: 'level_5',     icon: '🌟', name: 'Уровень 5',      desc: 'Достигни 5-го уровня',        check: (s) => s.level >= 5 },
    { id: 'streak_3',    icon: '📅', name: '3 дня подряд',   desc: 'Заходи 3 дня подряд',         check: (s) => s.streak >= 3 },
    { id: 'daily_bonus', icon: '🎁', name: 'Ранняя пташка',  desc: 'Забери первый дневной бонус', check: (s) => s.totalDailyClaims >= 1 },
    { id: 'epic_task',   icon: '🏆', name: 'Эпик',           desc: 'Выполни эпическое задание',   check: (s) => s.doneEpic >= 1 },
  ];

  const STORE_KEY = 'fl_tracker_v1';

  function defaultState() {
    return { xp:0, level:1, coins:0, doneTasks:0, doneEpic:0, streak:0,
      lastLoginDate:null, lastDailyDate:null, totalDailyClaims:0,
      unlockedAchievements:[], tasks:[],
      log:[{text:'Добро пожаловать в Прогресс!', type:'log-info'}] };
  }

  function loadState() {
    try { const r = localStorage.getItem(STORE_KEY); return r ? Object.assign(defaultState(), JSON.parse(r)) : defaultState(); }
    catch { return defaultState(); }
  }
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }

  let state = loadState();

  function calcLevel(xp) {
    let lvl = 1;
    for (let i = 1; i < XP_PER_LEVEL.length; i++) { if (xp >= XP_PER_LEVEL[i]) lvl = i+1; else break; }
    return Math.min(lvl, XP_PER_LEVEL.length);
  }
  function xpForLevel(lvl)     { return XP_PER_LEVEL[Math.min(lvl-1, XP_PER_LEVEL.length-1)] || 0; }
  function xpForNextLevel(lvl) { return XP_PER_LEVEL[Math.min(lvl,   XP_PER_LEVEL.length-1)] || XP_PER_LEVEL[XP_PER_LEVEL.length-1]; }

  const $ = (id) => document.getElementById(id);
  const elLevel     = $('trk-level');
  const elXpText    = $('trk-xp-text');
  const elXpFill    = $('trk-xp-fill');
  const elCoins     = $('trk-coins');
  const elDoneCount = $('trk-done-count');
  const elStreak    = $('trk-streak');
  const elDailyBtn  = $('trk-daily-btn');
  const elDailyHint = $('trk-daily-hint');
  const elTasksList = $('tasks-list');
  const elTasksEmpty= $('tasks-empty');
  const elAddBtn    = $('trk-add-btn');
  const elAddForm   = $('task-add-form');
  const elSaveBtn   = $('task-save-btn');
  const elCancelBtn = $('task-cancel-btn');
  const elTitleIn   = $('task-title-input');
  const elDescIn    = $('task-desc-input');
  const elXpSel     = $('task-xp-select');
  const elAchieve   = $('achieve-list');
  const elLog       = $('event-log');
  const elCharName  = $('trk-char-name');
  const elAnimLabel = $('char-anim-label');
  const canvas      = $('pixel-char');
  const canvasWrap  = canvas ? canvas.closest('.char-canvas-wrap') : null;

  /* ============================================================
     ПИКСЕЛЬНЫЙ ПЕРСОНАЖ — улучшенный спрайт 16×16
     ============================================================ */
  const C = canvas ? canvas.getContext('2d') : null;
  const SC = 6; // scale: 1px = 6px → 96×96

  // Цвета
  const COL = {
    sk: '#f5c8a0', // кожа
    hr: '#2a1a0a', // волосы
    sh: '#3a6fff', // рубашка
    sc: '#2a55dd', // рубашка тень
    pt: '#1a2a5a', // штаны
    bs: '#111111', // обувь
    ey: '#111111', // глаза
    eb: '#2a1a0a', // брови
    mt: '#c06858', // рот
    wh: '#ffffff', // белки глаз
    bl: '#aaccff', // блик на глазах
    bt: '#f5c842', // пуговица/деталь
  };

  // Спрайт: более читаемый человечек
  // Строки 16 символов, 0=прозрачно
  const SPR = [
    '00000HHHHHH0000', // 0  волосы верх
    '0000HhhhhhHH000', // 1  волосы
    '0000HwEwwEwH000', // 2  глаза
    '0000HssssssH000', // 3  нос/щёки
    '0000HsMMMMsH000', // 4  рот
    '00000HHHHHH0000', // 5  подбородок
    '0000SSSSSSSS000', // 6  шея/плечи
    '000SSSSSSSSSS00', // 7  плечи
    '000SSSSSSSSSS00', // 8  торс
    '000SSSSSSSSSS00', // 9  торс
    '0000SSSSSSSS000', // 10 талия
    '000PPPPPPPPPP00', // 11 штаны
    '000PPPPPPPPPP00', // 12 штаны
    '000PPPPPPPPPP00', // 13 штаны
    '000BBBB0BBBBB00', // 14 обувь
    '00BBBBB0BBBBB00', // 15 обувь
  ];

  const CMAP = {
    H:'#2a1a0a', h:'#f5c8a0', w:'#ffffff', E:'#111111', s:'#f5c8a0',
    M:'#c06858', S:'#3a6fff', P:'#1a2a5a', B:'#111111',
  };

  function drawSpr(spr, ctx, scale, ox, oy) {
    spr.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '0') continue;
        ctx.fillStyle = CMAP[ch] || '#fff';
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    });
  }

  let currentAnim = 'idle';
  let celebFrames = 0;

  function animIdle() {
    if (!C) return;
    const bob = Math.sin(Date.now() / 380) * 1.8;
    C.clearRect(0, 0, 96, 96);
    C.save();
    C.translate(0, bob);
    drawSpr(SPR, C, SC, 0, 0);
    C.restore();
  }

  function animCelebrate() {
    if (!C) return;
    celebFrames++;
    const t = celebFrames / 40;
    // Прыжок вверх с поднятой рукой — имитируем через смещение и масштаб
    const jumpY = -Math.sin(t * Math.PI) * 22;
    const scl   = 1 + Math.sin(t * Math.PI) * 0.08;
    C.clearRect(0, 0, 96, 96);
    C.save();
    C.translate(48, 48 + jumpY);
    C.scale(scl, scl);
    C.translate(-48, -48);
    drawSpr(SPR, C, SC, 0, 0);
    // Рука вверх — рисуем отдельный пиксель
    const armT = Math.sin(t * Math.PI);
    if (armT > 0.3) {
      C.fillStyle = CMAP['S'];
      C.fillRect(0, Math.round(6 * SC - armT * 12), SC * 2, SC * 2);
    }
    C.restore();

    if (celebFrames >= 80) {
      celebFrames = 0;
      currentAnim = 'idle';
      setAnimLabel('');
      if (canvasWrap) canvasWrap.classList.remove('is-celebrating');
    }
  }

  function setAnimLabel(text) { if (elAnimLabel) elAnimLabel.textContent = text; }

  function triggerCelebrate(label) {
    currentAnim = 'celebrate';
    celebFrames = 0;
    setAnimLabel(label || 'DONE!');
    if (canvasWrap) canvasWrap.classList.add('is-celebrating');
    setTimeout(() => setAnimLabel(''), 2200);
  }

  function gameLoop() {
    if (currentAnim === 'celebrate') animCelebrate();
    else animIdle();
    requestAnimationFrame(gameLoop);
  }
  if (C) gameLoop();

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function render() {
    const lvl   = calcLevel(state.xp);
    const xpCur = state.xp - xpForLevel(lvl);
    const xpNeed= xpForNextLevel(lvl) - xpForLevel(lvl);
    const pct   = Math.min(100, Math.round((xpCur / xpNeed) * 100));

    if (elLevel)     elLevel.textContent     = lvl;
    if (elXpText)    elXpText.textContent    = `${state.xp} / ${xpForNextLevel(lvl)} XP`;
    if (elXpFill)    elXpFill.style.width    = pct + '%';
    if (elCoins)     elCoins.textContent     = state.coins + ' 🪙';
    if (elDoneCount) elDoneCount.textContent = state.doneTasks;

    // Огонёк серии — анимированный span
    if (elStreak) {
      elStreak.innerHTML = `${state.streak} <span class="streak-fire">🔥</span>`;
    }

    const userName = window._flUser?.name || 'Фрилансер';
    if (elCharName) elCharName.textContent = userName;

    const today   = new Date().toISOString().slice(0, 10);
    const claimed = state.lastDailyDate === today;
    if (elDailyBtn) {
      elDailyBtn.disabled    = claimed;
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
    if (!state.tasks.length) { elTasksEmpty?.classList.remove('hidden'); return; }
    elTasksEmpty?.classList.add('hidden');
    state.tasks.forEach((task) => {
      const el = document.createElement('div');
      el.className = 'task-item' + (task.done ? ' is-done' : '');
      el.dataset.id = task.id;
      el.innerHTML = `
        <button class="task-check" data-action="check">${task.done ? '✓' : ''}</button>
        <div class="task-body">
          <div class="task-title">${esc(task.title)}</div>
          ${task.desc ? `<div class="task-desc">${esc(task.desc)}</div>` : ''}
          <div class="task-meta">
            <span class="task-xp-badge">+${task.xp} XP</span>
            ${task.done ? '<span style="font-size:0.75rem;color:#6ee7a0;">✓ Выполнено</span>' : ''}
          </div>
        </div>
        <button class="task-del" data-action="delete">✕</button>`;
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
        </div>`;
      elAchieve.appendChild(el);
    });
  }

  function renderLog() {
    if (!elLog) return;
    elLog.innerHTML = '';
    state.log.slice(-20).reverse().forEach((entry) => {
      const li = document.createElement('li');
      li.className = 'log-entry ' + (entry.type || 'log-info');
      li.textContent = entry.text || entry;
      elLog.appendChild(li);
    });
  }

  /* ============================================================
     ЛОГИКА
     ============================================================ */
  function addLog(text, type) { state.log.push({ text, type: type || 'log-info' }); if (state.log.length > 60) state.log = state.log.slice(-60); }

  function addXp(amount, refEl) {
    const oldLvl = calcLevel(state.xp);
    state.xp += amount;
    const newLvl = calcLevel(state.xp);
    state.level  = newLvl;
    addLog(`+${amount} XP`, 'log-xp');
    if (refEl) spawnXpPopup(amount, refEl);
    if (newLvl > oldLvl) { addLog(`🎉 Уровень ${newLvl}!`, 'log-level'); showLevelUp(newLvl); }
    checkAchievements();
    saveState();
    render();
  }

  function spawnXpPopup(amount, refEl) {
    const r = refEl.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'xp-popup';
    el.textContent = `+${amount} XP`;
    el.style.left = (r.left + r.width / 2 - 30) + 'px';
    el.style.top  = (r.top + window.scrollY - 10) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  function showLevelUp(lvl) {
    const ov = document.createElement('div');
    ov.className = 'levelup-overlay';
    ov.innerHTML = `<div class="levelup-box">
      <div class="levelup-title">LEVEL UP!</div>
      <span class="levelup-num">${lvl}</span>
      <div class="levelup-sub">Уровень ${lvl} достигнут. Продолжай в том же духе!</div>
      <button class="btn btn-neon btn-glow" style="padding:12px 28px;" id="lvlup-close">Продолжить</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#lvlup-close').addEventListener('click', () => ov.remove());
    setTimeout(() => ov.remove(), 6000);
  }

  function checkAchievements() {
    ACHIEVEMENTS.forEach((a) => {
      if (state.unlockedAchievements.includes(a.id)) return;
      if (a.check(state)) {
        state.unlockedAchievements.push(a.id);
        addLog(`🏆 Достижение: ${a.name}`, 'log-bonus');
        if (typeof showToast === 'function') showToast(`🏆 ${a.name} — разблокировано!`);
      }
    });
  }

  function updateStreak() {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastLoginDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    state.streak = (state.lastLoginDate === yesterday) ? state.streak + 1 : 1;
    state.lastLoginDate = today;
    saveState();
  }

  /* ——— Дневной бонус ——— */
  elDailyBtn?.addEventListener('click', async () => {
    const today = new Date().toISOString().slice(0, 10);
    if (state.lastDailyDate === today) return;
    try { await fetch('/api/cabinet/claim-daily', { method: 'POST' }); } catch {}
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

  /* ——— Форма задания ——— */
  elAddBtn?.addEventListener('click', () => { elAddForm?.classList.toggle('hidden'); elTitleIn?.focus(); });
  elCancelBtn?.addEventListener('click', () => { elAddForm?.classList.add('hidden'); if(elTitleIn) elTitleIn.value=''; if(elDescIn) elDescIn.value=''; });
  elSaveBtn?.addEventListener('click', () => {
    const title = elTitleIn?.value.trim();
    if (!title) { elTitleIn?.focus(); return; }
    const xp = Number(elXpSel?.value || 50);
    state.tasks.unshift({ id:'t'+Date.now(), title, desc: elDescIn?.value.trim()||'', xp, done:false, createdAt: new Date().toISOString() });
    addLog(`📋 Задание: ${title}`, 'log-info');
    saveState(); render();
    elAddForm?.classList.add('hidden');
    if(elTitleIn) elTitleIn.value='';
    if(elDescIn)  elDescIn.value='';
  });
  elTitleIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') elSaveBtn?.click(); });

  /* ——— Клики по заданиям ——— */
  elTasksList?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const item = btn.closest('.task-item');
    if (!item) return;
    const task = state.tasks.find((t) => t.id === item.dataset.id);
    if (!task) return;
    if (btn.dataset.action === 'check' && !task.done) {
      task.done = true; state.doneTasks++;
      if (task.xp >= 200) state.doneEpic++;
      addLog(`✓ Выполнено: ${task.title}`, 'log-xp');
      addXp(task.xp, btn);
      triggerCelebrate('DONE!');
      checkAchievements(); saveState(); render();
    }
    if (btn.dataset.action === 'delete') {
      state.tasks = state.tasks.filter((t) => t.id !== item.dataset.id);
      addLog(`🗑 Удалено: ${task.title}`, 'log-info');
      saveState(); render();
    }
  });

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ——— Инициализация ——— */
  async function init() {
    let user = null;
    try { const r = await fetch('/api/profile'); if (r.ok) user = await r.json(); } catch {}
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

  function drawGatePixel() {
    const c = $('gate-pixel-canvas');
    if (!c) return;
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    c.width = 200; c.height = 200;
    drawSpr(SPR, ctx, 12, 4, 4);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
