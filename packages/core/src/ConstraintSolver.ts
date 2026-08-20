import type { Constraint } from "./Constraint.js";
import type { GridConstraints } from "./ConstraintBuilder.js";
import type { ParticleGrid } from "./ParticleGrid.js";

export interface ConstraintSolverOptions {
  iterations?: number;
}

interface PreparedConstraint {
  constraint: Constraint;
  iterationStiffness: number;
}

interface PreparedConstraints {
  structural: PreparedConstraint[];
  shear: PreparedConstraint[];
  bend: PreparedConstraint[];
}

export class ConstraintSolver {
  private readonly iterations: number;

  private cachedSource:
    | GridConstraints
    | null = null;

  private prepared:
    | PreparedConstraints
    | null = null;

  constructor(
    options: ConstraintSolverOptions = {},
  ) {
    const { iterations = 8 } = options;

    if (
      !Number.isInteger(iterations) ||
      iterations < 1
    ) {
      throw new RangeError(
        "iterations must be a positive integer",
      );
    }

    this.iterations = iterations;
  }

  solve(
    grid: ParticleGrid,
    constraints: GridConstraints,
  ): void {
    const {
      positions,
      inverseMasses,
    } = grid;

    /*
     * Constraint stiffness and solver iteration count
     * are constant for a SoftSurface instance.
     *
     * Prepare the per-iteration stiffness once instead
     * of recalculating Math.pow() inside the hot loop.
     */
    if (
      this.cachedSource !== constraints ||
      this.prepared === null
    ) {
      this.prepared =
        this.prepareConstraints(
          constraints,
        );

      this.cachedSource =
        constraints;
    }

    const {
      structural,
      shear,
      bend,
    } = this.prepared;

    for (
      let iteration = 0;
      iteration <
      this.iterations;
      iteration++
    ) {
      solvePreparedGroup(
        structural,
        positions,
        inverseMasses,
      );

      solvePreparedGroup(
        shear,
        positions,
        inverseMasses,
      );

      solvePreparedGroup(
        bend,
        positions,
        inverseMasses,
      );
    }
  }

  private prepareConstraints(
    constraints: GridConstraints,
  ): PreparedConstraints {
    return {
      structural:
        prepareConstraintGroup(
          constraints.structural,
          this.iterations,
        ),

      shear:
        prepareConstraintGroup(
          constraints.shear,
          this.iterations,
        ),

      bend:
        prepareConstraintGroup(
          constraints.bend,
          this.iterations,
        ),
    };
  }
}

function prepareConstraintGroup(
  constraints: readonly Constraint[],
  iterations: number,
): PreparedConstraint[] {
  return constraints.map(
    (constraint) => ({
      constraint,
      iterationStiffness:
        getIterationStiffness(
          constraint.stiffness,
          iterations,
        ),
    }),
  );
}

function solvePreparedGroup(
  prepared: readonly PreparedConstraint[],
  positions: Float32Array,
  inverseMasses: Float32Array,
): void {
  for (
    let i = 0;
    i < prepared.length;
    i++
  ) {
    const {
      constraint,
      iterationStiffness,
    } = prepared[i];

    constraint.solve(
      positions,
      inverseMasses,
      iterationStiffness,
    );
  }
}

function getIterationStiffness(
  stiffness: number,
  iterations: number,
): number {
  if (stiffness <= 0) {
    return 0;
  }

  if (stiffness >= 1) {
    return 1;
  }

  return 1 - Math.pow(
    1 - stiffness,
    1 / iterations,
  );
}