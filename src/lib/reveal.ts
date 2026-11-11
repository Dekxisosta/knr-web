/**
 * Site-wide scroll reveals, built on Motion (the `motion` package, same one the React
 * islands use). No wrapper components and no markup changes: each rule below finds a
 * group on the page, and when it scrolls into view its items fade and rise in with a
 * stagger. Section headers, cards, lists, the form, the info strip, and so on.
 *
 *   data-reveal="off"   opt an element out.
 *
 * Safe by design:
 *  - Hiding is done here (not in CSS), so with no JS nothing is ever hidden.
 *  - Only things currently below the fold are hidden, so there is no flash on load.
 *  - Inline opacity / transform are removed when each animation ends, so hover
 *    transforms and the scroll parallax (which uses `translate`) keep working.
 *  - Skipped entirely for prefers-reduced-motion.
 */
import { animate, inView, stagger } from 'motion';

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

type Rule = {
  /** Elements that trigger the reveal when they enter the viewport */
  group: string;
  /** Items to animate inside each group (default: the group itself) */
  items?: string;
  /** Stagger between items, seconds */
  step?: number;
  /** Rise distance in px (0 = fade only) */
  y?: number;
  /** Runs once the group has been revealed */
  after?: (group: HTMLElement) => void;
};

const RULES: Rule[] = [
  // Section headers: badge, title, description in sequence
  { group: '.section-header', items: '.section-index, .header-badge, .section-title, .section-desc', step: 0.09 },
  { group: '.team-intro' },

  // Services
  { group: '.services-grid', items: ':scope > li', step: 0.08, y: 28 },
  { group: '.services-cta' },

  // Process
  { group: '.pipeline', items: '.stop', step: 0.1, y: 24 },
  { group: '.principles', items: '.principles-label, .principle', step: 0.07 },

  // Work
  { group: '.work-grid', items: '.work-card', step: 0.09, y: 32 },

  // Info strip (numbers count up)
  { group: '.strip-list', items: '.strip-item', step: 0.08, after: countUp },

  // KNR Cards
  { group: '.cards-left', items: ':scope > *', step: 0.08 },
  { group: '.cards-visual', y: 0 },
  { group: '.feature-list', items: '.feature', step: 0.1 },

  // Statement band
  { group: '.band-center', items: '.kicker, .statement, .band-link', step: 0.1 },

  // Why / Team / FAQ
  { group: '.benefits-grid', items: '.benefit-card', step: 0.08, y: 28 },
  { group: '.quote-card' },
  { group: '.team-cards', items: '.team-card', step: 0.1, y: 28 },
  { group: '.faq-list', items: '.faq-item', step: 0.06, y: 16 },
  { group: '.faq-art', y: 0 },

  // Contact
  { group: '.contact-form-wrap', y: 28 },
  { group: '.contact-info', items: '.info-card, .contact-meta', step: 0.1 },

  // Tech marquee
  { group: '.tech-stack-section', y: 0 },
];

let stops: Array<() => void> = [];

function visible(el: HTMLElement) {
  return el.getClientRects().length > 0;
}

function clear(els: HTMLElement[]) {
  for (const el of els) {
    el.style.removeProperty('opacity');
    el.style.removeProperty('transform');
  }
}

function countUp(group: HTMLElement) {
  group.querySelectorAll<HTMLElement>('.strip-value').forEach((el) => {
    const text = (el.textContent ?? '').trim();
    if (!/^\d+$/.test(text)) return; // leave things like "24/7" alone
    const target = Number(text);
    const width = text.length;
    el.textContent = String(0).padStart(width, '0');
    animate(0, target, {
      duration: 1.1,
      ease: EASE,
      onUpdate: (v: number) => {
        el.textContent = String(Math.round(v)).padStart(width, '0');
      },
    });
  });
}

export function initReveal() {
  stops.forEach((stop) => stop());
  stops = [];

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const vh = window.innerHeight;

  for (const rule of RULES) {
    const y = rule.y ?? 20;
    const step = rule.step ?? 0;

    document.querySelectorAll<HTMLElement>(rule.group).forEach((group) => {
      if (group.dataset.reveal === 'off' || group.dataset.revealed) return;
      if (!visible(group)) return;
      // Already on screen at load: leave it alone, no flash
      if (group.getBoundingClientRect().top < vh * 0.92) return;

      const items = (rule.items ? Array.from(group.querySelectorAll<HTMLElement>(rule.items)) : [group]).filter(
        (el) => el.dataset.reveal !== 'off' && visible(el),
      );
      if (!items.length) return;

      group.dataset.revealed = 'pending';
      for (const el of items) {
        el.style.opacity = '0';
        if (y) el.style.transform = `translateY(${y}px)`;
      }

      const stop = inView(
        group,
        () => {
          group.dataset.revealed = 'done';
          try {
            const controls = animate(
              items,
              y ? { opacity: [0, 1], transform: [`translateY(${y}px)`, 'translateY(0px)'] } : { opacity: [0, 1] },
              { duration: 0.6, delay: step ? stagger(step) : 0, ease: EASE },
            );
            Promise.resolve(controls.finished ?? controls).then(() => clear(items));
            rule.after?.(group);
          } catch {
            clear(items); // never leave content hidden
          }
        },
        { amount: 0.12, margin: '0px 0px -6% 0px' },
      );
      stops.push(stop);
    });
  }
}
