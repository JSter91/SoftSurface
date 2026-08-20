# SoftSurface — Project State

**Last updated:** 2026-08-20

**Status:** Active development — interactive physics MVP; dihedral bending and performance baseline established

## Goal

SoftSurface is a lightweight, renderer-agnostic engine for real-time deformable surfaces on the web.

The goal is to support materials and behaviors such as:

* cloth

* silk

* paper

* rubber

* gel

* membranes

* interactive deformable surfaces

The physics engine must remain independent from rendering libraries such as Three.js.

---

## Architecture

```text

SoftSurface/

├── packages/

│   ├── core/

│   │   └── @softsurface/core

│   │

│   └── three/

│       └── @softsurface/three

│

└── apps/

    └── playground/

```

### `@softsurface/core`

Renderer-independent physics engine.

Currently contains:

* `ParticleGrid`

* `VerletIntegrator`

* generic `Constraint` interface

* `DistanceConstraint`

* `DihedralBendingConstraint`

* `ConstraintBuilder`

* `DihedralConstraintBuilder`

* `ConstraintSolver`

* `SurfaceRelaxation`

* `SoftSurface`

* `GrabInteraction`

* material presets

* fixed timestep simulation

* weighted grab interaction

The core has **no dependency on Three.js, React or the DOM**.

### `@softsurface/three`

Three.js adapter.

Currently contains:

* `SoftSurfaceGeometry`

* `SoftSurfacePointerInteraction`

`SoftSurfaceGeometry` exposes the simulation's `Float32Array` directly as a Three.js `BufferAttribute`, avoiding a position-array copy on every frame.

`SoftSurfacePointerInteraction` handles renderer-specific pointer interaction:

```text

pointer

   ↓

Three.js Raycaster

   ↓

mesh intersection

   ↓

world-space point

   ↓

mesh local-space conversion

   ↓

SoftSurface grab API

```

The physics core therefore remains unaware of:

* pointers

* DOM events

* cameras

* raycasting

* Three.js meshes

### `apps/playground`

Vite + Three.js development environment.

It is used only for:

* visual testing

* material tuning

* interaction experiments

* performance testing

* examples

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

Generic iterative constraint solver

    ↓

Surface relaxation

    ↓

Weighted grab interaction

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

SoftSurface now supports two bending models:

```text

distance

dihedral

```

The original distance-based bend model connects particles two grid cells apart. It is inexpensive, but strong deformation visibly preserves the rectangular grid structure and can produce square-looking folds.

The new `dihedral` model constrains the angle between adjacent triangles. In visual testing it produced a major improvement in fold quality and almost eliminated the visible grid artifacts when combined with moderate/high relaxation.

The current playground quality baseline therefore uses:

```text

bendModel: "dihedral"

```

The distance model is retained for comparison and as a cheaper fallback.

### Shear constraints

Control diagonal deformation and prevent grid cells from collapsing into strongly skewed shapes.

### Surface relaxation

Local surface relaxation is implemented in `SurfaceRelaxation`.

It smooths local particle configurations after the main constraint solve and applies the same positional correction to `previousPositions` so it does not inject artificial Verlet velocity.

Relaxation is timestep-independent: the configured strength is converted relative to a 60 Hz reference step, so changing the physics substep does not unintentionally change the effective amount of smoothing.

Visual testing showed that relatively high relaxation values can be useful with dihedral bending for suppressing residual grid artifacts. Current playground testing has produced strong results around:

```text

relaxation: 0.5

```

This remains an experimental playground value rather than a library default or finalized material-preset value.

---

## Simulation timing

Physics uses a fixed timestep.

Current default:

```text

1 / 120 s

```

with a configurable maximum number of substeps.

`surface.step(deltaTime)` accepts the render-frame delta, while the engine internally advances physics using fixed simulation steps.

This keeps the simulation more consistent across different rendering frame rates and prevents large frame-time spikes from destabilizing the solver.

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

The visual comparison in the playground confirmed that the normalization was necessary: before the correction, most presets appeared nearly identical.

The solver now also caches the per-iteration stiffness for each constraint group. The normalized stiffness therefore does not recompute `Math.pow()` inside the hot solver loop on every iteration and substep.

This optimization preserved the same physics behavior while reducing unnecessary CPU work.

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

### Stretch vs bend

An important distinction discovered during visual tuning:

```text

stretch ≠ bend

```

