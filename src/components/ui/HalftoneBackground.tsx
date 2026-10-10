import { useEffect, useRef } from 'react';

interface Dot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  opacity: number;
  speed: number;
  angle: number;
  colorOffset: number;
}

export default function HalftoneBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      
      // Reinitialize dots on resize
      initDots();
    };

    // Initialize dots
    const initDots = () => {
      const dots: Dot[] = [];
      const spacing = 20;
      const cols = Math.ceil(window.innerWidth / spacing);
      const rows = Math.ceil(window.innerHeight / spacing);

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = i * spacing;
          const y = j * spacing;
          
          // Calculate distance from corners for gradient effect
          const distTopRight = Math.sqrt(
            Math.pow(x - window.innerWidth, 2) + Math.pow(y, 2)
          );
          const distBottomLeft = Math.sqrt(
            Math.pow(x, 2) + Math.pow(y - window.innerHeight, 2)
          );
          
          const minDist = Math.min(distTopRight, distBottomLeft);
          const maxDist = Math.sqrt(
            Math.pow(window.innerWidth, 2) + Math.pow(window.innerHeight, 2)
          );
          
          // Only add dots in gradient areas
          if (minDist < maxDist * 0.4) {
            const distRatio = minDist / (maxDist * 0.4);
            const isTopRight = distTopRight < distBottomLeft;
            
            dots.push({
              x,
              y,
              baseX: x,
              baseY: y,
              size: isTopRight 
                ? 1.5 + (1 - distRatio) * 1.5
                : 2 + (1 - distRatio) * 2,
              opacity: (1 - distRatio) * 0.15, // Much more transparent
              speed: 0.5 + Math.random() * 1.5, // Faster movement
              angle: Math.random() * Math.PI * 2,
              colorOffset: Math.random() * Math.PI * 2, // Random color phase
            });
          }
        }
      }

      dotsRef.current = dots;
    };

    // Animation loop
    let time = 0;
    const animate = () => {
      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      
      ctx.clearRect(0, 0, width, height);
      
      time += 0.01;

      dotsRef.current.forEach((dot) => {
        // Update position with more noticeable drift
        dot.angle += 0.01; // 5x faster angle change
        const driftAmount = 15; // Larger drift distance
        dot.x = dot.baseX + Math.sin(dot.angle) * driftAmount * dot.speed;
        dot.y = dot.baseY + Math.cos(dot.angle) * driftAmount * dot.speed;

        // Draw dot with color cycling
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
        
        // Cycle through gold -> violet -> neon blue -> gold
        const colorPhase = (time + dot.colorOffset) % (Math.PI * 2);
        let r, g, b;
        
        if (colorPhase < Math.PI * 2 / 3) {
          // Gold to Violet
          const t = (colorPhase / (Math.PI * 2 / 3));
          r = Math.floor(255 - t * (255 - 124));
          g = Math.floor(215 - t * (215 - 58));
          b = Math.floor(0 + t * 237);
        } else if (colorPhase < Math.PI * 4 / 3) {
          // Violet to Neon Blue
          const t = ((colorPhase - Math.PI * 2 / 3) / (Math.PI * 2 / 3));
          r = Math.floor(124 - t * (124 - 0));
          g = Math.floor(58 + t * (207 - 58));
          b = Math.floor(237 + t * (255 - 237));
        } else {
          // Neon Blue to Gold
          const t = ((colorPhase - Math.PI * 4 / 3) / (Math.PI * 2 / 3));
          r = Math.floor(0 + t * 255);
          g = Math.floor(207 + t * (215 - 207));
          b = Math.floor(255 - t * 255);
        }
        
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${dot.opacity})`;
        ctx.fill();
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Initialize
    resizeCanvas();
    animate();

    // Resize listener
    window.addEventListener('resize', resizeCanvas);

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="halftone-canvas"
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}
