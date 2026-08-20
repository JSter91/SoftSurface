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

type BendModel = "distance" | "dihedral";

interface PlaygroundSettings {
  preset: SoftSurfacePreset;

  segmentsX: number;
  segmentsY: number;

  gravityY: number;

  iterations: number;

  fixedTimeStep: number;
  maxSubsteps: number;

  relaxation: number;

  bendModel: BendModel;
  bendStiffness: number;
}

const settings: PlaygroundSettings = {
  preset: "cloth",

  segmentsX: 48,
  segmentsY: 36,

  gravityY: 0,

  iterations: 1,

  fixedTimeStep: 1 / 120,
  maxSubsteps: 4,

  relaxation: 0.5,

  bendModel: "dihedral",
  bendStiffness: 0.3,
};

/**
 * Surface factory
 */
function createSurface(): {
  surface: SoftSurface;
  geometry: SoftSurfaceGeometry;
} {
  const surface = new SoftSurface({
    width: 4,
    height: 3,

    segmentsX: settings.segmentsX,
    segmentsY: settings.segmentsY,

    preset: settings.preset,

    acceleration: [0, settings.gravityY, 0],

    iterations: settings.iterations,

    fixedTimeStep: settings.fixedTimeStep,

    maxSubsteps: settings.maxSubsteps,

    relaxation: settings.relaxation,

    bendModel: settings.bendModel,

    bendStiffness: settings.bendStiffness,
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

let { surface, geometry } = createSurface();

const mesh = new THREE.Mesh(geometry, material);
mesh.frustumCulled = false;

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
 * Playground UI
 */
const uiControls = document.createElement("div");

uiControls.className = "controls";

const title = document.createElement("h2");

title.textContent = "SoftSurface";

uiControls.appendChild(title);

const subtitle = document.createElement("div");

subtitle.className = "controls-subtitle";

subtitle.textContent = "Physics Playground";

uiControls.appendChild(subtitle);

/**
 * Surface rebuild
 *
 * Slider events may fire many times in the same
 * frame. Rebuild at most once per animation frame.
 */
let rebuildQueued = false;

function scheduleSurfaceRebuild(): void {
  if (rebuildQueued) {
    return;
  }

  rebuildQueued = true;

  requestAnimationFrame(() => {
    rebuildQueued = false;

    rebuildSurface();
  });
}

function rebuildSurface(): void {
  const next = createSurface();

  const oldGeometry = geometry;

  interaction.dispose();

  surface = next.surface;

  geometry = next.geometry;

  mesh.geometry = geometry;

  interaction = createInteraction();

  oldGeometry.dispose();
}

/**
 * UI helpers
 */
function createSection(titleText: string): HTMLElement {
  const section = document.createElement("section");

  section.className = "controls-section";

  const heading = document.createElement("h3");

  heading.textContent = titleText;

  section.appendChild(heading);

  return section;
}

function createSelectControl<T extends string>(
  labelText: string,
  value: T,
  options: readonly T[],
  onChange: (value: T) => void,
): HTMLElement {
  const row = document.createElement("label");

  row.className = "control-row";

  const name = document.createElement("span");

  name.textContent = labelText;

  const select = document.createElement("select");

  for (const optionValue of options) {
    const option = document.createElement("option");

    option.value = optionValue;

    option.textContent = optionValue;

    select.appendChild(option);
  }

  select.value = value;

  select.addEventListener("change", () => {
    onChange(select.value as T);
  });

  row.append(name, select);

  return row;
}

function createRangeControl(
  labelText: string,
  value: number,
  minimum: number,
  maximum: number,
  step: number,
  onChange: (value: number) => void,
  digits = 2,
): HTMLElement {
  const wrapper = document.createElement("div");

  wrapper.className = "range-control";

  const header = document.createElement("div");

  header.className = "range-header";

  const name = document.createElement("span");

  name.textContent = labelText;

  const output = document.createElement("span");

  output.className = "range-value";

  output.textContent = value.toFixed(digits);

  header.append(name, output);

  const input = document.createElement("input");

  input.type = "range";

  input.min = String(minimum);

  input.max = String(maximum);

  input.step = String(step);

  input.value = String(value);

  input.addEventListener("input", () => {
    const next = input.valueAsNumber;

    output.textContent = next.toFixed(digits);

    onChange(next);
  });

  wrapper.append(header, input);

  return wrapper;
}

function createNumberControl(
  labelText: string,
  value: number,
  minimum: number,
  maximum: number,
  onChange: (value: number) => void,
): HTMLElement {
  const row = document.createElement("label");

  row.className = "control-row";

  const name = document.createElement("span");

  name.textContent = labelText;

  const input = document.createElement("input");

  input.type = "number";

  input.min = String(minimum);

  input.max = String(maximum);

  input.step = "1";

  input.value = String(value);

  input.addEventListener("change", () => {
    const next = Math.min(
      maximum,
      Math.max(minimum, Math.round(input.valueAsNumber)),
    );

    input.value = String(next);

    onChange(next);
  });

  row.append(name, input);

  return row;
}

/**
 * Material
 */
const materialSection = createSection("Material");

materialSection.appendChild(
  createSelectControl(
    "Preset",
    settings.preset,
    ["cloth", "silk", "paper", "rubber", "gel"] satisfies SoftSurfacePreset[],
    (value) => {
      settings.preset = value;

      scheduleSurfaceRebuild();
    },
  ),
);

uiControls.appendChild(materialSection);

/**
 Bending
 */
const bendingSection = createSection("Bending");

bendingSection.appendChild(
  createSelectControl(
    "Model",
    settings.bendModel,
    ["distance", "dihedral"] satisfies BendModel[],
    (value) => {
      settings.bendModel = value;

      scheduleSurfaceRebuild();
    },
  ),
);

bendingSection.appendChild(
  createRangeControl(
    "Stiffness",
    settings.bendStiffness,
    0,
    0.6,
    0.01,
    (value) => {
      settings.bendStiffness = value;

      scheduleSurfaceRebuild();
    },
  ),
);

bendingSection.appendChild(
  createRangeControl("Relaxation", settings.relaxation, 0, 1, 0.01, (value) => {
    settings.relaxation = value;

    scheduleSurfaceRebuild();
  }),
);

uiControls.appendChild(bendingSection);

/**
 * Solver
 */
const solverSection = createSection("Solver");

solverSection.appendChild(
  createRangeControl(
    "Iterations",
    settings.iterations,
    1,
    10,
    1,
    (value) => {
      settings.iterations = value;

      scheduleSurfaceRebuild();
    },
    0,
  ),
);

solverSection.appendChild(
  createRangeControl(
    "Gravity Y",
    settings.gravityY,
    -10,
    10,
    0.1,
    (value) => {
      settings.gravityY = value;

      scheduleSurfaceRebuild();
    },
    1,
  ),
);

solverSection.appendChild(
  createNumberControl("Max substeps", settings.maxSubsteps, 1, 10, (value) => {
    settings.maxSubsteps = value;

    scheduleSurfaceRebuild();
  }),
);

uiControls.appendChild(solverSection);

/**
 * Resolution
 */
const resolutionSection = createSection("Resolution");

resolutionSection.appendChild(
  createNumberControl("Segments X", settings.segmentsX, 4, 100, (value) => {
    settings.segmentsX = value;

    scheduleSurfaceRebuild();
  }),
);

resolutionSection.appendChild(
  createNumberControl("Segments Y", settings.segmentsY, 4, 100, (value) => {
    settings.segmentsY = value;

    scheduleSurfaceRebuild();
  }),
);

uiControls.appendChild(resolutionSection);

/**
 * Performance HUD
 */
const performanceSection = createSection("Performance");

const performanceOutput = document.createElement("pre");

performanceOutput.className = "performance-output";

performanceOutput.textContent = [
  "FPS       --",
  "Physics   --",
  "Geometry  --",
  "Render    --",
].join("\n");

performanceSection.appendChild(performanceOutput);

uiControls.appendChild(performanceSection);

document.body.appendChild(uiControls);

/**
 * Simulation
 */
const clock = new THREE.Clock();

// function animate(): void {
//   requestAnimationFrame(animate);

//   const delta = clock.getDelta();

//   surface.step(delta);

//   geometry.update();

//   orbitControls.update();

//   renderer.render(scene, camera);
// }

let physicsTotal = 0;
let geometryTotal = 0;
let renderTotal = 0;

let physicsMax = 0;
let geometryMax = 0;
let renderMax = 0;

let measuredFrames = 0;
let lastReportTime = performance.now();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  const physicsStart = performance.now();

  surface.step(delta);

  const physicsEnd = performance.now();

  geometry.update();

  const geometryEnd = performance.now();

  orbitControls.update();
  renderer.render(scene, camera);

  const renderEnd = performance.now();

  const physicsTime = physicsEnd - physicsStart;

  const geometryTime = geometryEnd - physicsEnd;

  const renderTime = renderEnd - geometryEnd;

  physicsTotal += physicsTime;
  geometryTotal += geometryTime;
  renderTotal += renderTime;

  physicsMax = Math.max(physicsMax, physicsTime);

  geometryMax = Math.max(geometryMax, geometryTime);

  renderMax = Math.max(renderMax, renderTime);

  measuredFrames++;

  const now = performance.now();

  if (now - lastReportTime >= 1000) {
    const elapsed = now - lastReportTime;

    const physicsAverage = physicsTotal / measuredFrames;

    const geometryAverage = geometryTotal / measuredFrames;

    const renderAverage = renderTotal / measuredFrames;

    const fps = measuredFrames / (elapsed / 1000);

    performanceOutput.textContent = [
      `FPS       ${fps.toFixed(1)}`,
      "",
      `Physics   ${physicsAverage.toFixed(2)} ms`,
      `          max ${physicsMax.toFixed(2)} ms`,
      "",
      `Geometry  ${geometryAverage.toFixed(2)} ms`,
      `          max ${geometryMax.toFixed(2)} ms`,
      "",
      `Render    ${renderAverage.toFixed(2)} ms`,
      `          max ${renderMax.toFixed(2)} ms`,
    ].join("\n");

    physicsTotal = 0;
    geometryTotal = 0;
    renderTotal = 0;

    physicsMax = 0;
    geometryMax = 0;
    renderMax = 0;

    measuredFrames = 0;

    lastReportTime = now;
  }
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
