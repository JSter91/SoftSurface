import {
  bench,
  describe,
} from "vitest";

import {
  resolveVertexTriangleCollision,
} from "../src/VertexTriangleCollisionResolver.js";

import type {
  PointTriangleResult,
} from "../src/PointTriangleDistance.js";

const THICKNESS = 0.05;

const BENCH_OPTIONS = {
  time: 0,
  iterations: 10_000,
  warmupTime: 0,
  warmupIterations: 1_000,
};

const contact: PointTriangleResult = {
  distanceSquared:
    0.01 * 0.01,

  closestX: 0.25,
  closestY: 0.25,
  closestZ: 0,

  barycentricA: 0.5,
  barycentricB: 0.25,
  barycentricC: 0.25,
};

/**
 * Pinned triangle
 */
const pinnedPositions =
  new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,

    0.25, 0.25, 0.01,
  ]);

const pinnedPreviousPositions =
  new Float32Array(
    pinnedPositions,
  );

const pinnedInverseMasses =
  new Float32Array([
    0,
    0,
    0,
    1,
  ]);

/**
 * Fully dynamic triangle
 */
const dynamicPositions =
  new Float32Array([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,

    0.25, 0.25, 0.01,
  ]);

const dynamicPreviousPositions =
  new Float32Array(
    dynamicPositions,
  );

const dynamicInverseMasses =
  new Float32Array([
    1,
    1,
    1,
    1,
  ]);

describe(
  "VertexTriangleCollisionResolver",
  () => {
    bench(
      "pinned triangle",
      () => {
        /**
         * Restore the deterministic input.
         *
         * Only P moves in this scenario.
         */
        pinnedPositions[11] =
          0.01;

        pinnedPreviousPositions[11] =
          0.01;

        resolveVertexTriangleCollision(
          pinnedPositions,
          pinnedPreviousPositions,
          pinnedInverseMasses,

          3,

          0,
          1,
          2,

          THICKNESS,

          contact,
        );
      },
      BENCH_OPTIONS,
    );

    bench(
      "fully dynamic triangle",
      () => {
        /**
         * Restore only the coordinates modified
         * by this deterministic Z-axis contact.
         */
        dynamicPositions[2] = 0;
        dynamicPositions[5] = 0;
        dynamicPositions[8] = 0;
        dynamicPositions[11] = 0.01;

        dynamicPreviousPositions[2] = 0;
        dynamicPreviousPositions[5] = 0;
        dynamicPreviousPositions[8] = 0;
        dynamicPreviousPositions[11] =
          0.01;

        resolveVertexTriangleCollision(
          dynamicPositions,
          dynamicPreviousPositions,
          dynamicInverseMasses,

          3,

          0,
          1,
          2,

          THICKNESS,

          contact,
        );
      },
      BENCH_OPTIONS,
    );
  },
);