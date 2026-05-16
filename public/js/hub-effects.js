(function () {
  function initCursorGlow() {
    if (!document.body.classList.contains('theme-hub')) return;
    let el = document.querySelector('.hub-cursor-glow');
    if (!el) {
      el = document.createElement('div');
      el.className = 'hub-cursor-glow';
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    function paint() {
      el.style.transform = `translate(${mx - 140}px, ${my - 140}px)`;
    }
    paint();
    document.addEventListener(
      'mousemove',
      (e) => {
        mx = e.clientX;
        my = e.clientY;
        paint();
        document.documentElement.style.setProperty('--mx', `${mx}px`);
        document.documentElement.style.setProperty('--my', `${my}px`);
      },
      { passive: true }
    );
  }

  function initLogoHover() {
    document.querySelectorAll('.logo').forEach((logo) => {
      logo.classList.add('logo-interactive');
    });
  }

  function boot() {
    initCursorGlow();
    initLogoHover();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
