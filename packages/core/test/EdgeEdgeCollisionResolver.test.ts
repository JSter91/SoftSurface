import { describe, expect, it } from "vitest";

import {
  segmentSegmentDistanceSquared,
  type SegmentSegmentResult,
} from "../src/SegmentSegmentDistance.js";

import { resolveEdgeEdgeCollision } from "../src/EdgeEdgeCollisionResolver.js";

function createResult(): SegmentSegmentResult {
  return {
    distanceSquared: 0,

    closestAX: 0,
    closestAY: 0,
    closestAZ: 0,

    closestBX: 0,
    closestBY: 0,
    closestBZ: 0,

    parameterA: 0,
    parameterB: 0,
  };
}

describe("resolveEdgeEdgeCollision", () => {
  it("separates crossing edges when one edge is pinned", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      0, -1, 0, 0, 1, 0,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 1, 1]);

    const contact = createResult();

    segmentSegmentDistanceSquared(
      -1,
      0,
      0,
      1,
      0,
      0,

      0,
      -1,
      0,
      0,
      1,
      0,

      contact,
    );

    const resolved = resolveEdgeEdgeCollision(
      positions,
      previousPositions,
      inverseMasses,

      0,
      1,

      2,
      3,

      0.1,

      contact,
    );

    expect(resolved).toBe(true);

    expect(positions[2]).toBeCloseTo(0);

    expect(positions[5]).toBeCloseTo(0);

    const b0Factor = 1 - contact.parameterB;

    const b1Factor = contact.parameterB;

    const closestBZ = b0Factor * positions[8] + b1Factor * positions[11];

    expect(Math.abs(closestBZ)).toBeCloseTo(0.1);
  });

  it("distributes correction across two movable edges", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      0, -1, 0.02, 0, 1, 0.02,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([1, 1, 1, 1]);

    const contact = createResult();

    segmentSegmentDistanceSquared(
      -1,
      0,
      0,
      1,
      0,
      0,

      0,
      -1,
      0.02,
      0,
      1,
      0.02,

      contact,
    );

    const resolved = resolveEdgeEdgeCollision(
      positions,
      previousPositions,
      inverseMasses,

      0,
      1,

      2,
      3,

      0.1,

      contact,
    );

    expect(resolved).toBe(true);

    const a0Factor = 1 - contact.parameterA;

    const a1Factor = contact.parameterA;

    const b0Factor = 1 - contact.parameterB;

    const b1Factor = contact.parameterB;

    const closestAZ = a0Factor * positions[2] + a1Factor * positions[5];

    const closestBZ = b0Factor * positions[8] + b1Factor * positions[11];

    expect(Math.abs(closestAZ - closestBZ)).toBeCloseTo(0.1);

    expect(Math.abs(closestAZ)).toBeGreaterThan(0);

    expect(Math.abs(closestBZ - 0.02)).toBeGreaterThan(0);
  });

  it("does nothing outside collision thickness", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      0, -1, 0.2, 0, 1, 0.2,
    ]);

    const previousPositions = new Float32Array(positions);

    const original = new Float32Array(positions);

    const inverseMasses = new Float32Array([1, 1, 1, 1]);

    const contact = createResult();

    segmentSegmentDistanceSquared(
      -1,
      0,
      0,
      1,
      0,
      0,

      0,
      -1,
      0.2,
      0,
      1,
      0.2,

      contact,
    );

    const resolved = resolveEdgeEdgeCollision(
      positions,
      previousPositions,
      inverseMasses,

      0,
      1,

      2,
      3,

      0.1,

      contact,
    );

    expect(resolved).toBe(false);

    expect(Array.from(positions)).toEqual(Array.from(original));
  });

  it("does nothing when all endpoints are pinned", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      0, -1, 0, 0, 1, 0,
    ]);

    const previousPositions = new Float32Array(positions);

    const original = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 0, 0]);

    const contact = createResult();

    segmentSegmentDistanceSquared(
      -1,
      0,
      0,
      1,
      0,
      0,

      0,
      -1,
      0,
      0,
      1,
      0,

      contact,
    );

    const resolved = resolveEdgeEdgeCollision(
      positions,
      previousPositions,
      inverseMasses,

      0,
      1,

      2,
      3,

      0.1,

      contact,
    );

    expect(resolved).toBe(false);

    expect(Array.from(positions)).toEqual(Array.from(original));
  });
});
