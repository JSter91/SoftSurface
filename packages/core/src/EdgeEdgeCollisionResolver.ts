import type { SegmentSegmentResult } from "./SegmentSegmentDistance.js";

const NORMAL_EPSILON_SQUARED = 1e-12;
const MASS_EPSILON = 1e-12;

/**
 * Projects two edges apart until their closest points
 * are separated by at least `thickness`.
 *
 * Correction is distributed across the four endpoints
 * according to inverse mass and the segment parameters
 * of the closest points.
 *
 * The same correction is applied to previousPositions
 * so the projection does not inject Verlet velocity.
 */
export function resolveEdgeEdgeCollision(
  positions: Float32Array,
  previousPositions: Float32Array,
  inverseMasses: Float32Array,

  a0: number,
  a1: number,

  b0: number,
  b1: number,

  thickness: number,

  contact: SegmentSegmentResult,
): boolean {
  if (thickness <= 0) {
    return false;
  }

  const distanceSquared = contact.distanceSquared;

  if (
    !Number.isFinite(distanceSquared) ||
    distanceSquared >= thickness * thickness
  ) {
    return false;
  }

  const a0Offset = a0 * 3;
  const a1Offset = a1 * 3;

  const b0Offset = b0 * 3;
  const b1Offset = b1 * 3;

  let nx = contact.closestAX - contact.closestBX;

  let ny = contact.closestAY - contact.closestBY;

  let nz = contact.closestAZ - contact.closestBZ;

  let normalLengthSquared = nx * nx + ny * ny + nz * nz;

  let distance: number;

  if (normalLengthSquared > NORMAL_EPSILON_SQUARED) {
    distance = Math.sqrt(normalLengthSquared);

    const inverseDistance = 1 / distance;

    nx *= inverseDistance;
    ny *= inverseDistance;
    nz *= inverseDistance;
  } else {
    /**
     * Exact edge intersection.
     *
     * The closest-point direction is undefined, so use
     * the cross product of the two edge directions as a
     * deterministic separating normal.
     */
    const aX = positions[a1Offset] - positions[a0Offset];

    const aY = positions[a1Offset + 1] - positions[a0Offset + 1];

    const aZ = positions[a1Offset + 2] - positions[a0Offset + 2];

    const bX = positions[b1Offset] - positions[b0Offset];

    const bY = positions[b1Offset + 1] - positions[b0Offset + 1];

    const bZ = positions[b1Offset + 2] - positions[b0Offset + 2];

    nx = aY * bZ - aZ * bY;

    ny = aZ * bX - aX * bZ;

    nz = aX * bY - aY * bX;

    normalLengthSquared = nx * nx + ny * ny + nz * nz;

    /**
     * Parallel/coincident degenerate case.
     *
     * There is no unique geometric separating normal.
     * Leave it unresolved for now rather than applying
     * an arbitrary unstable correction.
     */
    if (normalLengthSquared <= NORMAL_EPSILON_SQUARED) {
      return false;
    }

    const inverseNormalLength = 1 / Math.sqrt(normalLengthSquared);

    nx *= inverseNormalLength;
    ny *= inverseNormalLength;
    nz *= inverseNormalLength;

    distance = 0;
  }

  const parameterA = contact.parameterA;

  const parameterB = contact.parameterB;

  const a0Factor = 1 - parameterA;

  const a1Factor = parameterA;

  const b0Factor = 1 - parameterB;

  const b1Factor = parameterB;

  const a0Weight = inverseMasses[a0];

  const a1Weight = inverseMasses[a1];

  const b0Weight = inverseMasses[b0];

  const b1Weight = inverseMasses[b1];

  /**
   * PBD denominator.
   *
   * Closest point A:
   * (1-s) A0 + s A1
   *
   * Closest point B:
   * (1-t) B0 + t B1
   */
  const denominator =
    a0Weight * a0Factor * a0Factor +
    a1Weight * a1Factor * a1Factor +
    b0Weight * b0Factor * b0Factor +
    b1Weight * b1Factor * b1Factor;

  if (denominator <= MASS_EPSILON) {
    return false;
  }

  const penetration = thickness - distance;

  if (penetration <= 0) {
    return false;
  }

  const correctionScale = penetration / denominator;

  /**
   * Edge A moves along +normal.
   * Edge B moves along -normal.
   */
  applyCorrection(
    positions,
    previousPositions,
    a0Offset,
    nx * a0Weight * a0Factor * correctionScale,
    ny * a0Weight * a0Factor * correctionScale,
    nz * a0Weight * a0Factor * correctionScale,
  );

  applyCorrection(
    positions,
    previousPositions,
    a1Offset,
    nx * a1Weight * a1Factor * correctionScale,
    ny * a1Weight * a1Factor * correctionScale,
    nz * a1Weight * a1Factor * correctionScale,
  );

  applyCorrection(
    positions,
    previousPositions,
    b0Offset,
    -nx * b0Weight * b0Factor * correctionScale,
    -ny * b0Weight * b0Factor * correctionScale,
    -nz * b0Weight * b0Factor * correctionScale,
  );

  applyCorrection(
    positions,
    previousPositions,
    b1Offset,
    -nx * b1Weight * b1Factor * correctionScale,
    -ny * b1Weight * b1Factor * correctionScale,
    -nz * b1Weight * b1Factor * correctionScale,
  );

  return true;
}

function applyCorrection(
  positions: Float32Array,
  previousPositions: Float32Array,

  offset: number,

  dx: number,
  dy: number,
  dz: number,
): void {
  positions[offset] += dx;
  positions[offset + 1] += dy;
  positions[offset + 2] += dz;

  previousPositions[offset] += dx;
  previousPositions[offset + 1] += dy;
  previousPositions[offset + 2] += dz;
}
