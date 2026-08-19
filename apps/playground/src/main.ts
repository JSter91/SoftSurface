import * as THREE from "three";

import { SoftSurface } from "@softsurface/core";
import { SoftSurfaceGeometry } from "@softsurface/three";

import "./style.css";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

camera.position.set(0, 0, 7);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

document.querySelector<HTMLDivElement>("#app")!.appendChild(renderer.domElement);

/**
 * SoftSurface simulation
 */
const surface = new SoftSurface({
  width: 4,
  height: 3,

  segmentsX: 30,
  segmentsY: 22,

  structuralStiffness: 1,
  shearStiffness: 0.85,
  bendStiffness: 0.35,

  damping: 0.02,

  acceleration: [0, -9.81, 0],

  iterations: 10,
});

/**
 * Pin the two upper corners.
 */
const topLeft = surface.grid.getParticleIndex(0, 0);

const topRight = surface.grid.getParticleIndex(
  surface.grid.columns - 1,
  0,
);

surface.pin(topLeft);
surface.pin(topRight);

/**
 * Three.js geometry using the same Float32Array
 * used by the physics engine.
 */
const geometry = new SoftSurfaceGeometry(surface);

const material = new THREE.MeshStandardMaterial({
  color: 0xd9d9d9,
  roughness: 0.65,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

const mesh = new THREE.Mesh(
  geometry,
  material,
);

scene.add(mesh);

/**
 * Lighting
 */
const ambientLight = new THREE.AmbientLight(
  0xffffff,
  1.5,
);

scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(
  0xffffff,
  3,
);

directionalLight.position.set(3, 4, 5);

scene.add(directionalLight);

/**
 * Simulation loop
 */
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = Math.min(
    clock.getDelta(),
    1 / 30,
  );

  surface.step(delta);

  geometry.update();

  renderer.render(
    scene,
    camera,
  );
}

animate();

/**
 * Resize
 */
window.addEventListener("resize", () => {
  camera.aspect =
    window.innerWidth /
    window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(
    window.innerWidth,
    window.innerHeight,
  );
});