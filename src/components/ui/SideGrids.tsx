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
      // Use viewport-only calculations to completely avoid forced reflows
      const viewportWidth = window.innerWidth;
      
      // Estimate container width using CSS custom property or default calculation
      const documentStyle = getComputedStyle(document.documentElement);
      const maxWidth = parseInt(documentStyle.getPropertyValue('--container-max-width')) || 1400;
      
      // Calculate estimated container width based on responsive breakpoints
      let estimatedContainer = viewportWidth;
      if (viewportWidth >= maxWidth + 200) { // Account for padding
        estimatedContainer = maxWidth;
      } else if (viewportWidth >= 1024) {
        estimatedContainer = viewportWidth * 0.85; // Typical responsive behavior
      } else if (viewportWidth >= 768) {
        estimatedContainer = viewportWidth * 0.9;
      } else {
        estimatedContainer = viewportWidth * 0.95;
      }
      
      // Calculate available margin space on each side
      const availableMargin = (viewportWidth - estimatedContainer) / 2;
      
      return Math.max(0, availableMargin - 20); // Subtract some buffer
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
        // Use performance.now() to measure timing
        const startTime = performance.now();
        
        checkViewportAndMargins();
        
        if (!shouldRender) {
          console.debug('SideGrids: Hidden due to insufficient margin space');
          return;
        }
        
        // Use the available margin width (minus some padding)
        const gridWidth = Math.min(marginWidth - 20, 120);
        
        // Use requestAnimationFrame to batch DOM updates and avoid forced reflow
        requestAnimationFrame(() => {
          // Set canvas size using purely calculated values
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const viewportHeight = window.innerHeight;
          const width = gridWidth * dpr;
          const height = viewportHeight * dpr;
          
          [leftCanvas, rightCanvas].forEach(canvas => {
            // Batch all DOM writes together
            canvas.width = width;
            canvas.height = height;
            canvas.style.width = gridWidth + 'px';
            canvas.style.height = viewportHeight + 'px';
          });
          
          const endTime = performance.now();
          const duration = endTime - startTime;
          
          // Log performance for debugging
          if (duration > 16) { // More than one frame
            console.warn(`SideGrids resize took ${duration.toFixed(2)}ms`);
          }
        });
      }, 150); // Increased debounce time
    }

    // Initial setup with a longer delay to ensure DOM is stable
    setTimeout(() => {
      resize();
    }, 200);
    
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

    // At 15px/s the dots only move to a new whole pixel ~15x per second, so redraw only then
    // (and never while the tab is hidden or the margins are too narrow to show anything).
    let lastOffset = -1;
    function animate(timestamp: number) {
      animId = requestAnimationFrame(animate);
      if (!shouldRender || document.hidden) return;

      if (!prefersReduced) {
        offset = (timestamp * ANIMATION_SPEED / 1000) % GRID_SIZE;
      }

      const step = Math.floor(offset);
      if (step === lastOffset) return;
      lastOffset = step;

      if (leftCtx && leftCanvas) drawGrid(leftCtx, leftCanvas);
      if (rightCtx && rightCanvas) drawGrid(rightCtx, rightCanvas);
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