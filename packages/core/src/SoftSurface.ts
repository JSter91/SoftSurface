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

import {
  SurfaceRelaxation,
  type SurfaceRelaxationOptions,
} from "./SurfaceRelaxation.js";

import { createGridTriangleIndices } from "./GridTopology.js";

import {
  SelfCollisionDetector,
  type SelfCollisionStats,
} from "./SelfCollisionDetector.js";

export interface SoftSurfaceOptions
  extends ParticleGridOptions, GridConstraintOptions {
  preset?: SoftSurfacePreset;
  damping?: VerletIntegratorOptions["damping"];
  acceleration?: VerletIntegratorOptions["acceleration"];
  relaxation?: SurfaceRelaxationOptions["strength"];
  iterations?: ConstraintSolverOptions["iterations"];
  fixedTimeStep?: number;
  maxSubsteps?: number;
  selfCollision?: SoftSurfaceSelfCollisionOptions;
}
export interface SoftSurfaceSelfCollisionOptions {
  enabled?: boolean;
  thickness?: number;
  cellSize?: number;
}

export class SoftSurface {
  readonly grid: ParticleGrid;
  readonly constraints: GridConstraints;

  private readonly integrator: VerletIntegrator;
  private readonly solver: ConstraintSolver;

  private readonly relaxation: SurfaceRelaxation;

  private readonly fixedTimeStep: number;
  private readonly maxSubsteps: number;

  private accumulator = 0;

  private readonly grabInteraction: GrabInteraction;

  private readonly selfCollisionDetector: SelfCollisionDetector | null;

  private lastSelfCollisionStats: Readonly<SelfCollisionStats> | null = null;

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

    const spacingX = this.grid.width / this.grid.segmentsX;

    const spacingY = this.grid.height / this.grid.segmentsY;

    const minimumSpacing = Math.min(spacingX, spacingY);

    const selfCollision = options.selfCollision;

    if (selfCollision?.enabled) {
      const thickness = selfCollision.thickness ?? minimumSpacing * 0.35;

      const cellSize = selfCollision.cellSize ?? minimumSpacing * 2;

      const triangles = createGridTriangleIndices(this.grid);

      this.selfCollisionDetector = new SelfCollisionDetector(triangles, {
        thickness,
        cellSize,
      });
    } else {
      this.selfCollisionDetector = null;
    }

    this.grabInteraction = new GrabInteraction(this.grid);

    this.constraints = createGridConstraints(this.grid, {
      structuralStiffness,
      shearStiffness,
      bendStiffness,
      bendModel: options.bendModel,
    });

    this.integrator = new VerletIntegrator({
      damping,
      acceleration: options.acceleration,
    });
    
    this.solver = new ConstraintSolver({
      iterations: options.iterations,
    });

    this.relaxation = new SurfaceRelaxation(this.grid, {
      strength: options.relaxation,
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

  get selfCollisionStats(): Readonly<SelfCollisionStats> | null {
    return this.lastSelfCollisionStats;
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

    this.relaxation.apply(this.grid, deltaTime);
    this.grabInteraction.apply();
    if (this.selfCollisionDetector) {
      this.lastSelfCollisionStats = this.selfCollisionDetector.detect(
        this.grid.positions,
      );
    }
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
