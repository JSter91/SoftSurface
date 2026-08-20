import * as THREE from "three";

import { SoftSurface, type SoftSurfacePreset } from "@softsurface/core";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  SoftSurfaceGeometry,
  SoftSurfacePointerInteraction,
} from "@softsurface/three";

import "./style.css";

/**
 * Scene
 */
const scene = new THREE.Scene();

scene.background = new THREE.Color(0x111111);

/**
 * Camera
 */
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);

camera.position.set(0, 0, 7);

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({
  antialias: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

renderer.setSize(window.innerWidth, window.innerHeight);

document
  .querySelector<HTMLDivElement>("#app")!
  .appendChild(renderer.domElement);

/**
 * Camera controls
 *
 * Left drag on empty space:
 * rotate camera.
 *
 * Wheel:
 * zoom.
 */
const orbitControls = new OrbitControls(camera, renderer.domElement);

orbitControls.enableDamping = true;
orbitControls.dampingFactor = 0.08;

orbitControls.enablePan = false;

orbitControls.minDistance = 4;
orbitControls.maxDistance = 12;

orbitControls.target.set(0, 0, 0);

orbitControls.update();

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
  /* gravity 1 */
  // const surface =
  //   new SoftSurface({
  //     width: 4,
  //     height: 3,

  //     segmentsX: 30,
  //     segmentsY: 22,

  //     preset,

  //     acceleration: [
  //       0,
  //       -9.81,
  //       0,
  //     ],

  //     iterations: 10,

  //     fixedTimeStep: 1 / 120,
  //     maxSubsteps: 4,

  //     relaxation: 0.025
  //   });

  /* gravity 0 */
  const surface = new SoftSurface({
    width: 4,
    height: 3,

    segmentsX: 48,
    segmentsY: 36,

    preset,

    acceleration: [0, 0, 0],

    iterations: 10,

    fixedTimeStep: 1 / 120,
    maxSubsteps: 4,

    relaxation: 0.25,
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

/**
 * Initial surface
 */
let currentPreset: SoftSurfacePreset = "cloth";

let { surface, geometry } = createSurface(currentPreset);

const mesh = new THREE.Mesh(geometry, material);

scene.add(mesh);

/**
 * Interaction factory
 *
 * Keeping this in a function prevents us from
 * duplicating the configuration when changing presets.
 */
function createInteraction(): SoftSurfacePointerInteraction {
  return new SoftSurfacePointerInteraction(
    surface,
    mesh,
    camera,
    renderer.domElement,
    {
      grab: {
        radius: 0.45,
        strength: 1,
      },

      onGrabStart: () => {
        orbitControls.enabled = false;
      },

      onGrabEnd: () => {
        orbitControls.enabled = true;
      },
    },
  );
}

let interaction = createInteraction();

/**
 * Preset UI
 */
const uiControls = document.createElement("div");

uiControls.className = "controls";

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

uiControls.appendChild(label);

document.body.appendChild(uiControls);

/**
 * Change material
 */
select.addEventListener("change", () => {
  currentPreset = select.value as SoftSurfacePreset;

  const next = createSurface(currentPreset);

  const oldGeometry = geometry;

  interaction.dispose();

  surface = next.surface;

  geometry = next.geometry;

  mesh.geometry = geometry;

  interaction = createInteraction();

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

  orbitControls.update();

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
