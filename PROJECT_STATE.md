SoftSurface — Project State

Last updated: 2026-08-22

Status: Active development — interactive physics MVP; dihedral bending established; self-collision detection optimized; isolated vertex-triangle collision response implemented; two-pass self-collision solver implemented and benchmarked; integration into SoftSurface is the next physics milestone

Goal

SoftSurface is a lightweight, renderer-agnostic engine for real-time deformable surfaces on the web.

The goal is to support materials and behaviors such as:

cloth

silk

paper

rubber

gel

membranes

interactive deformable surfaces

The physics engine must remain independent from rendering libraries such as Three.js.

Architecture


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


@softsurface/core

Renderer-independent physics engine.

Currently contains:

ParticleGrid

VerletIntegrator

generic Constraint interface

DistanceConstraint

DihedralBendingConstraint

ConstraintBuilder

DihedralConstraintBuilder

ConstraintSolver

SurfaceRelaxation

SoftSurface

GrabInteraction

GridTopology

TriangleSpatialHash

PointTriangleDistance

SelfCollisionDetector

VertexTriangleCollisionResolver

SelfCollisionSolver

material presets

fixed timestep simulation

weighted grab interaction

The core has no dependency on Three.js, React or the DOM.

@softsurface/three

Three.js adapter.

Currently contains:

SoftSurfaceGeometry

SoftSurfacePointerInteraction

SoftSurfaceGeometry exposes the simulation's Float32Array directly as a Three.js BufferAttribute, avoiding a position-array copy on every frame.

SoftSurfacePointerInteraction handles renderer-specific pointer interaction:


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


The physics core therefore remains unaware of:

pointers

DOM events

cameras

raycasting

Three.js meshes

apps/playground

Vite + Three.js development environment.

It is used only for:

visual testing

material tuning

interaction experiments

performance testing

examples

It is not part of the published library.

Physics model

Current simulation model:


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

Self-collision detection (optional; current `SoftSurface` integration is still detection-only)

    ↓

Updated Float32Array positions


Structural constraints

Control how much the surface can stretch.

High stiffness:


o---o---o---o


The distance between particles remains almost constant.

Bend constraints

SoftSurface now supports two bending models:


distance

dihedral


The original distance-based bend model connects particles two grid cells apart. It is inexpensive, but strong deformation visibly preserves the rectangular grid structure and can produce square-looking folds.

The new dihedral model constrains the angle between adjacent triangles. In visual testing it produced a major improvement in fold quality and almost eliminated the visible grid artifacts when combined with moderate/high relaxation.

The current playground quality baseline therefore uses:


bendModel: "dihedral"


The distance model is retained for comparison and as a cheaper fallback.

Shear constraints

Control diagonal deformation and prevent grid cells from collapsing into strongly skewed shapes.

Surface relaxation

Local surface relaxation is implemented in SurfaceRelaxation.

It smooths local particle configurations after the main constraint solve and applies the same positional correction to previousPositions so it does not inject artificial Verlet velocity.

Relaxation is timestep-independent: the configured strength is converted relative to a 60 Hz reference step, so changing the physics substep does not unintentionally change the effective amount of smoothing.

Visual testing showed that relatively high relaxation values can be useful with dihedral bending for suppressing residual grid artifacts. Current playground testing has produced strong results around:


relaxation: 0.5


This remains an experimental playground value rather than a library default or finalized material-preset value.

Simulation timing

Physics uses a fixed timestep.

Current default:


1 / 120 s


with a configurable maximum number of substeps.

surface.step(deltaTime) accepts the render-frame delta, while the engine internally advances physics using fixed simulation steps.

This keeps the simulation more consistent across different rendering frame rates and prevents large frame-time spikes from destabilizing the solver.

Constraint stiffness

Constraint stiffness is normalized across solver iterations.

Originally the same stiffness was applied on every solver iteration, which caused values such as:


0.95

0.90

0.65

0.55


to all approach an effective stiffness close to 1 when using many solver iterations.

The solver now converts global stiffness into a per-iteration stiffness.

Conceptually:


iterationStiffness =

1 - (1 - stiffness)^(1 / iterations)


This makes material parameters significantly more meaningful.

The visual comparison in the playground confirmed that the normalization was necessary: before the correction, most presets appeared nearly identical.

The solver now also caches the per-iteration stiffness for each constraint group. The normalized stiffness therefore does not recompute Math.pow() inside the hot solver loop on every iteration and substep.

