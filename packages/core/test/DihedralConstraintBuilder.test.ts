import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildGridDihedralConstraints,
} from "../src/DihedralConstraintBuilder.js";
import { ParticleGrid } from "../src/ParticleGrid.js";

describe(
  "buildGridDihedralConstraints",
  () => {
    it(
      "creates one constraint for a single quad",
      () => {
        const grid =
          new ParticleGrid({
            width: 1,
            height: 1,
            segmentsX: 1,
            segmentsY: 1,
          });

        const constraints =
          buildGridDihedralConstraints(
            grid,
            0.5,
          );

        expect(
          constraints.length,
        ).toBe(1);
      },
    );

    it(
      "creates constraints for every internal triangle edge",
      () => {
        const grid =
          new ParticleGrid({
            width: 2,
            height: 2,
            segmentsX: 2,
            segmentsY: 2,
          });

        const constraints =
          buildGridDihedralConstraints(
            grid,
            0.5,
          );

        /*
         * For an sx × sy rectangular grid
         * triangulated with one diagonal per cell:
         *
         * internal edges =
         *   sx * sy
         * + sx * (sy - 1)
         * + (sx - 1) * sy
         *
         * For 2 × 2:
         *
         * 4 + 2 + 2 = 8
         */

        expect(
          constraints.length,
        ).toBe(8);
      },
    );

    it(
      "uses the flat initial surface as rest state",
      () => {
        const grid =
          new ParticleGrid({
            width: 2,
            height: 2,
            segmentsX: 2,
            segmentsY: 2,
          });

        const constraints =
          buildGridDihedralConstraints(
            grid,
            0.5,
          );

        for (
          const constraint
          of constraints
        ) {
          expect(
            constraint.restAngle,
          ).toBeCloseTo(0);
        }
      },
    );

    it(
      "passes stiffness to every constraint",
      () => {
        const grid =
          new ParticleGrid({
            width: 2,
            height: 2,
            segmentsX: 2,
            segmentsY: 2,
          });

        const constraints =
          buildGridDihedralConstraints(
            grid,
            0.37,
          );

        for (
          const constraint
          of constraints
        ) {
          expect(
            constraint.stiffness,
          ).toBeCloseTo(0.37);
        }
      },
    );

    it(
      "rejects invalid stiffness",
      () => {
        const grid =
          new ParticleGrid({
            width: 1,
            height: 1,
            segmentsX: 1,
            segmentsY: 1,
          });

        expect(() =>
          buildGridDihedralConstraints(
            grid,
            1.1,
          ),
        ).toThrow(RangeError);
      },
    );
  },
);