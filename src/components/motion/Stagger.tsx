import { motion, useReducedMotion } from 'motion/react';
import { staggerVariants, revealVariants, fadeVariants } from '../../lib/motion';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
}

export function StaggerParent({ children, className, as: Tag = 'div' }: Props) {
  const MotionTag = motion[Tag as 'div'];
  return (
    <MotionTag
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-80px' }}
      variants={staggerVariants}
    >
      {children}
    </MotionTag>
  );
}

export function StaggerChild({ children, className, as: Tag = 'div' }: Props) {
  const reduced = useReducedMotion();
  const variants = reduced ? fadeVariants : revealVariants;
  const MotionTag = motion[Tag as 'div'];
  return (
    <MotionTag className={className} variants={variants}>
      {children}
    </MotionTag>
  );
}
