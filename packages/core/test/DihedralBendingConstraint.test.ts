import {
  describe,
  expect,
  it,
} from "vitest";

import {
  computeDihedralAngle,
  DihedralBendingConstraint,
} from "../src/DihedralBendingConstraint.js";

function createFlatPair(): Float32Array {
  return new Float32Array([
    // opposite A
     0,  1, 0,

    // opposite B
     0, -1, 0,

    // shared edge A
    -1,  0, 0,

    // shared edge B
     1,  0, 0,
  ]);
}

describe(
  "DihedralBendingConstraint",
  () => {
    it(
      "reports zero angle for a flat triangle pair",
      () => {
        const positions =
          createFlatPair();

        const angle =
          computeDihedralAngle(
            positions,
            0,
            1,
            2,
            3,
          );

        expect(angle)
          .toBeCloseTo(0);
      },
    );

    it(
      "does not modify a surface already at its rest angle",
      () => {
        const positions =
          createFlatPair();

        const before =
          Array.from(positions);

        const inverseMasses =
          new Float32Array([
            1,
            1,
            1,
            1,
          ]);

        const constraint =
          new DihedralBendingConstraint(
            0,
            1,
            2,
            3,
            0,
            1,
          );

        constraint.solve(
          positions,
          inverseMasses,
        );

        expect(
          Array.from(positions),
        ).toEqual(before);
      },
    );

    it(
      "reduces bending toward the rest angle",
      () => {
        const positions =
          createFlatPair();

        /*
         * Bend one opposite vertex out
         * of the original plane.
         */
        positions[2] = 1;

        const inverseMasses =
          new Float32Array([
            1,
            1,
            1,
            1,
          ]);

        const before =
          computeDihedralAngle(
            positions,
            0,
            1,
            2,
            3,
          );

        const constraint =
          new DihedralBendingConstraint(
            0,
            1,
            2,
            3,
            0,
            1,
          );

        constraint.solve(
          positions,
          inverseMasses,
        );

        const after =
          computeDihedralAngle(
            positions,
            0,
            1,
            2,
            3,
          );

        expect(before)
          .toBeGreaterThan(0);

        expect(after)
          .toBeLessThan(before);
      },
    );

    it(
      "does not move fully pinned particles",
      () => {
        const positions =
          createFlatPair();

        positions[2] = 1;

        const before =
          Array.from(positions);

        const inverseMasses =
          new Float32Array([
            0,
            0,
            0,
            0,
          ]);

        const constraint =
          new DihedralBendingConstraint(
            0,
            1,
            2,
            3,
            0,
            1,
          );

        constraint.solve(
          positions,
          inverseMasses,
        );

        expect(
          Array.from(positions),
        ).toEqual(before);
      },
    );

    it(
      "respects zero stiffness",
      () => {
        const positions =
          createFlatPair();

        positions[2] = 1;

        const before =
          Array.from(positions);

        const inverseMasses =
          new Float32Array([
            1,
            1,
            1,
            1,
          ]);

        const constraint =
          new DihedralBendingConstraint(
            0,
            1,
            2,
            3,
            0,
            0,
          );

        constraint.solve(
          positions,
          inverseMasses,
        );

        expect(
          Array.from(positions),
        ).toEqual(before);
      },
    );
  },
);