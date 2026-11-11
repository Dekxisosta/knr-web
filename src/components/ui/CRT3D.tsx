'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OrthographicCamera,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';

/**
 * CRT3D: a floating CRT monitor for the FAQ section (replaces the head-and-chips drawing).
 *
 * - Chunky monochrome 2.5D model: bezel housing, tapered tube, tilt-swivel stand, and a
 *   gently bulging glass screen that "types" a short audit log with a blinking cursor.
 * - Floats and sways on a slow loop, leans toward the pointer, a thin ring "shadow" below
 *   breathes with the float, and a few small wire cubes drift around it.
 * - Line colour follows the container's CSS `color`, so it matches the rest of the page.
 * - Same rules as the other 3D pieces: pauses off-screen and in hidden tabs, one static
 *   frame for prefers-reduced-motion, silent if there is no WebGL.
 */

const TAU = Math.PI * 2;
const BASE_Y = -0.5; // resting yaw of the whole piece
const TILT_X = 0.2; // looking slightly down on it

const LINES = [
  '$ knr audit --deep',
  '> scanning dependencies...',
  '> 0 critical · 0 high',
  '> headers hardened',
  '> secrets: none exposed',
  '[ok] audit complete',
];
const TOTAL_CHARS = LINES.reduce((n, l) => n + l.length, 0);
const TYPE_STEP_MS = 55;
const HOLD_MS = 2600;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function CRT3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      return; // No WebGL: the section simply renders without the monitor.
    }
    renderer.setClearColor(0x000000, 0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ink = new Color(0xffffff);
    try {
      ink.set(getComputedStyle(canvas).color);
    } catch {
      /* keep white */
    }

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };
    const edgeMat = (opacity: number) =>
      track(new LineBasicMaterial({ color: ink, transparent: true, opacity }));

    // ── Scene, camera, light ────────────────────────────────────────────────
    const scene = new Scene();
    const camera = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    camera.position.z = 30;
    scene.add(new AmbientLight(0xffffff, 1.5));
    const sun = new DirectionalLight(0xffffff, 1.8);
    sun.position.set(-5, 9, 8);
    scene.add(sun);

    const world = new Group();
    world.rotation.x = TILT_X;
    scene.add(world);
    const floater = new Group(); // the monitor; this is what bobs
    world.add(floater);

    // ── Helpers ─────────────────────────────────────────────────────────────
    function solid(g: BufferGeometry, color: number, edge = 0.55) {
      const fill = track(
        new MeshLambertMaterial({ color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      );
      const mesh = new Mesh(g, fill);
      mesh.add(new LineSegments(track(new EdgesGeometry(g)), edgeMat(edge)));
      return mesh;
    }
    function box(w: number, h: number, d: number, color: number, edge?: number) {
      return solid(track(new BoxGeometry(w, h, d)), color, edge);
    }

    // ── Monitor ─────────────────────────────────────────────────────────────
    const W = 6.4;
    const H = 5.0;
    const D = 1.4;

    // Front housing (bezel)
    floater.add(box(W, H, D, 0x2b2b2b, 0.7));

    // Tapered tube behind it: a 4-sided frustum, axis pointing back
    const tubeGeo = track(new CylinderGeometry(2.0, 3.7, 3.2, 4, 1));
    tubeGeo.rotateY(Math.PI / 4); // edges axis-aligned
    const tube = solid(tubeGeo, 0x1c1c1c, 0.5);
    tube.rotation.x = -Math.PI / 2; // small end towards -z
    tube.scale.set(1.12, 1, 0.9);
    tube.position.z = -D / 2 - 1.6 + 0.02;
    floater.add(tube);

    // Recessed screen frame and bulging glass
    const screenFrame = box(5.3, 4.0, 0.12, 0x050505, 0.35);
    screenFrame.position.set(0, 0.28, D / 2 - 0.02);
    floater.add(screenFrame);

    const SW = 4.9;
    const SH = 3.65;
    const glassGeo = track(new PlaneGeometry(SW, SH, 18, 14));
    {
      const pos = glassGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i) / (SW / 2);
        const ny = pos.getY(i) / (SH / 2);
        pos.setZ(i, 0.16 * (1 - (nx * nx + ny * ny) / 2));
      }
      glassGeo.computeVertexNormals();
    }

    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 360;
    screenCanvas.height = 268;
    const sctx = screenCanvas.getContext('2d');
    const screenTex = track(new CanvasTexture(screenCanvas));
    screenTex.colorSpace = SRGBColorSpace;
    const glass = new Mesh(glassGeo, track(new MeshBasicMaterial({ map: screenTex })));
    glass.position.set(0, 0.28, D / 2 + 0.06);
    floater.add(glass);

    let lastShown = -2;
    let lastBlink = -1;
    function drawScreen(chars: number, blink: boolean) {
      if (!sctx) return;
      const { width: w, height: h } = screenCanvas;
      sctx.fillStyle = '#060606';
      sctx.fillRect(0, 0, w, h);

      sctx.font = '15px "JetBrains Mono", Consolas, "Courier New", monospace';
      sctx.textBaseline = 'top';
      let left = chars;
      let y = 22;
      let cursorX = 22;
      let cursorY = y;
      for (let i = 0; i < LINES.length && left >= 0; i++) {
        const line = LINES[i];
        const shown = line.slice(0, Math.max(0, left));
        sctx.fillStyle = i === 0 ? '#ffffff' : i === LINES.length - 1 ? '#ffffff' : 'rgba(255,255,255,0.72)';
        sctx.fillText(shown, 22, y);
        cursorX = 22 + sctx.measureText(shown).width;
        cursorY = y;
        left -= line.length;
        y += 28;
      }
      if (blink) {
        sctx.fillStyle = '#ffffff';
        sctx.fillRect(cursorX + 3, cursorY + 1, 9, 16);
      }

      // Scanlines, vignette, and a faint glow
      sctx.fillStyle = 'rgba(0,0,0,0.28)';
      for (let yy = 0; yy < h; yy += 3) sctx.fillRect(0, yy, w, 1);
      const vg = sctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.65)');
      sctx.fillStyle = vg;
      sctx.fillRect(0, 0, w, h);

      screenTex.needsUpdate = true;
    }

    // Bezel details: two knobs, a power button and an LED along the bottom strip
    const knobY = -2.1;
    [1.55, 2.0].forEach((x) => {
      const k = box(0.3, 0.3, 0.14, 0x3a3a3a, 0.8);
      k.position.set(x, knobY, D / 2 + 0.05);
      floater.add(k);
    });
    const power = box(0.42, 0.2, 0.12, 0xffffff, 0.2);
    power.position.set(2.62, knobY, D / 2 + 0.05);
    floater.add(power);
    const ledMat = track(new MeshBasicMaterial({ color: 0xffffff }));
    const led = new Mesh(track(new BoxGeometry(0.1, 0.1, 0.06)), ledMat);
    led.position.set(-2.55, knobY, D / 2 + 0.04);
    floater.add(led);

    // Vent slots on the top of the tube
    {
      const pts: number[] = [];
      for (let i = 0; i < 7; i++) {
        const z = -0.2 - i * 0.28;
        pts.push(-1.2, H / 2 + 0.005, z, 1.2, H / 2 + 0.005, z);
      }
      const g = track(new BufferGeometry());
      g.setAttribute('position', new Float32BufferAttribute(pts, 3));
      // sits on top of the housing/tube junction
      const vents = new LineSegments(g, edgeMat(0.35));
      vents.position.y = 0;
      floater.add(vents);
    }

    // Tilt-swivel stand
    const neck = box(2.4, 0.4, 2.6, 0x232323, 0.6);
    neck.position.set(0, -H / 2 - 0.2, -0.5);
    floater.add(neck);
    const foot = box(4.4, 0.22, 4.6, 0x2b2b2b, 0.65);
    foot.position.set(0, -H / 2 - 0.5, -0.7);
    floater.add(foot);

    // ── Ground rings (breathe with the float) ───────────────────────────────
    const ringGeo = track(new BufferGeometry());
    {
      const pts: number[] = [];
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * TAU;
        pts.push(Math.cos(a), 0, Math.sin(a));
      }
      ringGeo.setAttribute('position', new Float32BufferAttribute(pts, 3));
    }
    const ringGroup = new Group();
    ringGroup.position.y = -5.1;
    world.add(ringGroup);
    const rings = [
      { r: 4.6, op: 0.32, m: new LineLoop(ringGeo, edgeMat(0.32)) },
      { r: 6.2, op: 0.16, m: new LineLoop(ringGeo, edgeMat(0.16)) },
      { r: 7.8, op: 0.08, m: new LineLoop(ringGeo, edgeMat(0.08)) },
    ];
    rings.forEach((r) => {
      r.m.scale.setScalar(r.r);
      ringGroup.add(r.m);
    });

    // Small wire cubes drifting around the piece
    const cubeGeo = track(new BoxGeometry(0.55, 0.55, 0.55));
    const cubeEdges = track(new EdgesGeometry(cubeGeo));
    const drifters = [
      { phase: 0.0, radius: 6.4, y: 1.8, speed: 0.00022, op: 0.55, s: 1 },
      { phase: 2.2, radius: 7.0, y: -1.2, speed: 0.00017, op: 0.4, s: 0.8 },
      { phase: 4.1, radius: 6.0, y: 3.2, speed: 0.00027, op: 0.3, s: 0.6 },
    ].map((d) => {
      const m = new LineSegments(cubeEdges, edgeMat(d.op));
      m.scale.setScalar(d.s);
      world.add(m);
      return { ...d, m };
    });

    // ── Layout ──────────────────────────────────────────────────────────────
    let w = 0;
    let h = 0;
    let active = false;

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      w = Math.round(rect.width);
      h = Math.round(rect.height);
      active = w >= 100 && h >= 100;
      if (!active) return;

      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);

      const ppu = Math.min(w, h) / 14; // whole piece fits with margin
      camera.left = -w / 2 / ppu;
      camera.right = w / 2 / ppu;
      camera.top = h / 2 / ppu;
      camera.bottom = -h / 2 / ppu;
      camera.updateProjectionMatrix();

      // Centre the visual mass (monitor above, rings below)
      world.position.y = 0.9;
    }

    // ── Pointer ─────────────────────────────────────────────────────────────
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;
    const onPointer = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // ── Frame ───────────────────────────────────────────────────────────────
    function draw(t: number) {
      if (!active) return;

      px = lerp(px, tx, 0.06);
      py = lerp(py, ty, 0.06);

      const bob = reduced ? 0 : Math.sin(t * 0.0012);
      floater.position.y = bob * 0.4;
      floater.rotation.z = reduced ? 0 : Math.sin(t * 0.0008) * 0.025;
      world.rotation.y = BASE_Y + (reduced ? 0 : Math.sin(t * 0.0004) * 0.16 + px * 0.28);
      world.rotation.x = TILT_X + py * 0.07;

      // Rings contract a touch as the monitor rises
      const k = 1 - bob * 0.04;
      rings.forEach((r, i) => {
        r.m.scale.setScalar(r.r * k * (1 + i * 0.0));
      });

      drifters.forEach((d) => {
        const a = d.phase + t * d.speed;
        d.m.position.set(Math.cos(a) * d.radius, d.y + Math.sin(t * 0.0009 + d.phase) * 0.3, Math.sin(a) * d.radius);
        d.m.rotation.x = t * 0.0004 + d.phase;
        d.m.rotation.y = t * 0.0006;
      });

      // Screen text: type out, hold, restart. Cursor blinks.
      let chars = TOTAL_CHARS;
      if (!reduced) {
        const cycle = TOTAL_CHARS * TYPE_STEP_MS + HOLD_MS;
        const phase = t % cycle;
        chars = Math.min(TOTAL_CHARS, Math.floor(phase / TYPE_STEP_MS));
      }
      const blink = reduced ? true : Math.floor(t / 450) % 2 === 0;
      const blinkKey = blink ? 1 : 0;
      if (chars !== lastShown || blinkKey !== lastBlink) {
        lastShown = chars;
        lastBlink = blinkKey;
        drawScreen(chars, blink);
      }
      ledMat.color.setScalar(reduced ? 1 : 0.7 + 0.3 * (Math.sin(t * 0.004) * 0.5 + 0.5));

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
    draw(0);

    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVisibility);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
    };
  }, []);

  return (
    <FadeIn3D>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A CRT monitor floating above a ring, typing out a security audit log"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          pointerEvents: 'none',
          color: '#ffffff',
        }}
      />
    </FadeIn3D>
  );
}