This optimization preserved the same physics behavior while reducing unnecessary CPU work.

Material presets

Currently supported:


cloth

silk

paper

rubber

gel


Important material dimensions currently include:


structuralStiffness

shearStiffness

bendStiffness

damping


Stretch vs bend

An important distinction discovered during visual tuning:


stretch ≠ bend


Stretch controls how much the material can change its dimensions.

Bend controls how easily the material can fold while preserving those dimensions.

A cloth-like material generally needs:


high structural stiffness

+

relatively low bend stiffness


This allows it to resist stretching while still forming folds.

Current interpretation

Cloth

low stretch

medium bend resistance

moderate movement

Silk

low stretch

very low bend resistance

easy folding

light response

Paper

almost no stretch

high bend resistance

tends to retain flatter shapes

Rubber

more stretch

medium bend resistance

stronger elastic response

Gel

moderate stretch

low bend resistance

high damping

slower / softer response

Preset values are still experimental and will continue to be tuned visually.

The current preset bendStiffness values were originally tuned for distance-based bending. They should not yet be considered calibrated for the dihedral model because the two formulations do not have equivalent stiffness semantics.

relaxation is also not yet baked into the material presets; it remains an explicit simulation/playground tuning parameter until the new bending model is fully calibrated.

Grab interaction

Weighted grab interaction is implemented in @softsurface/core.

Public API:


surface.grab(...)

surface.moveGrab(...)

surface.release()


The grab affects a region of particles, not a single vertex.

Conceptually:


             grab center

                  ↓

             strongest

                ███

             ███████

          ░░█████████░░

        ░░░░█████████░░░░

             weaker


Particles closer to the grab center receive a stronger influence.

A smooth radial falloff is used so the interaction produces a deformation rather than a sharp vertex pull.

Relative particle offsets around the initial grab point are preserved.

previousPositions are moved together with current positions during the grab correction so that the positional correction does not accidentally generate excessive Verlet velocity.

Pinned particles are ignored by the grab interaction.

Three.js pointer interaction

SoftSurfacePointerInteraction converts browser pointer input into the renderer-independent core grab API.

Grab workflow


pointerdown

    ↓

raycast against SoftSurface mesh

    ↓

intersection point in world space

    ↓

convert to mesh local space

    ↓

surface.grab(...)


During dragging, a mathematical plane is created through the original intersection point and oriented toward the camera.

Future pointer rays intersect this plane:


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


This provides stable 3D dragging from a 2D pointer.

Playground status

The Three.js playground currently supports:

rectangular deformable surface

two upper corners pinned

gravity / zero-gravity testing

real-time simulation

MeshStandardMaterial

runtime material preset selector

weighted mouse grab

camera orbit

zoom

viewing deformations from arbitrary angles

distance vs dihedral bending experiments

lightweight per-frame performance instrumentation

runtime tuning controls for material, bending, solver and resolution

self-collision enable / thickness / cell-size controls

copyable Performance Report output

self-collision candidate / tested / contact counters

temporary detector timing for hash-build vs narrow-phase profiling

Current experimental quality baseline

The best current visual/performance balance observed in the playground is approximately:


segmentsX: 48

segmentsY: 36

acceleration: [0, 0, 0]

iterations: 1

fixedTimeStep: 1 / 120

maxSubsteps: 4

bendModel: "dihedral"

bendStiffness: 0.3

relaxation: 0.5


These values are a playground benchmark configuration, not finalized library defaults.

Performance observations

Profiling separates:


surface.step()      -> physics

geometry.update()   -> geometry / normals

renderer.render()   -> render submission


On the current development machine and scene, representative pre-self-collision measurements were:


dihedral / 10 iterations   ~5.97 ms physics avg

dihedral / 6 iterations    ~3.62 ms physics avg

dihedral / 4 iterations    ~2.62 ms physics avg

dihedral / 2 iterations    ~1.63 ms physics avg

dihedral / 1 iteration     ~0.98 ms physics avg

dihedral / 1 iteration,
relaxation 0.5             ~0.82 ms physics avg

distance / 10 iterations   ~1.86 ms physics avg


The distance model was cheaper at the same iteration count, but its visual fold quality was substantially worse.

Reducing dihedral solver iterations from 10 to 1 produced no obvious visual degradation in the current playground test while reducing physics CPU time dramatically.

