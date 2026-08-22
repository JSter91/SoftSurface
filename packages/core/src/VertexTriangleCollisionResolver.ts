import type {
  PointTriangleResult,
} from "./PointTriangleDistance.js";

const NORMAL_EPSILON_SQUARED = 1e-12;
const MASS_EPSILON = 1e-12;

/**
 * Projects a vertex-triangle contact so that the vertex
 * and triangle are separated by at least `thickness`.
 *
 * The positional correction is distributed across the
 * particle and triangle vertices according to:
 *
 * - inverse mass
 * - barycentric contribution at the contact point
 *
 * The same correction is applied to previousPositions
 * so the projection itself does not inject artificial
 * Verlet velocity.
 *
 * Returns true when a correction was applied.
 */
export function resolveVertexTriangleCollision(
  positions: Float32Array,
  previousPositions: Float32Array,
  inverseMasses: Float32Array,

  particle: number,

  a: number,
  b: number,
  c: number,

  thickness: number,

  contact: PointTriangleResult,
): boolean {
  if (thickness <= 0) {
    return false;
  }

  const distanceSquared =
    contact.distanceSquared;

  if (
    !Number.isFinite(distanceSquared) ||
    distanceSquared >= thickness * thickness
  ) {
    return false;
  }

  const particleOffset =
    particle * 3;

  const aOffset = a * 3;
  const bOffset = b * 3;
  const cOffset = c * 3;

  const px =
    positions[particleOffset];

  const py =
    positions[particleOffset + 1];

  const pz =
    positions[particleOffset + 2];

  let nx =
    px - contact.closestX;

  let ny =
    py - contact.closestY;

  let nz =
    pz - contact.closestZ;

  let normalLengthSquared =
    nx * nx +
    ny * ny +
    nz * nz;

  let distance: number;

  /**
   * Normally the contact normal points from the closest
   * point on the triangle toward the particle.
   *
   * At zero distance that direction is undefined, so use
   * the triangle geometric normal as a deterministic
   * fallback.
   */
  if (
    normalLengthSquared >
    NORMAL_EPSILON_SQUARED
  ) {
    distance =
      Math.sqrt(
        normalLengthSquared,
      );

    const inverseDistance =
      1 / distance;

    nx *= inverseDistance;
    ny *= inverseDistance;
    nz *= inverseDistance;
  } else {
    const abX =
      positions[bOffset] -
      positions[aOffset];

    const abY =
      positions[bOffset + 1] -
      positions[aOffset + 1];

    const abZ =
      positions[bOffset + 2] -
      positions[aOffset + 2];

    const acX =
      positions[cOffset] -
      positions[aOffset];

    const acY =
      positions[cOffset + 1] -
      positions[aOffset + 1];

    const acZ =
      positions[cOffset + 2] -
      positions[aOffset + 2];

    nx =
      abY * acZ -
      abZ * acY;

    ny =
      abZ * acX -
      abX * acZ;

    nz =
      abX * acY -
      abY * acX;

    normalLengthSquared =
      nx * nx +
      ny * ny +
      nz * nz;

    /**
     * A degenerate triangle has no usable normal.
     */
    if (
      normalLengthSquared <=
      NORMAL_EPSILON_SQUARED
    ) {
      return false;
    }

    const inverseNormalLength =
      1 /
      Math.sqrt(
        normalLengthSquared,
      );

    nx *= inverseNormalLength;
    ny *= inverseNormalLength;
    nz *= inverseNormalLength;

    distance = 0;
  }

  const barycentricA =
    contact.barycentricA;

  const barycentricB =
    contact.barycentricB;

  const barycentricC =
    contact.barycentricC;

  const particleWeight =
    inverseMasses[particle];

  const aWeight =
    inverseMasses[a];

  const bWeight =
    inverseMasses[b];

  const cWeight =
    inverseMasses[c];

  /**
   * PBD denominator:
   *
   * wP
   * + wA * alpha²
   * + wB * beta²
   * + wC * gamma²
   */
  const denominator =
    particleWeight +
    aWeight *
      barycentricA *
      barycentricA +
    bWeight *
      barycentricB *
      barycentricB +
    cWeight *
      barycentricC *
      barycentricC;

  if (
    denominator <=
    MASS_EPSILON
  ) {
    return false;
  }

  const penetration =
    thickness - distance;

  if (penetration <= 0) {
    return false;
  }

  const correctionScale =
    penetration / denominator;

  const particleScale =
    particleWeight *
    correctionScale;

  const aScale =
    -aWeight *
    barycentricA *
    correctionScale;

  const bScale =
    -bWeight *
    barycentricB *
    correctionScale;

  const cScale =
    -cWeight *
    barycentricC *
    correctionScale;

  applyCorrection(
    positions,
    previousPositions,
    particleOffset,
    nx * particleScale,
    ny * particleScale,
    nz * particleScale,
  );

  applyCorrection(
    positions,
    previousPositions,
    aOffset,
    nx * aScale,
    ny * aScale,
    nz * aScale,
  );

  applyCorrection(
    positions,
    previousPositions,
    bOffset,
    nx * bScale,
    ny * bScale,
    nz * bScale,
  );

  applyCorrection(
    positions,
    previousPositions,
    cOffset,
    nx * cScale,
    ny * cScale,
    nz * cScale,
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