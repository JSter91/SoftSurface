# SoftSurface — Project State

**Last updated:** 2026-08-19
**Status:** Active development — early physics MVP

## Goal

SoftSurface is a lightweight, renderer-agnostic engine for real-time deformable surfaces on the web.

The goal is to support materials and behaviors such as:

- cloth
- silk
- paper
- rubber
- gel
- membranes
- interactive deformable surfaces

The physics engine must remain independent from rendering libraries such as Three.js.

---

## Architecture

```text
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
```

### `@softsurface/core`

Renderer-independent physics engine.

Currently contains:

- `ParticleGrid`
- `VerletIntegrator`
- `DistanceConstraint`
- `ConstraintBuilder`
- `ConstraintSolver`
- `SoftSurface`
- material presets
- fixed timestep simulation

The core has **no dependency on Three.js, React or the DOM**.

### `@softsurface/three`

Three.js adapter.

Currently contains:

- `SoftSurfaceGeometry`

`SoftSurfaceGeometry` exposes the simulation's `Float32Array` directly as a Three.js `BufferAttribute`, avoiding a position-array copy on every frame.

### `apps/playground`

Vite + Three.js development environment.

It is used only for:

- visual testing
- material tuning
- interaction experiments
- performance testing
- examples

It is not part of the published library.

---

## Physics model

Current simulation model:

```text
Particle grid
    ↓
Verlet integration
    ↓
Structural constraints
Shear constraints
Bend constraints
    ↓
Iterative constraint solver
    ↓
Updated Float32Array positions
```

### Structural constraints

Control how much the surface can stretch.

High stiffness:

```text
o---o---o---o
```

The distance between particles remains almost constant.

### Bend constraints

Control how easily the surface can fold or curve.

Low bend stiffness allows strong folds while preserving the overall dimensions of the surface.

### Shear constraints

Control diagonal deformation and prevent grid cells from collapsing into strongly skewed shapes.

---

## Simulation timing

Physics uses a fixed timestep.

Current default:

```text
1 / 120 s
```

with a configurable maximum number of substeps.

`surface.step(deltaTime)` accepts the render-frame delta, while the engine internally advances physics using fixed simulation steps.

This keeps the simulation more consistent across different rendering frame rates.

---

## Constraint stiffness

Constraint stiffness is normalized across solver iterations.

Originally the same stiffness was applied on every solver iteration, which caused values such as:

```text
0.95
0.90
0.65
0.55
```

to all approach an effective stiffness close to `1` when using many solver iterations.

The solver now converts global stiffness into a per-iteration stiffness.

Conceptually:

```text
iterationStiffness =
1 - (1 - stiffness)^(1 / iterations)
```

This makes material parameters significantly more meaningful.

---

## Material presets

Currently supported:

```text
cloth
silk
paper
rubber
gel
```

Important material dimensions currently include:

```text
structuralStiffness
shearStiffness
bendStiffness
damping
```

### Current interpretation

**Cloth**

- low stretch
- medium bend resistance
- moderate movement

**Silk**

- low stretch
- very low bend resistance
- easy folding

**Paper**

- almost no stretch
- high bend resistance
- tends to retain flatter shapes

**Rubber**

- more stretch
- medium bend resistance
- stronger elastic behavior

**Gel**

- moderate stretch
- low bend resistance
- high damping
- slower / softer response

Preset values are still experimental and will be tuned visually.

---

## Playground status

The first Three.js simulation is working.

Current demo:

- rectangular deformable surface
- two upper corners pinned
- gravity
- real-time simulation
- Three.js `MeshStandardMaterial`
- runtime material preset selector

The different presets are now visually distinguishable.

The most obvious differences currently come from:

- stretch
- bend behavior
- damping / bounce

---

## Tests

Current test coverage includes:

- particle grid creation
- initial particle positions
- inverse masses
- Verlet integration
- damping
- acceleration
- pinned particles
- distance constraints
- grid constraint generation
- iterative constraint solving
- SoftSurface API
- material presets
- fixed timestep behavior
- Three.js geometry adapter

Tests and TypeScript builds are currently passing.

---

## Relevant milestones

```text
1ffe13d feat(core): add SoftSurface simulation API
c9851ae feat(three): add SoftSurface geometry adapter
543d706 chore(playground): initialize Vite app
3338d82 feat(playground): render first SoftSurface cloth demo
05af44d feat(core): add fixed timestep simulation
00efc74 feat(core): add material presets
```

Additional commits were made afterwards for stiffness normalization, preset tuning and playground cleanup.

---

## Current observations

The first implementation initially made all materials appear too similar.

Reason:

```text
constraint stiffness × many solver iterations
```

made most constraints effectively rigid.

After stiffness normalization, the differences between materials became clearly visible.

Another important observation:

```text
stretch ≠ bend
```

A material can resist stretching strongly while still folding very easily.

This distinction is especially important for cloth and silk.

---

## Next milestone

### Mouse grab interaction

The next major feature is direct pointer interaction with the surface.

Target behavior:

```text
pointer
   ↓
raycast
   ↓
surface intersection
   ↓
particles inside grab radius
   ↓
weighted deformation
```

The grab should affect a region rather than a single particle.

Particles closer to the interaction center should receive a stronger influence.

Expected API direction:

```ts
surface.grab(...)
surface.moveGrab(...)
surface.release()
```

The interaction system should remain renderer-independent where possible. Three.js should only handle raycasting and conversion from pointer coordinates to a world-space target.

---

## Planned roadmap

```text
[x] Particle grid
[x] Verlet integration
[x] Structural constraints
[x] Shear constraints
[x] Bend constraints
[x] Iterative constraint solver
[x] SoftSurface public API
[x] Fixed timestep
[x] Three.js geometry adapter
[x] Three.js playground
[x] Material presets
[x] Stiffness normalization

[ ] Mouse grab
[ ] Weighted grab radius
[ ] Surface smoothing / relaxation
[ ] Push / pull forces
[ ] Wind / force fields
[ ] Better material tuning
[ ] Pinning API improvements
[ ] Collision primitives
[ ] Performance benchmarks
[ ] React Three Fiber adapter
[ ] Documentation
[ ] npm publishing
```

---

## Core design rule

`@softsurface/core` must remain renderer agnostic.

It must not depend on:

```text
Three.js
React
React Three Fiber
WebGL
DOM APIs
```

Renderer-specific behavior belongs in adapters such as:

```text
@softsurface/three
@softsurface/react-three-fiber
```

This separation is considered a fundamental architectural constraint of SoftSurface.
