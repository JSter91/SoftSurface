# SoftSurface — AI-Friendly Documentation Plan

> Status: Planned
>
> This document defines how SoftSurface should be documented for AI coding
> agents once the core architecture is sufficiently stable.
>
> It is intentionally not the final AI documentation.

---

## Goal

SoftSurface should be easy to understand and use not only by human
developers, but also by AI coding agents that have no previous knowledge
of the project.

An agent should be able to inspect the repository and quickly understand:

- what SoftSurface is;
- how the simulation pipeline works;
- which package owns each responsibility;
- which architectural rules must not be violated;
- how to use the public API;
- how to safely modify the physics core;
- how correctness is tested;
- how performance changes are evaluated;
- which architectural alternatives have already been tested and rejected.

The objective is to reduce the amount of repository context an agent must
read before making a correct modification.

---

# Core principle

The documentation should explain not only:

> "How does SoftSurface work?"

but also:

> "Why is SoftSurface designed this way?"

This is particularly important for AI agents.

Without historical architectural context, an agent may propose an approach
that looks reasonable but has already been tested and rejected.

---

# Documentation architecture

When the core is sufficiently stable, the project should contain several
different documentation layers.

## README.md

Audience:

- developers discovering SoftSurface;
- users evaluating the library;
- AI agents performing an initial repository scan.

Purpose:

- explain what SoftSurface does;
- show the simplest possible usage;
- describe the packages;
- link to deeper documentation.

The README should remain concise.

---

## AGENTS.md

Primary entry point for AI coding agents.

It should contain only the information required to work safely inside the
repository.

Suggested sections:

### Project purpose

SoftSurface is a browser-first, renderer-agnostic deformable-surface
physics library written in TypeScript.

It targets interactive and visually plausible deformation rather than
engineering/FEM accuracy.

### Architecture rules

Important invariants should be explicitly documented.

Example:

- `@softsurface/core` must remain renderer-agnostic.
- The core must not depend on Three.js, React, WebGL or the DOM.
- Renderer integrations belong in adapter packages.
- Physics hot paths should avoid unnecessary allocations.
- Particle state uses typed arrays.
- Performance-sensitive changes must be benchmarked.
- Correctness must be verified before comparing benchmark results.

### Repository structure

Example:

```text
packages/core
    physics and renderer-independent simulation

packages/three
    Three.js integration

apps/playground
    visual testing, tuning and experimentation
```

The final version must reflect the actual production pipeline.

Development workflow

Example:

1. identify the owning module
2. implement the smallest isolated change
3. add/update correctness tests
4. run pnpm test
5. run pnpm build
6. benchmark performance-sensitive changes
7. verify correctness equivalence before comparing performance
8. keep only experiments that demonstrate a measurable benefit
   ARCHITECTURE.md

A human- and machine-readable description of how SoftSurface works.

Suggested topics:

Particle representation

Document:

positions;
previous positions;
inverse masses;
grid topology;
ownership of particle state.
Integration

Document the Verlet integration model and timestep assumptions.

Constraints

Document:

structural constraints;
shear constraints;
bending constraints;
constraint solver;
stiffness normalization.
Bending

Explain the available bending models and when they are used.

Interaction

Explain grabbing and pointer interaction without introducing
renderer-specific concepts into the core.

Self-collision

Document the complete collision pipeline.

Example:

TriangleSpatialHash
↓
candidate triangles
↓
padded AABB rejection
↓
point-triangle narrow phase
↓
contact generation
↓
collision response
Renderer adapters

Explain clearly where core responsibility ends and adapter responsibility
begins.

Architecture Decision Records

Create:

docs/decisions/

Important architectural decisions should be preserved as small ADRs.

The goal is not to record every change.

Only decisions that explain the current architecture or prevent future
developers/agents from repeating rejected experiments should be included.

Candidate ADRs:

renderer-agnostic core

typed-array particle state

fixed timestep simulation

iteration-independent stiffness

weighted grab interaction

dihedral bending

self-collision architecture

AABB narrow-phase prefilter

deterministic physics benchmarking

flat TriangleSpatialHash storage
Important historical decisions to preserve

The following developments should eventually be documented.

Renderer-independent core

@softsurface/core must not depend on:

Three.js;
React;
WebGL;
DOM APIs.

Renderer-specific behavior belongs in adapters such as
@softsurface/three.

Fixed timestep

SoftSurface uses a fixed timestep to make simulation behavior more stable
and less dependent on rendering framerate.

