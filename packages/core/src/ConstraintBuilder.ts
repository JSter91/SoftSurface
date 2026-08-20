import { DistanceConstraint } from "./DistanceConstraint.js";
import { ParticleGrid } from "./ParticleGrid.js";
import type { Constraint } from "./Constraint.js";
import {
  buildGridDihedralConstraints,
} from "./DihedralConstraintBuilder.js";

export type BendModel =
  | "distance"
  | "dihedral";
export interface GridConstraintOptions {
  structuralStiffness?: number;
  shearStiffness?: number;
  bendStiffness?: number;
  bendModel?: BendModel;
}
export interface GridConstraints {
  structural: DistanceConstraint[];
  shear: DistanceConstraint[];
  bend: Constraint[];
}
export function createGridConstraints(
  grid: ParticleGrid,
  options: GridConstraintOptions = {},
): GridConstraints {
  const {
    structuralStiffness = 1,
    shearStiffness = 0.85,
    bendStiffness = 0.35,
    bendModel = "distance",
  } = options;

  const structural: DistanceConstraint[] = [];
  const shear: DistanceConstraint[] = [];
  const bend: Constraint[] = [];

  const spacingX = grid.width / grid.segmentsX;
  const spacingY = grid.height / grid.segmentsY;

  const shearLength = Math.hypot(spacingX, spacingY);

  // Structural constraints
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.columns; x++) {
      const current = grid.getParticleIndex(x, y);

      // Horizontal neighbor
      if (x < grid.columns - 1) {
        structural.push(
          new DistanceConstraint(
            current,
            grid.getParticleIndex(x + 1, y),
            spacingX,
            structuralStiffness,
          ),
        );
      }

      // Vertical neighbor
      if (y < grid.rows - 1) {
        structural.push(
          new DistanceConstraint(
            current,
            grid.getParticleIndex(x, y + 1),
            spacingY,
            structuralStiffness,
          ),
        );
      }
    }
  }

  // Shear constraints
  for (let y = 0; y < grid.rows - 1; y++) {
    for (let x = 0; x < grid.columns - 1; x++) {
      const topLeft = grid.getParticleIndex(x, y);
      const topRight = grid.getParticleIndex(x + 1, y);
      const bottomLeft = grid.getParticleIndex(x, y + 1);
      const bottomRight = grid.getParticleIndex(x + 1, y + 1);

      shear.push(
        new DistanceConstraint(
          topLeft,
          bottomRight,
          shearLength,
          shearStiffness,
        ),
      );

      shear.push(
        new DistanceConstraint(
          topRight,
          bottomLeft,
          shearLength,
          shearStiffness,
        ),
      );
    }
  }

  // Bend constraints
  if (bendModel === "distance") {
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.columns; x++) {
        const current = grid.getParticleIndex(x, y);

        // Two particles apart horizontally
        if (x < grid.columns - 2) {
          bend.push(
            new DistanceConstraint(
              current,
              grid.getParticleIndex(x + 2, y),
              spacingX * 2,
              bendStiffness,
            ),
          );
        }

        // Two particles apart vertically
        if (y < grid.rows - 2) {
          bend.push(
            new DistanceConstraint(
              current,
              grid.getParticleIndex(x, y + 2),
              spacingY * 2,
              bendStiffness,
            ),
          );
        }
      }
    }
  } else if (bendModel === "dihedral") {
    bend.push(...buildGridDihedralConstraints(grid, bendStiffness));
  } else {
    throw new RangeError(`Unknown bend model: ${String(bendModel)}`);
  }
  return {
    structural,
    shear,
    bend,
  };
}