**Stretch** controls how much the material can change its dimensions.

**Bend** controls how easily the material can fold while preserving those dimensions.

A cloth-like material generally needs:

```text

high structural stiffness

+

relatively low bend stiffness

```

This allows it to resist stretching while still forming folds.

### Current interpretation

**Cloth**

* low stretch

* medium bend resistance

* moderate movement

**Silk**

* low stretch

* very low bend resistance

* easy folding

* light response

**Paper**

* almost no stretch

* high bend resistance

* tends to retain flatter shapes

**Rubber**

* more stretch

* medium bend resistance

* stronger elastic response

**Gel**

* moderate stretch

* low bend resistance

* high damping

* slower / softer response

Preset values are still experimental and will continue to be tuned visually.

The current preset `bendStiffness` values were originally tuned for distance-based bending. They should not yet be considered calibrated for the dihedral model because the two formulations do not have equivalent stiffness semantics.

`relaxation` is also not yet baked into the material presets; it remains an explicit simulation/playground tuning parameter until the new bending model is fully calibrated.

---

## Grab interaction

Weighted grab interaction is implemented in `@softsurface/core`.

Public API:

```ts

surface.grab(...)

surface.moveGrab(...)

surface.release()

```

The grab affects a **region of particles**, not a single vertex.

Conceptually:

```text

             grab center

                  ↓

             strongest

                ███

             ███████

          ░░█████████░░

        ░░░░█████████░░░░

             weaker

```

Particles closer to the grab center receive a stronger influence.

A smooth radial falloff is used so the interaction produces a deformation rather than a sharp vertex pull.

Relative particle offsets around the initial grab point are preserved.

`previousPositions` are moved together with current positions during the grab correction so that the positional correction does not accidentally generate excessive Verlet velocity.

Pinned particles are ignored by the grab interaction.

---

## Three.js pointer interaction

`SoftSurfacePointerInteraction` converts browser pointer input into the renderer-independent core grab API.

### Grab workflow

```text

pointerdown

    ↓

raycast against SoftSurface mesh

    ↓

intersection point in world space

    ↓

convert to mesh local space

    ↓

surface.grab(...)

```

During dragging, a mathematical plane is created through the original intersection point and oriented toward the camera.

Future pointer rays intersect this plane:

```text

pointer move

    ↓

camera ray

    ↓

drag plane

    ↓

world-space target

    ↓

local-space target

    ↓

surface.moveGrab(...)

```

This provides stable 3D dragging from a 2D pointer.

---

## Playground status

The Three.js playground currently supports:

* rectangular deformable surface

* two upper corners pinned

* gravity / zero-gravity testing

* real-time simulation

* `MeshStandardMaterial`

* runtime material preset selector

* weighted mouse grab

* camera orbit

* zoom

* viewing deformations from arbitrary angles

* distance vs dihedral bending experiments

* lightweight per-frame performance instrumentation

### Current experimental quality baseline

The best current visual/performance balance observed in the playground is approximately:

```ts

segmentsX: 48
segmentsY: 36

acceleration: [0, 0, 0]

iterations: 1

fixedTimeStep: 1 / 120
maxSubsteps: 4

bendModel: "dihedral"
bendStiffness: 0.3

relaxation: 0.5

```

These values are a playground benchmark configuration, not finalized library defaults.

### Performance observations

Profiling separates:

```text

surface.step()      -> physics

geometry.update()   -> geometry / normals

renderer.render()   -> render submission

```

On the current development machine and scene, representative measurements were:

```text

dihedral / 10 iterations   ~5.97 ms physics avg

dihedral / 6 iterations    ~3.62 ms physics avg

dihedral / 4 iterations    ~2.62 ms physics avg

dihedral / 2 iterations    ~1.63 ms physics avg

dihedral / 1 iteration     ~0.98 ms physics avg

dihedral / 1 iteration,
relaxation 0.5             ~0.82 ms physics avg

distance / 10 iterations   ~1.86 ms physics avg

```

The distance model was cheaper at the same iteration count, but its visual fold quality was substantially worse.

Reducing dihedral solver iterations from 10 to 1 produced no obvious visual degradation in the current playground test while reducing physics CPU time dramatically.

These numbers are machine/browser/scene-specific and should be treated as development benchmarks, not universal performance guarantees.

### Pointer UX

The playground distinguishes interaction based on where the primary pointer starts:

