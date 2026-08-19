import {
  createGridConstraints,
  type GridConstraintOptions,
  type GridConstraints,
} from "./ConstraintBuilder.js";

import {
  ConstraintSolver,
  type ConstraintSolverOptions,
} from "./ConstraintSolver.js";

import {
  ParticleGrid,
} from "./ParticleGrid.js";

import type {
  ParticleGridOptions,
} from "./types.js";

import {
  VerletIntegrator,
  type VerletIntegratorOptions,
} from "./VerletIntegrator.js";

export interface SoftSurfaceOptions
  extends ParticleGridOptions,
    GridConstraintOptions {
  damping?: VerletIntegratorOptions["damping"];
  acceleration?: VerletIntegratorOptions["acceleration"];
  iterations?: ConstraintSolverOptions["iterations"];
}

export class SoftSurface {
  readonly grid: ParticleGrid;
  readonly constraints: GridConstraints;

  private readonly integrator: VerletIntegrator;
  private readonly solver: ConstraintSolver;

  constructor(options: SoftSurfaceOptions) {
    this.grid = new ParticleGrid({
      width: options.width,
      height: options.height,
      segmentsX: options.segmentsX,
      segmentsY: options.segmentsY,
    });

    this.constraints = createGridConstraints(this.grid, {
      structuralStiffness: options.structuralStiffness,
      shearStiffness: options.shearStiffness,
      bendStiffness: options.bendStiffness,
    });

    this.integrator = new VerletIntegrator({
      damping: options.damping,
      acceleration: options.acceleration,
    });

    this.solver = new ConstraintSolver({
      iterations: options.iterations,
    });
  }

  get positions(): Float32Array {
    return this.grid.positions;
  }

  get previousPositions(): Float32Array {
    return this.grid.previousPositions;
  }

  get inverseMasses(): Float32Array {
    return this.grid.inverseMasses;
  }

  get particleCount(): number {
    return this.grid.particleCount;
  }

  step(deltaTime: number): void {
    this.integrator.step(this.grid, deltaTime);
    this.solver.solve(this.grid, this.constraints);
  }

  pin(particleIndex: number): void {
    this.assertParticleIndex(particleIndex);

    this.grid.inverseMasses[particleIndex] = 0;
  }

  unpin(particleIndex: number): void {
    this.assertParticleIndex(particleIndex);

    this.grid.inverseMasses[particleIndex] = 1;
  }

  private assertParticleIndex(particleIndex: number): void {
    if (
      !Number.isInteger(particleIndex) ||
      particleIndex < 0 ||
      particleIndex >= this.grid.particleCount
    ) {
      throw new RangeError(
        `Particle index out of bounds: ${particleIndex}`,
      );
    }
  }
}