export { ParticleGrid } from "./ParticleGrid.js";

export type {
  ParticleGridOptions,
} from "./types.js";

export {
  VerletIntegrator,
  type VerletIntegratorOptions,
} from "./VerletIntegrator.js";

export { DistanceConstraint } from "./DistanceConstraint.js";

export const SOFTSURFACE_VERSION = "0.0.1";

export {
  createGridConstraints,
  type GridConstraintOptions,
  type GridConstraints,
} from "./ConstraintBuilder.js";

export {
  ConstraintSolver,
  type ConstraintSolverOptions,
} from "./ConstraintSolver.js";