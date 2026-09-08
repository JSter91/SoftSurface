import type { PointTriangleResult } from "./PointTriangleDistance.js";

const NORMAL_EPSILON_SQUARED = 1e-12;
const MASS_EPSILON = 1e-12;
const SIDE_EPSILON = 1e-6;

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

  const distanceSquared = contact.distanceSquared;

  if (
    !Number.isFinite(distanceSquared) ||
    distanceSquared >= thickness * thickness
  ) {
    return false;
  }

  const particleOffset = particle * 3;

  const aOffset = a * 3;
  const bOffset = b * 3;
  const cOffset = c * 3;

  const px = positions[particleOffset];

  const py = positions[particleOffset + 1];

  const pz = positions[particleOffset + 2];

  let nx = px - contact.closestX;

  let ny = py - contact.closestY;

  let nz = pz - contact.closestZ;

  let normalLengthSquared = nx * nx + ny * ny + nz * nz;

  let distance: number;

  let crossedPlane = false;

  /**
   * Normally the contact normal points from the closest
   * point on the triangle toward the particle.
   *
   * At zero distance that direction is undefined, so use
   * the triangle geometric normal as a deterministic
   * fallback.
   */
  if (normalLengthSquared > NORMAL_EPSILON_SQUARED) {
    distance = Math.sqrt(normalLengthSquared);

    const inverseDistance = 1 / distance;

    nx *= inverseDistance;
    ny *= inverseDistance;
    nz *= inverseDistance;
  } else {
    const abX = positions[bOffset] - positions[aOffset];

    const abY = positions[bOffset + 1] - positions[aOffset + 1];

    const abZ = positions[bOffset + 2] - positions[aOffset + 2];

    const acX = positions[cOffset] - positions[aOffset];

    const acY = positions[cOffset + 1] - positions[aOffset + 1];

    const acZ = positions[cOffset + 2] - positions[aOffset + 2];

    nx = abY * acZ - abZ * acY;

    ny = abZ * acX - abX * acZ;

    nz = abX * acY - abY * acX;

    normalLengthSquared = nx * nx + ny * ny + nz * nz;

    /**
     * A degenerate triangle has no usable normal.
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

  /**
   * Preserve collision sidedness across a discrete
   * triangle-plane crossing.
   *
   * The ordinary closest-point normal is correct while
   * the particle remains on the same side of the surface.
   *
   * Once the particle crosses the triangle plane, however,
   * that normal points toward the new (wrong) side and the
   * collision response would reinforce the crossing.
   *
   * Compare the signed particle/triangle distance between
   * previous and current states. If the sign changed,
   * restore the particle toward its previous side.
   */

  // Previous triangle normal.
  const previousAbX = previousPositions[bOffset] - previousPositions[aOffset];

  const previousAbY =
    previousPositions[bOffset + 1] - previousPositions[aOffset + 1];

  const previousAbZ =
    previousPositions[bOffset + 2] - previousPositions[aOffset + 2];

  const previousAcX = previousPositions[cOffset] - previousPositions[aOffset];

  const previousAcY =
    previousPositions[cOffset + 1] - previousPositions[aOffset + 1];

  const previousAcZ =
    previousPositions[cOffset + 2] - previousPositions[aOffset + 2];

  const previousNormalX = previousAbY * previousAcZ - previousAbZ * previousAcY;

  const previousNormalY = previousAbZ * previousAcX - previousAbX * previousAcZ;

  const previousNormalZ = previousAbX * previousAcY - previousAbY * previousAcX;

  const previousNormalLengthSquared =
    previousNormalX * previousNormalX +
    previousNormalY * previousNormalY +
    previousNormalZ * previousNormalZ;

  // Current triangle normal.
  const currentAbX = positions[bOffset] - positions[aOffset];

  const currentAbY = positions[bOffset + 1] - positions[aOffset + 1];

  const currentAbZ = positions[bOffset + 2] - positions[aOffset + 2];

  const currentAcX = positions[cOffset] - positions[aOffset];

  const currentAcY = positions[cOffset + 1] - positions[aOffset + 1];

  const currentAcZ = positions[cOffset + 2] - positions[aOffset + 2];

  let currentNormalX = currentAbY * currentAcZ - currentAbZ * currentAcY;

  let currentNormalY = currentAbZ * currentAcX - currentAbX * currentAcZ;

  let currentNormalZ = currentAbX * currentAcY - currentAbY * currentAcX;

  const currentNormalLengthSquared =
    currentNormalX * currentNormalX +
    currentNormalY * currentNormalY +
    currentNormalZ * currentNormalZ;

  if (
    previousNormalLengthSquared > NORMAL_EPSILON_SQUARED &&
    currentNormalLengthSquared > NORMAL_EPSILON_SQUARED
  ) {
    /**
     * Keep current triangle orientation consistent
     * with the previous triangle orientation.
     */
    const normalAlignment =
      previousNormalX * currentNormalX +
      previousNormalY * currentNormalY +
      previousNormalZ * currentNormalZ;

    if (normalAlignment < 0) {
      currentNormalX = -currentNormalX;
      currentNormalY = -currentNormalY;
      currentNormalZ = -currentNormalZ;
    }

    const inversePreviousNormalLength =
      1 / Math.sqrt(previousNormalLengthSquared);

    const inverseCurrentNormalLength =
      1 / Math.sqrt(currentNormalLengthSquared);

    const previousParticleX = previousPositions[particleOffset];

    const previousParticleY = previousPositions[particleOffset + 1];

    const previousParticleZ = previousPositions[particleOffset + 2];

    const previousSignedDistance =
      ((previousParticleX - previousPositions[aOffset]) * previousNormalX +
        (previousParticleY - previousPositions[aOffset + 1]) * previousNormalY +
        (previousParticleZ - previousPositions[aOffset + 2]) *
          previousNormalZ) *
      inversePreviousNormalLength;

    const currentSignedDistance =
      ((px - positions[aOffset]) * currentNormalX +
        (py - positions[aOffset + 1]) * currentNormalY +
        (pz - positions[aOffset + 2]) * currentNormalZ) *
      inverseCurrentNormalLength;

    crossedPlane =
      (previousSignedDistance > SIDE_EPSILON &&
        currentSignedDistance < -SIDE_EPSILON) ||
      (previousSignedDistance < -SIDE_EPSILON &&
        currentSignedDistance > SIDE_EPSILON);

    if (crossedPlane) {
      /**
       * Restore the direction associated with the
       * previous side of the triangle.
       */
      const previousSide = previousSignedDistance > 0 ? 1 : -1;

      nx = currentNormalX * inverseCurrentNormalLength * previousSide;

      ny = currentNormalY * inverseCurrentNormalLength * previousSide;

      nz = currentNormalZ * inverseCurrentNormalLength * previousSide;
    }
  }

  const barycentricA = contact.barycentricA;

  const barycentricB = contact.barycentricB;

  const barycentricC = contact.barycentricC;

  const particleWeight = inverseMasses[particle];

  const aWeight = inverseMasses[a];

  const bWeight = inverseMasses[b];

  const cWeight = inverseMasses[c];

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
    aWeight * barycentricA * barycentricA +
    bWeight * barycentricB * barycentricB +
    cWeight * barycentricC * barycentricC;

  if (denominator <= MASS_EPSILON) {
    return false;
  }

  const penetration = crossedPlane
    ? thickness + distance
    : thickness - distance;   
  if (penetration <= 0) {
    return false;
  }

  const correctionScale = penetration / denominator;

  const particleScale = particleWeight * correctionScale;

  const aScale = -aWeight * barycentricA * correctionScale;

  const bScale = -bWeight * barycentricB * correctionScale;

  const cScale = -cWeight * barycentricC * correctionScale;

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
