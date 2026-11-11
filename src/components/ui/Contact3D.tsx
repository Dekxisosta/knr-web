'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Material,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * Contact3D: two monochrome 2.5D pieces that sit in the side margins of the
 * "Get in touch" section, flanking the form / carousel.
 *
 * - Left: a stack of "message cards" that fan apart on scroll, with a small
 *   cube (the message) floating above and orbiting the stack.
 * - Right: a wireframe cube holding a solid core, with two tilted rings and
 *   orbiting cubes (the "signal").
 * - Wide screens: centred beside the form. Mid screens: tucked beside the header.
 *   Small screens: hidden (there is no free margin).
 * - Same rules as the other 3D pieces: black / white only, pauses off-screen and in
 *   hidden tabs, one static frame for prefers-reduced-motion, silent if no WebGL.
 */

const ISO_X = Math.atan(1 / Math.SQRT2);
const ISO_Y = Math.PI / 4;

const PPU = 26; // px per world unit
const OBJECT_PX = 156; // approx. width of one piece at scale 1
const CONTENT_W = 1100; // matches .contact-inner max-width
const HEADER_W = 720; // matches .section-header max-width

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function edgeMat(color: number, opacity: number) {
  return new LineBasicMaterial({ color, transparent: true, opacity });
}

export default function Contact3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL: the section simply renders without the side pieces.
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

    const leftAnchor = new Group();
    const rightAnchor = new Group();
    camera.add(leftAnchor, rightAnchor);
    leftAnchor.position.z = -20;
    rightAnchor.position.z = -20;

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
      mesh.add(
        new LineSegments(g.edges, track(edgeMat(tone === 'white' ? 0x000000 : 0xffffff, tone === 'white' ? 0.7 : 0.35))),
      );
      return mesh;
    }

    function wire(size: number, opacity: number) {
      const g = geo(size, size, size);
      return new LineSegments(g.edges, track(edgeMat(0x000000, opacity)));
    }

    function ring(radius: number, opacity: number) {
      const pts: number[] = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      }
      const g = track(new BufferGeometry());
      g.setAttribute('position', new Float32BufferAttribute(pts, 3));
      return new LineLoop(g, track(edgeMat(0x000000, opacity)));
    }

    function floorGrid(size: number, opacity: number) {
      const grid = new GridHelper(size, size, 0x000000, 0x000000);
      const mats = (Array.isArray(grid.material) ? grid.material : [grid.material]) as Material[];
      mats.forEach((m) => {
        track(m);
        m.transparent = true;
        m.opacity = opacity;
      });
      track(grid.geometry);
      return grid;
    }

    // ── Left: message cards ─────────────────────────────────────────────────
    const leftHero = new Group();
    leftAnchor.add(leftHero);
    leftHero.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');

    const cardSizes: Array<[number, number]> = [
      [5.2, 3.6],
      [4.7, 3.3],
      [4.2, 3.0],
    ];
    const cards: Mesh[] = cardSizes.map(([cw, cd], i) => {
      const m = block(cw, 0.22, cd, i % 2 === 0 ? 'white' : 'black', 0.97);
      leftHero.add(m);
      return m;
    });

    const message = block(0.8, 0.8, 0.8, 'black');
    leftHero.add(message);

    const leftGrid = floorGrid(10, 0.13);
    leftGrid.position.y = -1.3;
    leftHero.add(leftGrid);

    const leftRing = ring(4.4, 0.3);
    leftHero.add(leftRing);
    const leftOrbiter = block(0.42, 0.42, 0.42, 'white');
    leftHero.add(leftOrbiter);

    // ── Right: signal cube ──────────────────────────────────────────────────
    const rightHero = new Group();
    rightAnchor.add(rightHero);
    rightHero.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');

    const shell = wire(4.4, 0.55);
    rightHero.add(shell);
    const shellFill = block(4.4, 4.4, 4.4, 'white', 0.08);
    // Faint fill only: strip the edge child so the shell stays a single set of lines
    shellFill.clear();
    rightHero.add(shellFill);

    const core = block(1.7, 1.7, 1.7, 'black');
    rightHero.add(core);

    const ringA = ring(3.7, 0.32);
    const ringB = ring(3.1, 0.22);
    ringB.rotation.z = Math.PI / 2;
    rightHero.add(ringA, ringB);

    const rightOrbiters = [
      { m: block(0.5, 0.5, 0.5, 'black'), phase: 0 },
      { m: block(0.36, 0.36, 0.36, 'white'), phase: Math.PI },
    ];
    rightOrbiters.forEach((o) => rightHero.add(o.m));

    const rightGrid = floorGrid(10, 0.13);
    rightGrid.position.y = -3.4;
    rightHero.add(rightGrid);

    // ── Ghost cubes (faint depth cues in the margins) ───────────────────────
    type Ghost = { m: LineSegments; side: -1 | 1; dy: number; depth: number; phase: number; size: number };
    const ghostDefs: Array<[-1 | 1, number, number, number, number]> = [
      // side, dy (px from anchor), size, opacity, depth
      [-1, -230, 1.4, 0.08, 0.9],
      [-1, 210, 2.2, 0.05, 0.3],
      [1, -250, 1.9, 0.05, 0.4],
      [1, 235, 1.2, 0.09, 1.0],
    ];
    const ghostAnchor = new Group();
    camera.add(ghostAnchor);
    ghostAnchor.position.z = -30;
    const ghosts: Ghost[] = ghostDefs.map(([side, dy, size, op, depth], i) => {
      const m = wire(size, op);
      m.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');
      ghostAnchor.add(m);
      return { m, side, dy, depth, phase: i * 1.7, size };
    });

    // ── Layout (pixel-based) ────────────────────────────────────────────────
    let w = 1;
    let h = 1;
    let active = false;

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);

      camera.left = -w / 2 / PPU;
      camera.right = w / 2 / PPU;
      camera.top = h / 2 / PPU;
      camera.bottom = -h / 2 / PPU;
      camera.updateProjectionMatrix();

      // Wide: margins either side of the form. Mid: margins either side of the header.
      const wide = w >= CONTENT_W + 2 * 98;
      const margin = ((wide ? w - CONTENT_W : w - HEADER_W) / 2);
      const scale = clamp((margin - 16) / OBJECT_PX, 0, 1.15);
      active = (wide || w >= 900) && scale >= 0.45;

      leftAnchor.visible = rightAnchor.visible = ghostAnchor.visible = active;
      if (!active) return;

      const cy = wide ? h * 0.5 : w >= 1024 ? 165 : 150;
      const cxL = margin / 2;
      const cxR = w - margin / 2;
      const toX = (px: number) => (px - w / 2) / PPU;
      const toY = (py: number) => (h / 2 - py) / PPU;

      leftAnchor.position.set(toX(cxL), toY(cy), -20);
      rightAnchor.position.set(toX(cxR), toY(cy), -20);
      leftHero.scale.setScalar(scale);
      rightHero.scale.setScalar(scale);

      ghosts.forEach((g) => {
        const cx = g.side < 0 ? cxL : cxR;
        g.m.userData.baseX = toX(cx + g.side * margin * 0.08);
        g.m.userData.baseY = toY(cy + g.dy * (wide ? 1 : 0.55));
        g.m.scale.setScalar(scale);
        g.m.visible = wide || g.depth > 0.5;
      });
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
      if ((reduced || !running) && active) draw(0);
    }

    // ── Frame ───────────────────────────────────────────────────────────────
    function draw(t: number) {
      if (!active) {
        renderer.clear();
        return;
      }
      px = lerp(px, tx, 0.05);
      py = lerp(py, ty, 0.05);

      // Left: cards fan apart as the section scrolls in
      const gap = lerp(0.35, 1.0, progress);
      cards.forEach((c, i) => {
        c.position.set((i - 1) * 0.28, i * gap + Math.sin(t * 0.0009 + i * 0.9) * 0.07, (1 - i) * 0.22);
      });
      const topY = (cards.length - 1) * gap;
      message.position.set(0, topY + 0.9 + (0.5 + 0.5 * Math.sin(t * 0.0014)) * 0.25, 0);
      message.rotation.y = t * 0.0005;
      leftRing.position.y = topY * 0.5;
      leftRing.rotation.y = t * 0.00014;
      {
        const a = t * 0.0003;
        leftOrbiter.position.set(Math.cos(a) * 4.4, topY * 0.5 + Math.sin(t * 0.001) * 0.3, Math.sin(a) * 4.4);
        leftOrbiter.rotation.y = a;
      }

      // Right: shell + core counter-rotate, rings tumble
      shell.rotation.y = t * 0.00022;
      shellFill.rotation.y = shell.rotation.y;
      core.rotation.set(t * 0.0003, -t * 0.00045, 0);
      core.position.y = Math.sin(t * 0.0011) * 0.12;
      ringA.rotation.set(0, t * 0.0002, Math.sin(t * 0.0004) * 0.15);
      ringB.rotation.set(t * 0.00026, 0, Math.PI / 2);
      rightOrbiters.forEach((o, i) => {
        const a = t * 0.00032 * (i ? -1 : 1) + o.phase;
        o.m.position.set(Math.cos(a) * 3.7, Math.sin(t * 0.0009 + o.phase) * 0.5, Math.sin(a) * 3.7);
        o.m.rotation.y = a;
      });

      // Pointer parallax (tilt only, so the pieces stay graphic)
      leftHero.rotation.y = ISO_Y + px * 0.14;
      leftHero.rotation.x = ISO_X + py * 0.07;
      rightHero.rotation.y = ISO_Y - px * 0.14;
      rightHero.rotation.x = ISO_X + py * 0.07;

      ghosts.forEach((g) => {
        const d = 0.4 + g.depth * 0.9;
        g.m.position.x = g.m.userData.baseX - px * d * 0.9;
        g.m.position.y = g.m.userData.baseY + py * d * 0.6 + Math.sin(t * 0.0006 + g.phase) * 0.18;
        g.m.rotation.y = ISO_Y + t * 0.0001 * (g.side * 10) * (0.08 + g.depth * 0.1);
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
          // Soften the top/bottom edges so the pieces melt into neighbouring sections
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 6%, #000 92%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 6%, #000 92%, transparent 100%)',
        }}
      />
    </FadeIn3D>
  );
}
