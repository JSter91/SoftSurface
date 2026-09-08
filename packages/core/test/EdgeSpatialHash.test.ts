import { describe, expect, it } from "vitest";

import { EdgeSpatialHash } from "../src/EdgeSpatialHash.js";

describe("EdgeSpatialHash", () => {
  it("finds a crossing nearby edge", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      0, -1, 0, 0, 1, 0,
    ]);

    const edges = new Uint16Array([0, 1, 2, 3]);

    const hash = new EdgeSpatialHash({
      cellSize: 0.5,
      padding: 0.05,
    });

    hash.build(positions, edges);

    const candidates = hash.queryEdge(positions, edges, 0);

    expect(candidates).toContain(1);
  });

  it("rejects a distant edge", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      0, -1, 5, 0, 1, 5,
    ]);

    const edges = new Uint16Array([0, 1, 2, 3]);

    const hash = new EdgeSpatialHash({
      cellSize: 0.5,
      padding: 0.05,
    });

    hash.build(positions, edges);

    const candidates = hash.queryEdge(positions, edges, 0);

    expect(candidates).not.toContain(1);
  });

  it("returns each candidate only once", () => {
    const positions = new Float32Array([
      -2, 0, 0, 2, 0, 0,

      0, -2, 0, 0, 2, 0,
    ]);

    const edges = new Uint16Array([0, 1, 2, 3]);

    const hash = new EdgeSpatialHash({
      cellSize: 0.25,
      padding: 0.05,
    });

    hash.build(positions, edges);

    const candidates = hash.queryEdge(positions, edges, 0);

    const occurrences = candidates.filter((value) => value === 1).length;

    expect(occurrences).toBe(1);
  });

  it("uses padding to include edges within collision thickness", () => {
    const positions = new Float32Array([
      -1, 0, 0, 1, 0, 0,

      -1, 0.04, 0, 1, 0.04, 0,
    ]);

    const edges = new Uint16Array([0, 1, 2, 3]);

    const hash = new EdgeSpatialHash({
      cellSize: 0.02,
      padding: 0.05,
    });

    hash.build(positions, edges);

    const candidates = hash.queryEdge(positions, edges, 0);

    expect(candidates).toContain(1);
  });
});
