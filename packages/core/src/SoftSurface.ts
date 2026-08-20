import {
  createGridConstraints,
  type GridConstraintOptions,
  type GridConstraints,
} from "./ConstraintBuilder.js";

import {
  ConstraintSolver,
  type ConstraintSolverOptions,
} from "./ConstraintSolver.js";

import { ParticleGrid } from "./ParticleGrid.js";

import type { ParticleGridOptions } from "./types.js";

import {
  VerletIntegrator,
  type VerletIntegratorOptions,
} from "./VerletIntegrator.js";

import { MATERIAL_PRESETS, type SoftSurfacePreset } from "./MaterialPresets.js";

import {
  GrabInteraction,
  type GrabOptions,
  type GrabPoint,
} from "./GrabInteraction.js";
export interface SoftSurfaceOptions
  extends ParticleGridOptions, GridConstraintOptions {
  preset?: SoftSurfacePreset;
  damping?: VerletIntegratorOptions["damping"];
  acceleration?: VerletIntegratorOptions["acceleration"];
  iterations?: ConstraintSolverOptions["iterations"];
  fixedTimeStep?: number;
  maxSubsteps?: number;
}

export class SoftSurface {
  readonly grid: ParticleGrid;
  readonly constraints: GridConstraints;

  private readonly integrator: VerletIntegrator;
  private readonly solver: ConstraintSolver;

  private readonly fixedTimeStep: number;
  private readonly maxSubsteps: number;

  private accumulator = 0;

  private readonly grabInteraction: GrabInteraction;

  constructor(options: SoftSurfaceOptions) {
    const preset = MATERIAL_PRESETS[options.preset ?? "cloth"];

    const structuralStiffness =
      options.structuralStiffness ?? preset.structuralStiffness;

    const shearStiffness = options.shearStiffness ?? preset.shearStiffness;

    const bendStiffness = options.bendStiffness ?? preset.bendStiffness;

    const damping = options.damping ?? preset.damping;

    this.grid = new ParticleGrid({
      width: options.width,
      height: options.height,
      segmentsX: options.segmentsX,
      segmentsY: options.segmentsY,
    });

    this.grabInteraction = new GrabInteraction(this.grid);

    this.constraints = createGridConstraints(this.grid, {
      structuralStiffness: structuralStiffness,
      shearStiffness: shearStiffness,
      bendStiffness: bendStiffness,
    });

    this.integrator = new VerletIntegrator({
      damping: damping,
      acceleration: options.acceleration,
    });

    this.solver = new ConstraintSolver({
      iterations: options.iterations,
    });

    const fixedTimeStep = options.fixedTimeStep ?? 1 / 120;
    const maxSubsteps = options.maxSubsteps ?? 4;

    if (fixedTimeStep <= 0) {
      throw new RangeError("fixedTimeStep must be greater than 0");
    }

    if (!Number.isInteger(maxSubsteps) || maxSubsteps < 1) {
      throw new RangeError("maxSubsteps must be a positive integer");
    }

    this.fixedTimeStep = fixedTimeStep;
    this.maxSubsteps = maxSubsteps;
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

  get isGrabbed(): boolean {
    return this.grabInteraction.isActive;
  }

  grab(point: GrabPoint, options?: GrabOptions): number {
    return this.grabInteraction.grab(point, options);
  }

  moveGrab(point: GrabPoint): void {
    this.grabInteraction.move(point);
  }

  release(): void {
    this.grabInteraction.release();
  }

  step(deltaTime: number): void {
    if (deltaTime <= 0) {
      return;
    }

    const maxFrameTime = this.fixedTimeStep * this.maxSubsteps;

    this.accumulator += Math.min(deltaTime, maxFrameTime);

    let substeps = 0;

    while (
      this.accumulator >= this.fixedTimeStep &&
      substeps < this.maxSubsteps
    ) {
      this.substep(this.fixedTimeStep);

      this.accumulator -= this.fixedTimeStep;
      substeps++;
    }
  }

  private substep(deltaTime: number): void {
    this.integrator.step(this.grid, deltaTime);

    this.solver.solve(this.grid, this.constraints);

    this.grabInteraction.apply();
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
      throw new RangeError(`Particle index out of bounds: ${particleIndex}`);
    }
  }
}
