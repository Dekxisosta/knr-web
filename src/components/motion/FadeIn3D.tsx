import { motion, useReducedMotion } from 'motion/react';
import { ease } from '../../lib/motion';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Seconds before the fade starts */
  delay?: number;
  /** Extra styles for the wrapper (e.g. zIndex) */
  style?: CSSProperties;
  /** Let the canvas receive pointer events (default: the layer is click-through) */
  interactive?: boolean;
}

/**
 * Fades a three.js canvas in with Motion, matching the page's scroll reveals.
 *
 * Opacity only, on a wrapper: no transform, so the canvas keeps its true size for the
 * layout measurements the scenes take on mount, and the canvas's own inline opacity /
 * mask (set by the scenes for responsive dimming) is left untouched.
 * Islands hydrate when they scroll into view (client:visible) or when idle (hero), so
 * animating on mount means the scene eases in instead of popping.
 */
export default function FadeIn3D({ children, delay = 0, style, interactive = false }: Props) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, delay, ease }}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: interactive ? undefined : 'none',
        ...style,
      }}
    >
      {children}
    </motion.div>
  );
}
