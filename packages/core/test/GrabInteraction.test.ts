import { describe, expect, it } from "vitest";

import { GrabInteraction } from "../src/GrabInteraction.js";
import { ParticleGrid } from "../src/ParticleGrid.js";

describe("GrabInteraction", () => {
  it("selects particles inside the grab radius", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const grab = new GrabInteraction(grid);

    const count = grab.grab([0, 0, 0], {
      radius: 0.6,
    });

    expect(count).toBe(1);
    expect(grab.isActive).toBe(true);
  });

  it("moves grabbed particles toward the target", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    const offset = center * 3;

    const grab = new GrabInteraction(grid);

    grab.grab([0, 0, 0], {
      radius: 0.6,
    });

    grab.move([1, 0, 0]);
    grab.apply();

    expect(grid.positions[offset]).toBeCloseTo(1);
  });

  it("uses weighted falloff", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const grab = new GrabInteraction(grid);

    grab.grab([0, 0, 0], {
      radius: 1.5,
    });

    const center = grid.getParticleIndex(1, 1);

    const neighbor = grid.getParticleIndex(2, 1);

    const centerOffset = center * 3;

    const neighborOffset = neighbor * 3;

    const initialNeighborX = grid.positions[neighborOffset];

    grab.move([1, 0, 0]);
    grab.apply();

    const centerMovement = grid.positions[centerOffset];

    const neighborMovement = grid.positions[neighborOffset] - initialNeighborX;

    expect(centerMovement).toBeCloseTo(1);

    expect(neighborMovement).toBeGreaterThan(0);

    expect(neighborMovement).toBeLessThan(centerMovement);
  });

  it("does not move pinned particles", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    grid.inverseMasses[center] = 0;

    const offset = center * 3;

    const initialX = grid.positions[offset];

    const grab = new GrabInteraction(grid);

    grab.grab([0, 0, 0], {
      radius: 0.6,
    });

    grab.move([1, 0, 0]);
    grab.apply();

    expect(grid.positions[offset]).toBe(initialX);
  });

  it("stops affecting particles after release", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const center = grid.getParticleIndex(1, 1);

    const offset = center * 3;

    const grab = new GrabInteraction(grid);

    grab.grab([0, 0, 0], {
      radius: 0.6,
    });

    grab.release();

    grab.move([1, 0, 0]);
    grab.apply();

    expect(grid.positions[offset]).toBe(0);

    expect(grab.isActive).toBe(false);
  });
});
