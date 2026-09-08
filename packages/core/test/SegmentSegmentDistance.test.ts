import { describe, expect, it } from "vitest";

import {
  segmentSegmentDistanceSquared,
  type SegmentSegmentResult,
} from "../src/SegmentSegmentDistance.js";

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

describe("segmentSegmentDistanceSquared", () => {
  it("returns zero distance for crossing segments", () => {
    const result = createResult();

    segmentSegmentDistanceSquared(
      // Segment A
      -1,
      0,
      0,
      1,
      0,
      0,

      // Segment B
      0,
      -1,
      0,
      0,
      1,
      0,

      result,
    );

    expect(result.distanceSquared).toBeCloseTo(0);

    expect(result.closestAX).toBeCloseTo(0);

    expect(result.closestAY).toBeCloseTo(0);

    expect(result.closestAZ).toBeCloseTo(0);

    expect(result.closestBX).toBeCloseTo(0);

    expect(result.closestBY).toBeCloseTo(0);

    expect(result.closestBZ).toBeCloseTo(0);

    expect(result.parameterA).toBeCloseTo(0.5);

    expect(result.parameterB).toBeCloseTo(0.5);
  });

  it("returns the correct distance for parallel segments", () => {
    const result = createResult();

    segmentSegmentDistanceSquared(
      // Segment A
      0,
      0,
      0,
      1,
      0,
      0,

      // Segment B
      0,
      2,
      0,
      1,
      2,
      0,

      result,
    );

    expect(result.distanceSquared).toBeCloseTo(4);

    expect(Math.abs(result.closestAY - result.closestBY)).toBeCloseTo(2);
  });

  it("clamps the closest point to a segment endpoint", () => {
    const result = createResult();

    segmentSegmentDistanceSquared(
      // Segment A
      0,
      0,
      0,
      1,
      0,
      0,

      // Segment B
      2,
      -1,
      0,
      2,
      1,
      0,

      result,
    );

    expect(result.distanceSquared).toBeCloseTo(1);

    expect(result.closestAX).toBeCloseTo(1);

    expect(result.closestAY).toBeCloseTo(0);

    expect(result.closestBX).toBeCloseTo(2);

    expect(result.closestBY).toBeCloseTo(0);

    expect(result.parameterA).toBeCloseTo(1);

    expect(result.parameterB).toBeCloseTo(0.5);
  });

  it("handles a degenerate segment deterministically", () => {
    const result = createResult();

    segmentSegmentDistanceSquared(
      // Segment A is a point
      0,
      0,
      0,
      0,
      0,
      0,

      // Segment B
      1,
      -1,
      0,
      1,
      1,
      0,

      result,
    );

    expect(result.distanceSquared).toBeCloseTo(1);

    expect(result.closestAX).toBeCloseTo(0);

    expect(result.closestAY).toBeCloseTo(0);

    expect(result.closestBX).toBeCloseTo(1);

    expect(result.closestBY).toBeCloseTo(0);

    expect(result.parameterA).toBeCloseTo(0);

    expect(result.parameterB).toBeCloseTo(0.5);
  });

  it("returns the correct distance for skew segments in 3D", () => {
    const result = createResult();

    segmentSegmentDistanceSquared(
      // Segment A
      -1,
      0,
      0,
      1,
      0,
      0,

      // Segment B
      0,
      -1,
      1,
      0,
      1,
      1,

      result,
    );

    expect(result.distanceSquared).toBeCloseTo(1);

    expect(result.closestAX).toBeCloseTo(0);

    expect(result.closestAY).toBeCloseTo(0);

    expect(result.closestAZ).toBeCloseTo(0);

    expect(result.closestBX).toBeCloseTo(0);

    expect(result.closestBY).toBeCloseTo(0);

    expect(result.closestBZ).toBeCloseTo(1);

    expect(result.parameterA).toBeCloseTo(0.5);

    expect(result.parameterB).toBeCloseTo(0.5);
  });
});
