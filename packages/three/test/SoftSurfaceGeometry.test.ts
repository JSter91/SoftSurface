import { describe, expect, it } from "vitest";

import { SoftSurface } from "@softsurface/core";
import { SoftSurfaceGeometry } from "../src/SoftSurfaceGeometry.js";

describe("SoftSurfaceGeometry", () => {
  it("uses the surface positions directly", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const geometry = new SoftSurfaceGeometry(surface);

    const position = geometry.getAttribute("position");

    expect(position.array).toBe(surface.positions);
  });

  it("creates the expected number of vertices", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const geometry = new SoftSurfaceGeometry(surface);

    const position = geometry.getAttribute("position");

    expect(position.count).toBe(9);
  });

  it("creates two triangles per grid cell", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const geometry = new SoftSurfaceGeometry(surface);

    expect(geometry.index).not.toBeNull();
    expect(geometry.index?.count).toBe(24);
  });

  it("creates UV coordinates for every particle", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    const geometry = new SoftSurfaceGeometry(surface);

    const uv = geometry.getAttribute("uv");

    expect(uv.count).toBe(9);
  });
});