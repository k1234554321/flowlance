(function () {
  function initCursorGlow() {
    if (!document.body.classList.contains('theme-hub')) return;

    // Удаляем старые
    document.querySelectorAll('.hub-cursor-glow').forEach(function(e){ e.remove(); });

    var el = document.createElement('div');
    el.className = 'hub-cursor-glow';
    el.setAttribute('aria-hidden', 'true');

    // Вешаем на documentElement (<html>) — он выше body,
    // не обрезается overflow:hidden на body или секциях
    document.documentElement.appendChild(el);

    var half = 150; // 300/2
    var pageX = -500;
    var pageY = -500;

    function paint() {
      // fixed позиционируется от viewport
      // clientX = pageX - scrollX
      var cx = pageX - window.scrollX;
      var cy = pageY - window.scrollY;
      el.style.left = (cx - half) + 'px';
      el.style.top  = (cy - half) + 'px';
    }

    // rAF loop — обновляем каждый кадр, скролл учитывается автоматически
    (function loop() {
      paint();
      requestAnimationFrame(loop);
    })();

    window.addEventListener('mousemove', function(e) {
      pageX = e.pageX;
      pageY = e.pageY;
    }, { passive: true });

    window.addEventListener('touchstart', function(e) {
      if (e.touches && e.touches[0]) {
        pageX = e.touches[0].pageX;
        pageY = e.touches[0].pageY;
      }
    }, { passive: true });

    window.addEventListener('touchmove', function(e) {
      if (e.touches && e.touches[0]) {
        pageX = e.touches[0].pageX;
        pageY = e.touches[0].pageY;
      }
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
