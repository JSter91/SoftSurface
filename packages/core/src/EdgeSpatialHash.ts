import type { EdgeIndices } from "./GridTopology.js";

export interface EdgeSpatialHashOptions {
  cellSize: number;
  padding?: number;
}

export class EdgeSpatialHash {
  private readonly cellSize: number;
  private readonly padding: number;

  private bucketHeads = new Int32Array(0);

  private slotGenerations = new Uint32Array(0);

  private bucketMask = 0;
  private generation = 0;

  private entryEdges = new Uint32Array(0);

  private entryKeys = new Uint32Array(0);

  private entryNext = new Int32Array(0);

  private entryCount = 0;

  /**
   * Six values per edge:
   *
   * minX, minY, minZ,
   * maxX, maxY, maxZ
   *
   * Bounds already include padding.
   */
  private edgeBounds = new Float32Array(0);

  /**
   * Used to deduplicate an edge that occurs in several
   * spatial cells during one query.
   */
  private visitedEdges = new Uint32Array(0);

  private queryGeneration = 0;

  private readonly queryResults: number[] = [];

  constructor(options: EdgeSpatialHashOptions) {
    const { cellSize, padding = 0 } = options;

    if (cellSize <= 0) {
      throw new RangeError("cellSize must be greater than 0");
    }

    if (padding < 0) {
      throw new RangeError("padding must be non-negative");
    }

    this.cellSize = cellSize;
    this.padding = padding;
  }

  build(positions: Float32Array, edges: EdgeIndices): void {
    if (edges.length % 2 !== 0) {
      throw new Error("edge index array length must be divisible by 2");
    }

    const edgeCount = edges.length / 2;

    this.ensureTableCapacity(edgeCount);

    this.ensureBoundsCapacity(edgeCount);

    this.ensureVisitedCapacity(edgeCount);

    this.ensureEntryCapacity(Math.max(1024, edgeCount * 8));

    this.beginBuild();

    for (let edgeIndex = 0; edgeIndex < edgeCount; edgeIndex++) {
      const indexOffset = edgeIndex * 2;

      const a = edges[indexOffset];

      const b = edges[indexOffset + 1];

      const aOffset = a * 3;
      const bOffset = b * 3;

      const minX =
        Math.min(positions[aOffset], positions[bOffset]) - this.padding;

      const minY =
        Math.min(positions[aOffset + 1], positions[bOffset + 1]) - this.padding;

      const minZ =
        Math.min(positions[aOffset + 2], positions[bOffset + 2]) - this.padding;

      const maxX =
        Math.max(positions[aOffset], positions[bOffset]) + this.padding;

      const maxY =
        Math.max(positions[aOffset + 1], positions[bOffset + 1]) + this.padding;

      const maxZ =
        Math.max(positions[aOffset + 2], positions[bOffset + 2]) + this.padding;

      const boundsOffset = edgeIndex * 6;

      this.edgeBounds[boundsOffset] = minX;

      this.edgeBounds[boundsOffset + 1] = minY;

      this.edgeBounds[boundsOffset + 2] = minZ;

      this.edgeBounds[boundsOffset + 3] = maxX;

      this.edgeBounds[boundsOffset + 4] = maxY;

      this.edgeBounds[boundsOffset + 5] = maxZ;

      const minCellX = this.toCell(minX);

      const minCellY = this.toCell(minY);

      const minCellZ = this.toCell(minZ);

      const maxCellX = this.toCell(maxX);

      const maxCellY = this.toCell(maxY);

      const maxCellZ = this.toCell(maxZ);

      for (let z = minCellZ; z <= maxCellZ; z++) {
        for (let y = minCellY; y <= maxCellY; y++) {
          for (let x = minCellX; x <= maxCellX; x++) {
            this.insert(hashCell(x, y, z), edgeIndex);
          }
        }
      }
    }
  }

