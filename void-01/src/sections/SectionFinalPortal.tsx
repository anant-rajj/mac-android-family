import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MagneticButton } from '../components/MagneticButton';
import { Sparkles, Terminal, ArrowUp } from 'lucide-react';
import { sound } from '../utils/audioEngine';

export const SectionFinalPortal: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [modalActive, setModalActive] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Environment map for reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x05070f);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.5, 10),
      new THREE.MeshBasicMaterial({ color: 0x00f0ff })
    );
    strip.position.set(0, 5, 0);
    envScene.add(strip);
    const envMap = pmremGenerator.fromScene(envScene).texture;
    scene.environment = envMap;

    // Lights
    const light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(4, 5, 4);
    scene.add(light);

    const cyanLight = new THREE.PointLight(0x00f0ff, 6, 15);
    cyanLight.position.set(-3, -2, 2);
    scene.add(cyanLight);

    const limeLight = new THREE.PointLight(0xccff00, 5, 12);
    limeLight.position.set(3, 2, 2);
    scene.add(limeLight);

    // The Singularity Portal Object: Concentric Morphing Gyro Rings
    const portalGroup = new THREE.Group();
    scene.add(portalGroup);

    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0xe5e7eb,
      metalness: 0.98,
      roughness: 0.05,
      envMap: envMap,
      envMapIntensity: 2.2,
    });

    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.2,
    });

    // Ring 1
    const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 32, 120), ringMat1);
    portalGroup.add(r1);

    // Ring 2
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.06, 32, 100), ringMat2);
    r2.rotation.x = Math.PI / 4;
    portalGroup.add(r2);

    // Ring 3
    const r3 = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.05, 32, 80), ringMat1);
    r3.rotation.y = Math.PI / 3;
    portalGroup.add(r3);

    // Inner Glowing Singularity Core
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), coreMat);
    portalGroup.add(core);

    // Mouse Tracking
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const onMouseMove = (e: MouseEvent) => {
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      const time = clock.getElapsedTime();

      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      r1.rotation.z += 0.005;
      r1.rotation.x = Math.sin(time * 0.5) * 0.3 + mouse.y * 0.2;

      r2.rotation.y -= 0.007;
      r2.rotation.z = Math.cos(time * 0.6) * 0.3 + mouse.x * 0.2;

      r3.rotation.x += 0.009;
      r3.rotation.y += 0.006;

      core.rotation.y += 0.02;
      core.rotation.x += 0.01;

      portalGroup.position.y = Math.sin(time * 1.2) * 0.12;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      width = mount.clientWidth;
      height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      pmremGenerator.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  const scrollToTop = () => {
    sound.playClick();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEnterExperience = () => {
    sound.playPortalShift();
    setModalActive(true);
  };

  return (
    <section id="singularity" className="relative w-full min-h-screen flex flex-col justify-between pt-32 pb-8 overflow-hidden bg-gradient-to-b from-[#020205] to-black">
      
      {/* Background 3D Singularity Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-80" />

      {/* Main Closing Call to Action */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 md:px-12 text-center my-auto w-full">
        
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/60 backdrop-blur-md mb-6">
          <Sparkles className="w-3.5 h-3.5 text-[#00f0ff]" />
          <span className="font-mono text-[9px] tracking-[0.3em] text-gray-300 uppercase">
            SECTION 05 // THE FINAL HORIZON
          </span>
        </div>

        <h2 className="font-syne font-black text-5xl sm:text-7xl md:text-8xl tracking-tight text-white leading-none">
          READY TO EXPLORE <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-white to-[#ccff00]">THE UNKNOWN?</span>
        </h2>

        <p className="max-w-xl mx-auto mt-6 text-sm md:text-base text-gray-300 font-light leading-relaxed">
          Step across the event horizon. Complete dimensional synchronization initiated. Real-time rendering parameters fully unlocked.
        </p>

        {/* Prominent Magnetic CTA */}
        <div className="mt-10 flex justify-center">
          <MagneticButton
            variant="primary"
            cursorText="INITIATE"
            onClick={handleEnterExperience}
            className="text-sm px-10 py-5"
          >
            ENTER THE EXPERIENCE
          </MagneticButton>
        </div>

        {/* Interactive Modal confirmation */}
        {modalActive && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-6">
            <div className="glass-panel border-[#00f0ff]/50 rounded-3xl p-8 max-w-md w-full text-left relative animate-in fade-in zoom-in duration-300">
              <div className="flex items-center gap-3 text-[#00f0ff] font-mono text-xs mb-4">
                <Terminal className="w-4 h-4" />
                <span>DIMENSIONAL WARP PROTOCOL ACTIVE</span>
              </div>
              <h3 className="font-syne font-bold text-2xl text-white mb-2">
                Synchronization Complete
              </h3>
              <p className="font-sans text-xs text-gray-300 leading-relaxed mb-6">
                You have accessed the core substrate of VOID/01. Every shader, particle buffer, and audio oscillator is running at peak 120 FPS synchronization.
              </p>
              <div className="flex gap-4">
                <MagneticButton
                  variant="primary"
                  cursorText="CLOSE"
                  onClick={() => setModalActive(false)}
                  className="w-full text-xs"
                >
                  RETURN TO VIEWPORT
                </MagneticButton>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Clean Futuristic Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 md:px-12 pt-20">
        <div className="pt-8 border-t border-white/[0.08] flex flex-col md:flex-row items-center justify-between gap-6 font-mono text-[10px] text-gray-500">
          
          {/* Logo & Status */}
          <div className="flex items-center gap-4">
            <span className="font-syne font-black text-white text-base tracking-wider">
              VOID<span className="text-[#00f0ff]">/01</span>
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">CORE STATUS: NOMINAL (BUILD 2026.11)</span>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-6">
            <a
              href="#portal"
              data-cursor="TOP"
              onClick={(e) => {
                e.preventDefault();
                scrollToTop();
              }}
              className="hover:text-[#00f0ff] transition-colors flex items-center gap-1"
            >
              <ArrowUp className="w-3 h-3" /> BACK TO TOP
            </a>
            <span>//</span>
            <span className="text-gray-400">DESIGNED BY CREATIVE TECH LAB</span>
          </div>

          {/* Copyright */}
          <div className="text-gray-600">
            © 2026 VOID/01 LABS. ALL RIGHTS RESERVED.
          </div>

        </div>
      </footer>

    </section>
  );
};
