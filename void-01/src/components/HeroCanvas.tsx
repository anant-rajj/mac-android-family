import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const HeroCanvas: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Dimensions
    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || window.innerHeight;

    // Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020205, 0.035);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    mount.appendChild(renderer.domElement);

    // Dynamic procedural environment for realistic chrome reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Create a rich procedural studio HDR cube for chrome reflections
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x080812);
    // Add bright studio light strips inside reflection room
    const stripGeo = new THREE.BoxGeometry(10, 0.5, 10);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const topStrip = new THREE.Mesh(stripGeo, stripMat);
    topStrip.position.set(0, 5, 0);
    envScene.add(topStrip);

    const blueStripMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const leftStrip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 8), blueStripMat);
    leftStrip.position.set(-6, 0, 0);
    envScene.add(leftStrip);

    const limeStripMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
    const rightStrip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 8, 8), limeStripMat);
    rightStrip.position.set(6, 0, 0);
    envScene.add(rightStrip);

    const envMap = pmremGenerator.fromScene(envScene).texture;
    scene.environment = envMap;

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0x141a29, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);

    const bluePointLight = new THREE.PointLight(0x00f0ff, 8, 15);
    bluePointLight.position.set(-4, -2, 3);
    scene.add(bluePointLight);

    const limePointLight = new THREE.PointLight(0xccff00, 6, 12);
    limePointLight.position.set(4, 3, 2);
    scene.add(limePointLight);

    // Root Sculpture Group
    const sculptureGroup = new THREE.Group();
    sculptureGroup.scale.set(0.01, 0.01, 0.01); // starts small for expansion intro
    scene.add(sculptureGroup);

    // 1. Chrome Core Sphere
    const coreGeo = new THREE.SphereGeometry(1.2, 64, 64);
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe8ecf5,
      metalness: 0.98,
      roughness: 0.04,
      envMap: envMap,
      envMapIntensity: 2.2,
    });
    const coreMesh = new THREE.Mesh(coreGeo, chromeMat);
    sculptureGroup.add(coreMesh);

    // 2. Interlocking Möbius / Torus Rings (Chrome & Brushed Black Titanium)
    const ringGeo1 = new THREE.TorusGeometry(1.85, 0.065, 32, 120);
    const ringMesh1 = new THREE.Mesh(ringGeo1, chromeMat);
    ringMesh1.rotation.x = Math.PI / 3;
    ringMesh1.rotation.y = Math.PI / 6;
    sculptureGroup.add(ringMesh1);

    const ringGeo2 = new THREE.TorusGeometry(2.35, 0.045, 32, 120);
    const darkChromeMat = new THREE.MeshStandardMaterial({
      color: 0x1a202c,
      metalness: 0.95,
      roughness: 0.12,
      envMap: envMap,
      envMapIntensity: 1.8,
    });
    const ringMesh2 = new THREE.Mesh(ringGeo2, darkChromeMat);
    ringMesh2.rotation.x = -Math.PI / 4;
    ringMesh2.rotation.z = Math.PI / 4;
    sculptureGroup.add(ringMesh2);

    // 3. Translucent Refractive Glass Geometric Shards
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      opacity: 1,
      transparent: true,
      roughness: 0.06,
      ior: 1.52,
      reflectivity: 0.9,
      thickness: 1.2,
      envMap: envMap,
      envMapIntensity: 2.0,
      specularColor: new THREE.Color(0x00f0ff),
    });

    const shardGroup = new THREE.Group();
    const shardGeometries = [
      new THREE.OctahedronGeometry(0.35, 0),
      new THREE.TetrahedronGeometry(0.4, 0),
      new THREE.IcosahedronGeometry(0.32, 0),
      new THREE.DodecahedronGeometry(0.38, 0),
    ];

    const shards: THREE.Mesh[] = [];
    const shardCount = 14;
    for (let i = 0; i < shardCount; i++) {
      const geo = shardGeometries[i % shardGeometries.length];
      const shard = new THREE.Mesh(geo, glassMat);

      const radius = 2.7 + Math.random() * 0.9;
      const theta = (i / shardCount) * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;

      shard.position.set(
        radius * Math.cos(theta) * Math.cos(phi),
        radius * Math.sin(phi),
        radius * Math.sin(theta) * Math.cos(phi)
      );

      shard.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      shardGroup.add(shard);
      shards.push(shard);
    }
    sculptureGroup.add(shardGroup);

    // 4. Subtle Outer Geometric Cage
    const cageGeo = new THREE.IcosahedronGeometry(3.1, 1);
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.09,
    });
    const cageMesh = new THREE.Mesh(cageGeo, cageMat);
    sculptureGroup.add(cageMesh);

    // Mouse Tracking & Drag Momentum
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const isDragging = { current: false };
    const previousMouse = { x: 0, y: 0 };
    const dragVelocity = { x: 0, y: 0 };

    const onPointerMove = (e: MouseEvent) => {
      // Normalized screen coordinate [-1, 1]
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;

      if (isDragging.current) {
        const deltaX = e.clientX - previousMouse.x;
        const deltaY = e.clientY - previousMouse.y;
        dragVelocity.x = deltaX * 0.006;
        dragVelocity.y = deltaY * 0.006;
        sculptureGroup.rotation.y += dragVelocity.x;
        sculptureGroup.rotation.x += dragVelocity.y;
        previousMouse.x = e.clientX;
        previousMouse.y = e.clientY;
      }
    };

    const onPointerDown = (e: MouseEvent) => {
      // Check if clicked inside mount
      const rect = mount.getBoundingClientRect();
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        isDragging.current = true;
        previousMouse.x = e.clientX;
        previousMouse.y = e.clientY;
      }
    };

    const onPointerUp = () => {
      isDragging.current = false;
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mouseup', onPointerUp);

    // Intro Expansion Animation
    let scale = 0.01;
    const targetScale = 1.0;

    // Render loop
    let clock = new THREE.Clock();
    let animId: number;

    const animate = () => {
      clock.getDelta();
      const elapsedTime = clock.getElapsedTime();

      // Smooth expansion intro
      if (scale < targetScale) {
        scale += (targetScale - scale) * 0.045;
        sculptureGroup.scale.set(scale, scale, scale);
      }

      // Smooth mouse follow (lerp)
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Base zero-gravity organic floating
      const floatY = Math.sin(elapsedTime * 0.9) * 0.18;
      const floatX = Math.cos(elapsedTime * 0.7) * 0.12;
      sculptureGroup.position.y = floatY;
      sculptureGroup.position.x = floatX;

      // Drag inertia decay
      if (!isDragging.current) {
        dragVelocity.x *= 0.94;
        dragVelocity.y *= 0.94;
        sculptureGroup.rotation.y += dragVelocity.x;
        sculptureGroup.rotation.x += dragVelocity.y;

        // Subtle continuous variation in rotation
        sculptureGroup.rotation.y += 0.0035 + Math.sin(elapsedTime * 0.4) * 0.0015;
        sculptureGroup.rotation.x += 0.002 + Math.cos(elapsedTime * 0.3) * 0.001;

        // Mouse orientation reactive tilt
        sculptureGroup.rotation.y += mouse.x * 0.008;
        sculptureGroup.rotation.x -= mouse.y * 0.008;
      }

      // Ring counter-rotations
      ringMesh1.rotation.z += 0.006;
      ringMesh2.rotation.z -= 0.004;

      // Glass shards orbit and spin
      shardGroup.rotation.y -= 0.002;
      shards.forEach((shard, idx) => {
        shard.rotation.x += 0.01 * (idx % 2 === 0 ? 1 : -1);
        shard.rotation.y += 0.008;
      });

      // Cage pulse
      cageMesh.rotation.y += 0.001;
      cageMesh.rotation.z += 0.001;

      // Dynamic light movements reacting to pointer
      bluePointLight.position.x = -4 + mouse.x * 2;
      bluePointLight.position.y = -2 + mouse.y * 2;
      limePointLight.position.x = 4 - mouse.x * 2;
      limePointLight.position.y = 3 - mouse.y * 2;

      // Camera subtle perspective tilt
      camera.position.x = mouse.x * 0.45;
      camera.position.y = mouse.y * 0.45;
      camera.lookAt(0, 0, 0);

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
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
      pmremGenerator.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-3d="DRAG"
      className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
    />
  );
};
