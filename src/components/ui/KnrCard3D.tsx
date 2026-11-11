'use client';
import { useEffect, useRef } from 'react';
import FadeIn3D from '../motion/FadeIn3D';
import {
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';

/**
 * KnrCard3D: the KNR NFC card floating above a round "stand" platform.
 * Black / white only. The card is a real extruded slab; its faces are painted
 * with canvas textures (same layout as NfcCard.astro). Tap rings pulse outward
 * from the platform. Pauses off-screen, static for reduced motion.
 *
 * On success it flags the parent with data-3d="on"; if WebGL is missing it sets
 * data-3d="off" so the page can show the plain HTML card instead.
 */

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Card: ISO ID-1 proportions
const CARD_W = 3.9;
const CARD_H = CARD_W / 1.586;
const CARD_T = 0.06;
const DECAL_GAP = 0.004; // decals sit this far off the slab; depth range is tight so it never fights

// Platform
const BASE_H = 0.3;
const MID_H = 0.14;
const TOP_Y = BASE_H + MID_H; // top surface of the platform
const CARD_Y = TOP_Y + 0.75 + CARD_H / 2; // card centre when floating

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

// ── Card faces (canvas) ────────────────────────────────────────────────────
const TEX_W = 1600;
const TEX_H = Math.round(TEX_W / 1.586);

function paintFace(canvas: HTMLCanvasElement, side: 'front' | 'back', heading: string, mono: string) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = TEX_W;
  const H = TEX_H;
  const u = W / 100; // 1cqw, like the HTML card
  const spacing = (px: number) => {
    // letterSpacing is not in every browser's canvas yet
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${px}px`;
  };

  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  spacing(0);

  // Charcoal body
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2d2d2d');
  g.addColorStop(0.52, '#191919');
  g.addColorStop(1, '#242424');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.85, H * 0.1, 0, W * 0.85, H * 0.1, W * 0.7);
  glow.addColorStop(0, 'rgba(255,255,255,0.08)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Large arc across the face
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(W * 0.645, -0.42 * H + W * 0.475, W * 0.475, 0, Math.PI * 2);
  ctx.stroke();

  const nfcIcon = (x: number, y: number, size: number, alpha: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 24, size / 24);
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(12, 12, 1.6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.stroke(new Path2D('M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49'));
    ctx.stroke(new Path2D('M19.07 4.93a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14'));
    ctx.restore();
  };

  if (side === 'front') {
    // Wordmark
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${8 * u}px ${heading}`;
    spacing(-0.05 * 8 * u);
    ctx.fillText('KNR', 7.5 * u, 11 * u);
    ctx.font = `600 ${2.4 * u}px ${mono}`;
    spacing(0.22 * 2.4 * u);
    ctx.fillText('COLLECTIVE', 7.5 * u, 11 * u + 8 * u * 0.9 + 0.6 * u);

    // NFC mark
    nfcIcon(W - 7 * u - 6.4 * u, 8.5 * u, 6.4 * u, 0.85);

    // Holder
    const tagSize = 2.3 * u;
    const nameSize = 3.7 * u;
    const bottom = H - 8 * u;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `400 ${tagSize}px ${mono}`;
    spacing(0.1 * tagSize);
    ctx.fillText('YOUR NEXT CONNECTION.', 7.5 * u, bottom - tagSize);
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${nameSize}px ${heading}`;
    spacing(0.05 * nameSize);
    ctx.fillText('YOUR NAME', 7.5 * u, bottom - tagSize - 0.9 * u - nameSize);

    // Seal
    const sx = W - 6 * u - 11 * u;
    const sy = H - 6.5 * u - 11 * u;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, 11 * u, 11 * u);
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${2.6 * u}px ${heading}`;
    spacing(0.04 * 2.6 * u);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KNR', sx + 5.5 * u + 0.02 * 2.6 * u, sy + 5.5 * u);
  } else {
    // Back: centred mark inside a hairline frame
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(4 * u, 4 * u, W - 8 * u, H - 8 * u);

    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${14 * u}px ${heading}`;
    spacing(-0.05 * 14 * u);
    ctx.fillText('KNR', W / 2, H * 0.44);
    ctx.font = `600 ${2.6 * u}px ${mono}`;
    spacing(0.22 * 2.6 * u);
    ctx.fillText('COLLECTIVE', W / 2 + 0.11 * 2.6 * u, H * 0.44 + 9.5 * u);
    nfcIcon(W / 2 - 3.2 * u, H - 15 * u, 6.4 * u, 0.5);
  }
}

export default function KnrCard3D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Astro wraps client islands in <astro-island>, so look up to the flagged stage
    const host = canvas.closest('[data-3d]');

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch {
      host?.setAttribute('data-3d', 'off');
      return;
    }
    renderer.setClearColor(0x000000, 0);
    host?.setAttribute('data-3d', 'on');

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const disposables: Array<{ dispose: () => void }> = [];
    const track = <T extends { dispose: () => void }>(o: T): T => {
      disposables.push(o);
      return o;
    };

    // ── Scene ───────────────────────────────────────────────────────────────
    const scene = new Scene();
    const camera = new PerspectiveCamera(30, 1, 2, 40);
    scene.add(new AmbientLight(0xffffff, 1.5));
    const sun = new DirectionalLight(0xffffff, 1.8);
    sun.position.set(-4, 9, 7);
    scene.add(sun);

    const edgeMat = (color: number, opacity: number) =>
      track(new LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));

    // ── Platform (the stand) ────────────────────────────────────────────────
    const stand = new Group();
    scene.add(stand);

    const base = new Mesh(
      track(new CylinderGeometry(2.5, 2.5, BASE_H, 72)),
      track(new MeshLambertMaterial({ color: 0x0b0b0b })),
    );
    base.position.y = BASE_H / 2;
    base.add(new LineSegments(track(new EdgesGeometry(base.geometry, 20)), edgeMat(0xffffff, 0.3)));

    const mid = new Mesh(
      track(new CylinderGeometry(2.1, 2.1, MID_H, 72)),
      track(new MeshLambertMaterial({ color: 0xf2f2f2 })),
    );
    mid.position.y = BASE_H + MID_H / 2;
    mid.add(new LineSegments(track(new EdgesGeometry(mid.geometry, 20)), edgeMat(0x000000, 0.7)));
    stand.add(base, mid);

    // Soft contact shadow under the card
    const sCanvas = document.createElement('canvas');
    sCanvas.width = sCanvas.height = 128;
    {
      const c = sCanvas.getContext('2d')!;
      const rg = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      rg.addColorStop(0, 'rgba(0,0,0,0.42)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg;
      c.fillRect(0, 0, 128, 128);
    }
    const shadowTex = track(new CanvasTexture(sCanvas));
    const shadow = new Mesh(
      track(new CircleGeometry(1, 48)),
      track(new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = TOP_Y + 0.012;
    shadow.scale.set(2.1, 0.8, 1);
    stand.add(shadow);

    // Tap rings: unit circles in the XZ plane, scaled outward and faded
    const ringGeo = (() => {
      const pts: number[] = [];
      for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        pts.push(Math.cos(a), 0, Math.sin(a));
      }
      const g = track(new BufferGeometry());
      g.setAttribute('position', new Float32BufferAttribute(pts, 3));
      return g;
    })();
    const RING_Y = TOP_Y + 0.025;
    const pulseRings = [0, 1, 2].map((i) => {
      const mat = edgeMat(0x000000, 0.5);
      const ring = new LineLoop(ringGeo, mat);
      ring.position.y = RING_Y;
      stand.add(ring);
      return { ring, mat, offset: i / 3 };
    });
    const restRing = new LineLoop(ringGeo, edgeMat(0x000000, 0.75));
    restRing.position.y = RING_Y;
    restRing.scale.set(0.85, 1, 0.85);
    stand.add(restRing);

    // ── Card ────────────────────────────────────────────────────────────────
    const card = new Group();
    scene.add(card);

    const shape = roundedRect(CARD_W, CARD_H, 0.13);
    const slabGeo = track(new ExtrudeGeometry(shape, { depth: CARD_T, bevelEnabled: false, curveSegments: 14 }));
    slabGeo.translate(0, 0, -CARD_T / 2);
    const slab = new Mesh(slabGeo, track(new MeshLambertMaterial({ color: 0x101010 })));
    slab.add(new LineSegments(track(new EdgesGeometry(slabGeo, 30)), edgeMat(0xffffff, 0.22)));
    card.add(slab);

    // Face decals: flat shapes with UVs mapped across the card
    const decalGeo = track(new ShapeGeometry(shape, 14));
    {
      const pos = decalGeo.getAttribute('position');
      const uv: number[] = [];
      for (let i = 0; i < pos.count; i++) uv.push(pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5);
      decalGeo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    }
    const heading =
      getComputedStyle(document.documentElement).getPropertyValue('--font-heading').trim() || 'sans-serif';
    const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-mono').trim() || 'monospace';

    const makeFace = (side: 'front' | 'back') => {
      const cv = document.createElement('canvas');
      cv.width = TEX_W;
      cv.height = TEX_H;
      paintFace(cv, side, heading, mono);
      const tex = track(new CanvasTexture(cv));
      tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      const mat = track(
        new MeshBasicMaterial({
          map: tex,
          toneMapped: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      const mesh = new Mesh(decalGeo, mat);
      return { mesh, cv, tex };
    };

    const front = makeFace('front');
    front.mesh.position.z = CARD_T / 2 + DECAL_GAP;
    const back = makeFace('back');
    back.mesh.rotation.y = Math.PI;
    back.mesh.position.z = -(CARD_T / 2 + DECAL_GAP);
    card.add(front.mesh, back.mesh);

    // Repaint once the webfonts are in
    let disposed = false;
    const repaint = () => {
      if (disposed) return;
      paintFace(front.cv, 'front', heading, mono);
      paintFace(back.cv, 'back', heading, mono);
      front.tex.needsUpdate = true;
      back.tex.needsUpdate = true;
      if (reduced || !running) draw(0);
    };
    Promise.all([
      document.fonts.load(`800 64px ${heading}`),
      document.fonts.load(`700 40px ${heading}`),
      document.fonts.load(`400 24px ${mono}`),
      document.fonts.load(`600 24px ${mono}`),
    ])
      .then(repaint)
      .catch(() => {});

    // ── Layout ──────────────────────────────────────────────────────────────
    const TARGET_Y = 1.55;
    const ELEV = (13 * Math.PI) / 180;

    function layout() {
      const rect = canvas!.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);

      camera.aspect = w / h;
      const t = Math.tan((camera.fov * Math.PI) / 360);
      // Fit the platform's width and the card + platform height
      const dW = 5.7 / (camera.aspect * 2 * t);
      const dH = 5.9 / (2 * t);
      const d = Math.max(dW, dH);
      camera.position.set(0, TARGET_Y + Math.sin(ELEV) * d, Math.cos(ELEV) * d);
      camera.lookAt(0, TARGET_Y, 0);
      camera.updateProjectionMatrix();
    }

    // ── Interaction ─────────────────────────────────────────────────────────
    let tx = 0;
    let ty = 0;
    let px = 0;
    let py = 0;

    const onPointer = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };

    function draw(t: number) {
      px = lerp(px, tx, 0.05);
      py = lerp(py, ty, 0.05);

      const bob = Math.sin(t * 0.0015);
      card.position.y = CARD_Y + 0.07 + bob * 0.07;
      card.rotation.y = -0.28 + Math.sin(t * 0.0006) * 0.3 + px * 0.45;
      card.rotation.x = py * 0.14;
      card.rotation.z = Math.sin(t * 0.0009) * 0.02;

      // Shadow tightens as the card rises
      const s = 1 - bob * 0.06;
      shadow.scale.set(2.1 * s, 0.8 * s, 1);

      pulseRings.forEach((p) => {
        const ph = reduced ? 0.25 + p.offset * 0.6 : (t / 3400 + p.offset) % 1;
        const r = lerp(0.95, 1.95, ph);
        p.ring.scale.set(r, 1, r);
        p.mat.opacity = (1 - ph) * 0.55;
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
    draw(0);

    if (!reduced) window.addEventListener('pointermove', onPointer, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
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
    <FadeIn3D interactive>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="KNR NFC business card floating above a platform"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          display: 'block',
          touchAction: 'pan-y',
        }}
      />
    </FadeIn3D>
  );
}
