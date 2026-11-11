'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * Hero3D: monochrome 2.5D "vault" for the dark hero.
 *
 * Nested cubes (outer wireframe, smoked glass, bright core) turn at different
 * speeds while a translucent scan plane sweeps through them: security
 * auditing, drawn in black and white.
 *
 * Readability: the canvas is masked away from the copy column on desktop, and
 * is dimmed and centred behind the hero image on smaller screens. The scene
 * centres itself on the .hero-image element, wherever the layout puts it.
 *
 * Pauses off-screen / in hidden tabs; a single still frame for
 * prefers-reduced-motion; silent if WebGL is unavailable.
 */

const ISO_X = Math.atan(1 / Math.SQRT2);
const ISO_Y = Math.PI / 4;
const PPU = 40; // px per world unit (fixed; the hero group is scaled instead)
const EXTENT = 11; // world-unit width of the whole composition

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function Hero3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const host = canvas.closest<HTMLElement>('.hero');

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new Scene();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    camera.position.z = 50;
    scene.add(camera);

    scene.add(new AmbientLight(0xffffff, 1.2));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(-4, 9, 6);
    scene.add(sun);

    const heroAnchor = new Group();
    const ghostAnchor = new Group();
    camera.add(heroAnchor, ghostAnchor);
    heroAnchor.position.z = -20;
    ghostAnchor.position.z = -30;

    // ── Helpers (white lines on dark) ───────────────────────────────────────
    const line = (opacity: number, color = 0xffffff) =>
      track(new LineBasicMaterial({ color, transparent: true, opacity }));

    function boxWire(size: number, opacity: number) {
      const g = track(new BoxGeometry(size, size, size));
      return new LineSegments(track(new EdgesGeometry(g)), line(opacity));
    }

    function boxSolid(size: number, color: number, alpha: number, edgeColor: number, edgeOpacity: number) {
      const g = track(new BoxGeometry(size, size, size));
      const mat = track(
        new MeshLambertMaterial({
          color,
          transparent: alpha < 1,
          opacity: alpha,
          depthWrite: alpha >= 1,
          polygonOffset: true,
          polygonOffsetFactor: 1,
          polygonOffsetUnits: 1,
        }),
      );
      const m = new Mesh(g, mat);
      m.add(new LineSegments(track(new EdgesGeometry(g)), line(edgeOpacity, edgeColor)));
      return m;
    }

    function ring(radius: number, opacity: number) {
      const pts: number[] = [];
      for (let i = 0; i < 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      }
      const g = track(new BufferGeometry());
      g.setAttribute('position', new Float32BufferAttribute(pts, 3));
      return new LineLoop(g, line(opacity));
    }

    // ── Vault ───────────────────────────────────────────────────────────────
    const hero = new Group();
    heroAnchor.add(hero);
    hero.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');

    const vault = new Group();
    hero.add(vault);

    const outer = boxWire(5.2, 0.4);
    const mid = boxSolid(3.5, 0x1a1a1a, 0.6, 0xffffff, 0.55);
    const core = boxSolid(1.7, 0xf4f4f4, 1, 0x000000, 0.85);
    vault.add(outer, mid, core);

    // Scan plane sweeping through the vault
    const scanGeo = track(new PlaneGeometry(6.2, 6.2));
    const scan = new Mesh(
      scanGeo,
      track(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07, side: DoubleSide, depthWrite: false })),
    );
    scan.rotation.x = -Math.PI / 2;
    scan.add(new LineSegments(track(new EdgesGeometry(scanGeo)), line(0.6)));
    hero.add(scan);

    // Rings + orbiters
    const ringA = ring(4.3, 0.3);
    const ringB = ring(5.5, 0.16);
    hero.add(ringA, ringB);

    const orbiters = [
      { m: boxSolid(0.3, 0xf4f4f4, 1, 0x000000, 0.8), r: 4.3, speed: 0.00032, phase: 0 },
      { m: boxSolid(0.22, 0xf4f4f4, 1, 0x000000, 0.8), r: 5.5, speed: -0.00022, phase: 2.1 },
      { m: boxSolid(0.18, 0xf4f4f4, 1, 0x000000, 0.8), r: 4.3, speed: 0.00032, phase: 3.6 },
    ];
    orbiters.forEach((o) => hero.add(o.m));

    // Floor grid
    const grid = new GridHelper(18, 18, 0xffffff, 0xffffff);
    ((Array.isArray(grid.material) ? grid.material : [grid.material]) as Material[]).forEach((m) => {
      track(m);
      m.transparent = true;
      m.opacity = 0.1;
    });
    track(grid.geometry);
    grid.position.y = -3.4;
    hero.add(grid);

    // ── Ghost cubes (px sizes so they stay proportionate at any scale) ───────
    type Ghost = { m: LineSegments; fx: number; fy: number; px: number; depth: number; phase: number; spin: number };
    const ghostDefs: Array<[number, number, number, number, number]> = [
      // fx, fy, size(px), opacity, depth
      [0.56, 0.12, 54, 0.16, 0.9],
      [0.95, 0.3, 90, 0.12, 0.4],
      [0.62, 0.86, 120, 0.1, 0.2],
      [0.88, 0.9, 56, 0.16, 0.8],
      [0.42, 0.7, 44, 0.12, 0.6],
      [0.18, 0.88, 70, 0.1, 0.3],
    ];
    const ghosts: Ghost[] = ghostDefs.map(([fx, fy, px, op, depth], i) => {
      const m = boxWire(1, op);
      m.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');
      ghostAnchor.add(m);
      return { m, fx, fy, px, depth, phase: i * 1.4, spin: i % 2 ? 1 : -1 };
    });

    // ── Layout: centre on .hero-image, wherever the layout puts it ───────────
    let w = 1;
    let h = 1;

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);

      camera.left = -w / 2 / PPU;
      camera.right = w / 2 / PPU;
      camera.top = h / 2 / PPU;
      camera.bottom = -h / 2 / PPU;
      camera.updateProjectionMatrix();

      const desk = w >= 901;
      const imgEl = host?.querySelector<HTMLElement>('.hero-image') ?? null;
      const ir = imgEl && imgEl.offsetParent !== null ? imgEl.getBoundingClientRect() : null;

      let cx = w * 0.74;
      let cy = h * 0.5;
      let target = Math.min(w * 0.5, h * 0.9);
      if (ir && ir.width > 0) {
        cx = ir.left - rect.left + ir.width / 2;
        cy = ir.top - rect.top + ir.height / 2;
        target = ir.width * (desk ? 1.28 : 0.82);
      }

      hero.scale.setScalar(target / (EXTENT * PPU));
      heroAnchor.position.x = (cx - w / 2) / PPU;
      heroAnchor.position.y = (h / 2 - cy) / PPU;

      // Readability: keep the scene out from behind the copy
      const vertical = 'linear-gradient(to bottom, transparent 0, #000 12%, #000 84%, transparent 100%)';
      const horizontal = 'linear-gradient(to right, transparent 0%, transparent 36%, rgba(0,0,0,0.55) 50%, #000 64%)';
      const mask = desk ? `${horizontal}, ${vertical}` : vertical;
      const s = canvas!.style as CSSStyleDeclaration & Record<string, string>;
      s.maskImage = mask;
      s.webkitMaskImage = mask;
      s.maskComposite = 'intersect';
      s.webkitMaskComposite = 'source-in';
      canvas!.style.opacity = desk ? '1' : '0.7';

      ghosts.forEach((g) => {
        g.m.scale.setScalar(g.px / PPU);
        g.m.userData.bx = (g.fx * w - w / 2) / PPU;
        g.m.userData.by = (h / 2 - g.fy * h) / PPU;
        // On small screens keep ghosts below the copy only
        g.m.visible = desk ? true : g.fy > 0.62;
      });
    }

    // ── Interaction ─────────────────────────────────────────────────────────
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    let scrollSpin = 0;

    const onPointer = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    function onScroll() {
      scrollSpin = window.scrollY * 0.0022;
      if (reduced) draw(0);
    }

    function draw(t: number) {
      px = lerp(px, tx, 0.05);
      py = lerp(py, ty, 0.05);

      vault.rotation.y = t * 0.00022 + scrollSpin;
      mid.rotation.set(0, -t * 0.0004 - scrollSpin * 0.6, 0);
      core.rotation.set(t * 0.0003, t * 0.0007 + scrollSpin, 0);

      // Audit scan: smooth sweep up and down through the vault
      scan.position.y = Math.sin(t * 0.0007) * 2.7;
      (scan.material as MeshBasicMaterial).opacity = 0.05 + (1 - Math.abs(Math.sin(t * 0.0007))) * 0.05;

      ringA.rotation.y = t * 0.0001;
      ringB.rotation.y = -t * 0.00007;
      orbiters.forEach((o, i) => {
        const a = t * o.speed + o.phase;
        o.m.position.set(Math.cos(a) * o.r, Math.sin(t * 0.001 + i) * 0.25, Math.sin(a) * o.r);
        o.m.rotation.y = a;
      });

      hero.rotation.y = ISO_Y + px * 0.14;
      hero.rotation.x = ISO_X + py * 0.07;

      ghosts.forEach((g) => {
        const d = 0.4 + g.depth * 0.9;
        g.m.position.x = g.m.userData.bx - px * d * 0.9;
        g.m.position.y = g.m.userData.by + py * d * 0.6 + Math.sin(t * 0.0006 + g.phase) * 0.2;
        g.m.rotation.y = ISO_Y + t * 0.00009 * g.spin;
      });

      renderer.render(scene, camera);
    }

    // ── Loop control ────────────────────────────────────────────────────────
    let raf = 0;
    let visible = false;
    let running = false;

    const frame = (t: number) => {
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    const start = () => {
      if (reduced || running || !visible || document.hidden) return;
      running = true;
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries.some((e) => e.isIntersecting);
        visible ? start() : stop();
      },
      { rootMargin: '50px' },
    );
    io.observe(canvas);

    const relayout = () => {
      layout();
      if (reduced || !running) draw(0);
    };
    const ro = new ResizeObserver(relayout);
    ro.observe(canvas);
    const imgEl = host?.querySelector<HTMLElement>('.hero-image');
    if (imgEl) ro.observe(imgEl);

    // The hero copy/image fade in with a small translate; re-centre once settled.
    const settle = window.setTimeout(relayout, 900);

    const onVisibility = () => (document.hidden ? stop() : start());

    layout();
    onScroll();
    draw(0);

    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      window.clearTimeout(settle);
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
        }}
      />
    </FadeIn3D>
  );
}
