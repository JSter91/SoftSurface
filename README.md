SoftSurface

Real-time deformable surfaces for the creative web.

SoftSurface is an experimental, browser-first physics engine for interactive deformable surfaces.
It focuses on visually plausible cloth-like and soft-material behavior while keeping the physics core independent from rendering libraries.

Status: active development — interactive physics MVP.

Why SoftSurface?

SoftSurface aims to sit between simple vertex deformation and heavyweight general-purpose soft-body engines.

The project is designed around a few principles:

renderer agnostic physics

real-time browser performance

simple, explicit APIs

visually plausible materials

interactive creative-web use cases

room to evolve beyond rectangular cloth

The current MVP focuses on deformable grid surfaces, but the architecture is intentionally moving toward more general surface topology.

Current features

Physics

Verlet integration

fixed-timestep simulation

structural constraints

shear constraints

distance-based bending

dihedral bending

normalized stiffness across solver iterations

timestep-independent surface relaxation

weighted regional grabbing

pinned particles

generic constraint interface

cached per-iteration constraint stiffness

Three.js integration

zero-copy position buffer sharing with THREE.BufferGeometry

dynamic vertex updates

automatic normal recomputation

raycast-based pointer grabbing

OrbitControls-compatible interaction

camera inspection and zoom

Playground

The included Vite + Three.js playground is used for:

visual testing

material tuning

performance profiling

interaction experiments

physics comparisons

Visual quality

The original bending model used distance constraints between particles two grid cells apart.

It is inexpensive, but strong folds can reveal the underlying rectangular particle grid.

SoftSurface now also supports dihedral bending, which constrains the angle between adjacent triangles instead of approximating bending through distance alone.

In current experiments, combining dihedral bending with surface relaxation produces substantially smoother folds and greatly reduces visible grid artifacts.

Example playground configuration:

const surface = new SoftSurface({
  width: 4,
  height: 3,

  segmentsX: 48,
  segmentsY: 36,

  preset: "cloth",

  acceleration: [0, 0, 0],

  iterations: 1,
  fixedTimeStep: 1 / 120,
  maxSubsteps: 4,

  bendModel: "dihedral",
  bendStiffness: 0.3,

  relaxation: 0.5,
});

These values are an experimental playground baseline, not finalized library defaults.

Architecture

SoftSurface/
├── packages/
│   ├── core/
│   │   └── @softsurface/core
│   │
│   └── three/
│       └── @softsurface/three
│
└── apps/
    └── playground/

@softsurface/core

Renderer-independent simulation layer.

It must not depend on:

Three.js
React
React Three Fiber
WebGL
DOM APIs

The core determines how the surface reacts.

@softsurface/three

Three.js adapter.

It handles renderer-specific concerns such as:

pointer input
    ↓
raycasting
    ↓
mesh intersection
    ↓
world → local conversion
    ↓
SoftSurface grab API

Three.js determines where an interaction occurs; the physics core determines what happens next.

apps/playground

Development and experimentation environment.

It is not intended to be part of the published library.

Physics pipeline

The current simulation pipeline is approximately:

ParticleGrid
    ↓
Verlet integration
    ↓
Structural constraints
    ↓
Shear constraints
    ↓
Bend constraints
    ↓
Constraint solver
    ↓
Surface relaxation
    ↓
Grab interaction
    ↓
Updated positions

Bend models

SoftSurface currently supports:

bendModel: "distance"

and:

bendModel: "dihedral"

Distance bending

Connects particles separated by two grid cells.

Pros

inexpensive

simple

stable in common cases

Cons

stronger grid signature

lower fold quality under aggressive deformation

Dihedral bending

Constrains the angle between adjacent triangles.

Pros

smoother folds

better curvature behavior

substantially reduced grid artifacts

Cons

more computationally expensive

extreme stiffness values still require stability work

Performance

Performance is currently CPU-bound by the physics solver rather than Three.js rendering.

On the current development setup, one representative 48 × 36 playground scene produced approximately:

Configuration

Physics avg

Dihedral / 10 iterations

~5.97 ms

