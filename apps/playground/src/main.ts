import * as THREE from "three";

import { SoftSurface, type SoftSurfacePreset } from "@softsurface/core";

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

document
  .querySelector<HTMLDivElement>("#app")!
  .appendChild(renderer.domElement);

/**
 * Lighting
 */
scene.add(new THREE.AmbientLight(0xffffff, 1.5));

const directionalLight = new THREE.DirectionalLight(0xffffff, 3);

directionalLight.position.set(3, 4, 5);

scene.add(directionalLight);

/**
 * Material
 */
const material = new THREE.MeshStandardMaterial({
  color: 0xd9d9d9,
  roughness: 0.65,
  metalness: 0.05,
  side: THREE.DoubleSide,
});

/**
 * Surface factory
 */
function createSurface(preset: SoftSurfacePreset): {
  surface: SoftSurface;
  geometry: SoftSurfaceGeometry;
} {
  const surface = new SoftSurface({
    width: 4,
    height: 3,

    segmentsX: 30,
    segmentsY: 22,

    preset,

    acceleration: [0, -9.81, 0],

    iterations: 10,

    fixedTimeStep: 1 / 120,
    maxSubsteps: 4,
  });

  const topLeft = surface.grid.getParticleIndex(0, 0);

  const topRight = surface.grid.getParticleIndex(surface.grid.columns - 1, 0);

  surface.pin(topLeft);
  surface.pin(topRight);

  const geometry = new SoftSurfaceGeometry(surface);

  return {
    surface,
    geometry,
  };
}

let currentPreset: SoftSurfacePreset = "cloth";

let { surface, geometry } = createSurface(currentPreset);

const mesh = new THREE.Mesh(geometry, material);

scene.add(mesh);

/**
 * Preset UI
 */
const controls = document.createElement("div");

controls.className = "controls";

const label = document.createElement("label");

label.textContent = "Material";

const select = document.createElement("select");

const presets: SoftSurfacePreset[] = [
  "cloth",
  "silk",
  "paper",
  "rubber",
  "gel",
];

for (const preset of presets) {
  const option = document.createElement("option");

  option.value = preset;
  option.textContent = preset;

  select.appendChild(option);
}

select.value = currentPreset;

label.appendChild(select);
controls.appendChild(label);

document.body.appendChild(controls);

select.addEventListener("change", () => {
  currentPreset = select.value as SoftSurfacePreset;

  const next = createSurface(currentPreset);

  const oldGeometry = geometry;

  surface = next.surface;
  geometry = next.geometry;

  mesh.geometry = geometry;

  oldGeometry.dispose();
});

/**
 * Simulation
 */
const clock = new THREE.Clock();

function animate(): void {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  surface.step(delta);

  geometry.update();

  renderer.render(scene, camera);
}

animate();

/**
 * Resize
 */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;

  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
});
