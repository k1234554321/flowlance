(function (root) {
  function esc(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  /** @param {number} rating 0-5 @param {{ interactive?: boolean, name?: string, max?: number }} opts */
  function renderStars(rating, opts = {}) {
    const max = opts.max || 5;
    const r = Math.max(0, Math.min(max, Number(rating) || 0));
    const interactive = Boolean(opts.interactive);
    const name = opts.name || 'rating';
    const tag = interactive ? 'button' : 'span';
    const typeAttr = interactive ? ' type="button"' : '';
    const parts = [];
    for (let i = 1; i <= max; i += 1) {
      const lit = i <= r ? ' is-lit' : '';
      const extra = interactive ? ` data-star-val="${i}" aria-label="${i} из ${max}"` : ' aria-hidden="true"';
      parts.push(
        `<${tag} class="fl-star${lit}"${typeAttr}${extra}><span class="fl-star-glyph">★</span></${tag}>`
      );
    }
    const cls = interactive ? 'fl-stars fl-stars--pick' : 'fl-stars';
    const data = interactive ? ` data-stars-input="${esc(name)}"` : ` data-stars-display="${r}"`;
    return `<div class="${cls}"${data} role="${interactive ? 'group' : 'img'}" aria-label="${interactive ? 'Оценка' : `Оценка ${r} из ${max}`}">${parts.join('')}</div>`;
  }

  function bindStarPicker(container, onChange) {
    if (!container) return;
    const hidden =
      container.querySelector('input[type="hidden"]') ||
      (() => {
        const inp = document.createElement('input');
        inp.type = 'hidden';
        inp.name = container.dataset.starsName || 'rating';
        container.appendChild(inp);
        return inp;
      })();
    let current = Number(hidden.value) || 0;

    function setRating(n) {
      current = n;
      hidden.value = String(n);
      container.querySelectorAll('.fl-star').forEach((star, idx) => {
        star.classList.toggle('is-lit', idx < n);
      });
      onChange?.(n);
    }

    container.querySelectorAll('[data-star-val]').forEach((btn) => {
      btn.addEventListener('click', () => setRating(Number(btn.dataset.starVal)));
      btn.addEventListener('mouseenter', () => {
        const h = Number(btn.dataset.starVal);
        container.querySelectorAll('.fl-star').forEach((star, idx) => {
          star.classList.toggle('is-lit', idx < h);
        });
      });
    });
    container.addEventListener('mouseleave', () => setRating(current));
    setRating(current);
    return { setRating, getValue: () => current };
  }

  root.FLStars = { renderStars, bindStarPicker };
})(typeof window !== 'undefined' ? window : globalThis);
