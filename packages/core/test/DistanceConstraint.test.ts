import { describe, expect, it } from "vitest";

import { DistanceConstraint } from "../src/DistanceConstraint.js";

describe("DistanceConstraint", () => {
  it("restores the rest length between two particles", () => {
    const positions = new Float32Array([
      0, 0, 0,
      2, 0, 0,
    ]);

    const inverseMasses = new Float32Array([
      1,
      1,
    ]);

    const constraint = new DistanceConstraint(
      0,
      1,
      1,
    );

    constraint.solve(
      positions,
      inverseMasses,
    );

    expect(positions[0]).toBeCloseTo(0.5);
    expect(positions[3]).toBeCloseTo(1.5);
  });

  it("keeps a pinned particle fixed", () => {
    const positions = new Float32Array([
      0, 0, 0,
      2, 0, 0,
    ]);

    const inverseMasses = new Float32Array([
      0,
      1,
    ]);

    const constraint = new DistanceConstraint(
      0,
      1,
      1,
    );

    constraint.solve(
      positions,
      inverseMasses,
    );

    expect(positions[0]).toBe(0);
    expect(positions[3]).toBeCloseTo(1);
  });

  it("respects stiffness", () => {
    const positions = new Float32Array([
      0, 0, 0,
      2, 0, 0,
    ]);

    const inverseMasses = new Float32Array([
      1,
      1,
    ]);

    const constraint = new DistanceConstraint(
      0,
      1,
      1,
      0.5,
    );

    constraint.solve(
      positions,
      inverseMasses,
    );

    expect(positions[0]).toBeCloseTo(0.25);
    expect(positions[3]).toBeCloseTo(1.75);
  });

  it("does nothing when both particles are pinned", () => {
    const positions = new Float32Array([
      0, 0, 0,
      2, 0, 0,
    ]);

    const inverseMasses = new Float32Array([
      0,
      0,
    ]);

    const constraint = new DistanceConstraint(
      0,
      1,
      1,
    );

    constraint.solve(
      positions,
      inverseMasses,
    );

    expect(Array.from(positions)).toEqual([
      0, 0, 0,
      2, 0, 0,
    ]);
  });
});