import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Radio } from 'lucide-react';
import { sound } from '../utils/audioEngine';

export const Navbar: React.FC = () => {
  const [isMuted, setIsMuted] = useState(sound.getMuted());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleAudio = () => {
    const newMuted = sound.toggleMute();
    setIsMuted(newMuted);
  };

  const scrollTo = (id: string) => {
    sound.playHover();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 px-6 md:px-12 py-5 flex items-center justify-between ${
        scrolled ? 'bg-[#020205]/80 backdrop-blur-md border-b border-white/[0.05]' : 'bg-transparent'
      }`}
    >
      {/* Brand Logo */}
      <div
        onClick={() => scrollTo('portal')}
        className="flex items-center gap-3 cursor-pointer group"
        data-cursor="PORTAL"
      >
        <div className="relative flex items-center justify-center w-7 h-7 rounded-sm border border-[#00f0ff]/50 bg-[#00f0ff]/10 group-hover:border-[#00f0ff] group-hover:shadow-[0_0_15px_rgba(0,240,255,0.5)] transition-all">
          <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
          <div className="absolute w-2 h-2 rounded-full bg-[#00f0ff]" />
        </div>
        <div className="flex flex-col">
          <span className="font-syne font-black tracking-widest text-base text-white group-hover:text-[#00f0ff] transition-colors">
            VOID<span className="text-[#00f0ff]">/01</span>
          </span>
          <span className="font-mono text-[8px] tracking-[0.25em] text-gray-500 uppercase">
            DIMENSIONAL EXPERIMENTAL CORE
          </span>
        </div>
      </div>

      {/* Center Nav Links */}
      <nav className="hidden md:flex items-center gap-8">
        {[
          { label: '01 // PORTAL', id: 'portal' },
          { label: '02 // DEPTH', id: 'depth' },
          { label: '03 // LAB', id: 'lab' },
          { label: '04 // COSMOS', id: 'cosmos' },
          { label: '05 // SINGULARITY', id: 'singularity' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => scrollTo(item.id)}
            data-cursor="NAVIGATE"
            className="font-mono text-xs tracking-widest text-gray-400 hover:text-[#00f0ff] transition-colors relative group py-1"
          >
            {item.label}
            <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-[#00f0ff] group-hover:w-full transition-all duration-300" />
          </button>
        ))}
      </nav>

      {/* Right Controls: Sound Equalizer & System Telemetry */}
      <div className="flex items-center gap-5">
        <div className="hidden lg:flex items-center gap-2 font-mono text-[9px] text-gray-400 border border-white/10 px-3 py-1.5 rounded-full bg-white/[0.02]">
          <Radio className="w-3 h-3 text-[#ccff00] animate-pulse" />
          <span>SYSTEM: OPTIMAL</span>
        </div>

        {/* Audio Synthesizer Control */}
        <button
          onClick={toggleAudio}
          data-cursor={isMuted ? 'UNMUTE' : 'MUTE'}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/15 bg-white/[0.03] hover:border-[#00f0ff]/60 hover:bg-[#00f0ff]/10 text-xs font-mono text-gray-300 transition-all duration-300"
          title="Toggle Synthesizer Atmosphere"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] tracking-wider text-gray-400">AUDIO OFF</span>
            </>
          ) : (
            <>
              <Volume2 className="w-3.5 h-3.5 text-[#00f0ff]" />
              <div className="flex items-end gap-[2px] h-3">
                <span className="w-[2px] bg-[#00f0ff] h-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                <span className="w-[2px] bg-[#00f0ff] h-2/3 animate-[pulse_0.9s_ease-in-out_infinite]" />
                <span className="w-[2px] bg-[#00f0ff] h-4/5 animate-[pulse_0.7s_ease-in-out_infinite]" />
              </div>
              <span className="text-[10px] tracking-wider text-[#00f0ff]">LIVE SYNTH</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
