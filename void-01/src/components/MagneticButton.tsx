import React, { useRef, useState } from 'react';
import { sound } from '../utils/audioEngine';

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  cursorText?: string;
  className?: string;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  variant = 'primary',
  cursorText = 'CLICK',
  className = '',
  onClick,
  ...props
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [transform, setTransform] = useState({ x: 0, y: 0, rotX: 0, rotY: 0 });
  const [textTransform, setTextTransform] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = e.clientX - centerX;
    const deltaY = e.clientY - centerY;

    // Magnetic pull for button body
    const pullX = deltaX * 0.28;
    const pullY = deltaY * 0.28;

    // 3D tilt
    const rotX = -(deltaY / (rect.height / 2)) * 12;
    const rotY = (deltaX / (rect.width / 2)) * 12;

    // Independent displacement for layered text
    const textPullX = deltaX * 0.16;
    const textPullY = deltaY * 0.16;

    setTransform({ x: pullX, y: pullY, rotX, rotY });
    setTextTransform({ x: textPullX, y: textPullY });
  };

  const handleMouseEnter = () => {
    sound.playHover();
  };

  const handleMouseLeave = () => {
    // Spring back to rest
    setTransform({ x: 0, y: 0, rotX: 0, rotY: 0 });
    setTextTransform({ x: 0, y: 0 });
  };

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    sound.playClick();
    if (onClick) onClick(e);
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-gradient-to-r from-[#00f0ff] to-[#0099ff] text-black font-semibold shadow-[0_0_30px_rgba(0,240,255,0.4)] hover:shadow-[0_0_45px_rgba(0,240,255,0.7)] border-transparent';
      case 'secondary':
        return 'bg-[rgba(255,255,255,0.04)] text-white border border-white/20 hover:border-[#00f0ff]/80 hover:bg-[#00f0ff]/10 hover:shadow-[0_0_25px_rgba(0,240,255,0.25)]';
      case 'ghost':
        return 'bg-transparent text-gray-300 hover:text-[#00f0ff] border border-transparent hover:border-[#00f0ff]/30';
      default:
        return '';
    }
  };

  return (
    <button
      ref={buttonRef}
      data-cursor={cursorText}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) perspective(600px) rotateX(${transform.rotX}deg) rotateY(${transform.rotY}deg)`,
        transition: 'transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
      className={`relative inline-flex items-center justify-center px-8 py-4 rounded-full text-xs uppercase tracking-[0.2em] font-mono transition-shadow duration-300 cursor-pointer overflow-hidden group ${getVariantStyles()} ${className}`}
      {...props}
    >
      {/* Dynamic light refraction flare */}
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-in-out pointer-events-none" />

      {/* Layered independent text */}
      <span
        ref={textRef}
        style={{
          transform: `translate3d(${textTransform.x}px, ${textTransform.y}px, 0)`,
          transition: 'transform 0.1s ease-out',
        }}
        className="relative z-10 flex items-center gap-2 select-none"
      >
        {children}
      </span>
    </button>
  );
};
