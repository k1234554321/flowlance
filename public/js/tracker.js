/* ============================================================
   FlowLance Tracker v2.0 — логика + магазин
   ============================================================ */
(function () {

  const XP_PER_LEVEL = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000];
  const DAILY_XP = 30;
  const DAILY_COINS = 10;
  const LEVEL_UP_COINS = 10; // монеты за каждый новый уровень

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

  /* ============================================================
     МАГАЗИН — каталог
     ============================================================ */
  const SHOP_CLOTHES = [
    { id: 'cap_red',    type: 'cap',    name: 'Красная кепка',   icon: '🧢', price: 50,  color: '#e53e3e', desc: 'Классика' },
    { id: 'cap_blue',   type: 'cap',    name: 'Синяя кепка',     icon: '🧢', price: 60,  color: '#3182ce', desc: 'Стиль' },
    { id: 'cap_gold',   type: 'cap',    name: 'Золотая кепка',   icon: '🧢', price: 120, color: '#f5c842', desc: 'Редкая' },
    { id: 'shirt_red',  type: 'shirt',  name: 'Красная майка',   icon: '👕', price: 50,  color: '#e53e3e', desc: 'Огонь' },
    { id: 'shirt_green',type: 'shirt',  name: 'Зелёная майка',   icon: '👕', price: 50,  color: '#38a169', desc: 'Свежесть' },
    { id: 'shirt_purple',type:'shirt',  name: 'Фиолетовая майка',icon: '👕', price: 80,  color: '#805ad5', desc: 'Редкая' },
    { id: 'shirt_gold', type: 'shirt',  name: 'Золотая майка',   icon: '👕', price: 150, color: '#f5c842', desc: 'Легенда' },
    { id: 'pants_red',  type: 'pants',  name: 'Красные штаны',   icon: '👖', price: 60,  color: '#e53e3e', desc: 'Дерзко' },
    { id: 'pants_green',type: 'pants',  name: 'Зелёные штаны',   icon: '👖', price: 60,  color: '#38a169', desc: 'Природа' },
    { id: 'pants_purple',type:'pants',  name: 'Фиолетовые штаны',icon: '👖', price: 90,  color: '#805ad5', desc: 'Редкие' },
    { id: 'glasses_sun',type: 'glasses',name: 'Солнечные очки',  icon: '🕶️', price: 70,  color: '#1a1a1a', desc: 'Крутяк' },
    { id: 'glasses_neon',type:'glasses',name: 'Неоновые очки',   icon: '🕶️', price: 130, color: '#00d4ff', desc: 'Киберпанк' },
    { id: 'glasses_gold',type:'glasses',name: 'Золотые очки',    icon: '🕶️', price: 200, color: '#f5c842', desc: 'Элита' },
  ];

  const SHOP_AURAS = [
    { id: 'aura_none',   name: 'Без ауры',        icon: '⬜', price: 0,   color: null,      size: 0,   desc: 'Стандарт' },
    { id: 'aura_white',  name: 'Белая аура',       icon: '🤍', price: 0,   color: '#ffffff', size: 18,  desc: 'По умолчанию' },
    { id: 'aura_green',  name: 'Зелёная аура',     icon: '💚', price: 200, color: '#48bb78', size: 24,  desc: 'Природная сила' },
    { id: 'aura_purple', name: 'Фиолетовая аура',  icon: '💜', price: 400, color: '#9f7aea', size: 32,  desc: 'Мистическая' },
    { id: 'aura_black',  name: 'Чёрная аура',      icon: '🖤', price: 500, color: '#1a1a2e', size: 40,  desc: 'Тёмная сила' },
  ];

  const STORE_KEY = 'fl_tracker_v1';

  function defaultState() {
    return {
      xp: 0, level: 1, coins: 0, doneTasks: 0, doneEpic: 0, streak: 0,
      lastLoginDate: null, lastDailyDate: null, totalDailyClaims: 0,
      unlockedAchievements: [], tasks: [],
      log: [{ text: 'Добро пожаловать в Прогресс!', type: 'log-info' }],
      // магазин
      ownedItems: ['aura_white'],   // по умолчанию белая аура
      equippedCap: null,
      equippedShirt: null,
      equippedPants: null,
      equippedGlasses: null,
      equippedAura: 'aura_white',
    };
  }

  function loadState() {
    try {
      const r = localStorage.getItem(STORE_KEY);
      const s = r ? Object.assign(defaultState(), JSON.parse(r)) : defaultState();
      // миграция: убедимся что поля магазина есть
      if (!Array.isArray(s.ownedItems)) s.ownedItems = ['aura_white'];
      if (!s.ownedItems.includes('aura_white')) s.ownedItems.push('aura_white');
      if (s.equippedAura === undefined) s.equippedAura = 'aura_white';
      return s;
    } catch { return defaultState(); }
  }
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch {} }

  let state = loadState();

  function calcLevel(xp) {
    let lvl = 1;
    for (let i = 1; i < XP_PER_LEVEL.length; i++) { if (xp >= XP_PER_LEVEL[i]) lvl = i + 1; else break; }
    return Math.min(lvl, XP_PER_LEVEL.length);
  }
  function xpForLevel(lvl)     { return XP_PER_LEVEL[Math.min(lvl - 1, XP_PER_LEVEL.length - 1)] || 0; }
  function xpForNextLevel(lvl) { return XP_PER_LEVEL[Math.min(lvl,     XP_PER_LEVEL.length - 1)] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1]; }

  const $ = (id) => document.getElementById(id);
  const elLevel      = $('trk-level');
  const elXpText     = $('trk-xp-text');
  const elXpFill     = $('trk-xp-fill');
  const elCoins      = $('trk-coins');
  const elDoneCount  = $('trk-done-count');
  const elStreak     = $('trk-streak');
  const elDailyBtn   = $('trk-daily-btn');
  const elDailyHint  = $('trk-daily-hint');
  const elTasksList  = $('tasks-list');
  const elTasksEmpty = $('tasks-empty');
  const elAddBtn     = $('trk-add-btn');
  const elAddForm    = $('task-add-form');
  const elSaveBtn    = $('task-save-btn');
  const elCancelBtn  = $('task-cancel-btn');
  const elTitleIn    = $('task-title-input');
  const elDescIn     = $('task-desc-input');
  const elXpSel      = $('task-xp-select');
  const elAchieve    = $('achieve-list');
  const elLog        = $('event-log');
  const elCharName   = $('trk-char-name');
  const elAnimLabel  = $('char-anim-label');
  const canvas       = $('pixel-char');
  const canvasWrap   = canvas ? canvas.closest('.char-canvas-wrap') : null;
  const shopCanvas   = null; // превью убрано

  /* ============================================================
     ПИКСЕЛЬНЫЙ ПЕРСОНАЖ
     ============================================================ */
  const C  = canvas    ? canvas.getContext('2d')    : null;
  const SC = 6; // scale

  const CMAP_BASE = {
    H: '#2a1a0a', h: '#f5c8a0', w: '#ffffff', E: '#111111', s: '#f5c8a0',
    M: '#c06858', S: '#3a6fff', P: '#1a2a5a', B: '#111111',
  };

  // Спрайт персонажа
  const SPR = [
    '00000HHHHHH0000',
    '0000HhhhhhHH000',
    '0000HwEwwEwH000',
    '0000HssssssH000',
    '0000HsMMMMsH000',
    '00000HHHHHH0000',
    '0000SSSSSSSS000',
    '000SSSSSSSSSS00',
    '000SSSSSSSSSS00',
    '000SSSSSSSSSS00',
    '0000SSSSSSSS000',
    '000PPPPPPPPPP00',
    '000PPPPPPPPPP00',
    '000PPPPPPPPPP00',
    '000BBBB0BBBBB00',
    '00BBBBB0BBBBB00',
  ];

  // Кепка (рисуется поверх строк 0-1)
  const CAP_SPR = [
    '0000CCCCCCCC000',
    '000CCCCCCCCCC00',
  ];

  // Очки (строка 2)
  const GLASSES_SPR = [
    '0000GgGGGgGG000',
  ];

  function buildCmap() {
    const m = Object.assign({}, CMAP_BASE);
    if (state.equippedShirt)   m['S'] = state.equippedShirt;
    if (state.equippedPants)   m['P'] = state.equippedPants;
    return m;
  }

  function drawSpr(spr, ctx, scale, ox, oy, cmap) {
    spr.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '0') continue;
        ctx.fillStyle = cmap[ch] || '#fff';
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    });
  }

  function drawCharFull(ctx, scale, ox, oy, bobY) {
    const cmap = buildCmap();
    ctx.save();
    ctx.translate(0, bobY || 0);

    // Аура
    const auraItem = SHOP_AURAS.find(a => a.id === state.equippedAura);
    if (auraItem && auraItem.color) {
      const cx = ox + 8 * scale;
      const cy = oy + 8 * scale;
      const r  = auraItem.size * (scale / 6);
      const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      grad.addColorStop(0, auraItem.color + '55');
      grad.addColorStop(0.5, auraItem.color + '22');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.1, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Тело
    drawSpr(SPR, ctx, scale, ox, oy, cmap);

    // Кепка
    if (state.equippedCap) {
      const capCmap = { C: state.equippedCap, c: shadeColor(state.equippedCap, -30) };
      drawSpr(CAP_SPR, ctx, scale, ox, oy, capCmap);
    }

    // Очки
    if (state.equippedGlasses) {
      const gCmap = { G: state.equippedGlasses, g: shadeColor(state.equippedGlasses, 40) };
      drawSpr(GLASSES_SPR, ctx, scale, ox, oy + 2 * scale, gCmap);
    }

    ctx.restore();
  }

  function shadeColor(hex, amt) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amt));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
    const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  let currentAnim = 'idle';
  let celebFrames = 0;

  function animIdle() {
    if (!C) return;
    const bob = Math.sin(Date.now() / 380) * 1.8;
    C.clearRect(0, 0, 96, 96);
    drawCharFull(C, SC, 0, 0, bob);
  }

  function animCelebrate() {
    if (!C) return;
    celebFrames++;
    const t = celebFrames / 40;
    const jumpY = -Math.sin(t * Math.PI) * 22;
    const scl   = 1 + Math.sin(t * Math.PI) * 0.08;
    C.clearRect(0, 0, 96, 96);
    C.save();
    C.translate(48, 48 + jumpY);
    C.scale(scl, scl);
    C.translate(-48, -48);
    drawCharFull(C, SC, 0, 0, 0);
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

  // Превью убрано — персонаж виден на основном канвасе

  /* ============================================================
     РЕНДЕР
     ============================================================ */
  function render() {
    const lvl    = calcLevel(state.xp);
    const xpCur  = state.xp - xpForLevel(lvl);
    const xpNeed = xpForNextLevel(lvl) - xpForLevel(lvl);
    const pct    = Math.min(100, Math.round((xpCur / xpNeed) * 100));

    if (elLevel)     elLevel.textContent     = lvl;
    if (elXpText)    elXpText.textContent    = `${state.xp} / ${xpForNextLevel(lvl)} XP`;
    if (elXpFill)    elXpFill.style.width    = pct + '%';
    if (elCoins)     elCoins.textContent     = state.coins + ' 🪙';
    if (elDoneCount) elDoneCount.textContent = state.doneTasks;

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
  function addLog(text, type) {
    state.log.push({ text, type: type || 'log-info' });
    if (state.log.length > 60) state.log = state.log.slice(-60);
  }

  function addXp(amount, refEl) {
    const oldLvl = calcLevel(state.xp);
    state.xp += amount;
    const newLvl = calcLevel(state.xp);
    state.level  = newLvl;
    addLog(`+${amount} XP`, 'log-xp');
    if (refEl) spawnXpPopup(amount, refEl);
    if (newLvl > oldLvl) {
      // монеты за уровень
      state.coins += LEVEL_UP_COINS;
      addLog(`🎉 Уровень ${newLvl}! +${LEVEL_UP_COINS} монет`, 'log-level');
      showLevelUp(newLvl);
    }
    checkAchievements();
    saveState();
    render();
    if (typeof renderShop === 'function') renderShop();
    syncTrackerToServer();
  }

  function spawnXpPopup(amount, refEl) {
    const r  = refEl.getBoundingClientRect();
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
      <div class="levelup-sub">Уровень ${lvl} достигнут. +${LEVEL_UP_COINS} монет!</div>
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

  /* ============================================================
     МАГАЗИН — логика (встроен на страницу)
     ============================================================ */
  const shopCoinsDisp = $('shop-coins-display');
  const shopTabClothes = $('shop-tab-clothes');
  const shopTabAura    = $('shop-tab-aura');
  const shopTabs       = document.querySelectorAll('.shop-tab');

  // Вкладки
  shopTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      shopTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const key = tab.dataset.tab;
      if (shopTabClothes) shopTabClothes.classList.toggle('hidden', key !== 'clothes');
      if (shopTabAura)    shopTabAura.classList.toggle('hidden',    key !== 'aura');
    });
  });

  function isOwned(id)    { return Array.isArray(state.ownedItems) && state.ownedItems.includes(id); }
  function isEquipped(id) {
    return id === state.equippedCap || id === state.equippedShirt ||
           id === state.equippedPants || id === state.equippedGlasses ||
           id === state.equippedAura;
  }

  function renderShop() {
    if (shopCoinsDisp) shopCoinsDisp.textContent = (Number(state.coins) || 0) + ' 🪙';
    renderShopGrid(shopTabClothes, SHOP_CLOTHES);
    renderShopGrid(shopTabAura,    SHOP_AURAS);
  }

  function renderShopGrid(container, items) {
    if (!container) return;
    container.innerHTML = '';
    items.forEach(item => {
      const owned    = isOwned(item.id);
      const equipped = isEquipped(item.id);
      const coins    = Number(state.coins) || 0;
      const canBuy   = !owned && coins >= item.price && item.price > 0;
      const isFree   = item.price === 0;

      const card = document.createElement('div');
      card.className = 'shop-card' + (equipped ? ' shop-card-equipped' : '') + (owned && !equipped ? ' shop-card-owned' : '');

      let btnHtml;
      if (equipped) {
        btnHtml = `<button class="shop-btn shop-btn-unequip" data-id="${item.id}" data-action="unequip">Снять</button>`;
      } else if (owned || isFree) {
        btnHtml = `<button class="shop-btn shop-btn-equip" data-id="${item.id}" data-action="equip">Надеть</button>`;
      } else if (canBuy) {
        btnHtml = `<button class="shop-btn shop-btn-buy" data-id="${item.id}" data-action="buy">Купить ${item.price} 🪙</button>`;
      } else {
        btnHtml = `<button class="shop-btn shop-btn-locked" disabled>Нужно ${item.price} 🪙</button>`;
      }

      let dotStyle = item.color ? `background:${item.color};` : 'background:#444;';
      if (item.id.startsWith('aura_') && item.color) dotStyle += `box-shadow:0 0 8px ${item.color};`;

      card.innerHTML = `
        <div class="shop-card-icon">${item.icon}<span class="shop-color-dot" style="${dotStyle}"></span></div>
        <div class="shop-card-name">${item.name}</div>
        <div class="shop-card-desc">${item.desc}</div>
        ${btnHtml}`;
      container.appendChild(card);
    });
  }

  function shopAction(id, action) {
    const allItems = [...SHOP_CLOTHES, ...SHOP_AURAS];
    const item = allItems.find(i => i.id === id);
    if (!item) return;

    const coins = Number(state.coins) || 0;
    const price = Number(item.price) || 0;

    if (action === 'buy') {
      if (coins < price) { showShopToast('Недостаточно монет!', 'error'); return; }
      state.coins = coins - price;
      if (!Array.isArray(state.ownedItems)) state.ownedItems = ['aura_white'];
      if (!state.ownedItems.includes(id)) state.ownedItems.push(id);
      doEquip(item);
      showShopToast(`✅ Куплено и надето: ${item.name}`);
      addLog(`🛍️ Куплено: ${item.name}`, 'log-bonus');
    } else if (action === 'equip') {
      doEquip(item);
      showShopToast(`✨ Надето: ${item.name}`);
    } else if (action === 'unequip') {
      doUnequip(item);
      showShopToast(`👕 Снято: ${item.name}`);
    }

    saveState();
    render();
    renderShop();
  }

  function doEquip(item) {
    if (item.type === 'cap')          state.equippedCap     = item.color;
    else if (item.type === 'shirt')   state.equippedShirt   = item.color;
    else if (item.type === 'pants')   state.equippedPants   = item.color;
    else if (item.type === 'glasses') state.equippedGlasses = item.color;
    else if (item.id.startsWith('aura_')) state.equippedAura = item.id;
  }

  function doUnequip(item) {
    if (item.type === 'cap')          state.equippedCap     = null;
    else if (item.type === 'shirt')   state.equippedShirt   = null;
    else if (item.type === 'pants')   state.equippedPants   = null;
    else if (item.type === 'glasses') state.equippedGlasses = null;
    else if (item.id.startsWith('aura_')) state.equippedAura = 'aura_white';
  }

  function showShopToast(msg, type) {
    const t = document.createElement('div');
    t.className = 'shop-toast' + (type === 'error' ? ' shop-toast-error' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('shop-toast-show'));
    setTimeout(() => { t.classList.remove('shop-toast-show'); setTimeout(() => t.remove(), 400); }, 2500);
  }

  // Один обработчик на каждый грид
  shopTabClothes?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) shopAction(btn.dataset.id, btn.dataset.action);
  });
  shopTabAura?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) shopAction(btn.dataset.id, btn.dataset.action);
  });

  /* ============================================================
     СОБЫТИЯ
     ============================================================ */
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

  elAddBtn?.addEventListener('click', () => { elAddForm?.classList.toggle('hidden'); elTitleIn?.focus(); });
  elCancelBtn?.addEventListener('click', () => {
    elAddForm?.classList.add('hidden');
    if (elTitleIn) elTitleIn.value = '';
    if (elDescIn)  elDescIn.value  = '';
  });
  elSaveBtn?.addEventListener('click', () => {
    const title = elTitleIn?.value.trim();
    if (!title) { elTitleIn?.focus(); return; }
    const xp = Number(elXpSel?.value || 50);
    state.tasks.unshift({ id: 't' + Date.now(), title, desc: elDescIn?.value.trim() || '', xp, done: false, createdAt: new Date().toISOString() });
    addLog(`📋 Задание: ${title}`, 'log-info');
    saveState(); render();
    elAddForm?.classList.add('hidden');
    if (elTitleIn) elTitleIn.value = '';
    if (elDescIn)  elDescIn.value  = '';
  });
  elTitleIn?.addEventListener('keydown', (e) => { if (e.key === 'Enter') elSaveBtn?.click(); });

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
      if (task.preset && window._flSub === 'basic') return; // нельзя удалять предустановленные
      state.tasks = state.tasks.filter((t) => t.id !== item.dataset.id);
      addLog(`🗑 Удалено: ${task.title}`, 'log-info');
      saveState(); render();
    }
  });

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ============================================================
     ИНИЦИАЛИЗАЦИЯ
     ============================================================ */
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
    window._flSub  = String(user.subscription || 'basic').toLowerCase();
    guestEl?.classList.add('hidden');
    appEl?.classList.remove('hidden');
    updateStreak();
    state.level = calcLevel(state.xp);
    applySubscriptionRestrictions();
    render();
    renderShop();
    // Синхронизируем XP/уровень с сервером для лидерборда
    syncTrackerToServer();
  }

  function applySubscriptionRestrictions() {
    const sub = window._flSub || 'basic';
    const addBtn = $('trk-add-btn');
    const addForm = $('task-add-form');
    const tasksCard = document.querySelector('.tracker-tasks-card');

    if (sub === 'basic') {
      // Скрываем кнопку добавления заданий
      if (addBtn) addBtn.style.display = 'none';
      if (addForm) addForm.classList.add('hidden');
      // Показываем предустановленные задания если список пуст
      if (!state.tasks.length) {
        state.tasks = [
          { id: 'preset_1', title: 'Найти 3 подходящих заказа в ленте', desc: 'Используй фильтры для поиска', xp: 20, done: false, preset: true, createdAt: new Date().toISOString() },
          { id: 'preset_2', title: 'Заполнить профиль полностью', desc: 'Имя, аватар и описание', xp: 50, done: false, preset: true, createdAt: new Date().toISOString() },
          { id: 'preset_3', title: 'Получить дневной бонус 3 дня подряд', desc: 'Заходи каждый день', xp: 100, done: false, preset: true, createdAt: new Date().toISOString() },
          { id: 'preset_4', title: 'Добавить заказ в избранное', desc: 'Открой ленту и нажми ★', xp: 20, done: false, preset: true, createdAt: new Date().toISOString() },
          { id: 'preset_5', title: 'Изучить все биржи на странице Биржи', desc: 'Найди подходящую площадку', xp: 50, done: false, preset: true, createdAt: new Date().toISOString() },
        ];
        saveState();
      }
      // Добавляем баннер про подписку
      if (tasksCard && !tasksCard.querySelector('.sub-banner')) {
        const banner = document.createElement('div');
        banner.className = 'sub-banner';
        banner.innerHTML = `<span>🔒 Создание своих заданий доступно в <a href="/pricing" style="color:#48bb78;font-weight:700;">Pro</a></span>`;
        banner.style.cssText = 'padding:10px 14px;border-radius:10px;background:rgba(72,187,120,0.08);border:1px solid rgba(72,187,120,0.2);font-size:0.82rem;color:#888880;margin-bottom:12px;';
        tasksCard.insertBefore(banner, tasksCard.querySelector('.tasks-header')?.nextSibling || tasksCard.firstChild);
      }
    }
  }

  // Синхронизация трекера с сервером (для лидерборда)
  let syncTimer = null;
  function syncTrackerToServer() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      try {
        await fetch('/api/tracker/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xp: state.xp, level: state.level, coins: state.coins })
        });
      } catch {}
    }, 2000);
  }

  function drawGatePixel() {
    const c = $('gate-pixel-canvas');
    if (!c) return;
    const ctx = c.getContext?.('2d');
    if (!ctx) return;
    c.width = 200; c.height = 200;
    const cmap = Object.assign({}, CMAP_BASE);
    SPR.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '0') continue;
        ctx.fillStyle = cmap[ch] || '#fff';
        ctx.fillRect(x * 12, y * 12, 12, 12);
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
