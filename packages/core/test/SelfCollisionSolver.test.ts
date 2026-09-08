import { describe, expect, it } from "vitest";

import { SelfCollisionSolver } from "../src/SelfCollisionSolver.js";

import {
  segmentSegmentDistanceSquared,
  type SegmentSegmentResult,
} from "../src/SegmentSegmentDistance.js";

describe("SelfCollisionSolver", () => {
  it("detects and resolves a vertex penetrating a pinned triangle", () => {
    const positions = new Float32Array([
      // Triangle A
      0, 0, 0,

      // Triangle B
      1, 0, 0,

      // Triangle C
      0, 1, 0,

      // Particle P
      0.25, 0.25, 0.01,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 0, 1]);

    const triangles = new Uint16Array([0, 1, 2]);

    const solver = new SelfCollisionSolver(triangles, {
      thickness: 0.05,
      cellSize: 1,
    });

    const stats = solver.solve(positions, previousPositions, inverseMasses);

    expect(stats.contacts).toBe(1);

    expect(stats.resolvedContacts).toBe(1);

    expect(stats.staleContacts).toBe(0);

    /**
     * The triangle is pinned, so only P should move.
     */
    expect(positions[2]).toBeCloseTo(0);

    expect(positions[5]).toBeCloseTo(0);

    expect(positions[8]).toBeCloseTo(0);

    /**
     * P should be projected exactly to the collision
     * thickness.
     */
    expect(positions[11]).toBeCloseTo(0.05);
  });

  it("does not modify a vertex outside collision thickness", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,

      0.25, 0.25, 0.1,
    ]);

    const originalPositions = new Float32Array(positions);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 0, 1]);

    const triangles = new Uint16Array([0, 1, 2]);

    const solver = new SelfCollisionSolver(triangles, {
      thickness: 0.05,
      cellSize: 1,
    });

    const stats = solver.solve(positions, previousPositions, inverseMasses);

    expect(stats.contacts).toBe(0);

    expect(stats.resolvedContacts).toBe(0);

    expect(stats.staleContacts).toBe(0);

    expect(Array.from(positions)).toEqual(Array.from(originalPositions));
  });

  it("distributes collision response across a movable particle and triangle", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,

      0.25, 0.25, 0.01,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([1, 1, 1, 1]);

    const triangles = new Uint16Array([0, 1, 2]);

    const solver = new SelfCollisionSolver(triangles, {
      thickness: 0.05,
      cellSize: 1,
    });

    const stats = solver.solve(positions, previousPositions, inverseMasses);

    expect(stats.contacts).toBe(1);

    expect(stats.resolvedContacts).toBe(1);

    /**
     * P moves away from the triangle.
     */
    expect(positions[11]).toBeGreaterThan(0.01);

    /**
     * Triangle vertices move in the opposite direction.
     */
    expect(positions[2]).toBeLessThan(0);

    expect(positions[5]).toBeLessThan(0);

    expect(positions[8]).toBeLessThan(0);

    /**
     * Reconstruct the current point on the triangle
     * using the known barycentric coordinates for
     * this deterministic contact.
     */
    const closestZ =
      0.5 * positions[2] + 0.25 * positions[5] + 0.25 * positions[8];

    const separation = positions[11] - closestZ;

    expect(separation).toBeCloseTo(0.05);
  });

  it("detects contact but applies no correction when every particle is pinned", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,

      0.25, 0.25, 0.01,
    ]);

    const originalPositions = new Float32Array(positions);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 0, 0]);

    const triangles = new Uint16Array([0, 1, 2]);

    const solver = new SelfCollisionSolver(triangles, {
      thickness: 0.05,
      cellSize: 1,
    });

    const stats = solver.solve(positions, previousPositions, inverseMasses);

    expect(stats.contacts).toBe(1);

    expect(stats.resolvedContacts).toBe(0);

    expect(Array.from(positions)).toEqual(Array.from(originalPositions));
  });

  it("misses a vertex that crosses a triangle between discrete positions", () => {
    const positions = new Float32Array([
      // Triangle A
      0, 0, 0,

      // Triangle B
      1, 0, 0,

      // Triangle C
      0, 1, 0,

      // Particle P — current position
      0.25, 0.25, -0.04,
    ]);

    const previousPositions = new Float32Array([
      // Triangle A
      0, 0, 0,

      // Triangle B
      1, 0, 0,

      // Triangle C
      0, 1, 0,

      // Particle P — previous position
      0.25, 0.25, 0.04,
    ]);

    const inverseMasses = new Float32Array([0, 0, 0, 1]);

    const triangles = new Uint16Array([0, 1, 2]);

    const solver = new SelfCollisionSolver(triangles, {
      thickness: 0.03,
      cellSize: 1,
    });

    const before = new Float32Array(positions);

    const stats = solver.solve(positions, previousPositions, inverseMasses);

    /**
     * The particle travelled from +0.04 to -0.04,
     * therefore its trajectory crossed the triangle
     * plane at z = 0.
     *
     * Both discrete endpoints are farther than the
     * collision thickness (0.03), so the current
     * discrete detector misses the crossing.
     */
    expect(stats.contacts).toBe(0);

    expect(stats.resolvedContacts).toBe(0);

    expect(Array.from(positions)).toEqual(Array.from(before));
  });

  it("detects and resolves an edge-edge intersection when no vertex is within collision thickness", () => {
    const positions = new Float32Array([
      /**
       * Triangle 1, lying on z = 0.
       *
       * Edge 0-1 passes through the origin.
       */
      // A
      -1, 0, 0,

      // B
      1, 0, 0,

      // C
      0, 1, 0,

      /**
       * Triangle 2, lying on x = 0.
       *
       * Edge 3-4 also passes through the origin.
       */
      // D
      0, -1, -1,

      // E
      0, 1, 1,

      // F
      0, -1, 1,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([1, 1, 1, 1, 1, 1]);

    const triangles = new Uint16Array([0, 1, 2, 3, 4, 5]);

    /**
     * Prove that edge A-B and edge D-E
     * intersect exactly at their interiors.
     *
     * Both midpoints are the origin.
     */
    const abMidX = (positions[0] + positions[3]) * 0.5;

    const abMidY = (positions[1] + positions[4]) * 0.5;

    const abMidZ = (positions[2] + positions[5]) * 0.5;

    const deMidX = (positions[9] + positions[12]) * 0.5;

    const deMidY = (positions[10] + positions[13]) * 0.5;

    const deMidZ = (positions[11] + positions[14]) * 0.5;

    expect(abMidX).toBeCloseTo(0);
    expect(abMidY).toBeCloseTo(0);
    expect(abMidZ).toBeCloseTo(0);

    expect(deMidX).toBeCloseTo(0);
    expect(deMidY).toBeCloseTo(0);
    expect(deMidZ).toBeCloseTo(0);

    const before = new Float32Array(positions);

    const solver = new SelfCollisionSolver(triangles, {
      thickness: 0.05,
      cellSize: 2,
    });

    const stats = solver.solve(positions, previousPositions, inverseMasses);

    /**
     * The two triangle edges physically intersect,
     * but all six vertices remain farther than the
     * collision thickness from the opposite triangle.
     *
     * A vertex-triangle-only solver therefore has
     * no contact primitive capable of representing
     * this intersection.
     */
    /**
     * Vertex-triangle collision still sees nothing.
     */
    expect(stats.contacts).toBe(0);
    expect(stats.resolvedContacts).toBe(0);

    /**
     * Edge-edge collision must detect and resolve
     * the intersection.
     */
    expect(stats.edgeContacts).toBeGreaterThan(0);

    expect(stats.edgeResolvedContacts).toBeGreaterThan(0);

    expect(Array.from(positions)).not.toEqual(Array.from(before));

    /**
     * Verify specifically that the originally
     * intersecting edges A-B and D-E are now
     * separated by one collision thickness.
     */
    const result: SegmentSegmentResult = {
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

    segmentSegmentDistanceSquared(
      positions[0],
      positions[1],
      positions[2],

      positions[3],
      positions[4],
      positions[5],

      positions[9],
      positions[10],
      positions[11],

      positions[12],
      positions[13],
      positions[14],

      result,
    );

    expect(Math.sqrt(result.distanceSquared)).toBeCloseTo(0.05, 5);
  });
});
