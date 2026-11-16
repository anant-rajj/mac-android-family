import React, { useEffect, useState } from 'react';
import { sound } from '../utils/audioEngine';

interface PreloaderProps {
  onComplete: () => void;
}

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            setIsFading(true);
            setTimeout(() => {
              onComplete();
              sound.playPortalShift();
            }, 600);
          }, 200);
          return 100;
        }
        // Progressively speed up
        const increment = Math.floor(Math.random() * 8) + 4;
        return Math.min(prev + increment, 100);
      });
    }, 45);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-[10000] bg-[#020205] flex flex-col items-center justify-center transition-opacity duration-700 pointer-events-none select-none ${
        isFading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative flex flex-col items-center gap-6">
        {/* Glowing Singularity Loader */}
        <div className="relative w-16 h-16 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-[#00f0ff]/30 animate-spin-slow" />
          <div className="absolute inset-1 rounded-full border border-dashed border-[#ccff00]/40 animate-[spin_8s_linear_infinite_reverse]" />
          <div className="w-3 h-3 rounded-full bg-[#00f0ff] shadow-[0_0_20px_#00f0ff] animate-ping" />
          <div className="absolute w-2 h-2 rounded-full bg-[#ccff00]" />
        </div>

        {/* Telemetry and Progress Percentage */}
        <div className="flex flex-col items-center gap-2">
          <span className="font-syne font-black tracking-widest text-lg text-white">
            VOID<span className="text-[#00f0ff]">/01</span>
          </span>
          <div className="flex items-center gap-3 font-mono text-xs text-gray-400">
            <span className="tracking-widest">INITIALIZING QUANTUM MESH</span>
            <span className="text-[#00f0ff] font-bold">{progress.toString().padStart(3, '0')}%</span>
          </div>
        </div>

        {/* Precision Progress Bar */}
        <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-gradient-to-r from-[#00f0ff] to-[#ccff00] transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Bottom Coordinates */}
        <span className="font-mono text-[9px] text-gray-600 tracking-[0.3em] uppercase">
          45.109° N, 9.682° E // DIMENSION SECTOR 001
        </span>
      </div>
    </div>
  );
};