The final documentation should explain:

why the fixed timestep exists;
how substeps work;
how maxSubsteps affects behavior and performance.
Iteration-independent stiffness

Constraint stiffness is normalized across solver iterations.

The current model is based on:

iterationStiffness =
1 - Math.pow(1 - stiffness, 1 / iterations);

This prevents changing the solver iteration count from drastically changing
the perceived material stiffness.

This invariant should be documented because an AI agent could otherwise
accidentally remove it while optimizing the solver.

Dihedral bending

Distance-based bending was initially available but produced visible
grid/square artifacts under deformation.

Dihedral bending produced substantially better visual results and became
the preferred bending model.

Distance bending remains useful for compatibility or simpler cases.

The documentation should explain the trade-off rather than merely listing
both options.

Self-collision case study

The development of self-collision detection should become one of the main
architecture case studies.

It contains several useful engineering lessons.

Initial problem

When a deformable surface folded over itself, particles could pass through
other parts of the same surface.

This revealed that SoftSurface required explicit self-collision support.

The problem was separated into:

collision detection
collision response

Detection was implemented and optimized before response was introduced.

Triangle topology

Grid topology was converted into triangle indices so collision tests could
operate on the rendered surface representation.

Point-triangle narrow phase

An allocation-free point-to-triangle squared-distance implementation was
introduced.

It provides:

squared distance;
closest point;
barycentric coordinates.

Reusable result objects are used to avoid allocations inside the hot path.

Triangle spatial hashing

A triangle spatial hash was introduced as the broad phase.

Triangles are inserted into cells intersecting their padded AABB.

Particles query their local spatial cell to retrieve candidate triangles.

AABB prefilter

An exact padded-AABB test was added before the expensive point-triangle
distance calculation.

This reduced narrow-phase tests approximately from:

~25,000

to:

~3,500

in the reference REST scenario.

This changed the performance profile of the detector.

The narrow phase was no longer the dominant cost.

The spatial broad phase became the next optimization target.

ParticleSpatialHash experiment

An alternative particle-based spatial hash was tested.

The hypothesis was attractive because the reference surface contains only
around 1,800 particles while triangle hashing requires tens of thousands of
triangle-cell insertions.

The particle hash dramatically reduced hash-build cost.

However, the cost moved into triangle-cell traversal.

A deterministic end-to-end benchmark showed that the existing triangle
broad phase was still faster overall.

The experiment was rejected and removed.

Important lesson:

Optimizing one stage of a physics pipeline does not guarantee that the
complete pipeline becomes faster.

Deterministic benchmark methodology

The ParticleSpatialHash experiment led to an important project-wide
performance rule.

Manual interaction in the playground is useful for:

visual quality;
interaction feel;
stability;
deformation behavior.

It must not be used as the primary method for choosing between performance
algorithms.

Performance decisions should use deterministic benchmarks.

Required methodology:

same mesh
same positions
same parameters
same scenario
correctness gate
warmup
repeated measurements
mean + percentile comparison

Correctness must be established before performance is compared.

Flat TriangleSpatialHash

After rejecting ParticleSpatialHash, optimization returned to the triangle
broad phase.

The algorithm remained conceptually the same.

The storage representation changed.

The original implementation used:

Map<number, number[]>

with bucket arrays and bucket reuse.

An experimental implementation replaced this with reusable typed-array
storage.

Conceptually:

bucketHeads: Int32Array
slotGenerations: Uint32Array

entryTriangles: Uint32Array
entryKeys: Uint32Array
entryNext: Int32Array

This preserved the triangle spatial-hash architecture while reducing
JavaScript Map and dynamic-array overhead.

Broad-phase benchmark result

Reference mesh:

width: 4
height: 3
segmentsX: 48
segmentsY: 36
thickness: 0.03
cellSize: 0.1

Two deterministic scenarios were used:

REST
FOLDED

The flat implementation produced approximately:

REST
mean ≈ 0.35 ms

FOLDED
mean ≈ 0.35 ms

The previous Map implementation required approximately:

REST
~1.2–1.4 ms

FOLDED
~1.0 ms

The flat implementation was approximately:

REST 3.37× faster
FOLDED 2.78× faster

during the direct broad-phase comparison.

End-to-end detector benchmark

Correctness was verified first.

REST:

testedPairs: 3456
contacts: 0

FOLDED:

testedPairs: 16992
contacts: 10152

Map implementation:

REST mean:
~1.73 ms

FOLDED mean:
~2.15 ms

Flat implementation:

