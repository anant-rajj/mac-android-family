import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { sound } from '../utils/audioEngine';
import { Rotate3d, Sparkles } from 'lucide-react';

interface SpecimenCanvasProps {
  type: 'chrome-sphere' | 'glass-cube' | 'twisted-ring';
}

export const SpecimenCanvas: React.FC<SpecimenCanvasProps> = ({ type }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const dragVelocity = useRef({ x: 0, y: 0 });
  const isHovered = useRef(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 320;
    let height = mount.clientHeight || 320;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mount.appendChild(renderer.domElement);

    // Procedural Reflection Texture
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0a0c16);
    const topStrip = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.5, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    topStrip.position.set(0, 4, 0);
    envScene.add(topStrip);

    const accentMat = new THREE.MeshBasicMaterial({
      color: type === 'chrome-sphere' ? 0x00f0ff : type === 'glass-cube' ? 0xccff00 : 0x3b82f6,
    });
    const sideStrip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, 6), accentMat);
    sideStrip.position.set(-4, 0, 0);
    envScene.add(sideStrip);

    const envMap = pmremGenerator.fromScene(envScene).texture;
    scene.environment = envMap;

    // Lighting
    const amb = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(amb);

    const light1 = new THREE.PointLight(0x00f0ff, 5, 10);
    light1.position.set(3, 4, 3);
    scene.add(light1);

    const light2 = new THREE.PointLight(0xccff00, 4, 8);
    light2.position.set(-3, -2, 2);
    scene.add(light2);

    const objectGroup = new THREE.Group();
    scene.add(objectGroup);

    // Construct Specimen Geometry & Material
    if (type === 'chrome-sphere') {
      const geo = new THREE.SphereGeometry(1.5, 64, 64);
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf5f7fb,
        metalness: 0.98,
        roughness: 0.03,
        envMap: envMap,
        envMapIntensity: 2.2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      objectGroup.add(mesh);

      // Orbital electron ring
      const ringGeo = new THREE.TorusGeometry(1.9, 0.03, 16, 100);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.5;
      objectGroup.add(ring);
    } else if (type === 'glass-cube') {
      const geo = new THREE.BoxGeometry(1.9, 1.9, 1.9);
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transmission: 0.95,
        opacity: 1,
        transparent: true,
        roughness: 0.05,
        ior: 1.55,
        thickness: 2.0,
        reflectivity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      objectGroup.add(mesh);

      // Inner floating core
      const innerGeo = new THREE.OctahedronGeometry(0.8, 0);
      const innerMat = new THREE.MeshStandardMaterial({
        color: 0xccff00,
        metalness: 0.8,
        roughness: 0.2,
        emissive: 0x223300,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      objectGroup.add(innerMesh);
    } else {
      // Twisted Metallic Ring (Torus Knot)
      const geo = new THREE.TorusKnotGeometry(1.1, 0.32, 128, 32, 2, 3);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1f2937,
        metalness: 0.92,
        roughness: 0.15,
        envMap: envMap,
        envMapIntensity: 2.0,
      });
      const mesh = new THREE.Mesh(geo, mat);
      objectGroup.add(mesh);
    }

    // Interactive Drag Listeners
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - previousMouse.current.x;
      const dy = e.clientY - previousMouse.current.y;
      dragVelocity.current.x = dx * 0.008;
      dragVelocity.current.y = dy * 0.008;

      objectGroup.rotation.y += dragVelocity.current.x;
      objectGroup.rotation.x += dragVelocity.current.y;

      previousMouse.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging.current = false;
    };

    const onMouseEnter = () => {
      isHovered.current = true;
      sound.playHover();
    };

    const onMouseLeave = () => {
      isHovered.current = false;
      isDragging.current = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('mouseenter', onMouseEnter);
    dom.addEventListener('mouseleave', onMouseLeave);

    // Animation Loop with Physics Inertia
    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      const time = clock.getElapsedTime();

      if (!isDragging.current) {
        // Inertia decay
        dragVelocity.current.x *= 0.95;
        dragVelocity.current.y *= 0.95;
        objectGroup.rotation.y += dragVelocity.current.x;
        objectGroup.rotation.x += dragVelocity.current.y;

        // Base continuous rotation (faster when hovered)
        const speedMultiplier = isHovered.current ? 2.5 : 1.0;
        objectGroup.rotation.y += 0.008 * speedMultiplier;
        objectGroup.rotation.x += 0.005 * speedMultiplier;

        // Subtle floating oscillation
        objectGroup.position.y = Math.sin(time * 1.5) * 0.08;
      }

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
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mouseenter', onMouseEnter);
      dom.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      pmremGenerator.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [type]);

  return (
    <div
      ref={mountRef}
      data-3d="DRAG"
      className="w-full h-72 md:h-80 cursor-grab active:cursor-grabbing relative flex items-center justify-center"
    />
  );
};

