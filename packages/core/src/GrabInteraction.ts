import type { ParticleGrid } from "./ParticleGrid.js";

export type GrabPoint = readonly [
  number,
  number,
  number,
];

export interface GrabOptions {
  /**
   * Radius around the grab point that influences particles.
   */
  radius?: number;

  /**
   * Overall influence of the grab.
   *
   * 0 = no influence
   * 1 = full influence
   */
  strength?: number;
}

export class GrabInteraction {
  private readonly grid: ParticleGrid;

  private active = false;

  private targetX = 0;
  private targetY = 0;
  private targetZ = 0;

  private indices = new Uint32Array(0);
  private weights = new Float32Array(0);
  private offsets = new Float32Array(0);

  constructor(grid: ParticleGrid) {
    this.grid = grid;
  }

  get isActive(): boolean {
    return this.active;
  }

  get affectedParticleCount(): number {
    return this.indices.length;
  }

  grab(
    point: GrabPoint,
    options: GrabOptions = {},
  ): number {
    const radius =
      options.radius ??
      Math.min(this.grid.width, this.grid.height) * 0.15;

    const strength =
      options.strength ?? 1;

    if (radius <= 0) {
      throw new RangeError(
        "grab radius must be greater than 0",
      );
    }

    if (strength < 0 || strength > 1) {
      throw new RangeError(
        "grab strength must be between 0 and 1",
      );
    }

    const [grabX, grabY, grabZ] = point;

    const selectedIndices: number[] = [];
    const selectedWeights: number[] = [];
    const selectedOffsets: number[] = [];

    const positions = this.grid.positions;

    for (
      let particleIndex = 0;
      particleIndex < this.grid.particleCount;
      particleIndex++
    ) {
      const offset = particleIndex * 3;

      const x = positions[offset];
      const y = positions[offset + 1];
      const z = positions[offset + 2];

      const dx = x - grabX;
      const dy = y - grabY;
      const dz = z - grabZ;

      const distance = Math.sqrt(
        dx * dx +
        dy * dy +
        dz * dz,
      );

      if (distance > radius) {
        continue;
      }

      const normalizedDistance =
        distance / radius;

      const weight =
        (1 - smoothstep(normalizedDistance)) *
        strength;

      if (weight <= 0) {
        continue;
      }

      selectedIndices.push(particleIndex);
      selectedWeights.push(weight);

      // Preserve each particle's relative position
      // around the original grab point.
      selectedOffsets.push(
        dx,
        dy,
        dz,
      );
    }

    this.indices =
      Uint32Array.from(selectedIndices);

    this.weights =
      Float32Array.from(selectedWeights);

    this.offsets =
      Float32Array.from(selectedOffsets);

    this.targetX = grabX;
    this.targetY = grabY;
    this.targetZ = grabZ;

    this.active =
      this.indices.length > 0;

    return this.indices.length;
  }

  move(point: GrabPoint): void {
    if (!this.active) {
      return;
    }

    this.targetX = point[0];
    this.targetY = point[1];
    this.targetZ = point[2];
  }

  apply(): void {
    if (!this.active) {
      return;
    }

    const positions =
      this.grid.positions;

    const previousPositions =
      this.grid.previousPositions;

    for (
      let selectionIndex = 0;
      selectionIndex < this.indices.length;
      selectionIndex++
    ) {
      const particleIndex =
        this.indices[selectionIndex];

      // Pinned particles must remain pinned.
      if (
        this.grid.inverseMasses[
          particleIndex
        ] === 0
      ) {
        continue;
      }

      const positionOffset =
        particleIndex * 3;

      const grabOffset =
        selectionIndex * 3;

      const weight =
        this.weights[selectionIndex];

      const desiredX =
        this.targetX +
        this.offsets[grabOffset];

      const desiredY =
        this.targetY +
        this.offsets[grabOffset + 1];

      const desiredZ =
        this.targetZ +
        this.offsets[grabOffset + 2];

      const deltaX =
        (desiredX -
          positions[positionOffset]) *
        weight;

      const deltaY =
        (desiredY -
          positions[positionOffset + 1]) *
        weight;

      const deltaZ =
        (desiredZ -
          positions[positionOffset + 2]) *
        weight;

      positions[positionOffset] += deltaX;
      positions[positionOffset + 1] += deltaY;
      positions[positionOffset + 2] += deltaZ;

      /*
       * Move previousPositions by the same amount.
       *
       * This prevents the positional correction from
       * accidentally becoming a huge Verlet velocity.
       */
      previousPositions[positionOffset] += deltaX;
      previousPositions[positionOffset + 1] += deltaY;
      previousPositions[positionOffset + 2] += deltaZ;
    }
  }

  release(): void {
    this.active = false;

    this.indices =
      new Uint32Array(0);

    this.weights =
      new Float32Array(0);

    this.offsets =
      new Float32Array(0);
  }
}

function smoothstep(value: number): number {
  const t =
    Math.max(0, Math.min(1, value));

  return t * t * (3 - 2 * t);
}