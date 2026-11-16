import React from 'react';
import { HeroCanvas } from '../components/HeroCanvas';
import { MagneticButton } from '../components/MagneticButton';
import { ArrowDownRight, Compass, ShieldCheck, Sparkles } from 'lucide-react';
import { sound } from '../utils/audioEngine';

export const SectionPortal: React.FC = () => {
  const scrollTo = (id: string) => {
    sound.playHover();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="portal" className="relative w-full min-h-screen flex items-center justify-center overflow-hidden pt-20 pb-16">
      {/* 1. Behind-Layer Editorial Background Typography (Depth Layer 1) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none z-[-1] opacity-20">
        <h1 className="font-syne font-black text-[13vw] leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/30 to-transparent">
          ENTER
        </h1>
        <h1 className="font-syne font-black text-[14vw] leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white/20 to-transparent">
          UNREAL.
        </h1>
      </div>

      {/* 2. Primary 3D Hero WebGL Canvas (Depth Layer 2) */}
      <HeroCanvas />

      {/* 3. Foreground Content & Overlapping Typography (Depth Layer 3) */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 flex flex-col justify-between h-[85vh] pointer-events-none">
        
        {/* Top HUD Telemetry */}
        <div className="flex justify-between items-start pt-4 font-mono text-[10px] text-gray-500 uppercase tracking-widest pointer-events-auto">
          <div className="flex flex-col gap-1">
            <span className="text-[#00f0ff] flex items-center gap-1.5 font-bold">
              <Compass className="w-3 h-3 text-[#00f0ff] animate-spin-slow" />
              COORDINATES: 45.109° N, 9.682° E
            </span>
            <span>PROJECTION: ORTHOGONAL DUAL TILT</span>
          </div>
          <div className="flex flex-col text-right gap-1">
            <span className="text-[#ccff00] flex items-center justify-end gap-1.5 font-bold">
              <ShieldCheck className="w-3 h-3" />
              STATUS: DIMENSION COLLAPSE INACTIVE
            </span>
            <span>FRAME REFRESH: 120 FPS / SYNCHRONIZED</span>
          </div>
        </div>

        {/* Center Editorial Title Layering */}
        <div className="flex flex-col items-center text-center my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-black/40 backdrop-blur-md mb-6 pointer-events-auto">
            <Sparkles className="w-3 h-3 text-[#ccff00]" />
            <span className="font-mono text-[9px] tracking-[0.25em] text-gray-300 uppercase">
              DIMENSION 001 // THE FIRST HORIZON
            </span>
          </div>

          <h2 className="font-syne font-extrabold text-5xl sm:text-7xl md:text-8xl lg:text-9xl tracking-tight leading-[0.92] text-white drop-shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
            ENTER THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-white to-[#ccff00]">UNREAL.</span>
          </h2>

          <p className="max-w-xl mt-6 text-sm md:text-base text-gray-300 font-light tracking-wide leading-relaxed drop-shadow-md">
            A digital playground where imagination meets dimension. Experience zero-gravity physics, translucent crystal refraction, and dynamic spatial soundscapes.
          </p>

          {/* Interactive CTAs */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-5 pointer-events-auto">
            <MagneticButton
              variant="primary"
              cursorText="ENTER"
              onClick={() => scrollTo('lab')}
            >
              EXPLORE THE VOID
              <ArrowDownRight className="w-4 h-4 ml-1" />
            </MagneticButton>

            <MagneticButton
              variant="secondary"
              cursorText="LEARN"
              onClick={() => scrollTo('depth')}
            >
              DISCOVER THE EXPERIENCE
            </MagneticButton>
          </div>
        </div>

        {/* Bottom Bar: Quick Specs & Scroll Cue */}
        <div className="flex justify-between items-end pb-2 pointer-events-auto">
          <div className="hidden md:flex items-center gap-6 font-mono text-[10px] text-gray-400">
            <div>
              <span className="text-gray-600 block">RENDER PIPELINE</span>
              <span className="text-white">HARDWARE ACCELERATED</span>
            </div>
            <div className="w-[1px] h-6 bg-white/10" />
            <div>
              <span className="text-gray-600 block">CORE PARTICLES</span>
              <span className="text-white">FLOAT32 ATTRIBUTE BUFFER</span>
            </div>
          </div>

          <button
            onClick={() => scrollTo('depth')}
            data-cursor="SCROLL"
            className="flex items-center gap-2 text-xs font-mono tracking-widest text-gray-400 hover:text-[#00f0ff] transition-colors ml-auto group"
          >
            <span>SCROLL TO DESCEND</span>
            <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center group-hover:border-[#00f0ff] group-hover:translate-y-1 transition-all">
              ↓
            </span>
          </button>
        </div>

      </div>
    </section>
  );
};
