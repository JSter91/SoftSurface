export interface TriangleSpatialHashOptions {
  cellSize: number;
  padding?: number;
}

type TriangleIndexArray =
  | Uint16Array
  | Uint32Array
  | readonly number[];

export class TriangleSpatialHash {
  private readonly cellSize: number;
  private readonly padding: number;

  private readonly buckets =
    new Map<number, number[]>();

  private readonly activeBuckets:
    number[][] = [];

  private readonly bucketPool:
    number[][] = [];

  /**
   * Six values per triangle:
   *
   * 0 = minX
   * 1 = minY
   * 2 = minZ
   * 3 = maxX
   * 4 = maxY
   * 5 = maxZ
   *
   * Bounds already include padding.
   */
  private triangleBounds =
    new Float32Array(0);

  constructor(
    options: TriangleSpatialHashOptions,
  ) {
    const {
      cellSize,
      padding = 0,
    } = options;

    if (cellSize <= 0) {
      throw new RangeError(
        "cellSize must be greater than 0",
      );
    }

    if (padding < 0) {
      throw new RangeError(
        "padding must be non-negative",
      );
    }

    this.cellSize = cellSize;
    this.padding = padding;
  }

  build(
    positions: Float32Array,
    triangles: TriangleIndexArray,
  ): void {
    if (triangles.length % 3 !== 0) {
      throw new Error(
        "triangle index array length must be divisible by 3",
      );
    }

    this.recycleBuckets();

    const triangleCount =
      triangles.length / 3;

    const requiredBoundsLength =
      triangleCount * 6;

    /**
     * Grow only when needed.
     *
     * Reuse the existing buffer between builds
     * to avoid per-substep allocations.
     */
    if (
      this.triangleBounds.length <
      requiredBoundsLength
    ) {
      this.triangleBounds =
        new Float32Array(
          requiredBoundsLength,
        );
    }

    for (
      let triangleIndex = 0;
      triangleIndex < triangleCount;
      triangleIndex++
    ) {
      const indexOffset =
        triangleIndex * 3;

      const a =
        triangles[indexOffset];

      const b =
        triangles[indexOffset + 1];

      const c =
        triangles[indexOffset + 2];

      const aOffset = a * 3;
      const bOffset = b * 3;
      const cOffset = c * 3;

      const minX =
        Math.min(
          positions[aOffset],
          positions[bOffset],
          positions[cOffset],
        ) - this.padding;

      const minY =
        Math.min(
          positions[aOffset + 1],
          positions[bOffset + 1],
          positions[cOffset + 1],
        ) - this.padding;

      const minZ =
        Math.min(
          positions[aOffset + 2],
          positions[bOffset + 2],
          positions[cOffset + 2],
        ) - this.padding;

      const maxX =
        Math.max(
          positions[aOffset],
          positions[bOffset],
          positions[cOffset],
        ) + this.padding;

      const maxY =
        Math.max(
          positions[aOffset + 1],
          positions[bOffset + 1],
          positions[cOffset + 1],
        ) + this.padding;

      const maxZ =
        Math.max(
          positions[aOffset + 2],
          positions[bOffset + 2],
          positions[cOffset + 2],
        ) + this.padding;

      /**
       * Store the padded triangle AABB.
       *
       * SelfCollisionDetector can later perform
       * a cheap exact AABB rejection before the
       * more expensive point-triangle test.
       */
      const boundsOffset =
        triangleIndex * 6;

      this.triangleBounds[
        boundsOffset
      ] = minX;

      this.triangleBounds[
        boundsOffset + 1
      ] = minY;

      this.triangleBounds[
        boundsOffset + 2
      ] = minZ;

      this.triangleBounds[
        boundsOffset + 3
      ] = maxX;

      this.triangleBounds[
        boundsOffset + 4
      ] = maxY;

      this.triangleBounds[
        boundsOffset + 5
      ] = maxZ;

      const minCellX =
        this.toCell(minX);

      const minCellY =
        this.toCell(minY);

      const minCellZ =
        this.toCell(minZ);

      const maxCellX =
        this.toCell(maxX);

      const maxCellY =
        this.toCell(maxY);

      const maxCellZ =
        this.toCell(maxZ);

      for (
        let z = minCellZ;
        z <= maxCellZ;
        z++
      ) {
        for (
          let y = minCellY;
          y <= maxCellY;
          y++
        ) {
          for (
            let x = minCellX;
            x <= maxCellX;
            x++
          ) {
            const key =
              hashCell(
                x,
                y,
                z,
              );

            let bucket =
              this.buckets.get(key);

            if (!bucket) {
              bucket =
                this.bucketPool.pop() ??
                [];

              this.buckets.set(
                key,
                bucket,
              );

              this.activeBuckets.push(
                bucket,
              );
            }

            bucket.push(
              triangleIndex,
            );
          }
        }
      }
    }
  }

  queryPoint(
    x: number,
    y: number,
    z: number,
  ): readonly number[] {
    const key =
      hashCell(
        this.toCell(x),
        this.toCell(y),
        this.toCell(z),
      );

    return (
      this.buckets.get(key) ??
      EMPTY_RESULTS
    );
  }

  /**
   * Tests whether a point lies inside the padded
   * AABB stored for a triangle.
   *
   * This is intentionally allocation-free and
   * designed for the self-collision hot loop.
   */
  containsPoint(
    triangleIndex: number,
    x: number,
    y: number,
    z: number,
  ): boolean {
    const offset =
      triangleIndex * 6;

    return (
      x >=
        this.triangleBounds[offset] &&
      x <=
        this.triangleBounds[
          offset + 3
        ] &&
      y >=
        this.triangleBounds[
          offset + 1
        ] &&
      y <=
        this.triangleBounds[
          offset + 4
        ] &&
      z >=
        this.triangleBounds[
          offset + 2
        ] &&
      z <=
        this.triangleBounds[
          offset + 5
        ]
    );
  }

  clear(): void {
    this.recycleBuckets();
  }

  private recycleBuckets(): void {
    for (
      const bucket of
      this.activeBuckets
    ) {
      bucket.length = 0;

      this.bucketPool.push(
        bucket,
      );
    }

    this.activeBuckets.length = 0;

    this.buckets.clear();
  }

  private toCell(
    value: number,
  ): number {
    return Math.floor(
      value / this.cellSize,
    );
  }
}

const EMPTY_RESULTS:
  readonly number[] = [];

function hashCell(
  x: number,
  y: number,
  z: number,
): number {
  return (
    (
      Math.imul(
        x,
        73856093,
      ) ^
      Math.imul(
        y,
        19349663,
      ) ^
      Math.imul(
        z,
        83492791,
      )
    ) >>> 0
  );
}