```text

LEFT DRAG on SoftSurface

        ↓

deform material

LEFT DRAG on empty space

        ↓

orbit camera

MOUSE WHEEL

        ↓

zoom

```

This is achieved by letting `SoftSurfacePointerInteraction` raycast first.

If the mesh is hit, SoftSurface takes control of the pointer.

If no mesh is hit, the event is left to Three.js `OrbitControls`.

This allows both material interaction and scene navigation using the primary mouse button.

---

## Tests

Current automated coverage includes:

### `@softsurface/core`

* particle grid creation

* initial particle positions

* inverse masses

* Verlet integration

* damping

* acceleration

* pinned particles

* distance constraints

* grid constraint generation

* generic constraint solving

* stiffness normalization behavior

* timestep-independent relaxation

* dihedral bending constraint behavior

* dihedral constraint generation from grid topology

* distance / dihedral bend-model selection

* SoftSurface API

* material presets

* fixed timestep behavior

* weighted grab selection

* weighted grab movement

* grab falloff

* pinned-particle grab behavior

* grab release

### `@softsurface/three`

* direct sharing of SoftSurface position buffers

* expected vertex count

* indexed triangle generation

* UV generation

The latest development sequence has continued to pass the full workspace test and build commands after the dihedral integration and generic-constraint refactor.

The suite is currently approximately:

```text

@softsurface/core

50 tests passing

@softsurface/three

4 tests passing

Total

54 tests passing

```

TypeScript builds and the Vite production build are passing.

`SoftSurfacePointerInteraction` is currently verified through the interactive playground; dedicated automated tests for pointer/raycast behavior have not yet been added.

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

Later milestones include:

```text

fix(core): normalize stiffness across solver iterations

feat(core): add weighted grab interaction

feat(three): add pointer grab and orbit interaction

feat(core): add timestep-independent surface relaxation

feat(core): add dihedral bending constraint

feat(core): build dihedral constraints from grid topology

refactor(core): generalize constraint solver

feat(core): support dihedral bending model

perf(core): cache per-iteration constraint stiffness

```

Commit hashes for these later milestones should be added when needed.

---

## Current observations

### Material differentiation

Stiffness normalization made the material presets visibly more distinct.

The most noticeable characteristics remain:

* stretch

* bend

* damping

* bounce / energy retention

The addition of dihedral bending substantially changed fold quality, so the existing preset bend values now need a new tuning pass before they should be considered representative.

### Interaction and fold quality

Weighted grabbing continues to provide natural regional deformation.

The previous distance-based bending produced visible square/grid artifacts in stronger folds, especially in zero gravity.

Switching to dihedral bending produced a major visual improvement. With approximately:

```text

bendStiffness: 0.3
relaxation: 0.5

```

and the current 48 x 36 test surface, the grid artifacts are close to disappearing while the material remains highly interactive.

The quality remains strong even with a single solver iteration in the current playground scenario.

### Known self-intersection problem

SoftSurface does not currently implement self-collision.

A folded section of the surface can therefore pass through another section of the same surface. After penetration, stretch/shear/bending constraints may keep the mesh in the penetrated configuration, which can visually look as if two layers have become stuck together.

This is not expected to be solved by bend stiffness or relaxation tuning.

Future self-collision work will likely require:

* collision thickness

* broad-phase acceleration such as spatial hashing

* vertex-triangle collision handling

* exclusion of topologically adjacent triangles

* later evaluation of edge-edge collision cases

* careful interaction with grab ordering and tunneling

### Dihedral stability

Very high dihedral bend stiffness can become numerically unstable. In manual testing, `bendStiffness: 1` caused the simulation to explode.

This should be treated as a stability issue to investigate separately rather than as normal material behavior.

### Current visual gap vs HoloCloth

The visual gap has narrowed substantially after adding dihedral bending and relaxation.

The main remaining physical gaps now include:

* self-collision

* further material tuning

* improved collision behavior

* stability under extreme parameters

* future wrinkle/detail refinements

Lighting/material presentation can still be improved later, but current development should continue to prioritize physical shape, motion and robustness.

---

## Next milestone

### Playground tuning controls and performance HUD

The immediate next workflow improvement is to stop hardcoding tuning values in `apps/playground/src/main.ts`.

The playground should expose interactive controls for parameters such as:

```text

preset

bendModel

bendStiffness

relaxation

iterations

gravity

segmentsX / segmentsY

fixedTimeStep

maxSubsteps

```

