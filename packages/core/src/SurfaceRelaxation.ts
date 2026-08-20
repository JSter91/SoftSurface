import type { ParticleGrid } from "./ParticleGrid.js";

export interface SurfaceRelaxationOptions {
  strength?: number;
}

export class SurfaceRelaxation {
  private readonly strength: number;
  private readonly targetPositions: Float32Array;

  constructor(grid: ParticleGrid, options: SurfaceRelaxationOptions = {}) {
    const strength = options.strength ?? 0;

    if (strength < 0 || strength > 1) {
      throw new RangeError("relaxation strength must be between 0 and 1");
    }

    this.strength = strength;

    this.targetPositions = new Float32Array(grid.positions.length);
  }

//   apply(grid: ParticleGrid): void {
//     if (this.strength === 0) {
//       return;
//     }

//     const positions = grid.positions;

//     /*
//      * Read from the original positions and write targets
//      * into a separate buffer.
//      *
//      * This avoids iteration-order bias.
//      */
//     this.targetPositions.set(positions);

//     for (let y = 1; y < grid.rows - 1; y++) {
//       for (let x = 1; x < grid.columns - 1; x++) {
//         const particle = grid.getParticleIndex(x, y);

//         if (grid.inverseMasses[particle] === 0) {
//           continue;
//         }

//         const left = grid.getParticleIndex(x - 1, y);

//         const right = grid.getParticleIndex(x + 1, y);

//         const top = grid.getParticleIndex(x, y - 1);

//         const bottom = grid.getParticleIndex(x, y + 1);

//         const offset = particle * 3;

//         const leftOffset = left * 3;
//         const rightOffset = right * 3;
//         const topOffset = top * 3;
//         const bottomOffset = bottom * 3;

//         for (let axis = 0; axis < 3; axis++) {
//           const average =
//             (positions[leftOffset + axis] +
//               positions[rightOffset + axis] +
//               positions[topOffset + axis] +
//               positions[bottomOffset + axis]) /
//             4;

//           const current = positions[offset + axis];

//           this.targetPositions[offset + axis] =
//             current + (average - current) * this.strength;
//         }
//       }
//     }

//     /*
//      * Apply the correction to both current and previous
//      * positions so relaxation does not inject velocity.
//      */
//     for (let particle = 0; particle < grid.particleCount; particle++) {
//       if (grid.inverseMasses[particle] === 0) {
//         continue;
//       }

//       const offset = particle * 3;

//       for (let axis = 0; axis < 3; axis++) {
//         const delta =
//           this.targetPositions[offset + axis] - positions[offset + axis];

//         positions[offset + axis] += delta;

//         grid.previousPositions[offset + axis] += delta;
//       }
//     }
//   }

apply(
  grid: ParticleGrid,
  deltaTime: number,
): void {
  if (this.strength === 0 || deltaTime <= 0) {
    return;
  }

  const adjustedStrength =
    getTimeAdjustedStrength(
      this.strength,
      deltaTime,
    );

  const positions = grid.positions;

  this.targetPositions.set(positions);

  for (let y = 1; y < grid.rows - 1; y++) {
    for (let x = 1; x < grid.columns - 1; x++) {
      const particle =
        grid.getParticleIndex(x, y);

      if (grid.inverseMasses[particle] === 0) {
        continue;
      }

      const left =
        grid.getParticleIndex(x - 1, y);

      const right =
        grid.getParticleIndex(x + 1, y);

      const top =
        grid.getParticleIndex(x, y - 1);

      const bottom =
        grid.getParticleIndex(x, y + 1);

      const offset = particle * 3;

      const leftOffset = left * 3;
      const rightOffset = right * 3;
      const topOffset = top * 3;
      const bottomOffset = bottom * 3;

      for (let axis = 0; axis < 3; axis++) {
        const average =
          (
            positions[leftOffset + axis] +
            positions[rightOffset + axis] +
            positions[topOffset + axis] +
            positions[bottomOffset + axis]
          ) / 4;

        const current =
          positions[offset + axis];

        this.targetPositions[offset + axis] =
          current +
          (average - current) *
            adjustedStrength;
      }
    }
  }

  for (
    let particle = 0;
    particle < grid.particleCount;
    particle++
  ) {
    if (grid.inverseMasses[particle] === 0) {
      continue;
    }

    const offset = particle * 3;

    for (let axis = 0; axis < 3; axis++) {
      const delta =
        this.targetPositions[offset + axis] -
        positions[offset + axis];

      positions[offset + axis] += delta;

      grid.previousPositions[offset + axis] += delta;
    }
  }
}
}

function getTimeAdjustedStrength(
  strength: number,
  deltaTime: number,
  referenceTimeStep = 1 / 60,
): number {
  if (strength <= 0) {
    return 0;
  }

  if (strength >= 1) {
    return 1;
  }

  return 1 - Math.pow(
    1 - strength,
    deltaTime / referenceTimeStep,
  );
}
