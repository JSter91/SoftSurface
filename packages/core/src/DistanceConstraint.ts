export class DistanceConstraint {
  readonly particleA: number;
  readonly particleB: number;
  readonly restLength: number;
  readonly stiffness: number;

  constructor(
    particleA: number,
    particleB: number,
    restLength: number,
    stiffness = 1,
  ) {
    if (!Number.isInteger(particleA) || particleA < 0) {
      throw new RangeError("particleA must be a non-negative integer");
    }

    if (!Number.isInteger(particleB) || particleB < 0) {
      throw new RangeError("particleB must be a non-negative integer");
    }

    if (particleA === particleB) {
      throw new Error("A constraint requires two different particles");
    }

    if (restLength <= 0) {
      throw new RangeError("restLength must be greater than 0");
    }

    if (stiffness < 0 || stiffness > 1) {
      throw new RangeError("stiffness must be between 0 and 1");
    }

    this.particleA = particleA;
    this.particleB = particleB;
    this.restLength = restLength;
    this.stiffness = stiffness;
  }

  solve(
    positions: Float32Array,
    inverseMasses: Float32Array,
    stiffness = this.stiffness,
  ): void {
    const offsetA = this.particleA * 3;
    const offsetB = this.particleB * 3;

    const weightA = inverseMasses[this.particleA];
    const weightB = inverseMasses[this.particleB];

    const totalWeight = weightA + weightB;

    if (totalWeight === 0) {
      return;
    }

    const ax = positions[offsetA];
    const ay = positions[offsetA + 1];
    const az = positions[offsetA + 2];

    const bx = positions[offsetB];
    const by = positions[offsetB + 1];
    const bz = positions[offsetB + 2];

    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;

    const distanceSquared = dx * dx + dy * dy + dz * dz;

    if (distanceSquared === 0) {
      return;
    }

    const distance = Math.sqrt(distanceSquared);

    const difference = (distance - this.restLength) / distance;

    const correction = difference * stiffness;
    
    const correctionA = correction * (weightA / totalWeight);

    const correctionB = correction * (weightB / totalWeight);

    positions[offsetA] += dx * correctionA;
    positions[offsetA + 1] += dy * correctionA;
    positions[offsetA + 2] += dz * correctionA;

    positions[offsetB] -= dx * correctionB;
    positions[offsetB + 1] -= dy * correctionB;
    positions[offsetB + 2] -= dz * correctionB;
  }
}
