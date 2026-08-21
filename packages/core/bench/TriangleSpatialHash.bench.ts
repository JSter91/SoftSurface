import {
  bench,
  describe,
} from "vitest";

import { ParticleGrid } from "../src/ParticleGrid.js";

import {
  createGridTriangleIndices,
} from "../src/GridTopology.js";

import { TriangleSpatialHash } from "../src/TriangleSpatialHash.js";

const WIDTH = 4;
const HEIGHT = 3;

const SEGMENTS_X = 48;
const SEGMENTS_Y = 36;

const THICKNESS = 0.03;
const CELL_SIZE = 0.1;

const BENCH_OPTIONS = {
  time: 0,
  iterations: 200,
  warmupTime: 0,
  warmupIterations: 50,
};

const grid = new ParticleGrid({
  width: WIDTH,
  height: HEIGHT,
  segmentsX: SEGMENTS_X,
  segmentsY: SEGMENTS_Y,
});

const triangles =
  createGridTriangleIndices(grid);

/**
 * Deterministic flat reference surface.
 */
const restPositions =
  new Float32Array(
    grid.positions,
  );

/**
 * Deterministic folded surface.
 *
 * The right half is mirrored over the center
 * and shifted slightly along Z.
 */
const foldedPositions =
  createFoldedPositions(
    grid,
    THICKNESS,
  );

/**
 * Separate hash instances prevent state from one
 * scenario affecting the other.
 */
const restHash =
  new TriangleSpatialHash({
    cellSize: CELL_SIZE,
    padding: THICKNESS,
  });

const foldedHash =
  new TriangleSpatialHash({
    cellSize: CELL_SIZE,
    padding: THICKNESS,
  });

describe(
  "TriangleSpatialHash / REST",
  () => {
    bench(
      "build",
      () => {
        restHash.build(
          restPositions,
          triangles,
        );
      },
      BENCH_OPTIONS,
    );
  },
);

describe(
  "TriangleSpatialHash / FOLDED",
  () => {
    bench(
      "build",
      () => {
        foldedHash.build(
          foldedPositions,
          triangles,
        );
      },
      BENCH_OPTIONS,
    );
  },
);

function createFoldedPositions(
  sourceGrid: ParticleGrid,
  thickness: number,
): Float32Array {
  const positions =
    new Float32Array(
      sourceGrid.positions,
    );

  const firstIndex =
    sourceGrid.getParticleIndex(
      0,
      0,
    );

  const lastIndex =
    sourceGrid.getParticleIndex(
      sourceGrid.columns - 1,
      0,
    );

  const firstX =
    positions[
      firstIndex * 3
    ];

  const lastX =
    positions[
      lastIndex * 3
    ];

  const centerX =
    (firstX + lastX) * 0.5;

  const middleColumn =
    Math.floor(
      sourceGrid.columns / 2,
    );

  for (
    let y = 0;
    y < sourceGrid.rows;
    y++
  ) {
    for (
      let x =
        middleColumn + 1;
      x < sourceGrid.columns;
      x++
    ) {
      const particleIndex =
        sourceGrid.getParticleIndex(
          x,
          y,
        );

      const offset =
        particleIndex * 3;

      positions[offset] =
        centerX -
        (
          positions[offset] -
          centerX
        );

      positions[offset + 2] +=
        thickness * 0.5;
    }
  }

  return positions;
}