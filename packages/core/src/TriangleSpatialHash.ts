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

  /**
   * Power-of-two hash table.
   *
   * bucketHeads stores the first entry index for each slot.
   * slotGenerations lets us reuse the table without clearing
   * the entire Int32Array on every build.
   */
  private bucketHeads =
    new Int32Array(0);

  private slotGenerations =
    new Uint32Array(0);

  private bucketMask = 0;
  private generation = 0;

  /**
   * Linked-list entries.
   *
   * Each triangle-cell insertion occupies one entry.
   */
  private entryTriangles =
    new Uint32Array(0);

  private entryKeys =
    new Uint32Array(0);

  private entryNext =
    new Int32Array(0);

  private entryCount = 0;

  /**
   * Six values per triangle:
   *
   * 0 = minX
   * 1 = minY
   * 2 = minZ
   * 3 = maxX
   * 4 = maxY
   * 5 = maxZ
   */
  private triangleBounds =
    new Float32Array(0);

  /**
   * Reused query result.
   *
   * No array is allocated for individual point queries.
   */
  private readonly queryResults:
    number[] = [];

  constructor(
    options:
      TriangleSpatialHashOptions,
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

    const triangleCount =
      triangles.length / 3;

    this.ensureTableCapacity(
      triangleCount,
    );

    this.ensureBoundsCapacity(
      triangleCount,
    );

    /**
     * Initial estimate only.
     *
     * If deformation causes more cell insertions,
     * the entry buffers grow automatically.
     */
    this.ensureEntryCapacity(
      Math.max(
        1024,
        triangleCount * 8,
      ),
    );

    this.beginBuild();

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
        triangles[
          indexOffset + 1
        ];

      const c =
        triangles[
          indexOffset + 2
        ];

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
            this.insert(
              hashCell(
                x,
                y,
                z,
              ),
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

    const slot =
      key & this.bucketMask;

    this.queryResults.length = 0;

    if (
      this.slotGenerations[
        slot
      ] !== this.generation
    ) {
      return this.queryResults;
    }

    let entry =
      this.bucketHeads[slot];

    while (entry !== -1) {
      /**
       * Different 32-bit keys can map to the same
       * flat-table slot.
       *
       * Filter those table collisions here.
       *
       * True hashCell collisions remain conservative
       * false positives, matching the existing hash.
       */
      if (
        this.entryKeys[
          entry
        ] === key
      ) {
        this.queryResults.push(
          this.entryTriangles[
            entry
          ],
        );
      }

      entry =
        this.entryNext[entry];
    }

    return this.queryResults;
  }

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
        this.triangleBounds[
          offset
        ] &&
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
    this.entryCount = 0;

    this.advanceGeneration();

    this.queryResults.length = 0;
  }

  private insert(
    key: number,
    triangleIndex: number,
  ): void {
    const slot =
      key & this.bucketMask;

    let previousHead = -1;

    if (
      this.slotGenerations[
        slot
      ] === this.generation
    ) {
      previousHead =
        this.bucketHeads[
          slot
        ];
    } else {
      this.slotGenerations[
        slot
      ] = this.generation;

      this.bucketHeads[
        slot
      ] = -1;
    }

    this.ensureEntryCapacity(
      this.entryCount + 1,
    );

    const entry =
      this.entryCount++;

    this.entryTriangles[
      entry
    ] = triangleIndex;

    this.entryKeys[
      entry
    ] = key;

    this.entryNext[
      entry
    ] = previousHead;

    this.bucketHeads[
      slot
    ] = entry;
  }

  private beginBuild(): void {
    this.entryCount = 0;

    this.advanceGeneration();
  }

  private advanceGeneration(): void {
    this.generation =
      (
        this.generation + 1
      ) >>> 0;

    /**
     * Extremely rare Uint32 overflow.
     */
    if (this.generation === 0) {
      this.slotGenerations.fill(
        0,
      );

      this.generation = 1;
    }
  }

  private ensureTableCapacity(
    triangleCount: number,
  ): void {
    /**
     * Keep the table comfortably larger than the
     * expected number of occupied spatial cells.
     */
    const minimumCapacity =
      Math.max(
        256,
        triangleCount * 4,
      );

    const capacity =
      nextPowerOfTwo(
        minimumCapacity,
      );

    if (
      this.bucketHeads.length >=
      capacity
    ) {
      return;
    }

    this.bucketHeads =
      new Int32Array(
        capacity,
      );

    this.slotGenerations =
      new Uint32Array(
        capacity,
      );

    this.bucketMask =
      capacity - 1;

    /**
     * Force the next build to establish fresh slots.
     */
    this.generation = 0;
  }

  private ensureBoundsCapacity(
    triangleCount: number,
  ): void {
    const required =
      triangleCount * 6;

    if (
      this.triangleBounds.length >=
      required
    ) {
      return;
    }

    this.triangleBounds =
      new Float32Array(
        required,
      );
  }

  private ensureEntryCapacity(
    required: number,
  ): void {
    if (
      this.entryTriangles.length >=
      required
    ) {
      return;
    }

    let capacity =
      Math.max(
        1024,
        this.entryTriangles.length ||
          1024,
      );

    while (
      capacity < required
    ) {
      capacity *= 2;
    }

    const triangles =
      new Uint32Array(
        capacity,
      );

    const keys =
      new Uint32Array(
        capacity,
      );

    const next =
      new Int32Array(
        capacity,
      );

    triangles.set(
      this.entryTriangles,
    );

    keys.set(
      this.entryKeys,
    );

    next.set(
      this.entryNext,
    );

    this.entryTriangles =
      triangles;

    this.entryKeys =
      keys;

    this.entryNext =
      next;
  }

  private toCell(
    value: number,
  ): number {
    return Math.floor(
      value / this.cellSize,
    );
  }
}

function nextPowerOfTwo(
  value: number,
): number {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}

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