'use client';
import { useEffect, useRef } from 'react';

const GRID_SIZE = 16;
const DOT_SIZE = 3;
const DOT_OPACITY = 0.3;
const ANIMATION_SPEED = 15; // Pixels per second
const MIN_MARGIN_WIDTH = 150; // Minimum margin width needed to show grids

export default function SideGrids() {
  const leftCanvasRef = useRef<HTMLCanvasElement>(null);
  const rightCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const leftCanvas = leftCanvasRef.current;
    const rightCanvas = rightCanvasRef.current;
    if (!leftCanvas || !rightCanvas) return;

    const leftCtx = leftCanvas.getContext('2d');
    const rightCtx = rightCanvas.getContext('2d');
    if (!leftCtx || !rightCtx) return;

    let animId = 0;
    let offset = 0;
    let shouldRender = false;
    let marginWidth = 0;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function calculateMargins() {
      // Find the main content container
      const container = document.querySelector('.section-container');
      if (!container) return 0;

      const containerRect = container.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      // Calculate available margin space on each side
      const leftMargin = containerRect.left;
      const rightMargin = viewportWidth - containerRect.right;
      
      return Math.min(leftMargin, rightMargin);
    }

    function checkViewportAndMargins() {
      marginWidth = calculateMargins();
      shouldRender = marginWidth >= MIN_MARGIN_WIDTH;
      
      // Hide/show canvases based on available margin space
      [leftCanvas, rightCanvas].forEach(canvas => {
        canvas.style.display = shouldRender ? 'block' : 'none';
      });
    }

    function resize() {
      if (!leftCanvas || !rightCanvas) return;
      
      checkViewportAndMargins();
      
      if (!shouldRender) return;
      
      // Use the available margin width (minus some padding)
      const gridWidth = Math.min(marginWidth - 20, 120);
      
      // Set canvas size
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = gridWidth * dpr;
      const height = window.innerHeight * dpr;
      
      [leftCanvas, rightCanvas].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = gridWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
      });

      // Position canvases in the margin areas
      const container = document.querySelector('.section-container');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        leftCanvas.style.left = '10px';
        rightCanvas.style.right = '10px';
      }
    }

    // Initial setup with a delay to ensure DOM is ready
    setTimeout(() => {
      resize();
    }, 100);
    
    window.addEventListener('resize', resize);

    function drawGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
      if (!shouldRender) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.scale(dpr, dpr);
      
      const gridWidth = parseFloat(canvas.style.width);
      const cols = Math.ceil(gridWidth / GRID_SIZE);
      const rows = Math.ceil(window.innerHeight / GRID_SIZE) + 2;
      
      ctx.fillStyle = `rgba(0, 0, 0, ${DOT_OPACITY})`;
      
      for (let row = -1; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * GRID_SIZE + GRID_SIZE / 2;
          const y = (row * GRID_SIZE + offset) % (window.innerHeight + GRID_SIZE);
          
          ctx.beginPath();
          ctx.arc(x, y, DOT_SIZE, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      ctx.resetTransform();
    }

    function animate(timestamp: number) {
      if (!shouldRender) {
        animId = requestAnimationFrame(animate);
        return;
      }
      
      if (!prefersReduced) {
        offset = (timestamp * ANIMATION_SPEED / 1000) % GRID_SIZE;
      }
      
      if (leftCtx && leftCanvas) drawGrid(leftCtx, leftCanvas);
      if (rightCtx && rightCanvas) drawGrid(rightCtx, rightCanvas);
      
      animId = requestAnimationFrame(animate);
    }

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <>
      <canvas
        ref={leftCanvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '10px',
          top: 0,
          zIndex: 1,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />
      <canvas
        ref={rightCanvasRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          right: '10px',
          top: 0,
          zIndex: 1,
          pointerEvents: 'none',
          mixBlendMode: 'multiply',
        }}
      />
    </>
  );
}