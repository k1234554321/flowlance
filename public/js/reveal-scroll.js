(function () {
  let observer = null;

  function revealAll() {
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('visible');
      el.classList.add('is-visible');
    });
  }

  /** На десктопе выше «окно» видимости — иначе пол-экрана сразу получает .visible и анимация пропадает. */
  function ioOptions() {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    if (coarse) {
      return { threshold: 0.08, rootMargin: '0px 0px -56px 0px' };
    }
    return { threshold: 0.22, rootMargin: '0px 0px -14% 0px' };
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