export const SectionDimensionLab: React.FC = () => {
  return (
    <section id="lab" className="relative w-full min-h-screen py-32 bg-[#020205] border-t border-white/[0.05]">
      <div className="max-w-7xl mx-auto px-6 md:px-12 w-full">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs text-[#ccff00] uppercase tracking-widest mb-3">
              <Sparkles className="w-4 h-4 text-[#ccff00]" />
              <span>SECTION 03 // THE DIMENSION LAB</span>
            </div>
            <h2 className="font-syne font-black text-4xl sm:text-6xl md:text-7xl tracking-tight text-white">
              EXPERIMENTAL <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-[#ccff00]">MATTER.</span>
            </h2>
          </div>
          <p className="max-w-md font-mono text-xs text-gray-400 uppercase tracking-wider leading-relaxed">
            Hover, grab, and spin each specimen. Inertial momentum physics and real-time surface shaders respond dynamically to pointer velocity.
          </p>
        </div>

        {/* 3 Specimen Cards arranged in an asymmetric high-tech laboratory layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Specimen 01: Liquid Chrome Hyper-Sphere */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between relative group overflow-hidden border border-white/10">
            <div className="flex items-center justify-between font-mono text-[10px] text-gray-400 pb-3 border-b border-white/5">
              <span className="text-[#00f0ff] font-bold">SPECIMEN #001 // CHROME SPHERE</span>
              <span className="flex items-center gap-1">
                <Rotate3d className="w-3 h-3 text-[#00f0ff]" /> DRAG ENABLED
              </span>
            </div>

            <SpecimenCanvas type="chrome-sphere" />

            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="font-syne font-bold text-2xl text-white mb-1">
                Hyper-Reflective Sphere
              </h3>
              <p className="font-sans text-xs text-gray-400 leading-relaxed mb-4">
                High-polish liquid chrome matrix reflecting simulated HDR studio lighting. Features gyroscopic orbital confinement ring.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[9px] bg-white/[0.02] p-3 rounded-xl border border-white/5 text-gray-400">
                <div>MASS: <span className="text-white">4.82 KG</span></div>
                <div>ROUGHNESS: <span className="text-[#00f0ff]">0.03</span></div>
                <div>INERTIA: <span className="text-white">0.95 TENSOR</span></div>
                <div>MATERIAL: <span className="text-white">LIQUID MERCURY</span></div>
              </div>
            </div>
          </div>

          {/* Specimen 02: Refractive Glass Crystal Cube */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between relative group overflow-hidden border border-white/10">
            <div className="flex items-center justify-between font-mono text-[10px] text-gray-400 pb-3 border-b border-white/5">
              <span className="text-[#ccff00] font-bold">SPECIMEN #002 // PRISM CUBE</span>
              <span className="flex items-center gap-1">
                <Rotate3d className="w-3 h-3 text-[#ccff00]" /> DRAG ENABLED
              </span>
            </div>

            <SpecimenCanvas type="glass-cube" />

            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="font-syne font-bold text-2xl text-white mb-1">
                Crystal Refraction Cube
              </h3>
              <p className="font-sans text-xs text-gray-400 leading-relaxed mb-4">
                Translucent transmission glass block encasing an energized radioactive octahedron core with dynamic internal caustics.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[9px] bg-white/[0.02] p-3 rounded-xl border border-white/5 text-gray-400">
                <div>MASS: <span className="text-white">8.15 KG</span></div>
                <div>TRANSMISSION: <span className="text-[#ccff00]">95.0%</span></div>
                <div>IOR: <span className="text-white">1.55 GLASS</span></div>
                <div>CORE: <span className="text-white">EMISSIVE OCTA</span></div>
              </div>
            </div>
          </div>

          {/* Specimen 03: Twisted Metallic Gyro-Ring */}
          <div className="glass-panel glass-panel-hover rounded-3xl p-6 flex flex-col justify-between relative group overflow-hidden border border-white/10">
            <div className="flex items-center justify-between font-mono text-[10px] text-gray-400 pb-3 border-b border-white/5">
              <span className="text-[#3b82f6] font-bold">SPECIMEN #003 // TORUS KNOT</span>
              <span className="flex items-center gap-1">
                <Rotate3d className="w-3 h-3 text-[#3b82f6]" /> DRAG ENABLED
              </span>
            </div>

            <SpecimenCanvas type="twisted-ring" />

            <div className="mt-4 pt-4 border-t border-white/5">
              <h3 className="font-syne font-bold text-2xl text-white mb-1">
                Dark Titanium Torus Knot
              </h3>
              <p className="font-sans text-xs text-gray-400 leading-relaxed mb-4">
                Continuous non-orientable topological manifold cast in brushed aerospace-grade titanium alloy with high torsional resistance.
              </p>
              <div className="grid grid-cols-2 gap-2 font-mono text-[9px] bg-white/[0.02] p-3 rounded-xl border border-white/5 text-gray-400">
                <div>MASS: <span className="text-white">12.40 KG</span></div>
                <div>METALNESS: <span className="text-[#3b82f6]">0.92</span></div>
                <div>TOPOLOGY: <span className="text-white">KNOT (2,3)</span></div>
                <div>ALLOY: <span className="text-white">TI-6AL-4V</span></div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
