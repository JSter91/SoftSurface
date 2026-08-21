import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SelfCollisionDetector,
} from "../src/SelfCollisionDetector.js";

describe(
  "SelfCollisionDetector",
  () => {
    it(
      "detects a particle near an unrelated triangle",
      () => {
        const positions =
          new Float32Array([
            // Triangle
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,

            // Independent particle
            0.25, 0.25, 0.02,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const detector =
          new SelfCollisionDetector(
            triangles,
            {
              thickness: 0.05,
              cellSize: 0.25,
            },
          );

        const stats =
          detector.detect(
            positions,
          );

        expect(
          stats.contacts,
        ).toBe(1);
      },
    );

    it(
      "does not detect distant particles",
      () => {
        const positions =
          new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,

            0.25, 0.25, 1,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const detector =
          new SelfCollisionDetector(
            triangles,
            {
              thickness: 0.05,
              cellSize: 0.25,
            },
          );

        const stats =
          detector.detect(
            positions,
          );

        expect(
          stats.contacts,
        ).toBe(0);
      },
    );

    it(
      "ignores triangle vertices colliding with their own triangle",
      () => {
        const positions =
          new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const detector =
          new SelfCollisionDetector(
            triangles,
            {
              thickness: 0.05,
              cellSize: 0.25,
            },
          );

        const stats =
          detector.detect(
            positions,
          );

        expect(
          stats.contacts,
        ).toBe(0);

        expect(
          stats.testedPairs,
        ).toBe(0);
      },
    );

    it(
      "reports candidate and tested pair counts",
      () => {
        const positions =
          new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,

            0.25, 0.25, 0.02,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const detector =
          new SelfCollisionDetector(
            triangles,
            {
              thickness: 0.05,
              cellSize: 0.25,
            },
          );

        const stats =
          detector.detect(
            positions,
          );

        expect(
          stats.candidatePairs,
        ).toBeGreaterThan(0);

        expect(
          stats.testedPairs,
        ).toBeGreaterThan(0);
      },
    );

    it(
      "rejects invalid thickness",
      () => {
        expect(
          () =>
            new SelfCollisionDetector(
              new Uint16Array(),
              {
                thickness: 0,
                cellSize: 0.25,
              },
            ),
        ).toThrow(
          RangeError,
        );
      },
    );
  },
);