import { describe, expect, it } from "vitest";

import { createUniqueEdgeIndices } from "../src/GridTopology.js";

describe("createUniqueEdgeIndices", () => {
  it("deduplicates a shared triangle edge regardless of direction", () => {
    /**
     * Two triangles forming a quad:
     *
     * 0 ----- 1
     * |     / |
     * |   /   |
     * | /     |
     * 2 ----- 3
     *
     * Shared edge is 1-2.
     */
    const triangles = new Uint16Array([0, 2, 1, 1, 2, 3]);

    const edges = createUniqueEdgeIndices(triangles);

    /**
     * 6 triangle edges minus one duplicated
     * shared edge = 5 unique edges.
     */
    expect(edges.length).toBe(10);

    const pairs: string[] = [];

    for (let i = 0; i < edges.length; i += 2) {
      pairs.push(`${edges[i]}-${edges[i + 1]}`);
    }

    expect(new Set(pairs)).toEqual(
      new Set(["0-2", "1-2", "0-1", "2-3", "1-3"]),
    );
  });

  it("stores every edge in canonical ascending order", () => {
    const triangles = new Uint16Array([3, 1, 2]);

    const edges = createUniqueEdgeIndices(triangles);

    for (let i = 0; i < edges.length; i += 2) {
      expect(edges[i]).toBeLessThan(edges[i + 1]);
    }
  });

  it("preserves Uint32 topology when required", () => {
    const triangles = new Uint32Array([0, 70000, 70001]);

    const edges = createUniqueEdgeIndices(triangles);

    expect(edges).toBeInstanceOf(Uint32Array);

    expect(edges.length).toBe(6);
  });

  it("ignores degenerate zero-length edges", () => {
    const triangles = new Uint16Array([0, 0, 1]);

    const edges = createUniqueEdgeIndices(triangles);

    /**
     * Only edge 0-1 remains.
     */
    expect(Array.from(edges)).toEqual([0, 1]);
  });
});
