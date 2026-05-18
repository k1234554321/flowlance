/* Кастомный select под тему сайта — заменяет нативные <select> */
(function () {
  if (!document.body.classList.contains('theme-hub')) return;

  var style = document.createElement('style');
  style.textContent = `
    .cs-wrap { position: relative; display: inline-block; width: 100%; }
    .cs-trigger {
      width: 100%;
      background: rgba(12,12,18,0.85);
      color: #e8e8e3;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 10px;
      padding: 10px 36px 10px 14px;
      font-family: inherit;
      font-size: 0.92rem;
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
      backdrop-filter: blur(12px);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      user-select: none;
    }
    .cs-trigger:hover {
      border-color: rgba(255,255,255,0.28);
      background: rgba(18,18,26,0.92);
    }
    .cs-trigger.is-open {
      border-color: rgba(255,255,255,0.35);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.06);
    }
    .cs-arrow {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      opacity: 0.5;
      transition: transform 0.3s cubic-bezier(0.22,1,0.36,1);
    }
    .cs-trigger.is-open .cs-arrow { transform: rotate(180deg); opacity: 0.9; }
    .cs-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      background: rgba(12,12,20,0.97);
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 12px;
      overflow: hidden;
      z-index: 9999;
      backdrop-filter: blur(20px);
      box-shadow: 0 16px 48px rgba(0,0,0,0.6);
      opacity: 0;
      transform: translateY(-8px) scale(0.97);
      pointer-events: none;
      transition: opacity 0.22s cubic-bezier(0.22,1,0.36,1), transform 0.22s cubic-bezier(0.22,1,0.36,1);
      max-height: 260px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.1) transparent;
    }
    .cs-dropdown.is-open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: auto;
    }
    .cs-option {
      padding: 10px 14px;
      font-size: 0.9rem;
      color: #d0d0c8;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .cs-option:last-child { border-bottom: none; }
    .cs-option:hover { background: rgba(255,255,255,0.08); color: #f5f5f0; }
    .cs-option.is-selected { color: #f5f5f0; background: rgba(255,255,255,0.06); font-weight: 600; }
  `;
  document.head.appendChild(style);

  function buildCustomSelect(sel) {
    if (sel.dataset.csInit) return;
    sel.dataset.csInit = '1';

    var wrap = document.createElement('div');
    wrap.className = 'cs-wrap';

    var trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'cs-trigger';

    var label = document.createElement('span');
    label.className = 'cs-label';

    var arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('fill', 'none');
    arrow.setAttribute('stroke', 'currentColor');
    arrow.setAttribute('stroke-width', '2');
    arrow.classList.add('cs-arrow');
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M6 9l6 6 6-6');
    arrow.appendChild(path);

    trigger.appendChild(label);
    trigger.appendChild(arrow);

    var dropdown = document.createElement('div');
    dropdown.className = 'cs-dropdown';

    function syncOptions() {
      dropdown.innerHTML = '';
      var opts = sel.options;
      for (var i = 0; i < opts.length; i++) {
        (function(opt, idx) {
          var item = document.createElement('div');
          item.className = 'cs-option' + (idx === sel.selectedIndex ? ' is-selected' : '');
          item.textContent = opt.text;
          item.dataset.val = opt.value;
          item.addEventListener('click', function() {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            label.textContent = opt.text;
            dropdown.querySelectorAll('.cs-option').forEach(function(o){ o.classList.remove('is-selected'); });
            item.classList.add('is-selected');
            close();
          });
          dropdown.appendChild(item);
        })(opts[i], i);
      }
      label.textContent = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    }

    function open() {
      trigger.classList.add('is-open');
      dropdown.classList.add('is-open');
    }
    function close() {
      trigger.classList.remove('is-open');
      dropdown.classList.remove('is-open');
    }

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      if (dropdown.classList.contains('is-open')) close(); else open();
    });

    document.addEventListener('click', function() { close(); });
    dropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    // Следим за изменениями опций (динамическая загрузка)
    var mo = new MutationObserver(syncOptions);
    mo.observe(sel, { childList: true });

    syncOptions();

    // Скрываем нативный select
    sel.style.display = 'none';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    wrap.appendChild(trigger);
    wrap.appendChild(dropdown);
  }

  function initAll() {
    document.querySelectorAll('select').forEach(buildCustomSelect);
  }

  // Инициализируем сразу и наблюдаем за новыми
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // Для динамически добавляемых select (лента, фильтры)
  var bodyObs = new MutationObserver(function() {
    document.querySelectorAll('select:not([data-cs-init])').forEach(buildCustomSelect);
  });
  bodyObs.observe(document.body, { childList: true, subtree: true });
})();
