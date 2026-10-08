// ─── Shared motion tokens & variants ────────────────────────────────────────
// Import from here in all motion components to keep settings consistent.

export const ease = [0.22, 1, 0.36, 1] as const;

export const duration = {
  fast: 0.18,
  base: 0.35,
  slow: 0.6,
} as const;

// Reveal: fade + translateY
export const revealVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: duration.slow, ease },
  },
};

// Fade only (used with reduced motion)
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: duration.base, ease },
  },
};

// Stagger container
export const staggerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

// Line mask reveal for headings (clip-path)
export const lineRevealVariants = {
  hidden: { opacity: 0, y: '100%' },
  visible: {
    opacity: 1,
    y: '0%',
    transition: { duration: duration.slow, ease },
  },
};

// Button hover
export const buttonHover = {
  y: -2,
  transition: { duration: duration.fast, ease },
};
