(function () {
  let observer = null;

  function revealAll() {
    document.querySelectorAll('.reveal').forEach((el) => {
      el.classList.add('visible');
    });
  }

  window.initRevealScroll = function initRevealScroll() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    
    // Берем настройки плавности из примера
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            observer.unobserve(e.target); // Сработало один раз и зафиксировалось
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    requestAnimationFrame(() => {
      document.querySelectorAll('.reveal').forEach((el) => {
        if (!el.classList.contains('visible')) {
          observer.observe(el);
        }
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initRevealScroll);
  } else {
    window.initRevealScroll();
  }
})();