import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audioEngine';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
}

export const CustomCursor: React.FC = () => {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cursorText, setCursorText] = useState<string>('');
  const [cursorVariant, setCursorVariant] = useState<'default' | 'button' | 'drag' | 'link' | 'interact'>('default');
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Smooth position tracking
  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    // Detect touch-only device
    const checkTouch = () => {
      return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };
    if (checkTouch()) {
      setIsTouchDevice(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      }

      // Add gentle particle trail
      if (Math.random() > 0.4) {
        const colors = ['#00f0ff', '#ccff00', '#ffffff'];
        particles.current.push({
          x: e.clientX + (Math.random() - 0.5) * 8,
          y: e.clientY + (Math.random() - 0.5) * 8,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          size: Math.random() * 2.2 + 0.8,
          alpha: 0.7,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }

      // Detect hover target
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (target) {
        const cursorAttr = target.closest('[data-cursor]')?.getAttribute('data-cursor');
        const isInteractiveBtn = target.closest('button, [role="button"]');
        const isAnchor = target.closest('a');
        const is3DObject = target.closest('[data-3d]');

        if (cursorAttr) {
          setCursorText(cursorAttr);
          setCursorVariant(cursorAttr.toLowerCase() as any);
        } else if (is3DObject) {
          const action = is3DObject.getAttribute('data-3d') || 'DRAG';
          setCursorText(action);
          setCursorVariant('drag');
        } else if (isInteractiveBtn) {
          setCursorText('CLICK');
          setCursorVariant('button');
        } else if (isAnchor) {
          setCursorText('OPEN');
          setCursorVariant('link');
        } else {
          setCursorText('');
          setCursorVariant('default');
        }
      }
    };

    const onMouseDown = () => {
      setIsClicking(true);
      sound.playClick();
      // Burst particles on click
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3.5 + 1.5;
        particles.current.push({
          x: mousePos.current.x,
          y: mousePos.current.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3 + 1,
          alpha: 1.0,
          color: '#00f0ff',
        });
      }
    };

    const onMouseUp = () => {
      setIsClicking(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);

    // Spring interpolation loop for smooth outer ring & canvas particles
    let animId: number;
    const render = () => {
      // Lerp ring towards mouse with smooth inertia
      const dx = mousePos.current.x - ringPos.current.x;
      const dy = mousePos.current.y - ringPos.current.y;
      ringPos.current.x += dx * 0.16;
      ringPos.current.y += dy * 0.16;

      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
      }

      // Render particle trail
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.022; // Quick, elegant fade
        p.size *= 0.96;

        if (p.alpha <= 0 || p.size <= 0.2) {
          particles.current.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      cancelAnimationFrame(animId);
    };
  }, []);

  if (isTouchDevice) return null;

  // Compute ring dimensions and styling based on variant
  const getRingStyles = () => {
    if (cursorVariant === 'button' || cursorVariant === 'drag' || cursorVariant === 'interact') {
      return {
        width: '76px',
        height: '76px',
        backgroundColor: 'rgba(0, 240, 255, 0.08)',
        borderColor: '#00f0ff',
        boxShadow: '0 0 25px rgba(0, 240, 255, 0.4)',
      };
    }
    if (cursorVariant === 'link') {
      return {
        width: '48px',
        height: '48px',
        backgroundColor: 'rgba(204, 255, 0, 0.08)',
        borderColor: '#ccff00',
        boxShadow: '0 0 15px rgba(204, 255, 0, 0.3)',
      };
    }
    return {
      width: '32px',
      height: '32px',
      backgroundColor: 'transparent',
      borderColor: 'rgba(255, 255, 255, 0.35)',
      boxShadow: 'none',
    };
  };

  const ringStyles = getRingStyles();

  return (
    <>
      <canvas id="cursor-canvas" ref={canvasRef} />

      {/* Primary inner precision dot */}
      <div
        ref={dotRef}
        className={`fixed top-0 left-0 pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-75 ease-out ${
          isClicking ? 'scale-75' : 'scale-100'
        }`}
        style={{
          width: '7px',
          height: '7px',
          backgroundColor: cursorVariant === 'link' ? '#ccff00' : '#00f0ff',
          boxShadow: cursorVariant === 'link' ? '0 0 12px #ccff00' : '0 0 12px #00f0ff',
        }}
      />

      {/* Secondary outer elastic ring */}
      <div
        ref={ringRef}
        className={`fixed top-0 left-0 pointer-events-none z-[9999] -translate-x-1/2 -translate-y-1/2 rounded-full border flex items-center justify-center transition-[width,height,background-color,border-color,box-shadow] duration-300 ease-out ${
          isClicking ? 'scale-90 opacity-80' : 'scale-100 opacity-100'
        }`}
        style={ringStyles}
      >
        {cursorText && (
          <span className="font-mono text-[9px] font-bold tracking-widest text-[#00f0ff] uppercase select-none animate-pulse">
            {cursorText}
          </span>
        )}
      </div>
    </>
  );
};
