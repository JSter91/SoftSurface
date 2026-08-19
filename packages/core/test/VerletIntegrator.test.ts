import { describe, expect, it } from "vitest";

import { ParticleGrid } from "../src/ParticleGrid.js";
import { VerletIntegrator } from "../src/VerletIntegrator.js";

describe("VerletIntegrator", () => {
  it("preserves inertial movement", () => {
    const grid = new ParticleGrid({
      width: 1,
      height: 1,
      segmentsX: 1,
      segmentsY: 1,
    });

    const offset = 0;

    grid.positions[offset] = 1;
    grid.previousPositions[offset] = 0;

    const integrator = new VerletIntegrator({
      damping: 0,
    });

    integrator.step(grid, 1);

    expect(grid.positions[offset]).toBe(2);
  });

  it("applies damping to movement", () => {
    const grid = new ParticleGrid({
      width: 1,
      height: 1,
      segmentsX: 1,
      segmentsY: 1,
    });

    const offset = 0;

    grid.positions[offset] = 1;
    grid.previousPositions[offset] = 0;

    const integrator = new VerletIntegrator({
      damping: 0.5,
    });

    integrator.step(grid, 1);

    expect(grid.positions[offset]).toBe(1.5);
  });

  it("applies constant acceleration", () => {
    const grid = new ParticleGrid({
      width: 1,
      height: 1,
      segmentsX: 1,
      segmentsY: 1,
    });

    const integrator = new VerletIntegrator({
      damping: 0,
      acceleration: [0, -10, 0],
    });

    const initialY = grid.positions[1];

    integrator.step(grid, 0.5);

    expect(grid.positions[1]).toBeCloseTo(
      initialY - 2.5,
    );
  });

  it("does not move pinned particles", () => {
    const grid = new ParticleGrid({
      width: 1,
      height: 1,
      segmentsX: 1,
      segmentsY: 1,
    });

    grid.inverseMasses[0] = 0;

    const initialX = grid.positions[0];
    const initialY = grid.positions[1];
    const initialZ = grid.positions[2];

    const integrator = new VerletIntegrator({
      acceleration: [10, -10, 5],
    });

    integrator.step(grid, 1);

    expect(grid.positions[0]).toBe(initialX);
    expect(grid.positions[1]).toBe(initialY);
    expect(grid.positions[2]).toBe(initialZ);
  });
});