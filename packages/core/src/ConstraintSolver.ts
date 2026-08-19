import type { GridConstraints } from "./ConstraintBuilder.js";
import type { ParticleGrid } from "./ParticleGrid.js";

export interface ConstraintSolverOptions {
  iterations?: number;
}

export class ConstraintSolver {
  private readonly iterations: number;

  constructor(options: ConstraintSolverOptions = {}) {
    const { iterations = 8 } = options;

    if (!Number.isInteger(iterations) || iterations < 1) {
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
    const { positions, inverseMasses } = grid;

    for (
      let iteration = 0;
      iteration < this.iterations;
      iteration++
    ) {
      for (const constraint of constraints.structural) {
        constraint.solve(
          positions,
          inverseMasses,
          getIterationStiffness(
            constraint.stiffness,
            this.iterations,
          ),
        );
      }

      for (const constraint of constraints.shear) {
        constraint.solve(
          positions,
          inverseMasses,
          getIterationStiffness(
            constraint.stiffness,
            this.iterations,
          ),
        );
      }

      for (const constraint of constraints.bend) {
        constraint.solve(
          positions,
          inverseMasses,
          getIterationStiffness(
            constraint.stiffness,
            this.iterations,
          ),
        );
      }
    }
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