import {
  computeDihedralAngle,
  DihedralBendingConstraint,
} from "./DihedralBendingConstraint.js";
import type { ParticleGrid } from "./ParticleGrid.js";

interface PendingEdge {
  edgeA: number;
  edgeB: number;
  opposite: number;
}

export function buildGridDihedralConstraints(
  grid: ParticleGrid,
  stiffness: number,
): DihedralBendingConstraint[] {
  if (stiffness < 0 || stiffness > 1) {
    throw new RangeError(
      "stiffness must be between 0 and 1",
    );
  }

  const constraints: DihedralBendingConstraint[] = [];

  /*
   * Stores an edge the first time we encounter it.
   * When the same edge appears in a second triangle,
   * we have found two adjacent triangles and can
   * create their dihedral constraint.
   */
  const pendingEdges =
    new Map<string, PendingEdge>();

  const addEdge = (
    edgeA: number,
    edgeB: number,
    opposite: number,
  ): void => {
    const minimum =
      Math.min(edgeA, edgeB);

    const maximum =
      Math.max(edgeA, edgeB);

    const key =
      `${minimum}:${maximum}`;

    const existing =
      pendingEdges.get(key);

    if (!existing) {
      pendingEdges.set(key, {
        edgeA,
        edgeB,
        opposite,
      });

      return;
    }

    const restAngle =
      computeDihedralAngle(
        grid.positions,
        existing.opposite,
        opposite,
        existing.edgeA,
        existing.edgeB,
      );

    constraints.push(
      new DihedralBendingConstraint(
        existing.opposite,
        opposite,
        existing.edgeA,
        existing.edgeB,
        restAngle,
        stiffness,
      ),
    );

    /*
     * A regular grid is manifold:
     * at most two triangles share an edge.
     */
    pendingEdges.delete(key);
  };

  const addTriangle = (
    a: number,
    b: number,
    c: number,
  ): void => {
    /*
     * For every triangle edge,
     * the remaining vertex is the opposite one.
     */
    addEdge(a, b, c);
    addEdge(b, c, a);
    addEdge(c, a, b);
  };

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
        grid.getParticleIndex(x, y);

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
       * Same diagonal for every grid cell:
       *
       * topLeft ----- topRight
       *     |       /     |
       *     |     /       |
       *     |   /         |
       * bottomLeft -- bottomRight
       *
       * Triangles:
       *
       * TL - BL - TR
       * TR - BL - BR
       */

      addTriangle(
        topLeft,
        bottomLeft,
        topRight,
      );

      addTriangle(
        topRight,
        bottomLeft,
        bottomRight,
      );
    }
  }

  return constraints;
}