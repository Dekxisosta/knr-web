'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  EdgesGeometry,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Material,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Float32BufferAttribute,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * Process3D: a monochrome 2.5D composition for the "How we work" background.
 *
 * - Orthographic camera + isometric-rotated groups = flat, graphic depth.
 * - A stack of four exploded layers (one per process step) with pins, a ring and
 *   orbiting cubes, anchored top-right where the section header leaves space.
 * - Faint wireframe "ghost" cubes drift at different depths for parallax.
 * - Black / white only. Layers separate slightly as the section scrolls into view.
 * - Pauses off-screen / in hidden tabs; renders a single static frame for
 *   prefers-reduced-motion; fails silently if WebGL is unavailable.
 */

const ISO_X = Math.atan(1 / Math.SQRT2); // ≈ 35.264°
const ISO_Y = Math.PI / 4;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function edgeMat(color: number, opacity: number) {
  return new LineBasicMaterial({ color, transparent: true, opacity });
}

export default function Process3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL: the section simply renders without the background.
    }
    renderer.setClearColor(0x000000, 0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    // ── Scene, camera, light ────────────────────────────────────────────────
    const scene = new Scene();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    camera.position.z = 50;
    scene.add(camera);

    scene.add(new AmbientLight(0xffffff, 1.55));
    const sun = new DirectionalLight(0xffffff, 1.9);
    sun.position.set(-4, 9, 6);
    scene.add(sun);

    // Everything lives in a camera-space anchor so layout can be done in pixels.
    const heroAnchor = new Group();
    const ghostAnchor = new Group();
    camera.add(heroAnchor, ghostAnchor);
    heroAnchor.position.z = -20;
    ghostAnchor.position.z = -30;

    // ── Helpers ─────────────────────────────────────────────────────────────
    const boxGeos = new Map<string, BoxGeometry>();
    const edgeGeos = new Map<string, EdgesGeometry>();
    const geo = (w: number, h: number, d: number) => {
      const k = `${w}|${h}|${d}`;
      let g = boxGeos.get(k);
      if (!g) {
        g = track(new BoxGeometry(w, h, d));
        boxGeos.set(k, g);
        edgeGeos.set(k, track(new EdgesGeometry(g)));
      }
      return { box: g, edges: edgeGeos.get(k)! };
    };

    /** Solid block with a contrasting outline. tone: 'white' | 'black'. */
    function block(w: number, h: number, d: number, tone: 'white' | 'black', alpha = 1) {
      const g = geo(w, h, d);
      const fill = track(
        new MeshLambertMaterial({
          color: tone === 'white' ? 0xffffff : 0x0b0b0b,
          transparent: alpha < 1,
          opacity: alpha,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      const mesh = new Mesh(g.box, fill);
      const line = new LineSegments(g.edges, track(edgeMat(tone === 'white' ? 0x000000 : 0xffffff, tone === 'white' ? 0.7 : 0.35)));
      mesh.add(line);
      return mesh;
    }

    /** Edges only. */
    function ghost(size: number, opacity: number) {
      const g = geo(size, size, size);
      return new LineSegments(g.edges, track(edgeMat(0x000000, opacity)));
    }

    // ── Hero: exploded layer stack (one layer per process step) ──────────────
    const hero = new Group();
    heroAnchor.add(hero);
    hero.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');

    const stack = new Group();
    hero.add(stack);

    const SLAB = { sizes: [6.4, 5.4, 4.4, 3.4], t: 0.3 };
    const slabs: Mesh[] = SLAB.sizes.map((s, i) => {
      const m = block(s, SLAB.t, s, i % 2 === 0 ? 'white' : 'black', 0.96);
      stack.add(m);
      return m;
    });

    // Vertical pins linking the layers (corners of the smallest slab)
    const pinGeo = track(new BufferGeometry());
    const pinPos = new Float32Array(4 * 2 * 3);
    pinGeo.setAttribute('position', new Float32BufferAttribute(pinPos, 3));
    const pins = new LineSegments(pinGeo, track(edgeMat(0x000000, 0.3)));
    pins.frustumCulled = false;
    stack.add(pins);

    // Small "package" on top: the deliverable
    const pkg = block(0.9, 0.9, 0.9, 'black');
    stack.add(pkg);

    // Floor grid + ring, fixed under the stack
    const grid = new GridHelper(15, 15, 0x000000, 0x000000);
    const gridMats = (Array.isArray(grid.material) ? grid.material : [grid.material]) as Material[];
    gridMats.forEach((m) => {
      track(m);
      m.transparent = true;
      m.opacity = 0.13;
    });
    track(grid.geometry);
    grid.position.y = -1.2;
    hero.add(grid);

    const ringPts: number[] = [];
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      ringPts.push(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
    }
    const ringGeo = track(new BufferGeometry());
    ringGeo.setAttribute('position', new Float32BufferAttribute(ringPts, 3));
    const ring = new LineLoop(ringGeo, track(edgeMat(0x000000, 0.32)));
    hero.add(ring);

    // Orbiting cubes on the ring
    const orbiters = [
      { m: block(0.55, 0.55, 0.55, 'black'), phase: 0 },
      { m: block(0.4, 0.4, 0.4, 'white'), phase: (Math.PI * 2) / 3 },
      { m: block(0.3, 0.3, 0.3, 'black'), phase: (Math.PI * 4) / 3 },
    ];
    orbiters.forEach((o) => hero.add(o.m));

    // ── Ghost cubes: faint wireframes at varied depths (parallax) ────────────
    type Ghost = { m: LineSegments; fx: number; fy: number; depth: number; spin: number; phase: number };
    const ghostDefs: Array<[number, number, number, number, number]> = [
      // fx, fy (fraction of canvas, from top-left), size, opacity, depth(0..1)
      [0.08, 0.62, 2.6, 0.05, 0.3],
      [0.24, 0.86, 1.4, 0.08, 0.8],
      [0.42, 0.7, 2.0, 0.04, 0.2],
      [0.6, 0.92, 2.9, 0.04, 0.1],
      [0.78, 0.74, 1.2, 0.09, 1.0],
      [0.93, 0.56, 1.9, 0.05, 0.5],
      [0.05, 0.3, 1.1, 0.07, 0.9],
      [0.5, 0.45, 0.9, 0.05, 0.7],
    ];
    const ghosts: Ghost[] = ghostDefs.map(([fx, fy, size, op, depth], i) => {
      const m = ghost(size, op);
      m.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');
      ghostAnchor.add(m);
      return { m, fx, fy, depth, spin: (i % 2 ? 1 : -1) * (0.08 + depth * 0.1), phase: i * 1.3 };
    });

    // ── Layout (pixel-based) ────────────────────────────────────────────────
    let w = 1;
    let h = 1;
    let heroScale = 1;

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      const ppu = clamp(w / 36, 22, 42); // px per world unit
      camera.left = -w / 2 / ppu;
      camera.right = w / 2 / ppu;
      camera.top = h / 2 / ppu;
      camera.bottom = -h / 2 / ppu;
      camera.updateProjectionMatrix();

      // Hero sits top-right, in the space beside the section header.
      const big = w >= 1024;
      const mid = w >= 768;
      heroScale = big ? 1 : mid ? 0.82 : 0.5;
      const cxPx = big ? w - 300 : mid ? w - 210 : w - 64;
      const cyPx = big ? 210 : mid ? 190 : 120;
      heroAnchor.position.x = (cxPx - w / 2) / ppu;
      heroAnchor.position.y = (h / 2 - cyPx) / ppu;
      hero.scale.setScalar(heroScale);

      ghosts.forEach((g) => {
        g.m.userData.baseX = (g.fx * w - w / 2) / ppu;
        g.m.userData.baseY = (h / 2 - g.fy * h) / ppu;
        g.m.scale.setScalar(w < 768 ? 0.7 : 1);
      });
      // Hide the busiest ghosts on small screens
      ghosts.forEach((g, i) => (g.m.visible = w >= 768 || i % 2 === 0));
    }

    // ── Interaction state ───────────────────────────────────────────────────
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    let progress = 0.5;

    function onPointer(e: PointerEvent) {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    }

    function onScroll() {
      const r = canvas!.getBoundingClientRect();
      const vh = window.innerHeight;
      progress = clamp((vh - r.top) / (vh + r.height), 0, 1);
      if (reduced) draw(0);
    }

    // ── Frame ───────────────────────────────────────────────────────────────
    function draw(t: number) {
      px = lerp(px, tx, 0.05);
      py = lerp(py, ty, 0.05);

      // Layers separate as the section scrolls into view
      const gap = lerp(0.55, 1.25, progress);
      slabs.forEach((s, i) => {
        s.position.y = i * gap + Math.sin(t * 0.0009 + i * 0.9) * 0.08;
      });
      const topY = (slabs.length - 1) * gap;

      // Pins between the corners of the smallest layer
      const c = SLAB.sizes[3] / 2 - 0.02;
      const corners: Array<[number, number]> = [[-c, -c], [c, -c], [c, c], [-c, c]];
      corners.forEach(([x, z], i) => {
        pinPos.set([x, 0, z, x, topY, z], i * 6);
      });
      (pinGeo.getAttribute('position') as Float32BufferAttribute).needsUpdate = true;

      pkg.position.set(0, topY + 0.15 + 0.45 + 0.05 + (0.5 + 0.5 * Math.sin(t * 0.0014)) * 0.14, 0);
      pkg.rotation.y = t * 0.0004;

      ring.position.y = topY * 0.5;
      ring.rotation.y = t * 0.00012;
      orbiters.forEach((o, i) => {
        const a = t * 0.00028 * (i % 2 ? -1 : 1) + o.phase;
        o.m.position.set(Math.cos(a) * 5.2, topY * 0.5 + Math.sin(t * 0.001 + o.phase) * 0.35, Math.sin(a) * 5.2);
        o.m.rotation.y = a;
      });

      // Parallax (subtle, tilt only, so the composition stays graphic)
      hero.rotation.y = ISO_Y + px * 0.14;
      hero.rotation.x = ISO_X + py * 0.07;

      ghosts.forEach((g) => {
        const d = 0.4 + g.depth * 0.9;
        g.m.position.x = g.m.userData.baseX - px * d * 0.9;
        g.m.position.y = g.m.userData.baseY + py * d * 0.6 + Math.sin(t * 0.0006 + g.phase) * 0.18;
        g.m.rotation.y = ISO_Y + t * 0.0001 * g.spin * 10;
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
      if (reduced || running || !visible || document.hidden) return;
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
      if (reduced || !running) draw(0);
    });
    ro.observe(canvas);

    const onVisibility = () => (document.hidden ? stop() : start());

    layout();
    onScroll();
    draw(0);

    if (!reduced) {
      window.addEventListener('pointermove', onPointer, { passive: true });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
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
          // Soften the top/bottom edges so the scene melts into neighbouring sections
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 9%, #000 88%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 9%, #000 88%, transparent 100%)',
        }}
      />
    </FadeIn3D>
  );
}
