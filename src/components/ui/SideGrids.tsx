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
    let resizeTimeout: number;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function calculateMargins() {
      // Use ResizeObserver approach or simple viewport-based calculation to avoid forced reflows
      const viewportWidth = window.innerWidth;
      
      // Estimate container width based on common responsive design patterns
      // Most sites use max-width of 1200-1400px with some padding
      let containerWidth = viewportWidth;
      if (viewportWidth >= 1200) {
        containerWidth = Math.min(1200, viewportWidth * 0.9); // Assume 90% max-width with padding
      }
      
      // Calculate available margin space on each side
      const availableMargin = (viewportWidth - containerWidth) / 2;
      
      return Math.max(0, availableMargin);
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
      
      // Debounce resize to prevent excessive calculations
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        checkViewportAndMargins();
        
        if (!shouldRender) return;
        
        // Use the available margin width (minus some padding)
        const gridWidth = Math.min(marginWidth - 20, 120);
        
        // Use requestAnimationFrame to batch DOM updates
        requestAnimationFrame(() => {
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
        });
      }, 100);
    }

    // Initial setup with a delay to ensure DOM is ready
    setTimeout(() => {
      resize();
    }, 100);
    
    window.addEventListener('resize', resize, { passive: true });

    function drawGrid(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
      if (!shouldRender) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.scale(dpr, dpr);
      
      const gridWidth = parseFloat(canvas.style.width) || 120;
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
      clearTimeout(resizeTimeout);
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