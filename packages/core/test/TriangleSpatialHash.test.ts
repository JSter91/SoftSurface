import { describe, expect, it } from "vitest";

import { TriangleSpatialHash } from "../src/TriangleSpatialHash.js";

describe("TriangleSpatialHash", () => {
  it("finds a triangle in the same spatial cell", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

    const triangles = new Uint16Array([0, 1, 2]);

    const hash = new TriangleSpatialHash({
      cellSize: 1,
    });

    hash.build(positions, triangles);

    expect(hash.queryPoint(0.25, 0.25, 0)).toContain(0);
  });

  it("does not return distant triangles", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

    const triangles = new Uint32Array([0, 1, 2]);

    const hash = new TriangleSpatialHash({
      cellSize: 1,
    });

    hash.build(positions, triangles);

    expect(hash.queryPoint(10, 10, 10)).toHaveLength(0);
  });

  it("uses padding around triangle bounds", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

    const triangles = new Uint32Array([0, 1, 2]);

    const hash = new TriangleSpatialHash({
      cellSize: 0.1,
      padding: 0.05,
    });

    hash.build(positions, triangles);

    expect(hash.queryPoint(0.25, 0.25, 0.04)).toContain(0);
  });

  it("clears previous data when rebuilt", () => {
    const triangles = new Uint32Array([0, 1, 2]);

    const hash = new TriangleSpatialHash({
      cellSize: 1,
    });

    hash.build(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), triangles);

    expect(hash.queryPoint(0, 0, 0)).toContain(0);

    hash.build(
      new Float32Array([10, 10, 10, 11, 10, 10, 10, 11, 10]),
      triangles,
    );

    expect(hash.queryPoint(0, 0, 0)).toHaveLength(0);
  });

  it("rejects invalid cell sizes", () => {
    expect(
      () =>
        new TriangleSpatialHash({
          cellSize: 0,
        }),
    ).toThrow(RangeError);
  });
  it("reports whether a point is inside a triangle padded AABB", () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

    const triangles = new Uint16Array([0, 1, 2]);

    const hash = new TriangleSpatialHash({
      cellSize: 0.25,
      padding: 0.05,
    });

    hash.build(positions, triangles);

    expect(hash.containsPoint(0, 0.25, 0.25, 0.03)).toBe(true);

    expect(hash.containsPoint(0, 0.25, 0.25, 0.1)).toBe(false);
  });
});
