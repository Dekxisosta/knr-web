'use client';
import { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_-.';

interface Props {
  text: string;
  className?: string;
  /** Delay before scramble starts (ms) */
  delay?: number;
}

export default function MonoType({ text, className, delay = 0 }: Props) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? text : '');
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (reduced) {
      setDisplay(text);
      return;
    }

    const run = () => {
      const totalFrames = 18; // ~0.3s at 60fps per char
      let frame = 0;
      const len = text.length;

      function tick() {
        frame++;
        const progress = frame / totalFrames;
        const revealed = Math.floor(progress * len);
        let result = '';
        for (let i = 0; i < len; i++) {
          if (i < revealed) {
            result += text[i];
          } else {
            result += text[i] === ' '
              ? ' '
              : CHARS[Math.floor(Math.random() * CHARS.length)];
          }
        }
        setDisplay(result);
        if (frame < totalFrames) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(text);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    timerRef.current = setTimeout(run, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [text, delay, reduced]);

  return (
    <span
      className={className}
      aria-label={text}
      style={{ fontVariantNumeric: 'tabular-nums' }}
    >
      {display}
    </span>
  );
}
