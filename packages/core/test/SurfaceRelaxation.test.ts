import { describe, expect, it } from "vitest";

import { ParticleGrid } from "../src/ParticleGrid.js";
import { SurfaceRelaxation } from "../src/SurfaceRelaxation.js";

describe("SurfaceRelaxation", () => {
  it("moves an internal particle toward the average of its neighbors", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    const offset = center * 3;

    // Push center particle out of plane.
    grid.positions[offset + 2] = 1;
    grid.previousPositions[offset + 2] = 1;

    const relaxation = new SurfaceRelaxation(grid, {
      strength: 0.5,
    });

    relaxation.apply(grid, 1 / 60);

    expect(grid.positions[offset + 2]).toBeCloseTo(0.5);
  });

  it("does not modify boundary particles", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const corner = grid.getParticleIndex(0, 0);

    const offset = corner * 3;

    grid.positions[offset + 2] = 1;
    grid.previousPositions[offset + 2] = 1;

    const relaxation = new SurfaceRelaxation(grid, {
      strength: 1,
    });

    relaxation.apply(grid, 1 / 60);

    expect(grid.positions[offset + 2]).toBe(1);
  });

  it("does not modify pinned particles", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    const offset = center * 3;

    grid.positions[offset + 2] = 1;
    grid.previousPositions[offset + 2] = 1;

    grid.inverseMasses[center] = 0;

    const relaxation = new SurfaceRelaxation(grid, {
      strength: 1,
    });

    relaxation.apply(grid, 1 / 60);

    expect(grid.positions[offset + 2]).toBe(1);
  });

  it("moves previous positions by the same correction", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    const offset = center * 3;

    grid.positions[offset + 2] = 1;
    grid.previousPositions[offset + 2] = 1;

    const relaxation = new SurfaceRelaxation(grid, {
      strength: 0.5,
    });

    relaxation.apply(grid, 1 / 60);

    expect(grid.positions[offset + 2]).toBeCloseTo(0.5);

    expect(grid.previousPositions[offset + 2]).toBeCloseTo(0.5);
  });

  it("does nothing when strength is zero", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    const offset = center * 3;

    grid.positions[offset + 2] = 1;
    grid.previousPositions[offset + 2] = 1;

    const before = Array.from(grid.positions);

    const relaxation = new SurfaceRelaxation(grid, {
      strength: 0,
    });

    relaxation.apply(grid, 1 / 60);

    expect(Array.from(grid.positions)).toEqual(before);
  });

  it("rejects invalid relaxation strength", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    expect(
      () =>
        new SurfaceRelaxation(grid, {
          strength: -0.1,
        }),
    ).toThrow();

    expect(
      () =>
        new SurfaceRelaxation(grid, {
          strength: 1.1,
        }),
    ).toThrow();
  });

  it("produces similar relaxation across different timestep sizes", () => {
    const createGrid = () => {
      const grid = new ParticleGrid({
        width: 2,
        height: 2,
        segmentsX: 2,
        segmentsY: 2,
      });

      const center = grid.getParticleIndex(1, 1);

      const offset = center * 3;

      grid.positions[offset + 2] = 1;
      grid.previousPositions[offset + 2] = 1;

      return grid;
    };

    const grid60 = createGrid();
    const grid120 = createGrid();

    const relaxation60 = new SurfaceRelaxation(grid60, {
      strength: 0.25,
    });

    const relaxation120 = new SurfaceRelaxation(grid120, {
      strength: 0.25,
    });

    relaxation60.apply(grid60, 1 / 60);

    relaxation120.apply(grid120, 1 / 120);

    relaxation120.apply(grid120, 1 / 120);

    const center60 = grid60.getParticleIndex(1, 1);

    const center120 = grid120.getParticleIndex(1, 1);

    expect(grid120.positions[center120 * 3 + 2]).toBeCloseTo(
      grid60.positions[center60 * 3 + 2],
      5,
    );
  });
});
