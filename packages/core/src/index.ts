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

export {
  SoftSurface,
  type SoftSurfaceOptions,
} from "./SoftSurface.js";

export {
  MATERIAL_PRESETS,
  type MaterialParameters,
  type SoftSurfacePreset,
} from "./MaterialPresets.js";

export {
  GrabInteraction,
  type GrabOptions,
  type GrabPoint,
} from "./GrabInteraction.js";

export {
  SurfaceRelaxation,
  type SurfaceRelaxationOptions,
} from "./SurfaceRelaxation.js";

export {
  DihedralBendingConstraint,
  computeDihedralAngle,
} from "./DihedralBendingConstraint.js";

export {
  buildGridDihedralConstraints,
} from "./DihedralConstraintBuilder.js";