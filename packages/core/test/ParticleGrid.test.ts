import { describe, expect, it } from "vitest";

import { ParticleGrid } from "../src/ParticleGrid.js";

describe("ParticleGrid", () => {
  it("creates the expected number of particles", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    expect(grid.columns).toBe(3);
    expect(grid.rows).toBe(3);
    expect(grid.particleCount).toBe(9);

    expect(grid.positions.length).toBe(27);
    expect(grid.previousPositions.length).toBe(27);
  });

  it("creates a centered grid", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 1,
      segmentsY: 1,
    });

    expect(Array.from(grid.positions)).toEqual([
      -1, 1, 0,
       1, 1, 0,
      -1, -1, 0,
       1, -1, 0,
    ]);
  });

  it("starts with current and previous positions equal", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 4,
      segmentsY: 4,
    });

    expect(grid.previousPositions).toEqual(grid.positions);
  });

  it("initializes every particle as movable", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    expect(Array.from(grid.inverseMasses)).toEqual(
      new Array(grid.particleCount).fill(1),
    );
  });
});