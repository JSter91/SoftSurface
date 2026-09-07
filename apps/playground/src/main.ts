import * as THREE from "three";

import { SoftSurface, type SoftSurfacePreset } from "@softsurface/core";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import {
  SoftSurfaceGeometry,
  SoftSurfacePointerInteraction,
} from "@softsurface/three";

import {
  ScenarioRecorder,
  type RecordedScenario,
  type ScenarioConfiguration,
} from "./ScenarioRecording.js";

import { ScenarioReplay } from "./ScenarioReplay.js";

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

  selfCollisionEnabled: boolean;
  selfCollisionThickness: number;
  selfCollisionCellSize: number;
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

  selfCollisionEnabled: false,
  selfCollisionThickness: 0.03,
  selfCollisionCellSize: 0.17,
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

    selfCollision: {
      enabled: settings.selfCollisionEnabled,
      thickness: settings.selfCollisionThickness,
      cellSize: settings.selfCollisionCellSize,
    },
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

function createSurfaceFromScenario(scenario: RecordedScenario): {
  surface: SoftSurface;
  geometry: SoftSurfaceGeometry;
} {
  const configuration = scenario.configuration;

  const surface = new SoftSurface({
    width: configuration.width,
    height: configuration.height,

    segmentsX: configuration.segmentsX,

    segmentsY: configuration.segmentsY,

    preset: configuration.preset as SoftSurfacePreset,

    acceleration: [0, configuration.gravityY, 0],

    iterations: configuration.iterations,

    fixedTimeStep: configuration.fixedTimeStep,

    maxSubsteps: configuration.maxSubsteps,

    relaxation: configuration.relaxation,

    bendModel: configuration.bendModel as BendModel,

    bendStiffness: configuration.bendStiffness,

    selfCollision: {
      enabled: configuration.selfCollisionEnabled,

      thickness: configuration.selfCollisionThickness,

      cellSize: configuration.selfCollisionCellSize,
    },
  });

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

const scenarioRecorder = new ScenarioRecorder();

let recordedScenario: RecordedScenario | null = null;

let scenarioReplay: ScenarioReplay | null = null;

const replayCollisionTelemetry: Array<{
  step: number;
  candidatePairs: number;
  testedPairs: number;
  contacts: number;
  resolvedContacts: number;
  staleContacts: number;
  hashBuildMs: number;
  detectionMs: number;
  responseMs: number;
  totalMs: number;
}> = [];

/**
 * Total number of physics substeps executed
 * by the current playground session.
 *
 * This counter is never reset by recording.
 */
let physicsStep = 0;

/**
 * Global physics step at which the current
 * recording started.
 *
 * Recorded event steps are relative to this.
 */
let recordingStartStep = 0;
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

      onGrabStart: (point) => {
        orbitControls.enabled = false;
        scenarioRecorder.recordGrab(point[0], point[1], point[2]);
      },
      onGrabMove: (point) => {
        scenarioRecorder.recordMoveGrab(point[0], point[1], point[2]);
      },
      onGrabEnd: () => {
        orbitControls.enabled = true;

        scenarioRecorder.recordRelease();
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

function createCheckboxControl(
  labelText: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const row = document.createElement("label");

  row.className = "control-row";

  const name = document.createElement("span");

  name.textContent = labelText;

  const input = document.createElement("input");

  input.type = "checkbox";

  input.checked = checked;

  input.addEventListener("change", () => {
    onChange(input.checked);
  });

  row.append(name, input);

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
 * Self collision
 */
const selfCollisionSection = createSection("Self collision");

selfCollisionSection.appendChild(
  createCheckboxControl("Enabled", settings.selfCollisionEnabled, (checked) => {
    settings.selfCollisionEnabled = checked;

    scheduleSurfaceRebuild();
  }),
);

selfCollisionSection.appendChild(
  createRangeControl(
    "Thickness",
    settings.selfCollisionThickness,
    0.005,
    0.1,
    0.005,
    (value) => {
      settings.selfCollisionThickness = value;

      scheduleSurfaceRebuild();
    },
    3,
  ),
);

selfCollisionSection.appendChild(
  createRangeControl(
    "Cell size",
    settings.selfCollisionCellSize,
    0.05,
    0.5,
    0.01,
    (value) => {
      settings.selfCollisionCellSize = value;

      scheduleSurfaceRebuild();
    },
    2,
  ),
);

uiControls.appendChild(selfCollisionSection);

/**
 * Scenario recording
 */
const recordingSection = createSection("Scenario recording");

const startRecordingButton = document.createElement("button");

startRecordingButton.type = "button";

startRecordingButton.textContent = "Start recording";

const stopRecordingButton = document.createElement("button");

stopRecordingButton.type = "button";

stopRecordingButton.textContent = "Stop recording";

stopRecordingButton.disabled = true;

const exportRecordingButton = document.createElement("button");

exportRecordingButton.type = "button";

exportRecordingButton.textContent = "Export JSON";

exportRecordingButton.disabled = true;

const replayRecordingButton = document.createElement("button");

replayRecordingButton.type = "button";

replayRecordingButton.textContent = "Replay last recording";

replayRecordingButton.disabled = true;

const recordingStatus = document.createElement("pre");

recordingStatus.textContent = "Not recording";

startRecordingButton.addEventListener("click", () => {
  console.log("[scenario] start clicked");
  const configuration: ScenarioConfiguration = {
    width: 4,
    height: 3,

    segmentsX: settings.segmentsX,

    segmentsY: settings.segmentsY,

    preset: settings.preset,

    gravityY: settings.gravityY,

    iterations: settings.iterations,

    fixedTimeStep: settings.fixedTimeStep,

    maxSubsteps: settings.maxSubsteps,

    relaxation: settings.relaxation,

    bendModel: settings.bendModel,

    bendStiffness: settings.bendStiffness,

    selfCollisionEnabled: settings.selfCollisionEnabled,

    selfCollisionThickness: settings.selfCollisionThickness,

    selfCollisionCellSize: settings.selfCollisionCellSize,
  };

  /**
   * Recording while a replay drives the surface
   * would capture events against a sequence the
   * user is not controlling.
   */
  scenarioReplay = null;

  /**
   * Keep the global simulation counter intact.
   *
   * The recorder uses this value only as an
   * origin for relative scenario steps.
   */
  recordingStartStep = physicsStep;

  recordedScenario = scenarioRecorder.start(
    configuration,
    surface.positions,
    surface.previousPositions,
    surface.inverseMasses,
  );

  console.log("[scenario] raw result", recordedScenario);

  console.log("[scenario] started", {
    isRecording: scenarioRecorder.isRecording,

    scenarioCreated: recordedScenario != null,

    type: typeof recordedScenario,

    initialPositions: recordedScenario?.initialPositions?.length,

    events: recordedScenario?.events?.length,
  });
  startRecordingButton.textContent = "Recording...";
  startRecordingButton.disabled = true;

  stopRecordingButton.disabled = false;
  recordingStatus.textContent = "Recording...";
});

recordingSection.append(
  startRecordingButton,
  stopRecordingButton,
  exportRecordingButton,
  replayRecordingButton,
  recordingStatus,
);

uiControls.appendChild(recordingSection);

stopRecordingButton.addEventListener("click", () => {
  console.log("[scenario] stop clicked");
  console.log("[scenario] before stop", {
    isRecording: scenarioRecorder.isRecording,

    scenarioCreated: recordedScenario != null,

    events: recordedScenario?.events.length,
  });
  scenarioRecorder.stop();

  exportRecordingButton.disabled = recordedScenario == null;

  replayRecordingButton.disabled = recordedScenario === null;

  if (recordedScenario) {
    const events = recordedScenario.events;

    const firstEvent = events[0];

    const lastEvent = events[events.length - 1];

    recordingStatus.textContent = [
      "Recording complete",
      `Events: ${events.length}`,
      `First step: ${firstEvent?.step ?? "--"}`,
      `Last step: ${lastEvent?.step ?? "--"}`,
    ].join("\n");

    console.log("Recorded scenario:", recordedScenario);
  }
  startRecordingButton.disabled = false;

  startRecordingButton.textContent = "Start recording";

  stopRecordingButton.disabled = true;
});

exportRecordingButton.addEventListener("click", () => {
  if (!recordedScenario) {
    return;
  }

  const json = JSON.stringify(recordedScenario, null, 2);

  const blob = new Blob([json], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;

  link.download = "softsurface-scenario.json";

  link.click();

  URL.revokeObjectURL(url);
});

replayRecordingButton.addEventListener("click", () => {
  if (!recordedScenario) {
    return;
  }

  const next = createSurfaceFromScenario(recordedScenario);

  const oldGeometry = geometry;

  /**
   * Remove interaction attached to
   * the previous surface.
   */
  interaction.dispose();

  surface = next.surface;

  geometry = next.geometry;

  mesh.geometry = geometry;

  /**
   * Recreate pointer interaction so it
   * references the new surface.
   */
  interaction = createInteraction();

  oldGeometry.dispose();

  replayCollisionTelemetry.length = 0;

  /**
   * ScenarioReplay restores:
   *
   * positions
   * previousPositions
   * inverseMasses
   *
   * from the exact recording snapshot.
   */
  scenarioReplay = new ScenarioReplay(surface, recordedScenario, {
    radius: 0.45,
    strength: 1,
  });

  geometry.update();

  recordingStatus.textContent = "Replaying...";
});
/**
 * Performance HUD
 */
const performanceSection = createSection("Performance");

const performanceOutput = document.createElement("pre");

performanceOutput.className = "performance-output";

const copyPerformanceButton = document.createElement("button");

copyPerformanceButton.type = "button";
copyPerformanceButton.className = "performance-copy-button";

copyPerformanceButton.textContent = "Copy report";

copyPerformanceButton.addEventListener("click", async () => {
  const report = [
    "SoftSurface Performance Report",
    "",
    "Configuration",
    `Preset      ${settings.preset}`,
    `Resolution  ${settings.segmentsX} × ${settings.segmentsY}`,
    `Gravity Y   ${settings.gravityY}`,
    `Iterations  ${settings.iterations}`,
    `Timestep    ${settings.fixedTimeStep}`,
    `Substeps    ${settings.maxSubsteps}`,
    `Relaxation  ${settings.relaxation}`,
    `Bend model  ${settings.bendModel}`,
    `Bend stiff. ${settings.bendStiffness}`,
    "",
    "Self collision",
    `Enabled     ${settings.selfCollisionEnabled}`,
    `Thickness   ${settings.selfCollisionThickness}`,
    `Cell size   ${settings.selfCollisionCellSize}`,
    "",
    "Performance",
    performanceOutput.textContent,
  ].join("\n");

  try {
    await navigator.clipboard.writeText(report);

    copyPerformanceButton.textContent = "Copied";

    window.setTimeout(() => {
      copyPerformanceButton.textContent = "Copy report";
    }, 1200);
  } catch (error) {
    console.error("Failed to copy performance report:", error);

    copyPerformanceButton.textContent = "Copy failed";

    window.setTimeout(() => {
      copyPerformanceButton.textContent = "Copy report";
    }, 1200);
  }
});

performanceOutput.textContent = [
  "FPS       --",
  "Physics   --",
  "Geometry  --",
  "Render    --",
].join("\n");

performanceSection.append(performanceOutput, copyPerformanceButton);
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

  let executedSubsteps: number;

  if (scenarioReplay) {
    /**
     * Replay advances exactly one recorded
     * physics step at a time.
     *
     * Render frame rate therefore cannot change
     * the physics sequence being reproduced.
     */
    const replayStep = scenarioReplay.stepIndex;

    executedSubsteps = scenarioReplay.step();

    const collisionStats = surface.selfCollisionSolverStats;

    if (collisionStats) {
      replayCollisionTelemetry.push({
        step: replayStep,
        candidatePairs: collisionStats.candidatePairs,
        testedPairs: collisionStats.testedPairs,
        contacts: collisionStats.contacts,
        resolvedContacts: collisionStats.resolvedContacts,
        staleContacts: collisionStats.staleContacts,
        hashBuildMs: collisionStats.hashBuildMs,
        detectionMs: collisionStats.detectionMs,
        responseMs: collisionStats.responseMs,
        totalMs: collisionStats.totalMs,
      });
    }

    /**
     * The last recorded event is the release.
     * Once it is applied the replay is over and
     * the surface returns to live simulation.
     */
    if (scenarioReplay.hasProcessedAllEvents) {
      console.table(replayCollisionTelemetry);
      scenarioReplay = null;

      recordingStatus.textContent = "Replay complete";
    }
  } else {
    executedSubsteps = surface.step(delta);
  }

  physicsStep += executedSubsteps;

  if (scenarioRecorder.isRecording) {
    scenarioRecorder.setStep(physicsStep - recordingStartStep);
  }

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

    const lines = [
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
    ];

    const collisionStats = surface.selfCollisionStats;

    if (collisionStats) {
      lines.push(
        "",
        "Self collision",
        `Hash build  ${collisionStats.hashBuildMs.toFixed(2)} ms`,
        `Narrow      ${collisionStats.narrowPhaseMs.toFixed(2)} ms`,
        `Total       ${collisionStats.totalMs.toFixed(2)} ms`,
        "",
        `Candidates  ${collisionStats.candidatePairs}`,
        `Tested      ${collisionStats.testedPairs}`,
        `Contacts    ${collisionStats.contacts}`,
      );
    }
    performanceOutput.textContent = lines.join("\n");

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
