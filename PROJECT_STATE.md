# SoftSurface — Project State

**Last updated:** 2026-08-21

**Status:** Active development — interactive physics MVP; dihedral bending established; self-collision detection optimized with AABB prefilter; broad-phase benchmarking in progress

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

- `ParticleGrid`

- `VerletIntegrator`

- generic `Constraint` interface

- `DistanceConstraint`

- `DihedralBendingConstraint`

- `ConstraintBuilder`

- `DihedralConstraintBuilder`

- `ConstraintSolver`

- `SurfaceRelaxation`

- `SoftSurface`

- `GrabInteraction`

- `GridTopology`

- `TriangleSpatialHash`

- `PointTriangleDistance`

- `SelfCollisionDetector`

- material presets

- fixed timestep simulation

- weighted grab interaction

The core has **no dependency on Three.js, React or the DOM**.

### `@softsurface/three`

Three.js adapter.

Currently contains:

- `SoftSurfaceGeometry`

- `SoftSurfacePointerInteraction`

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

- pointers

- DOM events

- cameras

- raycasting

- Three.js meshes

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

Generic iterative constraint solver

    ↓

Surface relaxation

    ↓

Weighted grab interaction

    ↓

Self-collision detection (optional, detection-only)

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

- low stretch

- medium bend resistance

- moderate movement

**Silk**

- low stretch

- very low bend resistance

- easy folding

- light response

**Paper**

- almost no stretch

- high bend resistance

- tends to retain flatter shapes

**Rubber**

- more stretch

- medium bend resistance

- stronger elastic response

**Gel**

- moderate stretch

- low bend resistance

- high damping

- slower / softer response

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

- rectangular deformable surface

- two upper corners pinned

- gravity / zero-gravity testing

- real-time simulation

- `MeshStandardMaterial`

- runtime material preset selector

- weighted mouse grab

- camera orbit

- zoom

- viewing deformations from arbitrary angles

- distance vs dihedral bending experiments

- lightweight per-frame performance instrumentation

- runtime tuning controls for material, bending, solver and resolution

- self-collision enable / thickness / cell-size controls

- copyable Performance Report output

- self-collision candidate / tested / contact counters

- temporary detector timing for hash-build vs narrow-phase profiling

### Current experimental quality baseline

The best current visual/performance balance observed in the playground is approximately:

```ts
segmentsX: 48;

segmentsY: 36;

acceleration: [0, 0, 0];

iterations: 1;

fixedTimeStep: 1 / 120;

maxSubsteps: 4;

bendModel: "dihedral";

bendStiffness: 0.3;

relaxation: 0.5;
```

These values are a playground benchmark configuration, not finalized library defaults.

### Performance observations

Profiling separates:

```text

surface.step()      -> physics

geometry.update()   -> geometry / normals

renderer.render()   -> render submission

```

On the current development machine and scene, representative pre-self-collision measurements were:

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

### Self-collision detection benchmark

Self-collision is currently detection-only. No collision response or positional correction has been implemented yet.

Current reference configuration:

```text

preset: cloth
resolution: 48 x 36
gravityY: 0
iterations: 1
fixedTimeStep: 1 / 120
maxSubsteps: 4
relaxation: 0.5
bendModel: dihedral
bendStiffness: 0.3
selfCollisionThickness: 0.03

```

A recent reference run with self-collision disabled produced:

```text

Physics avg   ~0.87 ms
Physics max   ~1.60 ms

```

With self-collision detection enabled and:

```text

cellSize: 0.10
thickness: 0.03

```

the same scene produced approximately:

```text

Physics avg    ~3.21 ms
Physics max    ~3.70 ms

Hash build     ~1.10 ms
Narrow phase   ~1.60 ms
Detector total ~2.70 ms

Candidates     ~35,782
Tested         ~25,402
Contacts       0

```

The first self-collision performance gate therefore does not pass yet. Detection alone currently adds several milliseconds of CPU work even when the resting surface has no actual contacts.

Cell-size experiments showed the expected tradeoff between candidate count and hash-construction cost:

```text

cellSize 0.17 -> ~4.01 ms physics, ~68,688 candidates, ~58,320 tested
cellSize 0.12 -> ~3.17 ms physics, ~44,875 candidates, ~34,507 tested
cellSize 0.10 -> ~3.16-3.26 ms physics, ~35,770 candidates, ~25,390 tested
cellSize 0.08 -> ~4.15 ms physics, ~31,888 candidates, ~21,516 tested
cellSize 0.06 -> ~4.15 ms physics, ~25,207 candidates, ~14,835 tested

```

The current practical sweet spot is around:

```text

cellSize: 0.10 - 0.12

```

Smaller cells reduce the number of narrow-phase tests but increase spatial-hash construction work enough to make the total slower.

The current profile indicates that both stages matter:

```text

hash build   ~41% of detector cost
narrow phase ~59% of detector cost

```

The latest optimization experiment stores each triangle's already-computed padded AABB in a reusable `Float32Array` inside `TriangleSpatialHash`.

