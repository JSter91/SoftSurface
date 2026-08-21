import {
  describe,
  expect,
  it,
} from "vitest";

import {
  pointTriangleDistanceSquared,
  type PointTriangleResult,
} from "../src/PointTriangleDistance.js";

function createResult():
  PointTriangleResult {
  return {
    distanceSquared: 0,

    closestX: 0,
    closestY: 0,
    closestZ: 0,

    barycentricA: 0,
    barycentricB: 0,
    barycentricC: 0,
  };
}

describe(
  "pointTriangleDistanceSquared",
  () => {
    it(
      "finds a closest point inside the triangle face",
      () => {
        const result =
          createResult();

        pointTriangleDistanceSquared(
          0.25,
          0.25,
          1,

          0,
          0,
          0,

          1,
          0,
          0,

          0,
          1,
          0,

          result,
        );

        expect(
          result.closestX,
        ).toBeCloseTo(
          0.25,
        );

        expect(
          result.closestY,
        ).toBeCloseTo(
          0.25,
        );

        expect(
          result.closestZ,
        ).toBeCloseTo(0);

        expect(
          result.distanceSquared,
        ).toBeCloseTo(1);

        expect(
          result.barycentricA +
            result.barycentricB +
            result.barycentricC,
        ).toBeCloseTo(1);
      },
    );

    it(
      "finds vertex A as the closest point",
      () => {
        const result =
          createResult();

        pointTriangleDistanceSquared(
          -1,
          -1,
          0,

          0,
          0,
          0,

          1,
          0,
          0,

          0,
          1,
          0,

          result,
        );

        expect(
          result.closestX,
        ).toBeCloseTo(0);

        expect(
          result.closestY,
        ).toBeCloseTo(0);

        expect(
          result.barycentricA,
        ).toBeCloseTo(1);

        expect(
          result.barycentricB,
        ).toBeCloseTo(0);

        expect(
          result.barycentricC,
        ).toBeCloseTo(0);
      },
    );

    it(
      "finds a closest point on edge AB",
      () => {
        const result =
          createResult();

        pointTriangleDistanceSquared(
          0.5,
          -1,
          0,

          0,
          0,
          0,

          1,
          0,
          0,

          0,
          1,
          0,

          result,
        );

        expect(
          result.closestX,
        ).toBeCloseTo(0.5);

        expect(
          result.closestY,
        ).toBeCloseTo(0);

        expect(
          result.barycentricC,
        ).toBeCloseTo(0);

        expect(
          result.barycentricA,
        ).toBeCloseTo(0.5);

        expect(
          result.barycentricB,
        ).toBeCloseTo(0.5);
      },
    );

    it(
      "returns zero distance for a point on the triangle",
      () => {
        const result =
          createResult();

        pointTriangleDistanceSquared(
          0.25,
          0.25,
          0,

          0,
          0,
          0,

          1,
          0,
          0,

          0,
          1,
          0,

          result,
        );

        expect(
          result.distanceSquared,
        ).toBeCloseTo(0);
      },
    );

    it(
      "produces valid barycentric coordinates",
      () => {
        const result =
          createResult();

        pointTriangleDistanceSquared(
          0.2,
          0.3,
          0.5,

          0,
          0,
          0,

          1,
          0,
          0,

          0,
          1,
          0,

          result,
        );

        expect(
          result.barycentricA,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          result.barycentricB,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          result.barycentricC,
        ).toBeGreaterThanOrEqual(
          0,
        );

        expect(
          result.barycentricA +
            result.barycentricB +
            result.barycentricC,
        ).toBeCloseTo(1);
      },
    );
  },
);