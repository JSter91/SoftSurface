import type { TriangleIndices } from "./GridTopology.js";

import {
  pointTriangleDistanceSquared,
  type PointTriangleResult,
} from "./PointTriangleDistance.js";

import {
  resolveVertexTriangleCollision,
} from "./VertexTriangleCollisionResolver.js";

import { TriangleSpatialHash } from "./TriangleSpatialHash.js";

export interface SelfCollisionSolverOptions {
  thickness: number;
  cellSize: number;
}

export interface SelfCollisionSolverStats {
  candidatePairs: number;
  testedPairs: number;
  contacts: number;

  aabbRejected: number;

  resolvedContacts: number;
  staleContacts: number;

  hashBuildMs: number;
  detectionMs: number;
  responseMs: number;
  totalMs: number;
}

export class SelfCollisionSolver {
  private readonly visitedTriangles: Uint32Array;

  private visitStamp = 0;

  private readonly thickness: number;
  private readonly thicknessSquared: number;

  private readonly spatialHash: TriangleSpatialHash;

  /**
   * Contacts are stored as particle / triangle pairs.
   *
   * The buffers are reused across solve() calls and grow
   * only when the current capacity is exceeded.
   */
  private contactParticles = new Uint32Array(256);
  private contactTriangles = new Uint32Array(256);

  private contactCount = 0;

  /**
   * Reused narrow-phase result.
   *
   * Both detection and response reuse this object so no
   * per-contact result allocation is required.
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
   * Reused statistics object.
   */
  private readonly stats: SelfCollisionSolverStats = {
    candidatePairs: 0,
    testedPairs: 0,
    contacts: 0,

    aabbRejected: 0,

    resolvedContacts: 0,
    staleContacts: 0,

    hashBuildMs: 0,
    detectionMs: 0,
    responseMs: 0,
    totalMs: 0,
  };

  constructor(
    private readonly triangles: TriangleIndices,
    options: SelfCollisionSolverOptions,
  ) {
    const { thickness, cellSize } = options;

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

    this.thickness = thickness;
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

  solve(
    positions: Float32Array,
    previousPositions: Float32Array,
    inverseMasses: Float32Array,
  ): SelfCollisionSolverStats {
    const totalStart =
      performance.now();

    const buildStart =
      totalStart;

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

    stats.resolvedContacts = 0;
    stats.staleContacts = 0;

    this.contactCount = 0;

    /**
     * PASS 1
     *
     * Detect vertex-triangle contacts using the same
     * broad/narrow-phase strategy as SelfCollisionDetector.
     *
     * Only particle / triangle indices are retained.
     */
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
         * A triangle may occur more than once in the
         * spatial-hash candidate list for one particle.
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
         * A particle must never collide with a triangle
         * containing that same particle.
         */
        if (
          particle === a ||
          particle === b ||
          particle === c
        ) {
          continue;
        }

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

        if (
          !Number.isFinite(
            this.result
              .distanceSquared,
          )
        ) {
          continue;
        }

        if (
          this.result
            .distanceSquared <
          this.thicknessSquared
        ) {
          stats.contacts++;

          this.storeContact(
            particle,
            triangleIndex,
          );
        }
      }
    }

    const detectionEnd =
      performance.now();

    /**
     * PASS 2
     *
     * Re-evaluate each detected pair using the current
     * positions.
     *
     * Earlier responses may already have separated later
     * contacts, so closest-point and barycentric data from
     * PASS 1 must not be reused.
     */
    for (
      let contactIndex = 0;
      contactIndex <
      this.contactCount;
      contactIndex++
    ) {
      const particle =
        this.contactParticles[
          contactIndex
        ];

      const triangleIndex =
        this.contactTriangles[
          contactIndex
        ];

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

      const particleOffset =
        particle * 3;

      const aOffset = a * 3;
      const bOffset = b * 3;
      const cOffset = c * 3;

      pointTriangleDistanceSquared(
        positions[
          particleOffset
        ],
        positions[
          particleOffset + 1
        ],
        positions[
          particleOffset + 2
        ],

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

      if (
        !Number.isFinite(
          this.result
            .distanceSquared,
        )
      ) {
        continue;
      }

      /**
       * A previous response may already have separated
       * this pair.
       */
      if (
        this.result.distanceSquared >=
        this.thicknessSquared
      ) {
        stats.staleContacts++;

        continue;
      }

      const resolved =
        resolveVertexTriangleCollision(
          positions,
          previousPositions,
          inverseMasses,

          particle,

          a,
          b,
          c,

          this.thickness,

          this.result,
        );

      if (resolved) {
        stats.resolvedContacts++;
      }
    }

    const responseEnd =
      performance.now();

    stats.hashBuildMs =
      buildEnd - buildStart;

    /**
     * Candidate traversal + narrow phase.
     *
     * Hash construction is reported separately.
     */
    stats.detectionMs =
      detectionEnd - buildEnd;

    stats.responseMs =
      responseEnd -
      detectionEnd;

    stats.totalMs =
      responseEnd -
      totalStart;

    return stats;
  }

  private storeContact(
    particle: number,
    triangleIndex: number,
  ): void {
    const nextCount =
      this.contactCount + 1;

    this.ensureContactCapacity(
      nextCount,
    );

    this.contactParticles[
      this.contactCount
    ] = particle;

    this.contactTriangles[
      this.contactCount
    ] = triangleIndex;

    this.contactCount =
      nextCount;
  }

  private ensureContactCapacity(
    requiredCapacity: number,
  ): void {
    if (
      requiredCapacity <=
      this.contactParticles.length
    ) {
      return;
    }

    let newCapacity =
      this.contactParticles.length;

    while (
      newCapacity <
      requiredCapacity
    ) {
      newCapacity *= 2;
    }

    const newParticles =
      new Uint32Array(
        newCapacity,
      );

    const newTriangles =
      new Uint32Array(
        newCapacity,
      );

    newParticles.set(
      this.contactParticles,
    );

    newTriangles.set(
      this.contactTriangles,
    );

    this.contactParticles =
      newParticles;

    this.contactTriangles =
      newTriangles;
  }

  private nextVisitStamp(): number {
    this.visitStamp =
      (this.visitStamp + 1) >>>
      0;

    /**
     * Uint32 overflow.
     *
     * Reset the reusable marker buffer so stamp 0 never
     * aliases entries from an earlier traversal.
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