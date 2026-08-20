# SoftSurface — Project State

**Last updated:** 2026-08-20
**Status:** Active development — interactive physics MVP

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

* `ParticleGrid`
* `VerletIntegrator`
* `DistanceConstraint`
* `ConstraintBuilder`
* `ConstraintSolver`
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
Iterative constraint solver
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
* gravity
* real-time simulation
* `MeshStandardMaterial`
* runtime material preset selector
* weighted mouse grab
* camera orbit
* zoom
* viewing deformations from arbitrary angles

### Pointer UX

The playground now distinguishes interaction based on where the primary pointer starts:

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
* iterative constraint solving
* stiffness normalization behavior
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

The last full workspace verification before the pointer/orbit integration completed successfully with:

```text
@softsurface/core
32 tests passing

@softsurface/three
4 tests passing

Total
36 tests passing
```

TypeScript builds and the Vite production build were also passing.

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
```

Commit hashes for these later milestones should be added when needed.

---

## Current observations

### Material differentiation

The original material implementation made most presets appear too similar.

The main reason was repeated application of high stiffness values during solver iterations.

After stiffness normalization, the differences became visually meaningful.

The most noticeable characteristics currently are:

* stretch
* bend
* damping
* bounce / energy retention

### Interaction

Weighted grabbing produces a substantially more natural deformation than pulling a single vertex.

The interaction is now strong enough to evaluate material behavior manually from multiple viewing angles.

### Current visual gap vs HoloCloth

The system is functional and interactive, but the resulting deformation is not yet at the visual quality of HoloCloth.

Likely missing elements include:

* surface smoothing / relaxation
* improved wrinkle propagation
* further material tuning
* possibly better constraint formulation
* zero-gravity / suspended-surface scenarios
* improved lighting/material presentation later

The next improvements should focus on the **physical shape and motion first**, not shaders.

---

## Next milestone

### Surface smoothing / relaxation

The next major physics feature is smoothing the local particle configuration to produce softer folds and reduce harsh or noisy deformation.

Target concept:

```text
       neighbor
          o
          |
neighbor--X--neighbor
          |
          o
       neighbor
```

For each movable particle, calculate a local neighborhood average and apply a small controlled correction toward that average.

Expected effects:

* softer folds
* smoother wrinkle transitions
* less angular deformation
* more gel-like relaxation when desired
* behavior closer to HoloCloth

Smoothing must:

* preserve pinned particles
* remain optional/configurable
* avoid excessive surface shrinkage
* remain renderer-independent

It should eventually become another material parameter rather than a hardcoded solver behavior.

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
[x] Mouse grab
[x] Weighted grab radius
[x] Three.js pointer interaction
[x] Camera orbit / inspection controls

[ ] Surface smoothing / relaxation
[ ] Better material tuning
[ ] Push / pull forces
[ ] Wind / force fields
[ ] Pinning API improvements
[ ] Collision primitives
[ ] Performance benchmarks
[ ] Pointer interaction automated tests
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

Three.js may determine **where** an interaction occurs, but the physics engine must determine **how the surface reacts**.

This separation is considered a fundamental architectural constraint of SoftSurface.