An allocation-free:

```ts
containsPoint(triangleIndex, x, y, z);
```

check is implemented and tested. It has not yet been connected to `SelfCollisionDetector`.

The immediate next benchmark will measure how many of the current ~25k point-triangle tests can be rejected by this exact padded-AABB filter before calling `pointTriangleDistanceSquared()`.

These numbers are machine/browser/scene-specific and should be treated as development benchmarks, not universal performance guarantees.

Deterministic broad-phase comparison

Manual playground comparisons were found useful for visual behavior but not precise enough for performance decisions because hand-driven deformations are not identical between runs.

A deterministic benchmark methodology was therefore introduced for performance comparisons:

same mesh geometry
same positions buffer
same self-collision parameters
same broad-phase input
correctness check first
warmup
multiple measured runs
mean / min / max / percentile comparison

Two reference scenarios were used:

REST
48 x 36 flat surface
expected contacts: 0

FOLDED
48 x 36 deterministic mirrored fold
controlled overlap
expected contacts: > 0

The experimental ParticleSpatialHash broad phase was compared against the existing triangle-based broad phase.

Correctness matched exactly:

REST
tested = 3,456
contacts = 0

FOLDED
tested = 16,992
contacts = 10,152

Vitest benchmark results:

REST

triangle
mean 1.7678 ms
min 1.5082 ms
max 3.4658 ms

particle
mean 2.1058 ms
min 1.8581 ms
max 5.8163 ms

triangle ≈ 1.19x faster

FOLDED

triangle
mean 2.1906 ms
min 1.9839 ms
max 3.3391 ms

particle
mean 2.3940 ms
min 2.2558 ms
max 3.7806 ms

triangle ≈ 1.09x faster

The ParticleSpatialHash experiment demonstrated that reducing hash-build insertions does not automatically improve total self-collision performance.

The particle-based strategy reduced hash construction cost substantially in manual profiling, but shifted more work into triangle-AABB cell traversal and candidate lookup.

Decision:

ParticleSpatialHash
✓ correct
✓ much cheaper hash construction
✗ higher total detection cost
✗ rejected for current implementation

TriangleSpatialHash
✓ correct
✓ faster total REST benchmark
✓ faster total FOLDED benchmark
→ retained as current broad phase

The experimental particle implementation and its temporary playground integration were removed after benchmarking. The working tree returned to the last committed triangle-based implementation.

Performance-testing rule

From this point forward, performance implementation decisions should use deterministic benchmarks whenever two algorithms or optimizations are being compared.

Manual playground testing remains appropriate for:

visual quality
interaction feel
stability
fold behavior
UX

Deterministic benchmarks should be used for:

algorithm A vs algorithm B
optimization before vs after
broad-phase changes
solver hot-loop changes
collision-performance regressions

A performance optimization should only be retained when:

functional/collision results remain equivalent;

the same deterministic input is used;

sufficient warmup is performed;

multiple samples are measured;

mean and tail behavior show a meaningful improvement.

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

- particle grid creation

- initial particle positions

- inverse masses

- Verlet integration

- damping

- acceleration

- pinned particles

- distance constraints

- grid constraint generation

- generic constraint solving

- stiffness normalization behavior

- timestep-independent relaxation

- dihedral bending constraint behavior

- dihedral constraint generation from grid topology

- distance / dihedral bend-model selection

- SoftSurface API

- material presets

- fixed timestep behavior

- weighted grab selection

- weighted grab movement

- grab falloff

- pinned-particle grab behavior

- grab release

- grid triangle topology generation

- triangle spatial hashing

- spatial-hash bucket reuse

- padded triangle AABB storage / containment

- allocation-free point-triangle distance queries

- self-collision detection

- self-collision candidate de-duplication

### `@softsurface/three`

- direct sharing of SoftSurface position buffers

- expected vertex count

- indexed triangle generation

- UV generation

The latest development sequence has continued to pass the full workspace test and build commands after the dihedral integration and generic-constraint refactor.

The suite is currently approximately:

```text

@softsurface/core

66 tests passing

@softsurface/three

4 tests passing

Total

70 tests passing

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

perf(three): avoid per-frame bounding sphere updates

docs: update project state after dihedral performance tuning

docs: add project readme and MIT license

feat(playground): add tuning controls and performance HUD

feat(core): add self-collision geometry infrastructure

feat(core): add self-collision detection

```

The padded-AABB pre-filter integration was benchmarked and committed.

A temporary ParticleSpatialHash experiment was then implemented only for comparison. It produced equivalent detection results but worse total benchmark performance, so the experimental implementation, tests and playground integration were removed rather than committed.

Current working tree at this checkpoint:

clean
up to date with origin/main

Commit hashes for later milestones should be added when needed.

---

---

## Current observations

### Material differentiation

Stiffness normalization made the material presets visibly more distinct.

The most noticeable characteristics remain:

- stretch

- bend

- damping

- bounce / energy retention

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

### Self-collision status

The original self-intersection problem remains physically unresolved because SoftSurface still has no self-collision response.

