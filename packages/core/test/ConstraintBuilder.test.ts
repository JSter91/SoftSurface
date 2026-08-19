import { describe, expect, it } from "vitest";

import { createGridConstraints } from "../src/ConstraintBuilder.js";
import { ParticleGrid } from "../src/ParticleGrid.js";

describe("createGridConstraints", () => {
  it("creates the expected constraints for a 1x1 segmented grid", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 1,
      segmentsY: 1,
    });

    const constraints = createGridConstraints(grid);

    expect(constraints.structural).toHaveLength(4);
    expect(constraints.shear).toHaveLength(2);
    expect(constraints.bend).toHaveLength(0);
  });

  it("creates the expected constraints for a 2x2 segmented grid", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const constraints = createGridConstraints(grid);

    expect(constraints.structural).toHaveLength(12);
    expect(constraints.shear).toHaveLength(8);
    expect(constraints.bend).toHaveLength(6);
  });

  it("uses the correct structural rest lengths", () => {
    const grid = new ParticleGrid({
      width: 4,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const constraints = createGridConstraints(grid);

    const horizontal = constraints.structural.find(
      (constraint) =>
        constraint.particleA === grid.getParticleIndex(0, 0) &&
        constraint.particleB === grid.getParticleIndex(1, 0),
    );

    const vertical = constraints.structural.find(
      (constraint) =>
        constraint.particleA === grid.getParticleIndex(0, 0) &&
        constraint.particleB === grid.getParticleIndex(0, 1),
    );

    expect(horizontal?.restLength).toBeCloseTo(2);
    expect(vertical?.restLength).toBeCloseTo(1);
  });

  it("applies the requested stiffness values", () => {
    const grid = new ParticleGrid({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const constraints = createGridConstraints(grid, {
      structuralStiffness: 0.9,
      shearStiffness: 0.7,
      bendStiffness: 0.2,
    });

    expect(
      constraints.structural.every(
        (constraint) => constraint.stiffness === 0.9,
      ),
    ).toBe(true);

    expect(
      constraints.shear.every(
        (constraint) => constraint.stiffness === 0.7,
      ),
    ).toBe(true);

    expect(
      constraints.bend.every(
        (constraint) => constraint.stiffness === 0.2,
      ),
    ).toBe(true);
  });
});