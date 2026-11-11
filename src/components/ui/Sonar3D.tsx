'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * Sonar3D: a sonar / radar scope for the "Live demos" section background.
 *
 * - Centred on the section header: ping rings expand outward from the title,
 *   a sweep with a fading trail rotates around it, and fixed range rings give it scale.
 * - Blips only appear in free space (they avoid the header text and the card grid,
 *   which are measured from the DOM) and light up as the sweep passes over them.
 * - Black on the section's light surface, in keeping with the other monochrome 3D pieces.
 * - Pauses off-screen / in hidden tabs, one static frame for prefers-reduced-motion,
 *   fails silently if WebGL is unavailable.
 */

const TAU = Math.PI * 2;
const SWEEP_MS = 9000; // one full rotation
const PING_MS = 5600; // one ping ring's lifetime
const SECTOR = Math.PI * 0.5; // length of the sweep trail
const BLIP_COUNT = 22;
const RING_FRACS = [0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1.0];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** Small deterministic PRNG so the blips land in the same places every load. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circlePoints(radius: number, segments = 160) {
  const pts: number[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    pts.push(Math.cos(a) * radius, Math.sin(a) * radius, 0);
  }
  return pts;
}

export default function Sonar3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL: the section simply renders without the sonar.
    }
    renderer.setClearColor(0x000000, 0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const section = canvas.closest('section');

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };
    const lineMat = (opacity: number) =>
      track(new LineBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }));

    // ── Scene (1 world unit = 1 css px) ─────────────────────────────────────
    const scene = new Scene();
    const camera = new OrthographicCamera(-100, 100, 100, -100, -10, 10);
    const radar = new Group();
    scene.add(radar);

    const unitRingGeo = track(new BufferGeometry());
    unitRingGeo.setAttribute('position', new Float32BufferAttribute(circlePoints(1), 3));

    // Range rings (fixed), fading outward
    const rings = RING_FRACS.map((f, i) => {
      const m = new LineLoop(unitRingGeo, lineMat(Math.max(0.07, 0.22 - i * 0.02)));
      radar.add(m);
      return { m, f };
    });

    // Crosshair + bearing ticks on the outer ring
    const crossGeo = track(new BufferGeometry());
    crossGeo.setAttribute('position', new Float32BufferAttribute([-1, 0, 0, 1, 0, 0, 0, -1, 0, 0, 1, 0], 3));
    const cross = new LineSegments(crossGeo, lineMat(0.1));
    radar.add(cross);

    const tickPts: number[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const inner = i % 6 === 0 ? 0.94 : i % 2 === 0 ? 0.965 : 0.98;
      tickPts.push(Math.cos(a) * inner, Math.sin(a) * inner, 0, Math.cos(a), Math.sin(a), 0);
    }
    const tickGeo = track(new BufferGeometry());
    tickGeo.setAttribute('position', new Float32BufferAttribute(tickPts, 3));
    const ticks = new LineSegments(tickGeo, lineMat(0.2));
    radar.add(ticks);

    // Sweep: a triangle fan, strongest at the leading edge, fading behind it
    const steps = 56;
    const sweepPos: number[] = [0, 0, 0];
    const sweepCol: number[] = [0, 0, 0, 0.03];
    for (let i = 0; i <= steps; i++) {
      const a = -(i / steps) * SECTOR;
      sweepPos.push(Math.cos(a), Math.sin(a), 0);
      sweepCol.push(0, 0, 0, 0.16 * Math.pow(1 - i / steps, 1.7));
    }
    const sweepIdx: number[] = [];
    for (let i = 1; i <= steps; i++) sweepIdx.push(0, i, i + 1);
    const sweepGeo = track(new BufferGeometry());
    sweepGeo.setAttribute('position', new Float32BufferAttribute(sweepPos, 3));
    sweepGeo.setAttribute('color', new Float32BufferAttribute(sweepCol, 4));
    sweepGeo.setIndex(sweepIdx);
    const sweepMat = track(
      new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide }),
    );
    const sweep = new Group();
    sweep.add(new Mesh(sweepGeo, sweepMat));

    const armGeo = track(new BufferGeometry());
    armGeo.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0], 3));
    sweep.add(new LineSegments(armGeo, lineMat(0.45)));
    radar.add(sweep);

    // Ping rings: expand from the centre and fade
    const pings = [0, 1, 2, 3].map((i) => {
      const mat = lineMat(0);
      const m = new LineLoop(unitRingGeo, mat);
      radar.add(m);
      return { m, mat, phase: i / 4 };
    });

    // Centre marker
    const centre = new LineLoop(unitRingGeo, lineMat(0.5));
    centre.scale.setScalar(5);
    radar.add(centre);

    // Blips
    const blipGeo = track(new PlaneGeometry(1, 1));
    const blips = Array.from({ length: BLIP_COUNT }, () => {
      const mat = track(new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
      const m = new Mesh(blipGeo, mat);
      m.rotation.z = Math.PI / 4;
      m.scale.setScalar(7);
      m.visible = false;
      radar.add(m);
      return { m, mat, angle: 0, placed: false };
    });

    // ── Layout ──────────────────────────────────────────────────────────────
    let w = 0;
    let h = 0;
    let active = false;
    let R = 1;

    type Box = { l: number; t: number; r: number; b: number };
    const rel = (el: Element | null, base: DOMRect, pad: number): Box | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { l: r.left - base.left - pad, t: r.top - base.top - pad, r: r.right - base.left + pad, b: r.bottom - base.top + pad };
    };

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.round(rect.width);
      h = Math.round(rect.height);
      active = w >= 200 && h >= 200;
      if (!active) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();

      // Centre on the section header (the title), measured from the DOM
      const headerBox = rel(section?.querySelector('.section-header') ?? null, rect, 0);
      const titleBox = rel(section?.querySelector('.section-title') ?? null, rect, 0);
      const cx = w / 2;
      const cy = titleBox ? (titleBox.t + titleBox.b) / 2 : headerBox ? (headerBox.t + headerBox.b) / 2 : 190;
      radar.position.set(cx - w / 2, h / 2 - cy, 0);

      R = clamp(w * 0.62, 420, 1000);
      rings.forEach((r) => r.m.scale.setScalar(R * r.f));
      cross.scale.set(R, R, 1);
      ticks.scale.set(R, R, 1);
      sweep.scale.set(R, R, 1);

      // Blips live in free space: not behind the header copy or the card grid
      const blocked: Box[] = [
        rel(section?.querySelector('.section-header') ?? null, rect, 14),
        rel(section?.querySelector('.work-grid') ?? null, rect, 10),
      ].filter((b): b is Box => !!b);
      const inBlocked = (x: number, y: number) =>
        blocked.some((b) => x > b.l && x < b.r && y > b.t && y < b.b);

      const rand = mulberry32(11);
      blips.forEach((b) => {
        b.placed = false;
        for (let tries = 0; tries < 60; tries++) {
          const a = rand() * TAU;
          const d = R * (0.16 + rand() * 0.82);
          const x = cx + Math.cos(a) * d;
          const y = cy - Math.sin(a) * d; // canvas y grows downward
          if (x < 12 || x > w - 12 || y < 12 || y > h - 12 || inBlocked(x, y)) continue;
          b.m.position.set(Math.cos(a) * d, Math.sin(a) * d, 0);
          b.angle = a;
          b.placed = true;
          break;
        }
        b.m.visible = b.placed;
      });
    }

    // ── Frame ───────────────────────────────────────────────────────────────
    function draw(t: number) {
      if (!active) return;

      // Sweep turns clockwise
      const lead = reduced ? -0.9 : -(t / SWEEP_MS) * TAU;
      sweep.rotation.z = lead;

      // Blips light as the leading edge passes, then fade as the trail moves on
      blips.forEach((b) => {
        if (!b.placed) return;
        const behind = (((lead - b.angle) % TAU) + TAU) % TAU; // radians since the arm passed
        b.mat.opacity = reduced ? 0.35 : clamp(Math.exp(-behind * 1.1), 0, 1) * 0.7;
      });

      // Pings
      pings.forEach((p) => {
        const k = reduced ? 0.2 + p.phase * 0.6 : (t / PING_MS + p.phase) % 1;
        p.m.scale.setScalar(Math.max(1, R * k));
        p.mat.opacity = Math.pow(1 - k, 1.5) * 0.3;
      });

      renderer.render(scene, camera);
    }

    // ── Loop control ────────────────────────────────────────────────────────
    let raf = 0;
    let visible = false;
    let running = false;

    function frame(t: number) {
      draw(t);
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (reduced || running || !visible || !active || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        visible ? start() : stop();
      },
      { rootMargin: '100px' },
    );
    io.observe(canvas);

    const ro = new ResizeObserver(() => {
      layout();
      if (!active) stop();
      else if (visible) start();
      if (reduced || !running) draw(0);
    });
    ro.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', onVisibility);

    layout();
    draw(0);

    // Fonts / images can shift the grid after first paint; re-measure once everything has loaded
    const onLoad = () => {
      layout();
      if (reduced || !running) draw(0);
    };
    window.addEventListener('load', onLoad);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('load', onLoad);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <FadeIn3D style={{ zIndex: 0 }}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          zIndex: 0,
          // Fade the scope out at the section's top and bottom edges
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 6%, #000 90%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 6%, #000 90%, transparent 100%)',
        }}
      />
    </FadeIn3D>
  );
}
