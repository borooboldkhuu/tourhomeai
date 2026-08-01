"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Lightweight Three.js equirectangular viewer.
 * Alternative renderer for single-panorama previews (drag to look around).
 */
export function ThreeViewer({ panoramaUrl, className }: { panoramaUrl: string; className?: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 1, 1100);
    camera.position.set(0, 0, 0.1);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    // Sphere flipped inside-out so the texture is visible from the centre.
    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);

    const texture = new THREE.TextureLoader().load(panoramaUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture }));
    scene.add(mesh);

    let lon = 0, lat = 0, dragging = false, downX = 0, downY = 0, downLon = 0, downLat = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      downX = e.clientX; downY = e.clientY; downLon = lon; downLat = lat;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      lon = (downX - e.clientX) * 0.1 + downLon;
      lat = (e.clientY - downY) * 0.1 + downLat;
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.05, 30, 90);
      camera.updateProjectionMatrix();
    };
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    mount.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    mount.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("resize", onResize);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      lat = Math.max(-85, Math.min(85, lat));
      const phi = THREE.MathUtils.degToRad(90 - lat);
      const theta = THREE.MathUtils.degToRad(lon);
      camera.lookAt(
        500 * Math.sin(phi) * Math.cos(theta),
        500 * Math.cos(phi),
        500 * Math.sin(phi) * Math.sin(theta),
      );
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frame);
      mount.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      mount.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      texture.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [panoramaUrl]);

  return <div ref={mountRef} className={className} />;
}