  /**
   * Returns edges whose padded AABB overlaps the
   * unpadded AABB of the requested edge.
   *
   * Returned indices are unique.
   */
  queryEdge(
    positions: Float32Array,
    edges: EdgeIndices,
    edgeIndex: number,
  ): readonly number[] {
    const indexOffset = edgeIndex * 2;

    const a = edges[indexOffset];

    const b = edges[indexOffset + 1];

    const aOffset = a * 3;
    const bOffset = b * 3;

    const minX = Math.min(positions[aOffset], positions[bOffset]);

    const minY = Math.min(positions[aOffset + 1], positions[bOffset + 1]);

    const minZ = Math.min(positions[aOffset + 2], positions[bOffset + 2]);

    const maxX = Math.max(positions[aOffset], positions[bOffset]);

    const maxY = Math.max(positions[aOffset + 1], positions[bOffset + 1]);

    const maxZ = Math.max(positions[aOffset + 2], positions[bOffset + 2]);

    this.queryResults.length = 0;

    const queryStamp = this.nextQueryGeneration();

    const minCellX = this.toCell(minX);

    const minCellY = this.toCell(minY);

    const minCellZ = this.toCell(minZ);

    const maxCellX = this.toCell(maxX);

    const maxCellY = this.toCell(maxY);

    const maxCellZ = this.toCell(maxZ);

    for (let z = minCellZ; z <= maxCellZ; z++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        for (let x = minCellX; x <= maxCellX; x++) {
          const key = hashCell(x, y, z);

          const slot = key & this.bucketMask;

          if (this.slotGenerations[slot] !== this.generation) {
            continue;
          }

          let entry = this.bucketHeads[slot];

          while (entry !== -1) {
            if (this.entryKeys[entry] === key) {
              const candidate = this.entryEdges[entry];

              if (this.visitedEdges[candidate] !== queryStamp) {
                this.visitedEdges[candidate] = queryStamp;

                if (
                  this.overlapsBounds(
                    candidate,
                    minX,
                    minY,
                    minZ,
                    maxX,
                    maxY,
                    maxZ,
                  )
                ) {
                  this.queryResults.push(candidate);
                }
              }
            }

            entry = this.entryNext[entry];
          }
        }
      }
    }

    return this.queryResults;
  }

  private overlapsBounds(
    edgeIndex: number,

    minX: number,
    minY: number,
    minZ: number,

    maxX: number,
    maxY: number,
    maxZ: number,
  ): boolean {
    const offset = edgeIndex * 6;

    return (
      maxX >= this.edgeBounds[offset] &&
      minX <= this.edgeBounds[offset + 3] &&
      maxY >= this.edgeBounds[offset + 1] &&
      minY <= this.edgeBounds[offset + 4] &&
      maxZ >= this.edgeBounds[offset + 2] &&
      minZ <= this.edgeBounds[offset + 5]
    );
  }

  private insert(key: number, edgeIndex: number): void {
    const slot = key & this.bucketMask;

    let previousHead = -1;

    if (this.slotGenerations[slot] === this.generation) {
      previousHead = this.bucketHeads[slot];
    } else {
      this.slotGenerations[slot] = this.generation;

      this.bucketHeads[slot] = -1;
    }

    this.ensureEntryCapacity(this.entryCount + 1);

    const entry = this.entryCount++;

    this.entryEdges[entry] = edgeIndex;

    this.entryKeys[entry] = key;

    this.entryNext[entry] = previousHead;

    this.bucketHeads[slot] = entry;
  }

  private beginBuild(): void {
    this.entryCount = 0;

    this.generation = (this.generation + 1) >>> 0;

    if (this.generation === 0) {
      this.slotGenerations.fill(0);

      this.generation = 1;
    }
  }

  private nextQueryGeneration(): number {
    this.queryGeneration = (this.queryGeneration + 1) >>> 0;

    if (this.queryGeneration === 0) {
      this.visitedEdges.fill(0);

      this.queryGeneration = 1;
    }

    return this.queryGeneration;
  }

  private ensureTableCapacity(edgeCount: number): void {
    const minimumCapacity = Math.max(256, edgeCount * 4);

    const capacity = nextPowerOfTwo(minimumCapacity);

    if (this.bucketHeads.length >= capacity) {
      return;
    }

    this.bucketHeads = new Int32Array(capacity);

    this.slotGenerations = new Uint32Array(capacity);

    this.bucketMask = capacity - 1;

    this.generation = 0;
  }

  private ensureBoundsCapacity(edgeCount: number): void {
    const required = edgeCount * 6;

    if (this.edgeBounds.length >= required) {
      return;
    }

    this.edgeBounds = new Float32Array(required);
  }

  private ensureVisitedCapacity(edgeCount: number): void {
    if (this.visitedEdges.length >= edgeCount) {
      return;
    }

    this.visitedEdges = new Uint32Array(edgeCount);

    this.queryGeneration = 0;
  }

  private ensureEntryCapacity(required: number): void {
    if (this.entryEdges.length >= required) {
      return;
    }

    let capacity = Math.max(1024, this.entryEdges.length || 1024);

    while (capacity < required) {
      capacity *= 2;
    }

    const edges = new Uint32Array(capacity);

    const keys = new Uint32Array(capacity);

    const next = new Int32Array(capacity);

    edges.set(this.entryEdges);

    keys.set(this.entryKeys);

    next.set(this.entryNext);

    this.entryEdges = edges;
    this.entryKeys = keys;
    this.entryNext = next;
  }

  private toCell(value: number): number {
    return Math.floor(value / this.cellSize);
  }
}

function nextPowerOfTwo(value: number): number {
  let result = 1;

  while (result < value) {
    result *= 2;
  }

  return result;
}

function hashCell(x: number, y: number, z: number): number {
  return (
    (Math.imul(x, 73856093) ^
      Math.imul(y, 19349663) ^
      Math.imul(z, 83492791)) >>>
    0
  );
}
