(function () {
  let observer = null;

  function revealAll() {
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('visible');
      el.classList.add('is-visible');
    });
  }


  function ioOptions() {
    return { threshold: 0.12, rootMargin: '0px 0px -8% 0px' };
  }

  window.initRevealScroll = function initRevealScroll() {
    // Если у пользователя отключены анимации в системе — не ебём ему мозг
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      revealAll();
      return;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    const opts = ioOptions();
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
      opts
    );
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