Self-collision detection benchmark

The current SoftSurface integration is still detection-only. Positional collision response now exists in isolated core modules and has not yet been connected to the live simulation pipeline.

Current reference configuration:


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


A recent reference run with self-collision disabled produced:


Physics avg   ~0.87 ms
Physics max   ~1.60 ms


With self-collision detection enabled and:


cellSize: 0.10
thickness: 0.03


the same scene produced approximately:


Physics avg    ~3.21 ms
Physics max    ~3.70 ms

Hash build     ~1.10 ms
Narrow phase   ~1.60 ms
Detector total ~2.70 ms

Candidates     ~35,782
Tested         ~25,402
Contacts       0


The first self-collision performance gate therefore does not pass yet. Detection alone currently adds several milliseconds of CPU work even when the resting surface has no actual contacts.

Cell-size experiments showed the expected tradeoff between candidate count and hash-construction cost:


cellSize 0.17 -> ~4.01 ms physics, ~68,688 candidates, ~58,320 tested
cellSize 0.12 -> ~3.17 ms physics, ~44,875 candidates, ~34,507 tested
cellSize 0.10 -> ~3.16-3.26 ms physics, ~35,770 candidates, ~25,390 tested
cellSize 0.08 -> ~4.15 ms physics, ~31,888 candidates, ~21,516 tested
cellSize 0.06 -> ~4.15 ms physics, ~25,207 candidates, ~14,835 tested


The current practical sweet spot is around:


cellSize: 0.10 - 0.12


Smaller cells reduce the number of narrow-phase tests but increase spatial-hash construction work enough to make the total slower.

The current profile indicates that both stages matter:


hash build   ~41% of detector cost
narrow phase ~59% of detector cost


Each triangle's padded AABB is stored in a reusable Float32Array inside TriangleSpatialHash.

An allocation-free:


containsPoint(triangleIndex, x, y, z)


check is integrated into SelfCollisionDetector before the expensive point-to-triangle distance test.

On the 48 x 36 REST reference scene, this reduced expensive point-triangle tests from approximately:


25,402
→
3,456


and reduced representative narrow-phase cost from roughly 1.60 ms to ~0.70 ms while preserving Contacts = 0.

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
mean   1.7678 ms
min    1.5082 ms
max    3.4658 ms

particle
mean   2.1058 ms
min    1.8581 ms
max    5.8163 ms

triangle ≈ 1.19x faster

FOLDED

triangle
mean   2.1906 ms
min    1.9839 ms
max    3.3391 ms

particle
mean   2.3940 ms
min    2.2558 ms
max    3.7806 ms

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

The experimental particle implementation and its temporary playground integration were removed after benchmarking. The working tree returned to the retained triangle-based implementation.

Flat typed-array TriangleSpatialHash optimization

The retained triangle broad phase was then optimized without changing its public concept or query semantics.

The old implementation used:

Map<number, number[]>

per-bucket dynamic arrays

bucket pooling

An experimental FlatTriangleSpatialHash replaced the hot-path storage with reusable typed arrays and a flat linked-entry hash table:

Int32Array  bucketHeads
Uint32Array slotGenerations
Uint32Array entryTriangles
Uint32Array entryKeys
Int32Array  entryNext

The experimental implementation was first compared against the Map implementation using the same deterministic REST and FOLDED inputs. Candidate sets matched exactly.

Spatial-hash build A/B benchmark:

REST
Map   mean 1.1924 ms   p99 2.2304 ms
Flat  mean 0.3542 ms   p99 0.4881 ms
Flat ≈ 3.37x faster

FOLDED
Map   mean 1.0176 ms   p99 2.0657 ms
Flat  mean 0.3658 ms   p99 0.4814 ms
Flat ≈ 2.78x faster

An end-to-end detector harness then confirmed that the improvement survived candidate queries, AABB rejection, de-duplication and point-triangle testing.

Correctness remained equivalent:

REST
tested = 3,456
contacts = 0
aabbRejected = 21,818

FOLDED
tested = 16,992
contacts = 10,152
aabbRejected = 25,040

Confirmed end-to-end benchmark after integration:

REST
Map   mean 1.7336 ms   p99 2.7018 ms
Flat  mean 1.0732 ms   p99 1.3466 ms
Flat ≈ 1.62x faster

FOLDED
Map   mean 2.1488 ms   p99 2.8409 ms
Flat  mean 1.8534 ms   p99 2.1749 ms
Flat ≈ 1.16x faster

