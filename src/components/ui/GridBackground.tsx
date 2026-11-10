'use client';
import { useEffect, useRef } from 'react';

const GRID = 32;
const DOT_BASE_OPACITY = 0.08;
const DOT_HOVER_OPACITY = 0.35;
const CURSOR_RADIUS = 140;
const AMPLITUDE = 3;
const MAX_DPR = 1.5;
const FRAME_MS = 1000 / 30;

interface Dot {
  bx: number;
  by: number;
  phase: number;
  period: number;
  phaseY: number;
  periodY: number;
}

export default function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let dots: Dot[] = [];
    let cx = -9999;
    let cy = -9999;
    let hidden = false;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isTouch =
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none)').matches;

    function buildDots() {
      if (!canvas) return;
      dots = [];
      const cols = Math.ceil(canvas.width / (GRID * dpr)) + 2;
      const rows = Math.ceil(canvas.height / (GRID * dpr)) + 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          dots.push({
            bx: c * GRID,
            by: r * GRID,
            phase: Math.random() * Math.PI * 2,
            period: 12000 + Math.random() * 8000,
            phaseY: Math.random() * Math.PI * 2,
            periodY: 12000 + Math.random() * 8000,
          });
        }
      }
    }

    let dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      buildDots();
    }

    resize();
    window.addEventListener('resize', resize);

    function draw(now: number) {
      if (!canvas || !ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const glow = !prefersReduced && !isTouch;
      const r2 = CURSOR_RADIUS * CURSOR_RADIUS;
      const near: Array<[number, number, number]> = [];

      // All resting dots share one colour: draw them in a single batched path.
      ctx.fillStyle = `rgba(255,255,255,${DOT_BASE_OPACITY})`;
      ctx.beginPath();
      for (const d of dots) {
        let dx = d.bx;
        let dy = d.by;
        if (!prefersReduced) {
          const tx = (now % d.period) / d.period;
          const ty = (now % d.periodY) / d.periodY;
          dx += Math.sin(d.phase + tx * Math.PI * 2) * AMPLITUDE;
          dy += Math.sin(d.phaseY + ty * Math.PI * 2) * AMPLITUDE;
        }
        if (glow) {
          const ox = dx - cx;
          const oy = dy - cy;
          const dist2 = ox * ox + oy * oy;
          if (dist2 < r2) {
            near.push([dx, dy, 1 - Math.sqrt(dist2) / CURSOR_RADIUS]);
            continue;
          }
        }
        ctx.rect(dx - 0.5, dy - 0.5, 1, 1);
      }
      ctx.fill();

      // Only dots under the cursor need their own opacity.
      for (const [x, y, t] of near) {
        const opacity = DOT_BASE_OPACITY + (DOT_HOVER_OPACITY - DOT_BASE_OPACITY) * t * t;
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fillRect(x - 0.5, y - 0.5, 1, 1);
      }
    }

    // The drift is very slow (12-20s periods), so 30fps looks identical and halves the work.
    let last = 0;
    function loop(now: number) {
      animId = requestAnimationFrame(loop);
      if (hidden || now - last < FRAME_MS) return;
      last = now;
      draw(now);
    }
    animId = requestAnimationFrame(loop);

    function onVisibility() {
      hidden = document.hidden;
    }
    document.addEventListener('visibilitychange', onVisibility);

    let pointerRaf = 0;
    function onPointer(e: MouseEvent) {
      if (pointerRaf) return;
      pointerRaf = requestAnimationFrame(() => {
        cx = e.clientX;
        cy = e.clientY;
        pointerRaf = 0;
      });
    }
    if (!isTouch && !prefersReduced) {
      window.addEventListener('mousemove', onPointer, { passive: true });
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('mousemove', onPointer);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          display: 'block',
          backgroundColor: '#000',
        }}
      />
      {/* Static vignette (was redrawn on the canvas every frame) */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.85) 100%)',
        }}
      />
    </>
  );
}
