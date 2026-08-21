import type { TriangleIndices } from "./GridTopology.js";

import {
  pointTriangleDistanceSquared,
  type PointTriangleResult,
} from "./PointTriangleDistance.js";

import { TriangleSpatialHash } from "./TriangleSpatialHash.js";

export interface SelfCollisionDetectorOptions {
  thickness: number;
  cellSize: number;
}

export interface SelfCollisionStats {
  candidatePairs: number;
  testedPairs: number;
  contacts: number;

  aabbRejected: number;

  hashBuildMs: number;
  narrowPhaseMs: number;
  totalMs: number;
}

export class SelfCollisionDetector {
  private readonly visitedTriangles: Uint32Array;

  private visitStamp = 0;

  private readonly thicknessSquared: number;

  private readonly spatialHash: TriangleSpatialHash;

  /**
   * Reused narrow-phase result.
   *
   * Avoids allocating a new result object for every
   * point-triangle distance test.
   */
  private readonly result: PointTriangleResult = {
    distanceSquared: 0,

    closestX: 0,
    closestY: 0,
    closestZ: 0,

    barycentricA: 0,
    barycentricB: 0,
    barycentricC: 0,
  };

  /**
   * Reused detector statistics.
   *
   * detect() can run every physics substep, so returning
   * the same object avoids one allocation per substep.
   */
  private readonly stats: SelfCollisionStats = {
    candidatePairs: 0,
    testedPairs: 0,
    contacts: 0,

    aabbRejected: 0,

    hashBuildMs: 0,
    narrowPhaseMs: 0,
    totalMs: 0,
  };

  constructor(
    private readonly triangles: TriangleIndices,
    options: SelfCollisionDetectorOptions,
  ) {
    const {
      thickness,
      cellSize,
    } = options;

    if (thickness <= 0) {
      throw new RangeError(
        "thickness must be greater than 0",
      );
    }

    if (cellSize <= 0) {
      throw new RangeError(
        "cellSize must be greater than 0",
      );
    }

    this.thicknessSquared =
      thickness * thickness;

    this.spatialHash =
      new TriangleSpatialHash({
        cellSize,
        padding: thickness,
      });

    this.visitedTriangles =
      new Uint32Array(
        triangles.length / 3,
      );
  }

  detect(
    positions: Float32Array,
  ): SelfCollisionStats {
    const buildStart =
      performance.now();

    this.spatialHash.build(
      positions,
      this.triangles,
    );

    const buildEnd =
      performance.now();

    const stats = this.stats;

    stats.candidatePairs = 0;
    stats.testedPairs = 0;
    stats.contacts = 0;
    stats.aabbRejected = 0;

    const particleCount =
      positions.length / 3;

    for (
      let particle = 0;
      particle < particleCount;
      particle++
    ) {
      const visitStamp =
        this.nextVisitStamp();

      const particleOffset =
        particle * 3;

      const px =
        positions[particleOffset];

      const py =
        positions[
          particleOffset + 1
        ];

      const pz =
        positions[
          particleOffset + 2
        ];

      const candidates =
        this.spatialHash.queryPoint(
          px,
          py,
          pz,
        );

      stats.candidatePairs +=
        candidates.length;

      for (
        let i = 0;
        i < candidates.length;
        i++
      ) {
        const triangleIndex =
          candidates[i];

        /**
         * Different spatial cells can hash to the same
         * numeric key, so the same triangle may appear
         * more than once among the candidates.
         */
        if (
          this.visitedTriangles[
            triangleIndex
          ] === visitStamp
        ) {
          continue;
        }

        this.visitedTriangles[
          triangleIndex
        ] = visitStamp;

        const indexOffset =
          triangleIndex * 3;

        const a =
          this.triangles[
            indexOffset
          ];

        const b =
          this.triangles[
            indexOffset + 1
          ];

        const c =
          this.triangles[
            indexOffset + 2
          ];

        /**
         * A vertex must not collide with a triangle
         * containing that same vertex.
         */
        if (
          particle === a ||
          particle === b ||
          particle === c
        ) {
          continue;
        }

        /**
         * Spatial-hash membership only tells us that
         * the particle and triangle overlap the same
         * hash cell.
         *
         * Reject the candidate if the particle lies
         * outside the triangle's padded AABB before
         * running the more expensive point-triangle
         * distance calculation.
         */
        if (
          !this.spatialHash.containsPoint(
            triangleIndex,
            px,
            py,
            pz,
          )
        ) {
          stats.aabbRejected++;

          continue;
        }

        /**
         * Only candidates surviving the AABB filter
         * reach the actual narrow-phase distance test.
         */
        stats.testedPairs++;

        const aOffset = a * 3;
        const bOffset = b * 3;
        const cOffset = c * 3;

        pointTriangleDistanceSquared(
          px,
          py,
          pz,

          positions[aOffset],
          positions[aOffset + 1],
          positions[aOffset + 2],

          positions[bOffset],
          positions[bOffset + 1],
          positions[bOffset + 2],

          positions[cOffset],
          positions[cOffset + 1],
          positions[cOffset + 2],

          this.result,
        );

        /**
         * Degenerate geometry can produce invalid
         * numerical results.
         */
        if (
          !Number.isFinite(
            this.result.distanceSquared,
          )
        ) {
          continue;
        }

        if (
          this.result.distanceSquared <
          this.thicknessSquared
        ) {
          stats.contacts++;
        }
      }
    }

    const detectEnd =
      performance.now();

    stats.hashBuildMs =
      buildEnd - buildStart;

    stats.narrowPhaseMs =
      detectEnd - buildEnd;

    stats.totalMs =
      detectEnd - buildStart;

    return stats;
  }

  private nextVisitStamp(): number {
    this.visitStamp =
      (this.visitStamp + 1) >>> 0;

    /**
     * Uint32 overflow.
     *
     * Extremely rare, but reset the reusable marker
     * buffer so stamp 0 never aliases old entries.
     */
    if (this.visitStamp === 0) {
      this.visitedTriangles.fill(
        0,
      );

      this.visitStamp = 1;
    }

    return this.visitStamp;
  }
}