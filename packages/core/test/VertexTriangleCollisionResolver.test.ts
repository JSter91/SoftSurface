import { describe, expect, it } from "vitest";

import { resolveVertexTriangleCollision } from "../src/VertexTriangleCollisionResolver.js";

import type { PointTriangleResult } from "../src/PointTriangleDistance.js";

describe("resolveVertexTriangleCollision", () => {
  it("pushes a movable particle away from a pinned triangle", () => {
    const positions = new Float32Array([
      // A
      0, 0, 0,

      // B
      1, 0, 0,

      // C
      0, 1, 0,

      // P
      0.25, 0.25, 0.01,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 0, 1]);

    const contact: PointTriangleResult = {
      distanceSquared: 0.01 * 0.01,

      closestX: 0.25,
      closestY: 0.25,
      closestZ: 0,

      barycentricA: 0.5,
      barycentricB: 0.25,
      barycentricC: 0.25,
    };

    const resolved = resolveVertexTriangleCollision(
      positions,
      previousPositions,
      inverseMasses,

      3,

      0,
      1,
      2,

      0.05,

      contact,
    );

    expect(resolved).toBe(true);

    expect(positions[11]).toBeCloseTo(0.05);

    /**
     * Triangle is pinned.
     */
    expect(positions[2]).toBeCloseTo(0);

    expect(positions[5]).toBeCloseTo(0);

    expect(positions[8]).toBeCloseTo(0);

    /**
     * previousPositions receives the same
     * positional projection.
     */
    expect(previousPositions[11]).toBeCloseTo(0.05);
  });

  it("distributes correction across a movable particle and triangle", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,

      0.25, 0.25, 0.01,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([1, 1, 1, 1]);

    const contact: PointTriangleResult = {
      distanceSquared: 0.0001,

      closestX: 0.25,
      closestY: 0.25,
      closestZ: 0,

      barycentricA: 0.5,
      barycentricB: 0.25,
      barycentricC: 0.25,
    };

    const resolved = resolveVertexTriangleCollision(
      positions,
      previousPositions,
      inverseMasses,

      3,

      0,
      1,
      2,

      0.05,

      contact,
    );

    expect(resolved).toBe(true);

    /**
     * Particle moves +Z.
     */
    expect(positions[11]).toBeGreaterThan(0.01);

    /**
     * Triangle moves in the opposite direction.
     */
    expect(positions[2]).toBeLessThan(0);

    expect(positions[5]).toBeLessThan(0);

    expect(positions[8]).toBeLessThan(0);

    /**
     * A receives the strongest correction because
     * it has the largest barycentric contribution.
     */
    expect(Math.abs(positions[2])).toBeGreaterThan(Math.abs(positions[5]));

    const finalParticleZ = positions[11];

    const finalClosestZ =
      contact.barycentricA * positions[2] +
      contact.barycentricB * positions[5] +
      contact.barycentricC * positions[8];

    const finalSeparation = finalParticleZ - finalClosestZ;

    expect(finalSeparation).toBeCloseTo(0.05);

    expect(Math.abs(positions[2])).toBeGreaterThan(Math.abs(positions[8]));
  });

  it("uses the triangle normal when particle and closest point coincide", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,

      0.25, 0.25, 0,
    ]);

    const previousPositions = new Float32Array(positions);

    const inverseMasses = new Float32Array([0, 0, 0, 1]);

    const contact: PointTriangleResult = {
      distanceSquared: 0,

      closestX: 0.25,
      closestY: 0.25,
      closestZ: 0,

      barycentricA: 0.5,
      barycentricB: 0.25,
      barycentricC: 0.25,
    };

    const resolved = resolveVertexTriangleCollision(
      positions,
      previousPositions,
      inverseMasses,

      3,

      0,
      1,
      2,

      0.05,

      contact,
    );

    expect(resolved).toBe(true);

    expect(positions[11]).toBeCloseTo(0.05);
  });

  it("does nothing when the contact is outside collision thickness", () => {
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,

      0.25, 0.25, 0.1,
    ]);

    const previousPositions = new Float32Array(positions);

    const original = new Float32Array(positions);

    const inverseMasses = new Float32Array([1, 1, 1, 1]);

    const contact: PointTriangleResult = {
      distanceSquared: 0.01,

      closestX: 0.25,
      closestY: 0.25,
      closestZ: 0,

      barycentricA: 0.5,
      barycentricB: 0.25,
      barycentricC: 0.25,
    };

    const resolved = resolveVertexTriangleCollision(
      positions,
      previousPositions,
      inverseMasses,

      3,

      0,
      1,
      2,

      0.05,

      contact,
    );

    expect(resolved).toBe(false);

    expect(Array.from(positions)).toEqual(Array.from(original));
  });
});