REST mean:
~1.07 ms

FOLDED mean:
~1.85 ms

The flat implementation remained faster when measured across the complete
collision detector.

It was therefore promoted to the official TriangleSpatialHash
implementation.

The experimental FlatTriangleSpatialHash name was removed.

The public concept remains:

TriangleSpatialHash

The flat typed-array representation is an internal implementation detail.

Important implementation invariant

TriangleSpatialHash.queryPoint() reuses an internal result array.

Consumers must not retain the returned array across subsequent calls to
queryPoint().

Correct:

const candidates = hash.queryPoint(x, y, z);

for (const triangle of candidates) {
// consume immediately
}

Potentially incorrect:

const first = hash.queryPoint(...);
const second = hash.queryPoint(...);

// first may now reference reused storage

This invariant should eventually be documented directly with JSDoc.

Tests and benchmarks as contracts

SoftSurface should explicitly distinguish two forms of executable
documentation.

Tests

Tests define the correctness contract.

packages/core/test/

An AI agent modifying the core should inspect the related tests before
changing behavior.

Benchmarks

Benchmarks define the performance contract for hot paths.

packages/core/bench/

Performance-sensitive architecture changes should not be accepted based
only on intuition or manual profiling.

Canonical examples

Once the API stabilizes, create small examples that can be easily consumed
by both developers and AI agents.

Possible examples:

examples/basic-cloth
examples/material-presets
examples/pointer-grab
examples/self-collision
examples/three-basic

Examples should be:

small;
complete;
canonical;
independent where possible;
representative of recommended API usage.

Avoid making the playground the only usage example.

JSDoc strategy

Important public classes and performance-sensitive internal systems should
have concise JSDoc documenting:

ownership;
invariants;
allocation behavior;
mutation behavior;
lifetime of returned objects;
assumptions that callers must respect.

JSDoc should explain behavior that cannot be inferred safely from the type
signature alone.

Machine-readable API

The public API should remain strongly typed.

Prefer explicit TypeScript types such as:

type BendModel =
| "distance"
| "dihedral";

over arbitrary strings or implicit conventions.

Configuration objects should expose primitive, composable options.

Presets may exist for convenience, but they should not hide the underlying
model.

Generated .d.ts files should provide enough information for coding agents
to understand the public API without reading implementation internals.

AI usability test

Once the documentation is implemented, SoftSurface should be tested with a
fresh AI coding agent that has no previous context about the project.

Example task:

Add SoftSurface to a basic Three.js scene and create a deformable surface
that reacts to pointer interaction.

The agent should receive only:

repository

- normal project documentation

No hidden explanation of the architecture should be provided.

The test succeeds if the agent can correctly identify:

@softsurface/core;
@softsurface/three;
the renderer boundary;
the simulation lifecycle;
the appropriate API;
required initialization;
update/render integration.

A second, harder test should ask the agent to modify the physics engine.

The agent should respect the project's architectural and performance
invariants without being explicitly reminded of them.

Possible AI-readability metric

A useful future project metric could be:

How much repository context must an unfamiliar coding agent read before it
can safely perform a common SoftSurface task?

The goal should be to minimize this context without hiding important
architecture.

This may become a differentiating characteristic of SoftSurface.

When to implement this documentation

Do not fully implement the AI documentation while the core architecture is
still changing rapidly.

Recommended milestone:

core simulation stable
↓
collision detection stable
↓
collision response stable
↓
public API stabilization
↓
AI-friendly documentation pass

At that point:

create AGENTS.md;
create docs/ARCHITECTURE.md;
extract durable decisions into ADRs;
add canonical examples;
improve JSDoc;
review public TypeScript API;
run the fresh-agent usability test.
Decisions that must not be forgotten

When the documentation pass begins, recover and document at least:

renderer-independent core architecture;
ParticleGrid / typed-array state;
Verlet integration;
fixed timestep;
solver iteration behavior;
iteration-independent stiffness;
weighted grab interaction;
surface relaxation;
distance vs dihedral bending;
self-collision topology;
point-triangle narrow phase;
AABB prefilter;
deterministic benchmarking methodology;
rejected ParticleSpatialHash experiment;
flat typed-array TriangleSpatialHash;
collision response architecture once implemented.
Current status

This document is a planning checkpoint.

Do not treat it as the authoritative description of the current public API.

The authoritative development state remains:

PROJECT_STATE.md

This file exists so the AI-friendly documentation milestone is not forgotten
while the physics engine continues to evolve.