Decision:

Flat typed-array storage
✓ equivalent candidate sets
✓ equivalent tested/contact results
✓ much faster hash build
✓ faster total REST detection
✓ faster total FOLDED detection
✓ lower p99 latency
→ promoted to the official TriangleSpatialHash implementation

The temporary FlatTriangleSpatialHash name and duplicate tests were removed. The public implementation remains TriangleSpatialHash; only its internal storage strategy changed.

The permanent TriangleSpatialHash.bench.ts regression benchmark now measures the optimized production implementation directly.

Final production hash-build baseline:

REST
mean  0.3462 ms
p99   0.4145 ms
max   0.4936 ms

FOLDED
mean  0.3515 ms
p99   0.4285 ms
max   0.5150 ms

These values are the current deterministic broad-phase regression baseline on the development machine.

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

Vertex-triangle collision response

The first positional self-collision response stage is now implemented in VertexTriangleCollisionResolver.

The resolver uses a PBD-style vertex-triangle projection. Given particle P, triangle vertices A/B/C, the closest point on the triangle and its barycentric coordinates, the correction is distributed according to inverse masses and barycentric contribution.

Conceptually:

denominator =
    wP
  + wA * alpha^2
  + wB * beta^2
  + wC * gamma^2

correction =
    penetration / denominator

Pinned particles therefore participate naturally through inverseMass = 0.

The isolated resolver is covered by deterministic tests including:

movable particle against a pinned triangle

fully dynamic particle + triangle response

zero-distance fallback using the triangle normal

no-op outside collision thickness

final separation matching the configured collision thickness

A permanent isolated benchmark was added in:

packages/core/bench/VertexTriangleCollisionResolver.bench.ts

Representative results on the current development machine:

pinned triangle         ~0.0002 ms / contact
fully dynamic triangle  ~0.0002 ms / contact
fully dynamic response  ~1.30x the cost of the pinned-triangle case

These microbenchmarks are useful as a response-cost baseline, but the end-to-end self-collision solver benchmark is the more important performance reference.

Two-pass SelfCollisionSolver

SelfCollisionSolver is now implemented as a separate renderer-independent core module.

It deliberately does not use an optional callback inside SelfCollisionDetector.

A temporary callback experiment was benchmarked and rejected because even an unused optional contact callback introduced measurable overhead in the FOLDED hot path, where more than ten thousand contacts are visited.

The promoted solver architecture is two-pass:

PASS 1 — detection

TriangleSpatialHash
        ↓
padded AABB rejection
        ↓
point-triangle narrow phase
        ↓
store only:
(particleIndex, triangleIndex)
in reusable typed arrays


PASS 2 — response

stored pair
        ↓
recompute point-triangle data
using current positions
        ↓
contact still penetrating?
        ├── no  → stale contact
        └── yes → VertexTriangleCollisionResolver

Only particle/triangle index pairs are retained between the two passes. Closest-point and barycentric data are recalculated during response because earlier corrections may already have changed the geometry.

The contact-pair buffers are reusable typed arrays and grow only when required. No per-contact object allocation is required.

The deterministic REST / FOLDED benchmark preserves the same geometry and collision parameters used by SelfCollisionDetector:

width:      4
height:     3
segments:   48 x 36
thickness:  0.03
cellSize:   0.10

Detection correctness remains unchanged:

REST
tested:    3,456
contacts:  0
resolved:  0
stale:     0

FOLDED
tested:    16,992
contacts:  10,152
resolved:   4,606
stale:      5,546

Therefore, in the deterministic FOLDED case:

resolved contacts ≈ 45.4%
stale contacts    ≈ 54.6%

More than half of the initially detected contacts no longer require positional correction by the time they are revisited during PASS 2.

Two consecutive benchmark runs produced:

Run 1
REST     mean 1.0785 ms
FOLDED   mean 2.8956 ms

Run 2
REST     mean 1.0256 ms
FOLDED   mean 2.8404 ms

Practical current baseline:

REST     ~1.05 ms
FOLDED   ~2.87 ms

The REST result remains close to the pre-response detector baseline, so the response stage adds little overhead when no contacts exist.

Decision:

