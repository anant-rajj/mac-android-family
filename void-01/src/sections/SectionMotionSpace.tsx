import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Wind, Activity, Zap } from 'lucide-react';

export const SectionMotionSpace: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020205, 0.025);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 0, 15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // 1. Particle Cloud with 3,200 Interactive Quantum Points
    const particleCount = 3200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const originalPositions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorCyan = new THREE.Color(0x00f0ff);
    const colorLime = new THREE.Color(0xccff00);
    const colorWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Spread across volume
      const x = (Math.random() - 0.5) * 35;
      const y = (Math.random() - 0.5) * 25;
      const z = (Math.random() - 0.5) * 35;

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      originalPositions[i3] = x;
      originalPositions[i3 + 1] = y;
      originalPositions[i3 + 2] = z;

      velocities[i3] = 0;
      velocities[i3 + 1] = 0;
      velocities[i3 + 2] = 0;

      // Color distribution
      const randColor = Math.random();
      const chosenColor = randColor > 0.6 ? colorCyan : randColor > 0.35 ? colorLime : colorWhite;
      colors[i3] = chosenColor.r;
      colors[i3 + 1] = chosenColor.g;
      colors[i3 + 2] = chosenColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle sprite material
    const particleMat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(geometry, particleMat);
    scene.add(particleSystem);

    // 2. Floating Geometric Wireframes in the Deep Field
    const wireGroup = new THREE.Group();
    scene.add(wireGroup);

    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.15,
    });

    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(2.0 + Math.random() * 1.5, 1), wireMat);
      mesh.position.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 25
      );
      wireGroup.add(mesh);
    }

    // Mouse Tracking in 3D Space
    const raycaster = new THREE.Raycaster();
    const mouse2D = new THREE.Vector2(-100, -100);
    const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mouse3D = new THREE.Vector3();

    const onPointerMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouse2D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse2D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse2D, camera);
      raycaster.ray.intersectPlane(planeZ, mouse3D);
    };

    const handleScroll = () => {
      const rect = mount.getBoundingClientRect();
      const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      scrollRef.current = progress; // 0 to 1
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Physics Animation Loop
    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      const time = clock.getElapsedTime();
      const posAttr = geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      // Scroll camera flight: travels through Z space
      const targetZ = 16 - scrollRef.current * 18;
      camera.position.z += (targetZ - camera.position.z) * 0.05;
      camera.position.x = Math.sin(time * 0.2) * 1.5;
      camera.position.y = Math.cos(time * 0.25) * 1.0;

      // Particles gentle ambient drift + repulsion from mouse
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;

        // Current coordinates
        let px = posArray[i3];
        let py = posArray[i3 + 1];
        let pz = posArray[i3 + 2];

        // Origin coordinates
        const ox = originalPositions[i3];
        const oy = originalPositions[i3 + 1];
        const oz = originalPositions[i3 + 2];

        // Distance to pointer in 3D
        const dx = px - mouse3D.x;
        const dy = py - mouse3D.y;
        const distSq = dx * dx + dy * dy;
        const radius = 4.5;

        if (distSq < radius * radius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = (1 - dist / radius) * 0.35;
          velocities[i3] += (dx / dist) * force;
          velocities[i3 + 1] += (dy / dist) * force;
        }

        // Spring force returning to origin
        velocities[i3] += (ox - px) * 0.035;
        velocities[i3 + 1] += (oy - py) * 0.035;
        velocities[i3 + 2] += (oz - pz) * 0.035;

        // Damping friction
        velocities[i3] *= 0.88;
        velocities[i3 + 1] *= 0.88;
        velocities[i3 + 2] *= 0.88;

        // Apply velocities
        posArray[i3] += velocities[i3];
        posArray[i3 + 1] += velocities[i3 + 1];
        posArray[i3 + 2] += velocities[i3 + 2];
      }

      posAttr.needsUpdate = true;

      // Rotate geometric wireframes
      wireGroup.rotation.y = time * 0.05;
      wireGroup.rotation.x = time * 0.03;

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
      window.removeEventListener('mousemove', onPointerMove);
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
    <section id="cosmos" className="relative w-full min-h-screen py-32 overflow-hidden flex flex-col justify-center">
      {/* Interactive WebGL Particles Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-auto z-0" data-cursor="REPEL" />

      {/* Foreground Editorial Overlays */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-12 w-full pointer-events-none">
        
        {/* Header */}
        <div className="flex items-center gap-2 font-mono text-xs text-[#00f0ff] uppercase tracking-widest mb-4">
          <Wind className="w-4 h-4 text-[#00f0ff]" />
          <span>SECTION 04 // MOTION IN SPACE</span>
        </div>

        <div className="max-w-4xl">
          <h2 className="font-syne font-black text-4xl sm:text-6xl md:text-8xl tracking-tight text-white leading-none">
            QUANTUM <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] via-white to-[#ccff00]">DRIFT.</span>
          </h2>
          <p className="mt-6 text-sm md:text-base text-gray-300 font-light max-w-xl leading-relaxed">
            3,200 particle vertices suspended in zero atmospheric drag. Sweep your cursor across the star field to generate localized gravitational repulsion waves.
          </p>
        </div>

        {/* Telemetry Status Strip */}
        <div className="mt-16 flex flex-wrap gap-4 pointer-events-auto">
          <div className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3">
            <Activity className="w-4 h-4 text-[#00f0ff]" />
            <div className="font-mono text-[10px]">
              <span className="text-gray-400 block">PARTICLE DENSITY</span>
              <span className="text-white font-bold">3,200 VERTICES</span>
            </div>
          </div>

          <div className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3">
            <Zap className="w-4 h-4 text-[#ccff00]" />
            <div className="font-mono text-[10px]">
              <span className="text-gray-400 block">REPULSION RADIUS</span>
              <span className="text-white font-bold">4.50 SPATIAL UNITS</span>
            </div>
          </div>

          <div className="glass-panel px-5 py-3 rounded-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-ping" />
            <div className="font-mono text-[10px]">
              <span className="text-gray-400 block">CAMERA WARP TRAVEL</span>
              <span className="text-white font-bold">ACTIVE (SCROLL DRIVEN)</span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
