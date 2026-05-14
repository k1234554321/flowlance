(function () {
  let observer = null;

  function revealAll() {
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('visible');
      el.classList.add('is-visible');
    });
  }

  window.initRevealScroll = function initRevealScroll() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll();
      return;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            e.target.classList.add('is-visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    // Два кадра: после шрифтов/динамической вёрстки, иначе IO иногда не срабатывает для новых узлов.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelectorAll('.reveal').forEach((el) => {
          if (!el.classList.contains('visible')) observer.observe(el);
        });
      });
    });
  };

  function boot() {
    window.initRevealScroll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
