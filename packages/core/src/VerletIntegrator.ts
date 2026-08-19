import { ParticleGrid } from "./ParticleGrid.js";

export interface VerletIntegratorOptions {
  /**
   * Fraction of velocity removed at each step.
   *
   * 0 = no damping
   * 1 = all velocity removed
   */
  damping?: number;

  /**
   * Constant acceleration applied to movable particles.
   * Example gravity: [0, -9.81, 0]
   */
  acceleration?: readonly [number, number, number];
}

export class VerletIntegrator {
  private readonly damping: number;
  private readonly acceleration: readonly [number, number, number];

  constructor(options: VerletIntegratorOptions = {}) {
    const {
      damping = 0.01,
      acceleration = [0, 0, 0],
    } = options;

    if (damping < 0 || damping > 1) {
      throw new RangeError("damping must be between 0 and 1");
    }

    this.damping = damping;
    this.acceleration = acceleration;
  }

  step(grid: ParticleGrid, deltaTime: number): void {
    if (deltaTime <= 0) {
      return;
    }

    const positions = grid.positions;
    const previousPositions = grid.previousPositions;
    const inverseMasses = grid.inverseMasses;

    const velocityRetention = 1 - this.damping;
    const deltaTimeSquared = deltaTime * deltaTime;

    const ax = this.acceleration[0];
    const ay = this.acceleration[1];
    const az = this.acceleration[2];

    for (
      let particleIndex = 0;
      particleIndex < grid.particleCount;
      particleIndex++
    ) {
      const offset = particleIndex * 3;

      if (inverseMasses[particleIndex] === 0) {
        previousPositions[offset] = positions[offset];
        previousPositions[offset + 1] = positions[offset + 1];
        previousPositions[offset + 2] = positions[offset + 2];

        continue;
      }

      const x = positions[offset];
      const y = positions[offset + 1];
      const z = positions[offset + 2];

      const previousX = previousPositions[offset];
      const previousY = previousPositions[offset + 1];
      const previousZ = previousPositions[offset + 2];

      const velocityX = (x - previousX) * velocityRetention;
      const velocityY = (y - previousY) * velocityRetention;
      const velocityZ = (z - previousZ) * velocityRetention;

      previousPositions[offset] = x;
      previousPositions[offset + 1] = y;
      previousPositions[offset + 2] = z;

      positions[offset] =
        x + velocityX + ax * deltaTimeSquared;

      positions[offset + 1] =
        y + velocityY + ay * deltaTimeSquared;

      positions[offset + 2] =
        z + velocityZ + az * deltaTimeSquared;
    }
  }
}