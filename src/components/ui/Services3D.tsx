'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  OrthographicCamera,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * Services3D: monochrome 2.5D background for the "What we do" section.
 *
 * Six objects on a floating isometric platform, one per service:
 *   Websites (browser panel) · Full-stack (layer stack) · Mobile (phone)
 *   Maintenance (gear) · AI (faceted core) · NFC cards (card over a tap ring)
 *
 * Orthographic camera + isometric-rotated group = flat, graphic depth.
 * Black / white only. Pauses off-screen, static for reduced motion,
 * silent if WebGL is unavailable.
 */

const ISO_X = Math.atan(1 / Math.SQRT2);
const ISO_Y = Math.PI / 4;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function Services3D() {
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

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new Scene();
    // Tight near/far around the scene (hero ~20 units out, ghosts ~30). The old 0.1..200
    // range wasted depth precision and let near-coplanar faces fight.
    const camera = new OrthographicCamera(-10, 10, 10, -10, 8, 48);
    camera.position.z = 50;
    scene.add(camera);

    scene.add(new AmbientLight(0xffffff, 1.55));
    const sun = new DirectionalLight(0xffffff, 1.9);
    sun.position.set(-4, 9, 6);
    scene.add(sun);

    const heroAnchor = new Group();
    const ghostAnchor = new Group();
    camera.add(heroAnchor, ghostAnchor);
    heroAnchor.position.z = -20;
    ghostAnchor.position.z = -30;

    // ── Helpers ─────────────────────────────────────────────────────────────
    const lineMat = (color: number, opacity: number) =>
      track(new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));

    function solid(g: BufferGeometry, tone: 'white' | 'black', alpha = 1, angle = 20) {
      track(g);
      const mesh = new Mesh(
        g,
        track(
          new MeshLambertMaterial({
            color: tone === 'white' ? 0xffffff : 0x0b0b0b,
            transparent: alpha < 1,
            opacity: alpha,
            // Push faces back a hair so outline lines never fight the faces
            polygonOffset: true,
            polygonOffsetFactor: 2,
            polygonOffsetUnits: 2,
          }),
        ),
      );
      const eg = track(new EdgesGeometry(g, angle));
      mesh.add(new LineSegments(eg, lineMat(tone === 'white' ? 0x000000 : 0xffffff, tone === 'white' ? 0.7 : 0.35)));
      return mesh;
    }

    const block = (w: number, h: number, d: number, tone: 'white' | 'black', alpha = 1) =>
      solid(new BoxGeometry(w, h, d), tone, alpha);

    function wire(g: BufferGeometry, opacity: number) {
      track(g);
      return new LineSegments(track(new EdgesGeometry(g, 20)), lineMat(0x000000, opacity));
    }

    // ── Hero: isometric platform with six service objects ───────────────────
    const hero = new Group();
    heroAnchor.add(hero);
    hero.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');

    // Opaque on purpose: transparent meshes are depth-sorted per object and flicker.
    // The base sits clearly below the tiles (no shared coplanar faces).
    const base = block(6.3, 0.2, 4.3, 'black');
    base.position.y = -0.3;
    hero.add(base);

    // Tile top is y = 0.07; objects rest well above it so bottoms never share its plane.
    const TILE_Y = 0.12;
    const xs = [-2, 0, 2];
    const zs = [-1, 1];
    zs.forEach((z) =>
      xs.forEach((x) => {
        const tile = block(1.9, 0.14, 1.9, 'white');
        tile.position.set(x, 0, z);
        hero.add(tile);
      }),
    );

    // Each object sits in its own group so it can float independently.
    const floaters: Array<{ g: Group; baseY: number; phase: number; amp: number }> = [];
    function place(x: number, z: number, amp = 0.06) {
      const g = new Group();
      g.position.set(x, TILE_Y, z);
      hero.add(g);
      floaters.push({ g, baseY: TILE_Y, phase: floaters.length * 1.1, amp });
      return g;
    }

    // 1 · Websites: browser panel with a title bar
    {
      const g = place(-2, -1, 0.04);
      const panel = block(1.7, 1.1, 0.1, 'white'); // top (1.1) sits inside the title bar (0.96–1.2)
      panel.position.y = 0.55;
      const bar = block(1.74, 0.24, 0.14, 'black'); // wider/deeper than the panel: no shared side faces
      bar.position.set(0, 1.08, 0.02);
      g.add(panel, bar);
      [-0.66, -0.46, -0.26].forEach((dx) => {
        const dot = block(0.1, 0.1, 0.18, 'white');
        dot.position.set(dx, 1.08, 0.03);
        g.add(dot);
      });
      const line1 = block(1.1, 0.07, 0.14, 'black');
      line1.position.set(-0.2, 0.7, 0.02);
      const line2 = block(0.7, 0.07, 0.14, 'black');
      line2.position.set(-0.4, 0.5, 0.02);
      g.add(line1, line2);
      g.rotation.y = 0.12;
    }

    // 2 · Full-stack: stack of layers
    {
      const g = place(0, -1, 0.05);
      const tones: Array<'white' | 'black'> = ['white', 'black', 'white'];
      tones.forEach((t, i) => {
        const s = block(1.6, 0.2, 1.6, t);
        s.position.y = 0.12 + i * 0.4;
        g.add(s);
      });
    }

    // 3 · Mobile: phone
    {
      const g = place(2, -1, 0.05);
      const phone = block(0.85, 1.65, 0.13, 'black');
      phone.position.y = 0.85;
      const screen = block(0.7, 1.3, 0.18, 'white'); // 0.025 proud of the body on each side
      screen.position.set(0, 0.9, 0.0);
      g.add(phone, screen);
      g.rotation.y = 0.3;
    }

    // 4 · Maintenance: gear
    const gear = new Group();
    {
      const g = place(-2, 1, 0.03);
      const hub = solid(new CylinderGeometry(0.62, 0.62, 0.3, 12), 'white');
      gear.add(hub);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const tooth = block(0.26, 0.3, 0.26, 'black');
        tooth.position.set(Math.cos(a) * 0.76, 0, Math.sin(a) * 0.76);
        tooth.rotation.y = -a;
        gear.add(tooth);
      }
      const core = solid(new CylinderGeometry(0.22, 0.22, 0.34, 10), 'black');
      gear.add(core);
      gear.position.y = 0.26;
      g.add(gear);
    }

    // 5 · AI: faceted core inside a wireframe shell
    const core = solid(new IcosahedronGeometry(0.62, 0), 'black');
    const shell = wire(new IcosahedronGeometry(0.98, 0), 0.4);
    {
      const g = place(0, 1, 0.1);
      core.position.y = 1.05;
      shell.position.y = 1.05;
      g.add(core, shell);
    }

    // 6 · NFC cards: card hovering over a tap ring
    const nfcCard = block(1.7, 0.05, 1.1, 'black');
    {
      const g = place(2, 1, 0.05);
      nfcCard.position.y = 0.75;
      nfcCard.rotation.y = -0.35;
      g.add(nfcCard);
      const pts: number[] = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(Math.cos(a) * 0.82, 0.06, Math.sin(a) * 0.82);
      }
      const rg = track(new BufferGeometry());
      rg.setAttribute('position', new Float32BufferAttribute(pts, 3));
      g.add(new LineLoop(rg, lineMat(0x000000, 0.5)));
    }

    // ── Ghost cubes ─────────────────────────────────────────────────────────
    type Ghost = { m: LineSegments; fx: number; fy: number; depth: number; phase: number; spin: number };
    const ghostDefs: Array<[number, number, number, number, number]> = [
      [0.06, 0.28, 1.6, 0.14, 0.7],
      [0.2, 0.9, 2.4, 0.1, 0.2],
      [0.45, 0.62, 1.1, 0.14, 0.9],
      [0.62, 0.95, 2.0, 0.1, 0.3],
      [0.9, 0.72, 1.4, 0.16, 0.8],
    ];
    const ghosts: Ghost[] = ghostDefs.map(([fx, fy, size, op, depth], i) => {
      const m = wire(new BoxGeometry(size, size, size), op);
      m.rotation.set(ISO_X, ISO_Y, 0, 'YXZ');
      ghostAnchor.add(m);
      return { m, fx, fy, depth, phase: i * 1.7, spin: i % 2 ? 1 : -1 };
    });

    // ── Layout ──────────────────────────────────────────────────────────────
    let w = 1;
    let h = 1;

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);

      const ppu = clamp(w / 36, 22, 42);
      camera.left = -w / 2 / ppu;
      camera.right = w / 2 / ppu;
      camera.top = h / 2 / ppu;
      camera.bottom = -h / 2 / ppu;
      camera.updateProjectionMatrix();

      const big = w >= 1100;
      const mid = w >= 768;
      hero.scale.setScalar(big ? 1 : mid ? 0.78 : 0.5);
      const cx = big ? w - 280 : mid ? w - 190 : w - 60;
      const cy = big ? 215 : mid ? 175 : 120;
      heroAnchor.position.x = (cx - w / 2) / ppu;
      heroAnchor.position.y = (h / 2 - cy) / ppu;

      // Keep the scene from competing with text on narrower layouts
      canvas!.style.opacity = big ? '1' : mid ? '0.55' : '0.35';

      ghosts.forEach((g, i) => {
        g.m.userData.bx = (g.fx * w - w / 2) / ppu;
        g.m.userData.by = (h / 2 - g.fy * h) / ppu;
        g.m.visible = w >= 768 || i % 2 === 0;
      });
    }

    // ── Interaction ─────────────────────────────────────────────────────────
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    let progress = 0.5;

    const onPointer = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    function onScroll() {
      const r = canvas!.getBoundingClientRect();
      const vh = window.innerHeight;
      progress = clamp((vh - r.top) / (vh + r.height), 0, 1);
      if (reduced) draw(0);
    }

    function draw(t: number) {
      px = lerp(px, tx, 0.05);
      py = lerp(py, ty, 0.05);

      // Objects lift off the platform a little as the section scrolls in
      const lift = lerp(0, 0.28, progress);
      floaters.forEach((f) => {
        f.g.position.y = f.baseY + lift + (0.5 + 0.5 * Math.sin(t * 0.0012 + f.phase)) * f.amp * 2;
      });

      gear.rotation.y = t * 0.0006;
      core.rotation.set(t * 0.0005, t * 0.0008, 0);
      shell.rotation.set(-t * 0.0003, -t * 0.0005, 0);
      nfcCard.position.y = 0.75 + Math.sin(t * 0.0016) * 0.08;

      hero.rotation.y = ISO_Y + px * 0.14;
      hero.rotation.x = ISO_X + py * 0.07;

      ghosts.forEach((g) => {
        const d = 0.4 + g.depth * 0.9;
        g.m.position.x = g.m.userData.bx - px * d * 0.9;
        g.m.position.y = g.m.userData.by + py * d * 0.6 + Math.sin(t * 0.0006 + g.phase) * 0.18;
        g.m.rotation.y = ISO_Y + t * 0.0009 * g.spin * 0.1;
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

    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
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
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 8%, #000 90%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, transparent 0, #000 8%, #000 90%, transparent 100%)',
        }}
      />
    </FadeIn3D>
  );
}
