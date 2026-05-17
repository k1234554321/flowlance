(function () {
  function initCursorGlow() {
    if (!document.body.classList.contains('theme-hub')) return;

    document.querySelectorAll('.hub-cursor-glow').forEach(function(e){ e.remove(); });

    var el = document.createElement('div');
    el.className = 'hub-cursor-glow';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);

    var half = 150; // 300 / 2

    // Обновляем позицию СРАЗУ в mousemove — никакого rAF, никакого transition
    // position:fixed + left/top в координатах viewport = всегда на курсоре
    window.addEventListener('mousemove', function(e) {
      el.style.left = (e.clientX - half) + 'px';
      el.style.top  = (e.clientY - half) + 'px';
    }, { passive: true });
  }

  function initLogoHover() {
    document.querySelectorAll('.logo').forEach(function(logo) {
      logo.classList.add('logo-interactive');
    });
  }

  function boot() {
    initCursorGlow();
    initLogoHover();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