Dihedral / 6 iterations

~3.62 ms

Dihedral / 4 iterations

~2.62 ms

Dihedral / 2 iterations

~1.63 ms

Dihedral / 1 iteration

~0.98 ms

Dihedral / 1 iteration / relaxation 0.5

~0.82 ms

Distance / 10 iterations

~1.86 ms

These numbers are development measurements, not universal benchmarks.

A key observation so far is that the current dihedral setup preserves excellent visual quality even at a very low solver iteration count.

Known limitations

SoftSurface is still experimental.

Current known limitations include:

no self-collision yet

surface layers can self-intersect

extreme dihedral stiffness can become unstable

material presets still need retuning for dihedral bending

relaxation values are still experimental

arbitrary triangle meshes are not supported yet

collision primitives are not implemented yet

Self-intersection is currently one of the most important missing physics features: a folded section can pass through another section of the same surface because there is not yet a collision constraint preventing it.

Getting started

Requirements

Node.js 20+

pnpm

Clone

git clone https://github.com/JSter91/SoftSurface.git
cd SoftSurface

Install

pnpm install

Run the playground

pnpm dev

Run tests

pnpm test

Build the workspace

pnpm build

Workspace scripts

From the repository root:

pnpm dev

Starts the playground.

pnpm test

Runs workspace tests.

pnpm build

Builds all workspace packages and the playground.

Example API

import { SoftSurface } from "@softsurface/core";

const surface = new SoftSurface({
  width: 4,
  height: 3,

  segmentsX: 48,
  segmentsY: 36,

  preset: "cloth",

  acceleration: [0, 0, 0],

  bendModel: "dihedral",
  bendStiffness: 0.3,

  relaxation: 0.5,

  iterations: 1,
  fixedTimeStep: 1 / 120,
  maxSubsteps: 4,
});

surface.pin(0);

surface.step(deltaTime);

Weighted interaction is exposed through:

surface.grab(point, {
  radius: 0.45,
  strength: 1,
});

surface.moveGrab(point);

surface.release();

Material direction

Current material presets include:

cloth

silk

paper

rubber

gel

The main material dimensions currently being explored are:

structural stiffness
shear stiffness
bend stiffness
damping
relaxation

A core design distinction is:

stretch ≠ bend

A material can strongly resist stretching while still folding easily.

The current presets are experimental and will be retuned around the newer dihedral bending model.

Roadmap

Current

Particle grid

Verlet integration

Structural constraints

Shear constraints

Distance bending

Dihedral bending

Generic constraint solver

Fixed timestep

Stiffness normalization

Surface relaxation

Weighted grab interaction

Three.js geometry adapter

Three.js pointer interaction

Initial performance profiling

Solver performance tuning

Next

Playground tuning controls

Performance HUD

Self-collision broad phase

Vertex-triangle self-collision

Dihedral extreme-stiffness stability

Material preset retuning

Push / pull forces

Wind / force fields

Collision primitives

Formal benchmarks

Documentation

npm publishing

Longer term

Arbitrary triangle-mesh topology

GLTF deformable geometry experiments

Closed-mesh volume preservation

XPBD evaluation

Volumetric / tetrahedral soft-body research

React Three Fiber adapter

Long-term direction

SoftSurface should not remain architecturally limited to rectangular cloth.

A possible future evolution is:

ParticleGrid
    ↓
SurfaceTopology / ParticleMesh
    ↓
arbitrary triangle meshes
    ↓
GLTF / product geometry

Potential applications include:

interactive 3D product presentation

material previews

footwear and sole deformation

cushions and foam

rubber and silicone objects

flexible packaging

creative 3D experiences

lightweight game soft bodies

SoftSurface is not intended to replace engineering-grade FEM or scientific material simulation.

The goal is a lightweight, browser-first layer for visually plausible real-time deformation.

Project philosophy

The core architectural rule is simple:

@softsurface/core owns physics. Rendering adapters own rendering-specific input and presentation.

That separation should remain intact as the project grows.

## License

SoftSurface is released under the MIT License.

See [LICENSE](./LICENSE) for details.
