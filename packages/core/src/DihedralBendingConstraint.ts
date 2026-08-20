import type { Constraint } from "./Constraint.js";

const EPSILON = 1e-12;

export class DihedralBendingConstraint implements Constraint {
  readonly oppositeA: number;
  readonly oppositeB: number;

  readonly edgeA: number;
  readonly edgeB: number;

  readonly restAngle: number;
  readonly stiffness: number;

  constructor(
    oppositeA: number,
    oppositeB: number,
    edgeA: number,
    edgeB: number,
    restAngle: number,
    stiffness = 1,
  ) {
    const indices = [oppositeA, oppositeB, edgeA, edgeB];

    if (indices.some((index) => !Number.isInteger(index) || index < 0)) {
      throw new RangeError("particle indices must be non-negative integers");
    }

    if (new Set(indices).size !== 4) {
      throw new Error("dihedral constraint requires four different particles");
    }

    if (restAngle < 0 || restAngle > Math.PI) {
      throw new RangeError("restAngle must be between 0 and PI");
    }

    if (stiffness < 0 || stiffness > 1) {
      throw new RangeError("stiffness must be between 0 and 1");
    }

    this.oppositeA = oppositeA;
    this.oppositeB = oppositeB;

    this.edgeA = edgeA;
    this.edgeB = edgeB;

    this.restAngle = restAngle;
    this.stiffness = stiffness;
  }

  solve(
    positions: Float32Array,
    inverseMasses: Float32Array,
    stiffness = this.stiffness,
  ): void {
    if (stiffness === 0) {
      return;
    }

    const i0 = this.oppositeA;
    const i1 = this.oppositeB;
    const i2 = this.edgeA;
    const i3 = this.edgeB;

    const o0 = i0 * 3;
    const o1 = i1 * 3;
    const o2 = i2 * 3;
    const o3 = i3 * 3;

    const p0x = positions[o0];
    const p0y = positions[o0 + 1];
    const p0z = positions[o0 + 2];

    const p1x = positions[o1];
    const p1y = positions[o1 + 1];
    const p1z = positions[o1 + 2];

    const p2x = positions[o2];
    const p2y = positions[o2 + 1];
    const p2z = positions[o2 + 2];

    const p3x = positions[o3];
    const p3y = positions[o3 + 1];
    const p3z = positions[o3 + 2];

    /*
     * Shared edge:
     *
     * p2 ---------- p3
     *  \            /
     *   p0        p1
     */

    const ex = p3x - p2x;
    const ey = p3y - p2y;
    const ez = p3z - p2z;

    const edgeLengthSquared = ex * ex + ey * ey + ez * ez;

    if (edgeLengthSquared < EPSILON) {
      return;
    }

    const edgeLength = Math.sqrt(edgeLengthSquared);

    const inverseEdgeLength = 1 / edgeLength;

    /*
     * Triangle 1 normal:
     *
     * (p2 - p0) × (p3 - p0)
     */

    const a1x = p2x - p0x;
    const a1y = p2y - p0y;
    const a1z = p2z - p0z;

    const b1x = p3x - p0x;
    const b1y = p3y - p0y;
    const b1z = p3z - p0z;

    const rawN1x = a1y * b1z - a1z * b1y;

    const rawN1y = a1z * b1x - a1x * b1z;

    const rawN1z = a1x * b1y - a1y * b1x;

    /*
     * Triangle 2 normal:
     *
     * (p3 - p1) × (p2 - p1)
     */

    const a2x = p3x - p1x;
    const a2y = p3y - p1y;
    const a2z = p3z - p1z;

    const b2x = p2x - p1x;
    const b2y = p2y - p1y;
    const b2z = p2z - p1z;

    const rawN2x = a2y * b2z - a2z * b2y;

    const rawN2y = a2z * b2x - a2x * b2z;

    const rawN2z = a2x * b2y - a2y * b2x;

    const n1Squared = rawN1x * rawN1x + rawN1y * rawN1y + rawN1z * rawN1z;

    const n2Squared = rawN2x * rawN2x + rawN2y * rawN2y + rawN2z * rawN2z;

    if (n1Squared < EPSILON || n2Squared < EPSILON) {
      return;
    }

    /*
     * Scaled normals used by the
     * dihedral-angle gradients.
     */

    const g1x = rawN1x / n1Squared;

    const g1y = rawN1y / n1Squared;

    const g1z = rawN1z / n1Squared;

    const g2x = rawN2x / n2Squared;

    const g2y = rawN2y / n2Squared;

    const g2z = rawN2z / n2Squared;

    /*
     * Gradients for the four particles.
     */

    const d0x = edgeLength * g1x;

    const d0y = edgeLength * g1y;

    const d0z = edgeLength * g1z;

    const d1x = edgeLength * g2x;

    const d1y = edgeLength * g2y;

    const d1z = edgeLength * g2z;

    const p0p3DotEdge =
      ((p0x - p3x) * ex + (p0y - p3y) * ey + (p0z - p3z) * ez) *
      inverseEdgeLength;

    const p1p3DotEdge =
      ((p1x - p3x) * ex + (p1y - p3y) * ey + (p1z - p3z) * ez) *
      inverseEdgeLength;

    const d2x = p0p3DotEdge * g1x + p1p3DotEdge * g2x;

    const d2y = p0p3DotEdge * g1y + p1p3DotEdge * g2y;

    const d2z = p0p3DotEdge * g1z + p1p3DotEdge * g2z;

    const p2p0DotEdge =
      ((p2x - p0x) * ex + (p2y - p0y) * ey + (p2z - p0z) * ez) *
      inverseEdgeLength;

    const p2p1DotEdge =
      ((p2x - p1x) * ex + (p2y - p1y) * ey + (p2z - p1z) * ez) *
      inverseEdgeLength;

    const d3x = p2p0DotEdge * g1x + p2p1DotEdge * g2x;

    const d3y = p2p0DotEdge * g1y + p2p1DotEdge * g2y;

    const d3z = p2p0DotEdge * g1z + p2p1DotEdge * g2z;

    /*
     * Unit normals → current dihedral angle.
     */

    const n1Length = Math.sqrt(n1Squared);

    const n2Length = Math.sqrt(n2Squared);

    const n1x = rawN1x / n1Length;

    const n1y = rawN1y / n1Length;

    const n1z = rawN1z / n1Length;

    const n2x = rawN2x / n2Length;

    const n2y = rawN2y / n2Length;

    const n2z = rawN2z / n2Length;

    const dot = clamp(n1x * n2x + n1y * n2y + n1z * n2z, -1, 1);

    const angle = Math.acos(dot);

    const w0 = inverseMasses[i0];

    const w1 = inverseMasses[i1];

    const w2 = inverseMasses[i2];

    const w3 = inverseMasses[i3];

    const denominator =
      w0 * (d0x * d0x + d0y * d0y + d0z * d0z) +
      w1 * (d1x * d1x + d1y * d1y + d1z * d1z) +
      w2 * (d2x * d2x + d2y * d2y + d2z * d2z) +
      w3 * (d3x * d3x + d3y * d3y + d3z * d3z);

    if (denominator < EPSILON) {
      return;
    }

    let lambda = ((angle - this.restAngle) / denominator) * stiffness;

    /*
     * Preserve bending direction.
     */
    const crossX = n1y * n2z - n1z * n2y;

    const crossY = n1z * n2x - n1x * n2z;

    const crossZ = n1x * n2y - n1y * n2x;

    if (crossX * ex + crossY * ey + crossZ * ez > 0) {
      lambda = -lambda;
    }

    positions[o0] -= w0 * lambda * d0x;

    positions[o0 + 1] -= w0 * lambda * d0y;

    positions[o0 + 2] -= w0 * lambda * d0z;

    positions[o1] -= w1 * lambda * d1x;

    positions[o1 + 1] -= w1 * lambda * d1y;

    positions[o1 + 2] -= w1 * lambda * d1z;

    positions[o2] -= w2 * lambda * d2x;

    positions[o2 + 1] -= w2 * lambda * d2y;

    positions[o2 + 2] -= w2 * lambda * d2z;

    positions[o3] -= w3 * lambda * d3x;

    positions[o3 + 1] -= w3 * lambda * d3y;

    positions[o3 + 2] -= w3 * lambda * d3z;
  }
}

