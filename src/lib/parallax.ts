/**
 * Lightweight scroll parallax.
 *
 *   data-parallax="0.06"      vertical depth. Negative = lags (feels far away),
 *                             positive = moves ahead (feels close).
 *   data-parallax-x="-0.4"    same idea, horizontal drift.
 *   data-parallax-min="1025"  only active at or above this viewport width.
 *
 * Uses the individual CSS `translate` property, so it composes with any
 * `transform` the element already has (hover lifts, rotations, ...).
 * Disabled for prefers-reduced-motion. Strength is halved on small screens.
 */

type Item = {
  el: HTMLElement;
  y: number;
  x: number;
  min: number;
  center: number;
};

let teardown: (() => void) | null = null;

export function initParallax() {
  teardown?.();
  teardown = null;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const els = Array.from(document.querySelectorAll<HTMLElement>('[data-parallax], [data-parallax-x]'));
  if (!els.length) return;

  let items: Item[] = [];
  let vh = window.innerHeight;
  let vw = window.innerWidth;
  let queued = false;

  const measure = () => {
    vh = window.innerHeight;
    vw = window.innerWidth;
    items = els.map((el) => {
      // Measure at the natural position, then restore.
      const prev = el.style.translate;
      el.style.translate = '';
      const r = el.getBoundingClientRect();
      const center = r.top + window.scrollY + r.height / 2;
      el.style.translate = prev;
      return {
        el,
        y: parseFloat(el.dataset.parallax ?? '0') || 0,
        x: parseFloat(el.dataset.parallaxX ?? '0') || 0,
        min: parseFloat(el.dataset.parallaxMin ?? '0') || 0,
        center,
      };
    });
  };

  const update = () => {
    queued = false;
    const mid = window.scrollY + vh / 2;
    const strength = vw < 768 ? 0.5 : 1;

    for (const it of items) {
      if (vw < it.min) {
        it.el.style.translate = '';
        continue;
      }
      const d = it.center - mid;
      if (Math.abs(d) > vh * 1.5) continue; // far off-screen: skip work
      const ty = d * it.y * strength;
      const tx = d * it.x * strength;
      it.el.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
    }
  };

  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };

  const remeasure = () => {
    measure();
    queue();
  };

  measure();
  update();

  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', remeasure, { passive: true });
  window.addEventListener('load', remeasure);
  // Layout can shift as fonts/images/React islands load
  const ro = new ResizeObserver(remeasure);
  ro.observe(document.body);

  teardown = () => {
    window.removeEventListener('scroll', queue);
    window.removeEventListener('resize', remeasure);
    window.removeEventListener('load', remeasure);
    ro.disconnect();
    els.forEach((el) => (el.style.translate = ''));
  };
}
