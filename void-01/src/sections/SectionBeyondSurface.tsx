import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Eye, Layers, Orbit, Cpu } from 'lucide-react';

export const SectionBeyondSurface: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Dynamic point lights for glassy refractions
    const cyanLight = new THREE.PointLight(0x00f0ff, 8, 20);
    cyanLight.position.set(-5, 4, 3);
    scene.add(cyanLight);

    const limeLight = new THREE.PointLight(0xccff00, 7, 18);
    limeLight.position.set(5, -3, 2);
    scene.add(limeLight);

    const ambLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambLight);

    // Group for floating glass panels and prisms
    const glassGroup = new THREE.Group();
    scene.add(glassGroup);

    // Glass material with transmission
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.94,
      opacity: 1,
      transparent: true,
      roughness: 0.08,
      ior: 1.5,
      thickness: 1.5,
      reflectivity: 0.9,
    });

    // 1. Floating Glass Monolith Panels
    const panels: { mesh: THREE.Mesh; speed: number; rotSpeed: number; basePosY: number }[] = [];
    const panelGeo = new THREE.BoxGeometry(2.4, 3.8, 0.08);

    const p1 = new THREE.Mesh(panelGeo, glassMat);
    p1.position.set(-3.2, 0, -1);
    p1.rotation.y = 0.35;
    glassGroup.add(p1);
    panels.push({ mesh: p1, speed: 0.0018, rotSpeed: 0.002, basePosY: 0 });

    const p2 = new THREE.Mesh(new THREE.BoxGeometry(3.0, 2.2, 0.08), glassMat);
    p2.position.set(3.4, -0.5, -0.5);
    p2.rotation.y = -0.3;
    p2.rotation.x = 0.15;
    glassGroup.add(p2);
    panels.push({ mesh: p2, speed: 0.0025, rotSpeed: -0.003, basePosY: -0.5 });

    // 2. Floating Crystal Prisms (Octahedrons)
    const prismMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    const prism1 = new THREE.Mesh(new THREE.OctahedronGeometry(1.2, 0), prismMat);
    prism1.position.set(0, 1.5, -2);
    glassGroup.add(prism1);
    panels.push({ mesh: prism1, speed: 0.0035, rotSpeed: 0.005, basePosY: 1.5 });

    const prism2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), glassMat);
    prism2.position.set(-1.8, -2.2, 0.5);
    glassGroup.add(prism2);
    panels.push({ mesh: prism2, speed: 0.0012, rotSpeed: -0.004, basePosY: -2.2 });

    const handleScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      const time = clock.getElapsedTime();
      const scrollOffset = scrollYRef.current;

      // Parallax scroll calculation: each object shifts in Y at distinct speeds
      panels.forEach((item, idx) => {
        item.mesh.position.y = item.basePosY - (scrollOffset * item.speed) + Math.sin(time + idx) * 0.15;
        item.mesh.rotation.y += item.rotSpeed;
        item.mesh.rotation.x += item.rotSpeed * 0.5;
      });

      // Light oscillation
      cyanLight.position.x = -5 + Math.sin(time * 0.8) * 1.5;
      limeLight.position.x = 5 + Math.cos(time * 0.7) * 1.5;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!mount) return;
      width = mount.clientWidth || window.innerWidth;
      height = mount.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section id="depth" className="relative w-full min-h-screen py-32 overflow-hidden flex flex-col justify-center">
      {/* 3D Glass Layer Background */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />

      {/* Foreground Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 w-full">
        
        {/* Section Header */}
        <div className="flex items-center gap-3 font-mono text-xs text-[#00f0ff] uppercase tracking-widest mb-8">
          <Layers className="w-4 h-4 text-[#00f0ff]" />
          <span>SECTION 02 // BEYOND THE SURFACE</span>
        </div>

        {/* Oversized Statement */}
        <div className="max-w-5xl">
          <h2 className="font-syne font-black text-4xl sm:text-6xl md:text-7xl lg:text-8xl tracking-tight leading-[1.0] text-white">
            THERE IS <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-gray-500">MORE</span> THAN WHAT YOU <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#ccff00]">SEE.</span>
          </h2>
        </div>

        {/* Floating Telemetry & Information Cards */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group" data-cursor="EXPAND">
            <div className="w-10 h-10 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center mb-6 text-[#00f0ff] group-hover:scale-110 transition-transform">
              <Eye className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] text-[#00f0ff] tracking-widest uppercase block mb-1">
              SPEC // 01 — OPTICAL REFRACTION
            </span>
            <h3 className="font-syne font-bold text-xl text-white mb-2">
              Physical Light Dispersion
            </h3>
            <p className="font-sans text-xs text-gray-400 leading-relaxed">
              Real-time Snell’s law simulation computes sub-surface light bending through synthetic quartz and high-index glass shards with zero framerate degradation.
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between font-mono text-[9px] text-gray-500">
              <span>IOR: 1.520 (BK7 BOROSILICATE)</span>
              <span>ROUGHNESS: 0.08</span>
            </div>
          </div>

          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group" data-cursor="EXPAND">
            <div className="w-10 h-10 rounded-xl bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center justify-center mb-6 text-[#ccff00] group-hover:scale-110 transition-transform">
              <Orbit className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] text-[#ccff00] tracking-widest uppercase block mb-1">
              SPEC // 02 — KINEMATIC INERTIA
            </span>
            <h3 className="font-syne font-bold text-xl text-white mb-2">
              Multi-Layer Parallax
            </h3>
            <p className="font-sans text-xs text-gray-400 leading-relaxed">
              Floating prisms and geometric structures translate across Z-depth planes at varying velocity multipliers, mimicking astronomical gravitational lenses.
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between font-mono text-[9px] text-gray-500">
              <span>DEPTH CHANNELS: 4 PLANES</span>
              <span>VELOCITY: DYNAMIC LERP</span>
            </div>
          </div>

          <div className="glass-panel glass-panel-hover p-6 rounded-2xl relative overflow-hidden group" data-cursor="EXPAND">
            <div className="w-10 h-10 rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/30 flex items-center justify-center mb-6 text-[#3b82f6] group-hover:scale-110 transition-transform">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="font-mono text-[10px] text-[#3b82f6] tracking-widest uppercase block mb-1">
              SPEC // 03 — SPATIAL SHADER CORE
            </span>
            <h3 className="font-syne font-bold text-xl text-white mb-2">
              GPU Matrix Acceleration
            </h3>
            <p className="font-sans text-xs text-gray-400 leading-relaxed">
              Fragment shader pipelines render anisotropic metallic highlights and micro-facet scattering directly on consumer-grade GPUs at unified 120 FPS.
            </p>
            <div className="mt-4 pt-4 border-t border-white/5 flex justify-between font-mono text-[9px] text-gray-500">
              <span>API: WEBGL 2.0 / METAL</span>
              <span>DRAW CALLS: BATCHED INSTANCED</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
