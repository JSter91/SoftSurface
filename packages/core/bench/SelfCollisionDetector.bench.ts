import {
  bench,
  describe,
} from "vitest";

import { ParticleGrid } from "../src/ParticleGrid.js";

import {
  createGridTriangleIndices,
} from "../src/GridTopology.js";

import {
  SelfCollisionDetector,
} from "../src/SelfCollisionDetector.js";

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

const grid =
  new ParticleGrid({
    width: WIDTH,
    height: HEIGHT,
    segmentsX: SEGMENTS_X,
    segmentsY: SEGMENTS_Y,
  });

const triangles =
  createGridTriangleIndices(grid);

const restPositions =
  new Float32Array(
    grid.positions,
  );

const foldedPositions =
  createFoldedPositions(
    grid,
    THICKNESS,
  );

/**
 * Keep one detector per deterministic scenario.
 *
 * The detector reuses internal buffers, which is also
 * how it behaves during the real simulation.
 */
const restDetector =
  new SelfCollisionDetector(
    triangles,
    {
      thickness: THICKNESS,
      cellSize: CELL_SIZE,
    },
  );

const foldedDetector =
  new SelfCollisionDetector(
    triangles,
    {
      thickness: THICKNESS,
      cellSize: CELL_SIZE,
    },
  );

/**
 * Correctness gate.
 *
 * Performance numbers are useful only if the detector
 * is still producing the expected results.
 */
verifyCorrectness();

describe(
  "SelfCollisionDetector / REST",
  () => {
    bench(
      "detect",
      () => {
        restDetector.detect(
          restPositions,
        );
      },
      BENCH_OPTIONS,
    );
  },
);

describe(
  "SelfCollisionDetector / FOLDED",
  () => {
    bench(
      "detect",
      () => {
        foldedDetector.detect(
          foldedPositions,
        );
      },
      BENCH_OPTIONS,
    );
  },
);

function verifyCorrectness():
  void {
  const rest =
    new SelfCollisionDetector(
      triangles,
      {
        thickness: THICKNESS,
        cellSize: CELL_SIZE,
      },
    );

  const folded =
    new SelfCollisionDetector(
      triangles,
      {
        thickness: THICKNESS,
        cellSize: CELL_SIZE,
      },
    );

  const restStats =
    rest.detect(
      restPositions,
    );

  if (
    restStats.testedPairs !==
    3456
  ) {
    throw new Error(
      [
        "REST tested-pair regression.",
        "expected=3456",
        `actual=${restStats.testedPairs}`,
      ].join(" "),
    );
  }

  if (
    restStats.contacts !== 0
  ) {
    throw new Error(
      [
        "REST contact regression.",
        "expected=0",
        `actual=${restStats.contacts}`,
      ].join(" "),
    );
  }

  const foldedStats =
    folded.detect(
      foldedPositions,
    );

  if (
    foldedStats.testedPairs !==
    16992
  ) {
    throw new Error(
      [
        "FOLDED tested-pair regression.",
        "expected=16992",
        `actual=${foldedStats.testedPairs}`,
      ].join(" "),
    );
  }

  if (
    foldedStats.contacts !==
    10152
  ) {
    throw new Error(
      [
        "FOLDED contact regression.",
        "expected=10152",
        `actual=${foldedStats.contacts}`,
      ].join(" "),
    );
  }

  console.log(
    [
      "REST correctness:",
      `tested=${restStats.testedPairs}`,
      `contacts=${restStats.contacts}`,
      `aabbRejected=${restStats.aabbRejected}`,
    ].join(" "),
  );

  console.log(
    [
      "FOLDED correctness:",
      `tested=${foldedStats.testedPairs}`,
      `contacts=${foldedStats.contacts}`,
      `aabbRejected=${foldedStats.aabbRejected}`,
    ].join(" "),
  );
}

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