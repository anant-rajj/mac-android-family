import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { CustomCursor } from './components/CustomCursor';
import { Preloader } from './components/Preloader';
import { SectionPortal } from './sections/SectionPortal';
import { SectionBeyondSurface } from './sections/SectionBeyondSurface';
import { SectionDimensionLab } from './sections/SectionDimensionLab';
import { SectionMotionSpace } from './sections/SectionMotionSpace';
import { SectionFinalPortal } from './sections/SectionFinalPortal';
import { sound } from './utils/audioEngine';

export const App: React.FC = () => {
  const [loading, setLoading] = useState(true);

  // Initialize sound on user interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      sound.startAmbience();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, []);

  return (
    <main className="relative min-h-screen bg-[#020205] text-[#f0f3fa] selection:bg-[#00f0ff] selection:text-black overflow-x-hidden">
      {/* Intro Preloader Sequence */}
      {loading && <Preloader onComplete={() => setLoading(false)} />}

      {/* High-Precision Interactive Custom Mouse Follower & Particle Trail */}
      <CustomCursor />

      {/* Top Futuristic Navigation Bar */}
      <Navbar />

      {/* SECTION ONE — THE PORTAL (Hero Experience) */}
      <SectionPortal />

      {/* SECTION TWO — BEYOND THE SURFACE (Layered Glass & Parallax) */}
      <SectionBeyondSurface />

      {/* SECTION THREE — THE DIMENSION LAB (3 Interactive Drag Objects) */}
      <SectionDimensionLab />

      {/* SECTION FOUR — MOTION IN SPACE (Particle Field & Fly-through) */}
      <SectionMotionSpace />

      {/* SECTION FIVE — THE FINAL PORTAL (Closing & Footer) */}
      <SectionFinalPortal />
    </main>
  );
};

export default App;
