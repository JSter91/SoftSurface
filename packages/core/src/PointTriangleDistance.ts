export interface PointTriangleResult {
  distanceSquared: number;

  closestX: number;
  closestY: number;
  closestZ: number;

  barycentricA: number;
  barycentricB: number;
  barycentricC: number;
}

export function pointTriangleDistanceSquared(
  px: number,
  py: number,
  pz: number,

  ax: number,
  ay: number,
  az: number,

  bx: number,
  by: number,
  bz: number,

  cx: number,
  cy: number,
  cz: number,

  result: PointTriangleResult,
): void {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;

  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;

  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;

  const d1 =
    abx * apx +
    aby * apy +
    abz * apz;

  const d2 =
    acx * apx +
    acy * apy +
    acz * apz;

  /**
   * Vertex region A
   */
  if (
    d1 <= 0 &&
    d2 <= 0
  ) {
    setResult(
      result,
      px,
      py,
      pz,
      ax,
      ay,
      az,
      1,
      0,
      0,
    );

    return;
  }

  const bpx = px - bx;
  const bpy = py - by;
  const bpz = pz - bz;

  const d3 =
    abx * bpx +
    aby * bpy +
    abz * bpz;

  const d4 =
    acx * bpx +
    acy * bpy +
    acz * bpz;

  /**
   * Vertex region B
   */
  if (
    d3 >= 0 &&
    d4 <= d3
  ) {
    setResult(
      result,
      px,
      py,
      pz,
      bx,
      by,
      bz,
      0,
      1,
      0,
    );

    return;
  }

  /**
   * Edge region AB
   */
  const vc =
    d1 * d4 -
    d3 * d2;

  if (
    vc <= 0 &&
    d1 >= 0 &&
    d3 <= 0
  ) {
    const v =
      d1 /
      (d1 - d3);

    const closestX =
      ax + v * abx;

    const closestY =
      ay + v * aby;

    const closestZ =
      az + v * abz;

    setResult(
      result,
      px,
      py,
      pz,
      closestX,
      closestY,
      closestZ,
      1 - v,
      v,
      0,
    );

    return;
  }

  const cpx = px - cx;
  const cpy = py - cy;
  const cpz = pz - cz;

  const d5 =
    abx * cpx +
    aby * cpy +
    abz * cpz;

  const d6 =
    acx * cpx +
    acy * cpy +
    acz * cpz;

  /**
   * Vertex region C
   */
  if (
    d6 >= 0 &&
    d5 <= d6
  ) {
    setResult(
      result,
      px,
      py,
      pz,
      cx,
      cy,
      cz,
      0,
      0,
      1,
    );

    return;
  }

  /**
   * Edge region AC
   */
  const vb =
    d5 * d2 -
    d1 * d6;

  if (
    vb <= 0 &&
    d2 >= 0 &&
    d6 <= 0
  ) {
    const w =
      d2 /
      (d2 - d6);

    const closestX =
      ax + w * acx;

    const closestY =
      ay + w * acy;

    const closestZ =
      az + w * acz;

    setResult(
      result,
      px,
      py,
      pz,
      closestX,
      closestY,
      closestZ,
      1 - w,
      0,
      w,
    );

    return;
  }

  /**
   * Edge region BC
   */
  const va =
    d3 * d6 -
    d5 * d4;

  if (
    va <= 0 &&
    d4 - d3 >= 0 &&
    d5 - d6 >= 0
  ) {
    const w =
      (d4 - d3) /
      (
        (d4 - d3) +
        (d5 - d6)
      );

    const bcx =
      cx - bx;

    const bcy =
      cy - by;

    const bcz =
      cz - bz;

    const closestX =
      bx + w * bcx;

    const closestY =
      by + w * bcy;

    const closestZ =
      bz + w * bcz;

    setResult(
      result,
      px,
      py,
      pz,
      closestX,
      closestY,
      closestZ,
      0,
      1 - w,
      w,
    );

    return;
  }

  /**
   * Face region
   */
  const denominator =
    1 /
    (va + vb + vc);

  const v =
    vb * denominator;

  const w =
    vc * denominator;

  const u =
    1 - v - w;

  const closestX =
    ax * u +
    bx * v +
    cx * w;

  const closestY =
    ay * u +
    by * v +
    cy * w;

  const closestZ =
    az * u +
    bz * v +
    cz * w;

  setResult(
    result,
    px,
    py,
    pz,
    closestX,
    closestY,
    closestZ,
    u,
    v,
    w,
  );
}

function setResult(
  result: PointTriangleResult,

  px: number,
  py: number,
  pz: number,

  closestX: number,
  closestY: number,
  closestZ: number,

  barycentricA: number,
  barycentricB: number,
  barycentricC: number,
): void {
  const dx =
    px - closestX;

  const dy =
    py - closestY;

  const dz =
    pz - closestZ;

  result.distanceSquared =
    dx * dx +
    dy * dy +
    dz * dz;

  result.closestX =
    closestX;

  result.closestY =
    closestY;

  result.closestZ =
    closestZ;

  result.barycentricA =
    barycentricA;

  result.barycentricB =
    barycentricB;

  result.barycentricC =
    barycentricC;
}