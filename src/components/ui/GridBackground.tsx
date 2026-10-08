'use client';
import { useEffect, useRef } from 'react';

const GRID = 32;
const DOT_BASE_OPACITY = 0.08;
const DOT_HOVER_OPACITY = 0.35;
const CURSOR_RADIUS = 140;
const AMPLITUDE = 3;
const MAX_DPR = 2;

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
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      ctx.scale(dpr, dpr);

      for (const d of dots) {
        let dx = d.bx;
        let dy = d.by;

        if (!prefersReduced) {
          const tx = (now % d.period) / d.period;
          const ty = (now % d.periodY) / d.periodY;
          dx += Math.sin(d.phase + tx * Math.PI * 2) * AMPLITUDE;
          dy += Math.sin(d.phaseY + ty * Math.PI * 2) * AMPLITUDE;
        }

        let opacity = DOT_BASE_OPACITY;

        // Cursor glow — skip on touch and reduced motion
        if (!prefersReduced && !isTouch) {
          const dist = Math.hypot(dx - cx, dy - cy);
          if (dist < CURSOR_RADIUS) {
            const t = 1 - dist / CURSOR_RADIUS;
            opacity = DOT_BASE_OPACITY + (DOT_HOVER_OPACITY - DOT_BASE_OPACITY) * t * t;
          }
        }

        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.beginPath();
        ctx.arc(dx, dy, 0.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Vignette overlay
      const vg = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        Math.min(canvas.width, canvas.height) * 0.3,
        canvas.width / 2,
        canvas.height / 2,
        Math.max(canvas.width, canvas.height) * 0.75
      );
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function loop(now: number) {
      if (!hidden) draw(now);
      animId = requestAnimationFrame(loop);
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
  );
}