two-pass SelfCollisionSolver
✓ deterministic detection correctness preserved
✓ reusable typed contact-pair buffers
✓ no contact callback in the detector hot path
✓ no per-contact object allocation
✓ stale contacts automatically discarded
✓ ~54.6% of FOLDED contacts avoid response
✓ stable end-to-end benchmark
→ promoted for integration testing

The solver is not yet connected to the SoftSurface simulation pipeline. The next physics milestone is to integrate it and then evaluate ordering, stability, visual behavior and persistent-contact velocity handling.

Pointer UX

The playground distinguishes interaction based on where the primary pointer starts:


LEFT DRAG on SoftSurface

        ↓

deform material

LEFT DRAG on empty space

        ↓

orbit camera

MOUSE WHEEL

        ↓

zoom


This is achieved by letting SoftSurfacePointerInteraction raycast first.

If the mesh is hit, SoftSurface takes control of the pointer.

If no mesh is hit, the event is left to Three.js OrbitControls.

This allows both material interaction and scene navigation using the primary mouse button.

Tests

Current automated coverage includes:

@softsurface/core

particle grid creation

initial particle positions

inverse masses

Verlet integration

damping

acceleration

pinned particles

distance constraints

grid constraint generation

generic constraint solving

stiffness normalization behavior

timestep-independent relaxation

dihedral bending constraint behavior

dihedral constraint generation from grid topology

distance / dihedral bend-model selection

SoftSurface API

material presets

fixed timestep behavior

weighted grab selection

weighted grab movement

grab falloff

pinned-particle grab behavior

grab release

grid triangle topology generation

triangle spatial hashing

spatial-hash bucket reuse

padded triangle AABB storage / containment

allocation-free point-triangle distance queries

self-collision detection

self-collision candidate de-duplication

vertex-triangle collision response

two-pass self-collision solving

@softsurface/three

direct sharing of SoftSurface position buffers

expected vertex count

indexed triangle generation

UV generation

The latest development sequence has continued to pass the full workspace test and build commands after the dihedral integration and generic-constraint refactor.

The full workspace test suite is passing after the collision-response and two-pass solver additions. Exact test counts should be refreshed from the next recorded pnpm test output rather than inferred here.

TypeScript builds and the Vite production build are passing.

SoftSurfacePointerInteraction is currently verified through the interactive playground; dedicated automated tests for pointer/raycast behavior have not yet been added.

Relevant milestones


1ffe13d feat(core): add SoftSurface simulation API

c9851ae feat(three): add SoftSurface geometry adapter

543d706 chore(playground): initialize Vite app

3338d82 feat(playground): render first SoftSurface cloth demo

05af44d feat(core): add fixed timestep simulation

00efc74 feat(core): add material presets


Later milestones include:


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


The padded-AABB pre-filter integration was benchmarked and committed.

A temporary ParticleSpatialHash experiment was then implemented only for comparison. It produced equivalent detection results but worse total benchmark performance, so the experimental implementation, tests and playground integration were removed rather than committed.

A permanent deterministic TriangleSpatialHash regression benchmark was added.

The old Map-backed triangle spatial hash was then replaced internally by the benchmark-winning flat typed-array storage while preserving the public TriangleSpatialHash name and API.

Relevant later commit subjects include:

bench(core): add deterministic triangle spatial hash benchmark
perf(core): replace triangle spatial hash with flat storage
bench(core): add deterministic self-collision detector benchmark
feat(core): add vertex-triangle collision resolver
feat(core): add two-pass self-collision solver

The temporary Map-vs-flat detector benchmark was removed after the decision. TriangleSpatialHash.bench.ts remains as the production regression benchmark.

Commit hashes for later milestones should be added when needed.

Current observations

Material differentiation

Stiffness normalization made the material presets visibly more distinct.

The most noticeable characteristics remain:

stretch

bend

damping

bounce / energy retention

The addition of dihedral bending substantially changed fold quality, so the existing preset bend values now need a new tuning pass before they should be considered representative.

Interaction and fold quality

Weighted grabbing continues to provide natural regional deformation.

The previous distance-based bending produced visible square/grid artifacts in stronger folds, especially in zero gravity.

Switching to dihedral bending produced a major visual improvement. With approximately:


bendStiffness: 0.3

relaxation: 0.5


and the current 48 x 36 test surface, the grid artifacts are close to disappearing while the material remains highly interactive.

The quality remains strong even with a single solver iteration in the current playground scenario.

Self-collision status

