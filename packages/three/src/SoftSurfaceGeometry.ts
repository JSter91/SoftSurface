import { SoftSurface } from "@softsurface/core";
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
} from "three";

export class SoftSurfaceGeometry extends BufferGeometry {
  readonly surface: SoftSurface;

  private readonly positionAttribute: BufferAttribute;

  constructor(surface: SoftSurface) {
    super();

    this.surface = surface;

    this.positionAttribute = new BufferAttribute(
      surface.positions,
      3,
    );

    this.positionAttribute.setUsage(DynamicDrawUsage);

    this.setAttribute(
      "position",
      this.positionAttribute,
    );

    this.createIndices();
    this.createUVs();

    this.computeVertexNormals();
    this.computeBoundingSphere();
  }

  update(): void {
    this.positionAttribute.needsUpdate = true;

    this.computeVertexNormals();
    this.computeBoundingSphere();
  }

  private createIndices(): void {
    const grid = this.surface.grid;

    const indexCount =
      grid.segmentsX *
      grid.segmentsY *
      6;

    const IndexArray =
      grid.particleCount > 65535
        ? Uint32Array
        : Uint16Array;

    const indices = new IndexArray(indexCount);

    let offset = 0;

    for (let y = 0; y < grid.segmentsY; y++) {
      for (let x = 0; x < grid.segmentsX; x++) {
        const topLeft =
          grid.getParticleIndex(x, y);

        const topRight =
          grid.getParticleIndex(x + 1, y);

        const bottomLeft =
          grid.getParticleIndex(x, y + 1);

        const bottomRight =
          grid.getParticleIndex(x + 1, y + 1);

        // Counter-clockwise when viewed from +Z.
        indices[offset++] = topLeft;
        indices[offset++] = bottomLeft;
        indices[offset++] = topRight;

        indices[offset++] = topRight;
        indices[offset++] = bottomLeft;
        indices[offset++] = bottomRight;
      }
    }

    this.setIndex(
      new BufferAttribute(indices, 1),
    );
  }

  private createUVs(): void {
    const grid = this.surface.grid;

    const uvs = new Float32Array(
      grid.particleCount * 2,
    );

    let offset = 0;

    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.columns; x++) {
        uvs[offset++] =
          x / grid.segmentsX;

        uvs[offset++] =
          1 - y / grid.segmentsY;
      }
    }

    this.setAttribute(
      "uv",
      new BufferAttribute(uvs, 2),
    );
  }
}