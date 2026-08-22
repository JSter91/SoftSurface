import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SelfCollisionSolver,
} from "../src/SelfCollisionSolver.js";

describe(
  "SelfCollisionSolver",
  () => {
    it(
      "detects and resolves a vertex penetrating a pinned triangle",
      () => {
        const positions =
          new Float32Array([
            // Triangle A
            0, 0, 0,

            // Triangle B
            1, 0, 0,

            // Triangle C
            0, 1, 0,

            // Particle P
            0.25, 0.25, 0.01,
          ]);

        const previousPositions =
          new Float32Array(
            positions,
          );

        const inverseMasses =
          new Float32Array([
            0,
            0,
            0,
            1,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const solver =
          new SelfCollisionSolver(
            triangles,
            {
              thickness: 0.05,
              cellSize: 1,
            },
          );

        const stats =
          solver.solve(
            positions,
            previousPositions,
            inverseMasses,
          );

        expect(
          stats.contacts,
        ).toBe(1);

        expect(
          stats.resolvedContacts,
        ).toBe(1);

        expect(
          stats.staleContacts,
        ).toBe(0);

        /**
         * The triangle is pinned, so only P should move.
         */
        expect(
          positions[2],
        ).toBeCloseTo(0);

        expect(
          positions[5],
        ).toBeCloseTo(0);

        expect(
          positions[8],
        ).toBeCloseTo(0);

        /**
         * P should be projected exactly to the collision
         * thickness.
         */
        expect(
          positions[11],
        ).toBeCloseTo(0.05);
      },
    );

    it(
      "does not modify a vertex outside collision thickness",
      () => {
        const positions =
          new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,

            0.25, 0.25, 0.1,
          ]);

        const originalPositions =
          new Float32Array(
            positions,
          );

        const previousPositions =
          new Float32Array(
            positions,
          );

        const inverseMasses =
          new Float32Array([
            0,
            0,
            0,
            1,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const solver =
          new SelfCollisionSolver(
            triangles,
            {
              thickness: 0.05,
              cellSize: 1,
            },
          );

        const stats =
          solver.solve(
            positions,
            previousPositions,
            inverseMasses,
          );

        expect(
          stats.contacts,
        ).toBe(0);

        expect(
          stats.resolvedContacts,
        ).toBe(0);

        expect(
          stats.staleContacts,
        ).toBe(0);

        expect(
          Array.from(positions),
        ).toEqual(
          Array.from(
            originalPositions,
          ),
        );
      },
    );

    it(
      "distributes collision response across a movable particle and triangle",
      () => {
        const positions =
          new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,

            0.25, 0.25, 0.01,
          ]);

        const previousPositions =
          new Float32Array(
            positions,
          );

        const inverseMasses =
          new Float32Array([
            1,
            1,
            1,
            1,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const solver =
          new SelfCollisionSolver(
            triangles,
            {
              thickness: 0.05,
              cellSize: 1,
            },
          );

        const stats =
          solver.solve(
            positions,
            previousPositions,
            inverseMasses,
          );

        expect(
          stats.contacts,
        ).toBe(1);

        expect(
          stats.resolvedContacts,
        ).toBe(1);

        /**
         * P moves away from the triangle.
         */
        expect(
          positions[11],
        ).toBeGreaterThan(
          0.01,
        );

        /**
         * Triangle vertices move in the opposite direction.
         */
        expect(
          positions[2],
        ).toBeLessThan(0);

        expect(
          positions[5],
        ).toBeLessThan(0);

        expect(
          positions[8],
        ).toBeLessThan(0);

        /**
         * Reconstruct the current point on the triangle
         * using the known barycentric coordinates for
         * this deterministic contact.
         */
        const closestZ =
          0.5 *
            positions[2] +
          0.25 *
            positions[5] +
          0.25 *
            positions[8];

        const separation =
          positions[11] -
          closestZ;

        expect(
          separation,
        ).toBeCloseTo(
          0.05,
        );
      },
    );

    it(
      "detects contact but applies no correction when every particle is pinned",
      () => {
        const positions =
          new Float32Array([
            0, 0, 0,
            1, 0, 0,
            0, 1, 0,

            0.25, 0.25, 0.01,
          ]);

        const originalPositions =
          new Float32Array(
            positions,
          );

        const previousPositions =
          new Float32Array(
            positions,
          );

        const inverseMasses =
          new Float32Array([
            0,
            0,
            0,
            0,
          ]);

        const triangles =
          new Uint16Array([
            0, 1, 2,
          ]);

        const solver =
          new SelfCollisionSolver(
            triangles,
            {
              thickness: 0.05,
              cellSize: 1,
            },
          );

        const stats =
          solver.solve(
            positions,
            previousPositions,
            inverseMasses,
          );

        expect(
          stats.contacts,
        ).toBe(1);

        expect(
          stats.resolvedContacts,
        ).toBe(0);

        expect(
          Array.from(positions),
        ).toEqual(
          Array.from(
            originalPositions,
          ),
        );
      },
    );
  },
);