The detection infrastructure now includes:

- stable grid triangle indices via `GridTopology`

- broad-phase triangle spatial hashing via `TriangleSpatialHash`

- pooled / reused spatial-hash buckets to reduce GC pressure

- allocation-free point-to-triangle distance / closest-point testing

- reusable `PointTriangleResult`

- candidate de-duplication using a reusable `Uint32Array` visit-stamp buffer

- reusable `SelfCollisionStats`

- optional detector integration in `SoftSurface`

- playground controls for enable / thickness / cell size

- Performance HUD counters for candidates / tested pairs / contacts

- copyable benchmark reports

- temporary timing instrumentation for hash build / narrow phase / total detector time

- cached padded triangle AABBs and an allocation-free `containsPoint()` test

Current detection ordering:

```text

Verlet integration
↓
constraint solver
↓
surface relaxation
↓
grab interaction
↓
self-collision detection
↓
statistics only

```

No vertices are currently moved by self-collision.

At rest, the reference surface reports:

```text

Contacts = 0

```

with `thickness: 0.03`, which is an important correctness signal: the flat surface is not being interpreted as self-colliding.

During strong folding / penetration, hundreds of contacts can be detected, showing that the detector is observing the geometric overlap problem.

The current performance problem is more important than collision response: on the 48 x 36 reference mesh, detector cost is approximately `2.70 ms` before any positional response is added.

The exact padded-AABB pre-filter is now integrated into SelfCollisionDetector.

On the 48 x 36 reference resting scene, the pre-filter reduced expensive point-triangle tests from approximately:

25,402
→
3,456

while keeping:

Contacts = 0

Representative detector timing improved from approximately:

Narrow phase
1.60 ms
→
0.70 ms

Detector total
2.70 ms
→
~2.00 ms

The broad phase is now the dominant remaining cost.

A particle-based inverted broad-phase experiment was implemented and benchmarked deterministically, but the existing triangle-based broad phase remained faster overall and is therefore retained.

Still required before self-collision can be considered physically implemented:

- further optimize TriangleSpatialHash total broad-phase cost where justified by deterministic benchmarks

- add topology-aware exclusions if materially useful

- implement vertex-triangle positional collision response

- vertex-triangle positional collision response

- revisit solver / grab / collision ordering

- later evaluate edge-edge collision cases

- investigate tunneling / fast dragging and possible CCD or movement limiting

### Dihedral stability

Very high dihedral bend stiffness can become numerically unstable. In manual testing, `bendStiffness: 1` caused the simulation to explode.

This should be treated as a stability issue to investigate separately rather than as normal material behavior.

### Current visual gap vs HoloCloth

The visual gap has narrowed substantially after adding dihedral bending and relaxation.

The main remaining physical gaps now include:

- self-collision

- further material tuning

- improved collision behavior

- stability under extreme parameters

- future wrinkle/detail refinements

Lighting/material presentation can still be improved later, but current development should continue to prioritize physical shape, motion and robustness.

---

## Next milestone

### Optimize the retained triangle broad phase

The padded-AABB pre-filter is integrated and has already reduced narrow-phase work substantially.

A deterministic A/B benchmark was used to compare the current TriangleSpatialHash against an experimental ParticleSpatialHash.

Result:

REST
triangle ≈ 1.19x faster

FOLDED
triangle ≈ 1.09x faster

The particle broad phase was therefore rejected and removed.

The current optimization target remains the triangle-based broad phase, but future changes must be validated using deterministic benchmarks rather than hand-driven playground runs.

Current reference behavior:

REST
tested pairs: 3,456
contacts: 0

FOLDED deterministic benchmark
tested pairs: 16,992
contacts: 10,152

Immediate direction:

establish a reusable deterministic benchmark for the retained TriangleSpatialHash;

profile and optimize only one broad-phase change at a time;

require identical contact/test correctness before comparing timings;

keep an optimization only if mean and tail performance improve meaningfully;

after broad-phase cost is acceptable, implement vertex-triangle collision response.

Performance remains a continuous design constraint rather than an end-stage optimization task.

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

[x] Playground tuning controls

[x] Performance HUD

[x] Self-collision broad phase

[x] Vertex-triangle self-collision detection

[x] Padded triangle AABB cache / containsPoint primitive

[x] Self-collision exact AABB pre-filter integration

[x] Deterministic self-collision benchmark methodology

[x] Triangle vs particle broad-phase comparison

[x] Retain TriangleSpatialHash after deterministic comparison

[ ] Self-collision topology exclusions

[ ] Vertex-triangle self-collision response

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

- interactive 3D product presentation

- material previews

- footwear and sole deformation

- cushions, mattresses and foam products

- rubber and silicone objects

- flexible packaging

- interactive GLTF models

- creative 3D experiences

- game objects and environmental soft bodies

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

- browser-first usage

- simple APIs

- renderer independence

- real-time interaction

- visually plausible material behavior

- creative-web and product-experience use cases

Architectural decisions made during the current MVP should avoid unnecessarily preventing this future evolution.
