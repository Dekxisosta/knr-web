import { motion, useReducedMotion } from 'motion/react';
import { revealVariants, fadeVariants } from '../../lib/motion';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export default function Reveal({ children, delay = 0, className, as: Tag = 'div' }: Props) {
  const reduced = useReducedMotion();
  const variants = reduced ? fadeVariants : revealVariants;

  const MotionTag = motion[Tag as 'div'];

  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={variants}
      transition={delay > 0 ? { delay } : undefined}
    >
      {children}
    </MotionTag>
  );
}
