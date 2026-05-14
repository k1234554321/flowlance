(function () {
  function mount() {
    document.body.classList.add('is-page-mounted');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
