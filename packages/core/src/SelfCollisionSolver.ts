import {
  createUniqueEdgeIndices,
  type EdgeIndices,
  type TriangleIndices,
} from "./GridTopology.js";

import { EdgeSpatialHash } from "./EdgeSpatialHash.js";

import {
  segmentSegmentDistanceSquared,
  type SegmentSegmentResult,
} from "./SegmentSegmentDistance.js";

import { resolveEdgeEdgeCollision } from "./EdgeEdgeCollisionResolver.js";

import {
  pointTriangleDistanceSquared,
  type PointTriangleResult,
} from "./PointTriangleDistance.js";

import { resolveVertexTriangleCollision } from "./VertexTriangleCollisionResolver.js";

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

  /**
   * Edge-edge statistics are separate so the existing
   * vertex-triangle metrics preserve their current meaning.
   */
  edgeCandidatePairs: number;
  edgeTestedPairs: number;
  edgeContacts: number;

  edgeResolvedContacts: number;
  edgeStaleContacts: number;

  edgeHashBuildMs: number;
  edgeDetectionMs: number;
  edgeResponseMs: number;

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

  private readonly edges: EdgeIndices;
  private readonly edgeSpatialHash: EdgeSpatialHash;

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
   * Edge contacts are stored as pairs of edge indices.
   */
  private edgeContactA = new Uint32Array(256);

  private edgeContactB = new Uint32Array(256);

  private edgeContactCount = 0;

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

  private readonly edgeResult: SegmentSegmentResult = {
    distanceSquared: 0,

    closestAX: 0,
    closestAY: 0,
    closestAZ: 0,

    closestBX: 0,
    closestBY: 0,
    closestBZ: 0,

    parameterA: 0,
    parameterB: 0,
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

    edgeCandidatePairs: 0,
    edgeTestedPairs: 0,
    edgeContacts: 0,

    edgeResolvedContacts: 0,
    edgeStaleContacts: 0,

    edgeHashBuildMs: 0,
    edgeDetectionMs: 0,
    edgeResponseMs: 0,

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
      throw new RangeError("thickness must be greater than 0");
    }

    if (cellSize <= 0) {
      throw new RangeError("cellSize must be greater than 0");
    }

    this.thickness = thickness;
    this.thicknessSquared = thickness * thickness;

    this.spatialHash = new TriangleSpatialHash({
      cellSize,
      padding: thickness,
    });

    this.edges = createUniqueEdgeIndices(triangles);

    this.edgeSpatialHash = new EdgeSpatialHash({
      cellSize,
      padding: thickness,
    });

    this.visitedTriangles = new Uint32Array(triangles.length / 3);
  }

  solve(
    positions: Float32Array,
    previousPositions: Float32Array,
    inverseMasses: Float32Array,
  ): SelfCollisionSolverStats {
    const totalStart = performance.now();

    const buildStart = totalStart;

    this.spatialHash.build(positions, this.triangles);

    const triangleBuildEnd = performance.now();

    this.edgeSpatialHash.build(positions, this.edges);

    const buildEnd = performance.now();
    const stats = this.stats;

    stats.candidatePairs = 0;
    stats.testedPairs = 0;
    stats.contacts = 0;

    stats.aabbRejected = 0;

    stats.resolvedContacts = 0;
    stats.staleContacts = 0;

    this.contactCount = 0;

    stats.edgeCandidatePairs = 0;
    stats.edgeTestedPairs = 0;
    stats.edgeContacts = 0;

    stats.edgeResolvedContacts = 0;
    stats.edgeStaleContacts = 0;

    this.edgeContactCount = 0;

    /**
     * PASS 1
     *
     * Detect vertex-triangle contacts using the same
     * broad/narrow-phase strategy as SelfCollisionDetector.
     *
     * Only particle / triangle indices are retained.
     */
    const particleCount = positions.length / 3;

    for (let particle = 0; particle < particleCount; particle++) {
      const visitStamp = this.nextVisitStamp();

      const particleOffset = particle * 3;

      const px = positions[particleOffset];

      const py = positions[particleOffset + 1];

      const pz = positions[particleOffset + 2];

      const candidates = this.spatialHash.queryPoint(px, py, pz);

      stats.candidatePairs += candidates.length;

      for (let i = 0; i < candidates.length; i++) {
        const triangleIndex = candidates[i];

        /**
         * A triangle may occur more than once in the
         * spatial-hash candidate list for one particle.
         */
        if (this.visitedTriangles[triangleIndex] === visitStamp) {
          continue;
        }

        this.visitedTriangles[triangleIndex] = visitStamp;

        const indexOffset = triangleIndex * 3;

        const a = this.triangles[indexOffset];

        const b = this.triangles[indexOffset + 1];

        const c = this.triangles[indexOffset + 2];

        /**
         * A particle must never collide with a triangle
         * containing that same particle.
         */
        if (particle === a || particle === b || particle === c) {
          continue;
        }

        if (!this.spatialHash.containsPoint(triangleIndex, px, py, pz)) {
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

        if (!Number.isFinite(this.result.distanceSquared)) {
          continue;
        }

        if (this.result.distanceSquared < this.thicknessSquared) {
          stats.contacts++;

          this.storeContact(particle, triangleIndex);
        }
      }
    }

    const vertexDetectionEnd = performance.now();

    /**
     * EDGE-EDGE DETECTION
     *
     * Every unordered edge pair is evaluated at most once.
     * Edges sharing a vertex are excluded because they are
     * topological neighbours rather than self-collision
     * candidates.
     */
    const edgeCount = this.edges.length / 2;

    for (let edgeAIndex = 0; edgeAIndex < edgeCount; edgeAIndex++) {
      const candidates = this.edgeSpatialHash.queryEdge(
        positions,
        this.edges,
        edgeAIndex,
      );

      stats.edgeCandidatePairs += candidates.length;

      const edgeAOffset = edgeAIndex * 2;

      const a0 = this.edges[edgeAOffset];

      const a1 = this.edges[edgeAOffset + 1];

      for (let i = 0; i < candidates.length; i++) {
        const edgeBIndex = candidates[i];

        /**
         * Skip self-pairs and duplicate A-B / B-A pairs.
         */
        if (edgeBIndex <= edgeAIndex) {
          continue;
        }

        const edgeBOffset = edgeBIndex * 2;

        const b0 = this.edges[edgeBOffset];

        const b1 = this.edges[edgeBOffset + 1];

        /**
         * Adjacent edges sharing a vertex must not
         * self-collide.
         */
        if (a0 === b0 || a0 === b1 || a1 === b0 || a1 === b1) {
          continue;
        }

        stats.edgeTestedPairs++;

        const a0Offset = a0 * 3;
        const a1Offset = a1 * 3;

        const b0Offset = b0 * 3;
        const b1Offset = b1 * 3;

        segmentSegmentDistanceSquared(
          positions[a0Offset],
          positions[a0Offset + 1],
          positions[a0Offset + 2],

          positions[a1Offset],
          positions[a1Offset + 1],
          positions[a1Offset + 2],

          positions[b0Offset],
          positions[b0Offset + 1],
          positions[b0Offset + 2],

          positions[b1Offset],
          positions[b1Offset + 1],
          positions[b1Offset + 2],

          this.edgeResult,
        );

        if (!Number.isFinite(this.edgeResult.distanceSquared)) {
          continue;
        }

        if (this.edgeResult.distanceSquared < this.thicknessSquared) {
          stats.edgeContacts++;

          this.storeEdgeContact(edgeAIndex, edgeBIndex);
        }
      }
    }

    const edgeDetectionEnd = performance.now();

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
      contactIndex < this.contactCount;
      contactIndex++
    ) {
      const particle = this.contactParticles[contactIndex];

      const triangleIndex = this.contactTriangles[contactIndex];

      const indexOffset = triangleIndex * 3;

      const a = this.triangles[indexOffset];

      const b = this.triangles[indexOffset + 1];

      const c = this.triangles[indexOffset + 2];

      const particleOffset = particle * 3;

      const aOffset = a * 3;
      const bOffset = b * 3;
      const cOffset = c * 3;

      pointTriangleDistanceSquared(
        positions[particleOffset],
        positions[particleOffset + 1],
        positions[particleOffset + 2],

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

      if (!Number.isFinite(this.result.distanceSquared)) {
        continue;
      }

      /**
       * A previous response may already have separated
       * this pair.
       */
      if (this.result.distanceSquared >= this.thicknessSquared) {
        stats.staleContacts++;

        continue;
      }

      const resolved = resolveVertexTriangleCollision(
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

    const vertexResponseEnd = performance.now();

    /**
     * EDGE-EDGE RESPONSE
     *
     * Closest points are recomputed because earlier
     * responses may already have changed the geometry.
     */
    for (
      let contactIndex = 0;
      contactIndex < this.edgeContactCount;
      contactIndex++
    ) {
      const edgeAIndex = this.edgeContactA[contactIndex];

      const edgeBIndex = this.edgeContactB[contactIndex];

      const edgeAOffset = edgeAIndex * 2;

      const edgeBOffset = edgeBIndex * 2;

      const a0 = this.edges[edgeAOffset];

      const a1 = this.edges[edgeAOffset + 1];

      const b0 = this.edges[edgeBOffset];

      const b1 = this.edges[edgeBOffset + 1];

      const a0Offset = a0 * 3;
      const a1Offset = a1 * 3;

      const b0Offset = b0 * 3;
      const b1Offset = b1 * 3;

      segmentSegmentDistanceSquared(
        positions[a0Offset],
        positions[a0Offset + 1],
        positions[a0Offset + 2],

        positions[a1Offset],
        positions[a1Offset + 1],
        positions[a1Offset + 2],

        positions[b0Offset],
        positions[b0Offset + 1],
        positions[b0Offset + 2],

        positions[b1Offset],
        positions[b1Offset + 1],
        positions[b1Offset + 2],

        this.edgeResult,
      );

      if (!Number.isFinite(this.edgeResult.distanceSquared)) {
        continue;
      }

      if (this.edgeResult.distanceSquared >= this.thicknessSquared) {
        stats.edgeStaleContacts++;

        continue;
      }

      const resolved = resolveEdgeEdgeCollision(
        positions,
        previousPositions,
        inverseMasses,

        a0,
        a1,

        b0,
        b1,

        this.thickness,

        this.edgeResult,
      );

      if (resolved) {
        stats.edgeResolvedContacts++;
      }
    }

    const responseEnd = performance.now();

    stats.hashBuildMs = triangleBuildEnd - buildStart;

    stats.edgeHashBuildMs = buildEnd - triangleBuildEnd;

    /**
     * Candidate traversal + narrow phase.
     *
     * Triangle and edge collision timings are
     * reported separately.
     */
    stats.detectionMs = vertexDetectionEnd - buildEnd;

    stats.edgeDetectionMs = edgeDetectionEnd - vertexDetectionEnd;

    stats.responseMs = vertexResponseEnd - edgeDetectionEnd;

    stats.edgeResponseMs = responseEnd - vertexResponseEnd;

    stats.totalMs = responseEnd - totalStart;
    stats.edgeDetectionMs = edgeDetectionEnd - vertexDetectionEnd;

    stats.edgeResponseMs = responseEnd - vertexResponseEnd;

    return stats;
  }

  private storeContact(particle: number, triangleIndex: number): void {
    const nextCount = this.contactCount + 1;

    this.ensureContactCapacity(nextCount);

    this.contactParticles[this.contactCount] = particle;

    this.contactTriangles[this.contactCount] = triangleIndex;

    this.contactCount = nextCount;
  }

  private ensureContactCapacity(requiredCapacity: number): void {
    if (requiredCapacity <= this.contactParticles.length) {
      return;
    }

    let newCapacity = this.contactParticles.length;

    while (newCapacity < requiredCapacity) {
      newCapacity *= 2;
    }

    const newParticles = new Uint32Array(newCapacity);

    const newTriangles = new Uint32Array(newCapacity);

    newParticles.set(this.contactParticles);

    newTriangles.set(this.contactTriangles);

    this.contactParticles = newParticles;

    this.contactTriangles = newTriangles;
  }

  private storeEdgeContact(edgeA: number, edgeB: number): void {
    const nextCount = this.edgeContactCount + 1;

    this.ensureEdgeContactCapacity(nextCount);

    this.edgeContactA[this.edgeContactCount] = edgeA;

    this.edgeContactB[this.edgeContactCount] = edgeB;

    this.edgeContactCount = nextCount;
  }

  private ensureEdgeContactCapacity(requiredCapacity: number): void {
    if (requiredCapacity <= this.edgeContactA.length) {
      return;
    }

    let newCapacity = this.edgeContactA.length;

    while (newCapacity < requiredCapacity) {
      newCapacity *= 2;
    }

    const newA = new Uint32Array(newCapacity);

    const newB = new Uint32Array(newCapacity);

    newA.set(this.edgeContactA);

    newB.set(this.edgeContactB);

    this.edgeContactA = newA;

    this.edgeContactB = newB;
  }

  private nextVisitStamp(): number {
    this.visitStamp = (this.visitStamp + 1) >>> 0;

    /**
     * Uint32 overflow.
     *
     * Reset the reusable marker buffer so stamp 0 never
     * aliases entries from an earlier traversal.
     */
    if (this.visitStamp === 0) {
      this.visitedTriangles.fill(0);

      this.visitStamp = 1;
    }

    return this.visitStamp;
  }
}
