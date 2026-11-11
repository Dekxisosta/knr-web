import { motion, useReducedMotion } from 'motion/react';
import { ease, duration } from '../../lib/motion';
import IDEViewport from './IDEViewport';
import AuditTerminal from './AuditTerminal';
import './IDEWindows.css';

/**
 * IDEWindows: the two windows under the hero. Each rises in as it scrolls into
 * view (second one slightly after the first); the terminal then prints its lines.
 * On narrow screens only the code window is shown (see IDEWindows.css).
 */
export default function IDEWindows() {
  const reduced = useReducedMotion();

  const cell = (i: number) => ({
    hidden: { opacity: 0, y: reduced ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease, delay: reduced ? 0 : i * 0.14 } },
  });
  const inView = { once: true, margin: '-80px' } as const;

  return (
    <div className="ide-row">
      <motion.div className="ide-cell" initial="hidden" whileInView="visible" viewport={inView} variants={cell(0)}>
        <IDEViewport />
      </motion.div>
      <motion.div
        className="ide-cell ide-cell--terminal"
        initial="hidden"
        whileInView="visible"
        viewport={inView}
        variants={cell(1)}
      >
        <AuditTerminal />
      </motion.div>
    </div>
  );
}