The original self-intersection problem is not yet resolved in the live SoftSurface pipeline because the new collision response has not yet been integrated there. The response infrastructure itself now exists and has been tested and benchmarked independently.

The detection infrastructure now includes:

stable grid triangle indices via GridTopology

broad-phase triangle spatial hashing via the flat typed-array TriangleSpatialHash implementation

flat typed-array triangle spatial hash with reusable bucket heads / entry buffers / generation stamps to reduce Map, dynamic-array and GC overhead

allocation-free point-to-triangle distance / closest-point testing

reusable PointTriangleResult

candidate de-duplication using a reusable Uint32Array visit-stamp buffer

reusable SelfCollisionStats

isolated VertexTriangleCollisionResolver

two-pass SelfCollisionSolver

reusable typed particle/triangle contact-pair buffers

deterministic response benchmarks

optional detector integration in SoftSurface

playground controls for enable / thickness / cell size

Performance HUD counters for candidates / tested pairs / contacts

copyable benchmark reports

temporary timing instrumentation for hash build / narrow phase / total detector time

cached padded triangle AABBs and an allocation-free containsPoint() test

Current detection ordering:


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


No vertices are currently moved by self-collision.

At rest, the reference surface reports:


Contacts = 0


with thickness: 0.03, which is an important correctness signal: the flat surface is not being interpreted as self-colliding.

During strong folding / penetration, hundreds of contacts can be detected, showing that the detector is observing the geometric overlap problem.

Detection performance has been reduced substantially before collision response is added. The optimized deterministic detector harness measures approximately 1.07 ms in REST and 1.85 ms in the deterministic FOLDED case on the current development machine. Collision response will add new cost, so these values should be treated as the pre-response baseline rather than a final budget.

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

The AABB pre-filter made the broad phase the next dominant target. A particle-based inverted broad phase was rejected by deterministic benchmarking, while a flat typed-array rewrite of the retained triangle spatial hash produced a large and repeatable improvement and is now the production implementation.

Current production hash-build baseline:

REST    mean ~0.346 ms
FOLDED  mean ~0.352 ms

Current pre-response detector baseline from the deterministic A/B harness:

REST    mean ~1.073 ms
FOLDED  mean ~1.853 ms

Still required before self-collision can be considered fully integrated:

connect SelfCollisionSolver to the SoftSurface simulation pipeline

evaluate solver / relaxation / grab / collision ordering

evaluate persistent-contact behavior and the interaction with Verlet velocity / previousPositions

add topology-aware exclusions if materially useful

visually test folding, sticking, jitter and stability in the playground

later evaluate edge-edge collision cases

investigate tunneling / fast dragging and possible CCD or movement limiting

Dihedral stability

Very high dihedral bend stiffness can become numerically unstable. In manual testing, bendStiffness: 1 caused the simulation to explode.

This should be treated as a stability issue to investigate separately rather than as normal material behavior.

Current visual gap vs HoloCloth

The visual gap has narrowed substantially after adding dihedral bending and relaxation.

The main remaining physical gaps now include:

self-collision

further material tuning

improved collision behavior

stability under extreme parameters

future wrinkle/detail refinements

Lighting/material presentation can still be improved later, but current development should continue to prioritize physical shape, motion and robustness.

Next milestone

Integrate the two-pass SelfCollisionSolver into SoftSurface

The collision-response math and the two-pass solver are now implemented, tested and benchmarked independently.

Current response architecture:

SelfCollisionDetector
    ✓ retained as detection-only regression reference

VertexTriangleCollisionResolver
    ✓ isolated positional response
    ✓ inverse-mass / barycentric correction
    ✓ deterministic tests
    ✓ isolated benchmark

SelfCollisionSolver
    ✓ two-pass detection + response
    ✓ reusable typed contact-pair buffers
    ✓ deterministic REST / FOLDED benchmark
    ✓ stale-contact elimination

The next development session should restart here:

1. Confirm the working tree is clean after the SelfCollisionSolver commit and PROJECT_STATE.md update.

2. Integrate SelfCollisionSolver into SoftSurface without changing unrelated public APIs.

3. Preserve the current detector benchmark as the pre-response regression baseline.

4. Decide and test initial pipeline ordering.

   Current pipeline:
   Verlet
       ↓
   constraints
       ↓
   relaxation
       ↓
   grab
       ↓
   SelfCollisionDetector
       ↓
   stats only

   First integration candidate:
   Verlet
       ↓
   constraints
       ↓
   relaxation
       ↓
   grab
       ↓
   SelfCollisionSolver
       ↓
   corrected positions