export function computeDihedralAngle(
  positions: Float32Array,
  oppositeA: number,
  oppositeB: number,
  edgeA: number,
  edgeB: number,
): number {
  const o0 = oppositeA * 3;
  const o1 = oppositeB * 3;
  const o2 = edgeA * 3;
  const o3 = edgeB * 3;

  const p0x = positions[o0];
  const p0y = positions[o0 + 1];
  const p0z = positions[o0 + 2];

  const p1x = positions[o1];
  const p1y = positions[o1 + 1];
  const p1z = positions[o1 + 2];

  const p2x = positions[o2];
  const p2y = positions[o2 + 1];
  const p2z = positions[o2 + 2];

  const p3x = positions[o3];
  const p3y = positions[o3 + 1];
  const p3z = positions[o3 + 2];

  const a1x = p2x - p0x;
  const a1y = p2y - p0y;
  const a1z = p2z - p0z;

  const b1x = p3x - p0x;
  const b1y = p3y - p0y;
  const b1z = p3z - p0z;

  const n1x = a1y * b1z - a1z * b1y;

  const n1y = a1z * b1x - a1x * b1z;

  const n1z = a1x * b1y - a1y * b1x;

  const a2x = p3x - p1x;
  const a2y = p3y - p1y;
  const a2z = p3z - p1z;

  const b2x = p2x - p1x;
  const b2y = p2y - p1y;
  const b2z = p2z - p1z;

  const n2x = a2y * b2z - a2z * b2y;

  const n2y = a2z * b2x - a2x * b2z;

  const n2z = a2x * b2y - a2y * b2x;

  const length1 = Math.sqrt(n1x * n1x + n1y * n1y + n1z * n1z);

  const length2 = Math.sqrt(n2x * n2x + n2y * n2y + n2z * n2z);

  if (length1 < EPSILON || length2 < EPSILON) {
    return 0;
  }

  return Math.acos(
    clamp((n1x * n2x + n1y * n2y + n1z * n2z) / (length1 * length2), -1, 1),
  );
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
