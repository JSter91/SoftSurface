import { describe, expect, it } from "vitest";

import { createGridConstraints } from "../src/ConstraintBuilder.js";
import { ConstraintSolver } from "../src/ConstraintSolver.js";
import { ParticleGrid } from "../src/ParticleGrid.js";

describe("ConstraintSolver", () => {
  it("reduces deformation in a grid", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const constraints = createGridConstraints(grid);

    const center = grid.getParticleIndex(1, 1);
    const offset = center * 3;

    grid.positions[offset] += 1;

    const before = grid.positions[offset];

    const solver = new ConstraintSolver({
      iterations: 10,
    });

    solver.solve(grid, constraints);

    const after = grid.positions[offset];

    expect(after).toBeLessThan(before);
  });

  it("preserves pinned particles", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const pinned = grid.getParticleIndex(0, 0);
    const offset = pinned * 3;

    const initialX = grid.positions[offset];
    const initialY = grid.positions[offset + 1];

    grid.inverseMasses[pinned] = 0;

    const constraints = createGridConstraints(grid);

    const center = grid.getParticleIndex(1, 1);
    grid.positions[center * 3] += 2;

    const solver = new ConstraintSolver({
      iterations: 10,
    });

    solver.solve(grid, constraints);

    expect(grid.positions[offset]).toBe(initialX);
    expect(grid.positions[offset + 1]).toBe(initialY);
  });

  it("keeps stiffness reasonably consistent across iteration counts", () => {
    const createDeformedGrid = () => {
      const grid = new ParticleGrid({
        width: 2,
        height: 2,
        segmentsX: 2,
        segmentsY: 2,
      });

      const center = grid.getParticleIndex(1, 1);

      grid.positions[center * 3] += 1;

      return grid;
    };

    const grid1 = createDeformedGrid();
    const grid10 = createDeformedGrid();

    const constraints1 = createGridConstraints(grid1, {
      structuralStiffness: 0.5,
      shearStiffness: 0.5,
      bendStiffness: 0.5,
    });

    const constraints10 = createGridConstraints(grid10, {
      structuralStiffness: 0.5,
      shearStiffness: 0.5,
      bendStiffness: 0.5,
    });

    new ConstraintSolver({
      iterations: 1,
    }).solve(grid1, constraints1);

    new ConstraintSolver({
      iterations: 10,
    }).solve(grid10, constraints10);

    const center = grid1.getParticleIndex(1, 1);

    expect(grid10.positions[center * 3]).toBeCloseTo(
      grid1.positions[center * 3],
      1,
    );
  });
});
