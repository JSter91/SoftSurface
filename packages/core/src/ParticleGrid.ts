import type { ParticleGridOptions } from "./types.js";

export class ParticleGrid {
  readonly width: number;
  readonly height: number;

  readonly segmentsX: number;
  readonly segmentsY: number;

  readonly columns: number;
  readonly rows: number;
  readonly particleCount: number;

  readonly positions: Float32Array;
  readonly previousPositions: Float32Array;
  readonly inverseMasses: Float32Array;

  constructor(options: ParticleGridOptions) {
    const { width, height, segmentsX, segmentsY } = options;

    if (width <= 0 || height <= 0) {
      throw new Error("width and height must be greater than 0");
    }

    if (
      !Number.isInteger(segmentsX) ||
      !Number.isInteger(segmentsY) ||
      segmentsX < 1 ||
      segmentsY < 1
    ) {
      throw new Error("segmentsX and segmentsY must be positive integers");
    }

    this.width = width;
    this.height = height;

    this.segmentsX = segmentsX;
    this.segmentsY = segmentsY;

    this.columns = segmentsX + 1;
    this.rows = segmentsY + 1;

    this.particleCount = this.columns * this.rows;

    this.positions = new Float32Array(this.particleCount * 3);
    this.previousPositions = new Float32Array(this.particleCount * 3);

    // 1 = movable particle
    // 0 = pinned / infinite mass
    this.inverseMasses = new Float32Array(this.particleCount);
    this.inverseMasses.fill(1);

    this.initializePositions();
  }

  private initializePositions(): void {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.columns; x++) {
        const particleIndex = this.getParticleIndex(x, y);
        const offset = particleIndex * 3;

        const normalizedX = x / this.segmentsX;
        const normalizedY = y / this.segmentsY;

        const px = (normalizedX - 0.5) * this.width;
        const py = (0.5 - normalizedY) * this.height;
        const pz = 0;

        this.positions[offset] = px;
        this.positions[offset + 1] = py;
        this.positions[offset + 2] = pz;
      }
    }

    this.previousPositions.set(this.positions);
  }

  getParticleIndex(x: number, y: number): number {
    if (x < 0 || x >= this.columns || y < 0 || y >= this.rows) {
      throw new RangeError(`Particle coordinates out of bounds: (${x}, ${y})`);
    }

    return y * this.columns + x;
  }

  getPositionOffset(particleIndex: number): number {
    if (particleIndex < 0 || particleIndex >= this.particleCount) {
      throw new RangeError(`Particle index out of bounds: ${particleIndex}`);
    }

    return particleIndex * 3;
  }
}