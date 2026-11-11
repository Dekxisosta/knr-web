import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import './IDEWindows.css';

/**
 * IDEShapes: the wireframe ring and cube of the texture beside the code window.
 * They drift at different speeds as the section scrolls past (parallax), and the
 * cube turns a little. Static for prefers-reduced-motion.
 */
export default function IDEShapes() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });

  const ringY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-30, 40]);
  const cubeY = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [50, -50]);
  const cubeRotate = useTransform(scrollYProgress, [0, 1], reduced ? [0, 0] : [-10, 10]);

  return (
    <div ref={ref} className="ide-shapes" aria-hidden="true">
      <motion.svg className="tex-ring" style={{ y: ringY }} viewBox="0 0 300 300" fill="none" stroke="currentColor" strokeWidth={1}>
        <circle cx="150" cy="150" r="140" vectorEffect="non-scaling-stroke" />
        <circle cx="150" cy="150" r="96" vectorEffect="non-scaling-stroke" />
      </motion.svg>
      <motion.svg
        className="tex-cube"
        style={{ y: cubeY, rotate: cubeRotate }}
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth={1}
        strokeLinejoin="round"
      >
        <path d="M50 6 88 28v44L50 94 12 72V28Z" vectorEffect="non-scaling-stroke" />
        <path d="M50 50 12 28M50 50l38-22M50 50v44M50 50 12 72M50 50l38 22M50 50V6" vectorEffect="non-scaling-stroke" />
      </motion.svg>
    </div>
  );
}
