import type { ParticleGrid } from "./ParticleGrid.js";

export type TriangleIndices =
  | Uint16Array
  | Uint32Array;

export function createGridTriangleIndices(
  grid: ParticleGrid,
): TriangleIndices {
  const triangleCount =
    grid.segmentsX *
    grid.segmentsY *
    2;

  const indexCount =
    triangleCount * 3;

  const IndexArray =
    grid.particleCount > 65535
      ? Uint32Array
      : Uint16Array;

  const indices =
    new IndexArray(indexCount);

  let offset = 0;

  for (
    let y = 0;
    y < grid.rows - 1;
    y++
  ) {
    for (
      let x = 0;
      x < grid.columns - 1;
      x++
    ) {
      const topLeft =
        grid.getParticleIndex(
          x,
          y,
        );

      const topRight =
        grid.getParticleIndex(
          x + 1,
          y,
        );

      const bottomLeft =
        grid.getParticleIndex(
          x,
          y + 1,
        );

      const bottomRight =
        grid.getParticleIndex(
          x + 1,
          y + 1,
        );

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

      indices[offset++] =
        topLeft;

      indices[offset++] =
        bottomLeft;

      indices[offset++] =
        topRight;

      indices[offset++] =
        topRight;

      indices[offset++] =
        bottomLeft;

      indices[offset++] =
        bottomRight;
    }
  }

  return indices;
}