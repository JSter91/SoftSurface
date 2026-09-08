const SEGMENT_EPSILON = 1e-12;

export interface SegmentSegmentResult {
  distanceSquared: number;

  closestAX: number;
  closestAY: number;
  closestAZ: number;

  closestBX: number;
  closestBY: number;
  closestBZ: number;

  /**
   * Parametric position on segment A:
   *
   * P(s) = A0 + s * (A1 - A0)
   *
   * where s is clamped to [0, 1].
   */
  parameterA: number;

  /**
   * Parametric position on segment B:
   *
   * Q(t) = B0 + t * (B1 - B0)
   *
   * where t is clamped to [0, 1].
   */
  parameterB: number;
}

/**
 * Computes the squared minimum distance between two
 * finite 3D segments.
 *
 * No allocations are performed. Results are written into
 * the caller-provided result object.
 */
export function segmentSegmentDistanceSquared(
  a0x: number,
  a0y: number,
  a0z: number,

  a1x: number,
  a1y: number,
  a1z: number,

  b0x: number,
  b0y: number,
  b0z: number,

  b1x: number,
  b1y: number,
  b1z: number,

  result: SegmentSegmentResult,
): void {
  const dAx = a1x - a0x;

  const dAy = a1y - a0y;

  const dAz = a1z - a0z;

  const dBx = b1x - b0x;

  const dBy = b1y - b0y;

  const dBz = b1z - b0z;

  const rx = a0x - b0x;

  const ry = a0y - b0y;

  const rz = a0z - b0z;

  const a = dAx * dAx + dAy * dAy + dAz * dAz;

  const e = dBx * dBx + dBy * dBy + dBz * dBz;

  const f = dBx * rx + dBy * ry + dBz * rz;

  let s: number;
  let t: number;

  /**
   * Both segments degenerate into points.
   */
  if (a <= SEGMENT_EPSILON && e <= SEGMENT_EPSILON) {
    s = 0;
    t = 0;
  } else if (a <= SEGMENT_EPSILON) {
    /**
     * Segment A degenerates into a point.
     */
    s = 0;

    t = clamp01(f / e);
  } else {
    const c = dAx * rx + dAy * ry + dAz * rz;

    if (e <= SEGMENT_EPSILON) {
      /**
       * Segment B degenerates into a point.
       */
      t = 0;

      s = clamp01(-c / a);
    } else {
      const b = dAx * dBx + dAy * dBy + dAz * dBz;

      const denominator = a * e - b * b;

      /**
       * Non-parallel segments have one unconstrained
       * closest pair on their supporting lines.
       *
       * Parallel segments use s = 0 as a deterministic
       * starting point before endpoint clamping below.
       */
      if (denominator > SEGMENT_EPSILON * a * e) {
        s = clamp01((b * f - c * e) / denominator);
      } else {
        s = 0;
      }

      t = (b * s + f) / e;

      /**
       * If t lies outside segment B, clamp B first and
       * recompute the closest position on segment A.
       */
      if (t < 0) {
        t = 0;

        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;

        s = clamp01((b - c) / a);
      }
    }
  }

  const closestAX = a0x + dAx * s;

  const closestAY = a0y + dAy * s;

  const closestAZ = a0z + dAz * s;

  const closestBX = b0x + dBx * t;

  const closestBY = b0y + dBy * t;

  const closestBZ = b0z + dBz * t;

  const dx = closestAX - closestBX;

  const dy = closestAY - closestBY;

  const dz = closestAZ - closestBZ;

  result.distanceSquared = dx * dx + dy * dy + dz * dz;

  result.closestAX = closestAX;

  result.closestAY = closestAY;

  result.closestAZ = closestAZ;

  result.closestBX = closestBX;

  result.closestBY = closestBY;

  result.closestBZ = closestBZ;

  result.parameterA = s;

  result.parameterB = t;
}

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}