5. Run automated tests and build before playground evaluation.

6. Use the playground only for:
   - visual fold quality
   - sticking / separation behavior
   - jitter
   - stability
   - grab interaction

7. Use deterministic benchmarks for any performance or algorithmic decision.

8. After integration, measure:
   - physics avg / max
   - collision total
   - resolvedContacts
   - staleContacts
   - behavior under persistent folds

9. Revisit `previousPositions` handling only if integrated collision behavior shows repeated penetration, excessive energy retention, jitter or sticking.

Important open questions after integration:

where collision response belongs relative to constraints / relaxation / grab
whether collision correction should modify previousPositions exactly as current resolver does
whether inward normal velocity should later be removed explicitly
whether topology-near triangles require exclusion
whether collision solving needs iteration / interleaving with structural constraints
how to prevent oscillation / sticking during persistent contact

Do not resume broad-phase experimentation unless integrated solver measurements expose a new bottleneck.

Performance remains a continuous design constraint rather than an end-stage optimization task.

Planned roadmap


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

[x] Deterministic TriangleSpatialHash regression benchmark

[x] Map vs flat typed-array TriangleSpatialHash comparison

[x] Replace Map-backed TriangleSpatialHash with flat typed-array storage

[x] Integrate optimized TriangleSpatialHash into SelfCollisionDetector

[x] Permanent SelfCollisionDetector regression benchmark

[ ] Self-collision topology exclusions

[x] Vertex-triangle self-collision response

[x] Two-pass SelfCollisionSolver

[x] Deterministic SelfCollisionSolver regression benchmark

[ ] Integrate SelfCollisionSolver into SoftSurface

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


long-term deformable geometry goals

[ ] Arbitrary triangle-mesh topology

[ ] Closed-mesh volume preservation

[ ] GLTF deformable geometry experiments

[ ] XPBD evaluation

[ ] Volumetric / tetrahedral soft bodies — research

Core design rule

@softsurface/core must remain renderer agnostic.

It must not depend on:


Three.js

React

React Three Fiber

WebGL

DOM APIs


Renderer-specific behavior belongs in adapters such as:


@softsurface/three

@softsurface/react-three-fiber


Three.js may determine where an interaction occurs, but the physics engine must determine how the surface reacts.

This separation is considered a fundamental architectural constraint of SoftSurface.





Long-term direction — General deformable geometry

SoftSurface should not be architecturally limited to rectangular cloth simulation.

The current particle grid is intentionally the simplest topology for developing and validating the physics engine, but a possible long-term direction is support for arbitrary deformable 3D geometry.

Potential inputs include:


PlaneGeometry

SphereGeometry

BoxGeometry

arbitrary triangle meshes

GLTF / product geometry


A future topology abstraction could evolve from:


ParticleGrid


toward a more general representation such as:


ParticleMesh / SurfaceTopology


where particles and constraints are derived from mesh vertices, edges and connectivity rather than from a regular (x, y) grid.

Possible evolution:


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


Surface deformation vs soft bodies

Arbitrary surface deformation and true volumetric soft-body simulation are separate capabilities.

A closed triangle mesh using only surface constraints can deform, but may collapse because it has no concept of internal volume.

Future closed-body support may therefore introduce:


surface constraints

+

bend constraints

+

volume preservation

+

collision constraints


A more advanced future implementation could optionally investigate XPBD and tetrahedral volumetric meshes.

This is considered a possible expansion path, not a requirement for the current cloth/surface MVP.

Potential applications

This direction could enable:

interactive 3D product presentation

material previews

footwear and sole deformation

cushions, mattresses and foam products

rubber and silicone objects

flexible packaging

interactive GLTF models

creative 3D experiences

game objects and environmental soft bodies

Product positioning

SoftSurface does not currently aim to replace engineering-grade FEM or scientific material simulation.

The intended opportunity is a lightweight layer between purely visual vertex deformation and heavyweight general-purpose physics engines:


visual deformation

        ↓

SoftSurface

        ↓

general soft-body / engineering simulation


The emphasis should remain on:

browser-first usage

simple APIs

renderer independence

real-time interaction

visually plausible material behavior

creative-web and product-experience use cases

Architectural decisions made during the current MVP should avoid unnecessarily preventing this future evolution.