A small performance HUD should expose the existing measurements for:

```text

physics avg / max

geometry avg / max

render avg / max

FPS

```

The first version can rebuild the surface when a setting changes. A later API can distinguish parameters that are safe to modify live from parameters that require topology/surface reconstruction.

After the tuning UI is in place, the next major physics feature should be self-collision.

---

## Planned roadmap

```text

[x] Particle grid

[x] Verlet integration

[x] Structural constraints

[x] Shear constraints

[x] Distance bend constraints

[x] Iterative constraint solver

[x] Generic constraint interface / solver

[x] SoftSurface public API

[x] Fixed timestep

[x] Three.js geometry adapter

[x] Three.js playground

[x] Material presets

[x] Stiffness normalization

[x] Per-iteration stiffness cache

[x] Mouse grab

[x] Weighted grab radius

[x] Three.js pointer interaction

[x] Camera orbit / inspection controls

[x] Surface smoothing / relaxation

[x] Timestep-independent relaxation

[x] Dihedral bending constraint

[x] Dihedral constraint generation from grid topology

[x] Distance / dihedral bend-model selection

[x] Initial performance profiling

[x] Solver-iteration performance tuning

[ ] Playground tuning controls

[ ] Performance HUD

[ ] Self-collision broad phase

[ ] Vertex-triangle self-collision

[ ] Dihedral extreme-stiffness stability

[ ] Better material tuning

[ ] Push / pull forces

[ ] Wind / force fields

[ ] Pinning API improvements

[ ] Collision primitives

[ ] Formal performance benchmarks

[ ] Pointer interaction automated tests

[ ] React Three Fiber adapter

[ ] Documentation

[ ] npm publishing

```

## long-term deformable geometry goals

[ ] Arbitrary triangle-mesh topology

[ ] Closed-mesh volume preservation

[ ] GLTF deformable geometry experiments

[ ] XPBD evaluation

[ ] Volumetric / tetrahedral soft bodies — research

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

Three.js may determine **where** an interaction occurs, but the physics engine must determine **how the surface reacts**.

This separation is considered a fundamental architectural constraint of SoftSurface.



# Long-term direction — General deformable geometry

SoftSurface should not be architecturally limited to rectangular cloth simulation.

The current particle grid is intentionally the simplest topology for developing and validating the physics engine, but a possible long-term direction is support for **arbitrary deformable 3D geometry**.

Potential inputs include:

```text

PlaneGeometry

SphereGeometry

BoxGeometry

arbitrary triangle meshes

GLTF / product geometry

```

A future topology abstraction could evolve from:

```text

ParticleGrid

```

toward a more general representation such as:

```text

ParticleMesh / SurfaceTopology

```

where particles and constraints are derived from mesh vertices, edges and connectivity rather than from a regular `(x, y)` grid.

Possible evolution:

```text

Particle system

      │

      ├── Grid surface

      │      └── cloth / silk / paper

      │

      └── Arbitrary mesh

             ├── sphere

             ├── cube

             ├── product geometry

             └── GLTF models

```

## Surface deformation vs soft bodies

Arbitrary surface deformation and true volumetric soft-body simulation are separate capabilities.

A closed triangle mesh using only surface constraints can deform, but may collapse because it has no concept of internal volume.

Future closed-body support may therefore introduce:

```text

surface constraints

+

bend constraints

+

volume preservation

+

collision constraints

```

A more advanced future implementation could optionally investigate XPBD and tetrahedral volumetric meshes.

This is considered a **possible expansion path**, not a requirement for the current cloth/surface MVP.

## Potential applications

This direction could enable:

* interactive 3D product presentation

* material previews

* footwear and sole deformation

* cushions, mattresses and foam products

* rubber and silicone objects

* flexible packaging

* interactive GLTF models

* creative 3D experiences

* game objects and environmental soft bodies

## Product positioning

SoftSurface does not currently aim to replace engineering-grade FEM or scientific material simulation.

The intended opportunity is a lightweight layer between purely visual vertex deformation and heavyweight general-purpose physics engines:

```text

visual deformation

        ↓

SoftSurface

        ↓

general soft-body / engineering simulation

```

The emphasis should remain on:

* browser-first usage

* simple APIs

* renderer independence

* real-time interaction

* visually plausible material behavior

* creative-web and product-experience use cases

Architectural decisions made during the current MVP should avoid unnecessarily preventing this future evolution.