import type { ParticleGrid } from "./ParticleGrid.js";

export type TriangleIndices = Uint16Array | Uint32Array;

export type EdgeIndices = Uint16Array | Uint32Array;

export function createGridTriangleIndices(grid: ParticleGrid): TriangleIndices {
  const triangleCount = grid.segmentsX * grid.segmentsY * 2;

  const indexCount = triangleCount * 3;

  const IndexArray = grid.particleCount > 65535 ? Uint32Array : Uint16Array;

  const indices = new IndexArray(indexCount);

  let offset = 0;

  for (let y = 0; y < grid.rows - 1; y++) {
    for (let x = 0; x < grid.columns - 1; x++) {
      const topLeft = grid.getParticleIndex(x, y);

      const topRight = grid.getParticleIndex(x + 1, y);

      const bottomLeft = grid.getParticleIndex(x, y + 1);

      const bottomRight = grid.getParticleIndex(x + 1, y + 1);

      /*
       * Same triangulation currently used
       * by the grid/dihedral model:
       *
       * TL ----- TR
       * |      / |
       * |    /   |
       * |  /     |
       * BL ----- BR
       *
       * TL, BL, TR
       * TR, BL, BR
       */

      indices[offset++] = topLeft;

      indices[offset++] = bottomLeft;

      indices[offset++] = topRight;

      indices[offset++] = topRight;

      indices[offset++] = bottomLeft;

      indices[offset++] = bottomRight;
    }
  }

  return indices;
}

/**
 * Builds the unique undirected edge set represented by
 * a triangle index buffer.
 *
 * Every edge is stored canonically as:
 *
 * [minVertexIndex, maxVertexIndex]
 *
 * so triangle edges (a, b) and (b, a) map to the same
 * topological edge.
 *
 * This function runs when collision topology is created,
 * not in the per-frame hot path.
 */
export function createUniqueEdgeIndices(
  triangles: TriangleIndices,
): EdgeIndices {
  const edgeKeys = new Set<number>();

  let maxVertexIndex = 0;

  for (let i = 0; i < triangles.length; i++) {
    if (triangles[i] > maxVertexIndex) {
      maxVertexIndex = triangles[i];
    }
  }

  const vertexStride = maxVertexIndex + 1;

  for (let i = 0; i < triangles.length; i += 3) {
    const a = triangles[i];
    const b = triangles[i + 1];
    const c = triangles[i + 2];

    addEdgeKey(edgeKeys, a, b, vertexStride);

    addEdgeKey(edgeKeys, b, c, vertexStride);

    addEdgeKey(edgeKeys, c, a, vertexStride);
  }

  const IndexArray =
    triangles instanceof Uint32Array ? Uint32Array : Uint16Array;

  const edges = new IndexArray(edgeKeys.size * 2);

  let offset = 0;

  for (const key of edgeKeys) {
    const a = Math.floor(key / vertexStride);

    const b = key - a * vertexStride;

    edges[offset++] = a;
    edges[offset++] = b;
  }

  return edges;
}

function addEdgeKey(
  edgeKeys: Set<number>,

  a: number,
  b: number,

  vertexStride: number,
): void {
  /**
   * Ignore degenerate zero-length topology edges.
   */
  if (a === b) {
    return;
  }

  const min = a < b ? a : b;

  const max = a < b ? b : a;

  edgeKeys.add(min * vertexStride + max);
}
