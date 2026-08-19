import { describe, expect, it } from "vitest";

import { SoftSurface } from "../src/SoftSurface.js";

describe("SoftSurface", () => {
  it("creates a complete deformable surface", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
    });

    expect(surface.particleCount).toBe(9);
    expect(surface.positions.length).toBe(27);

    expect(surface.constraints.structural).toHaveLength(12);
    expect(surface.constraints.shear).toHaveLength(8);
    expect(surface.constraints.bend).toHaveLength(6);
  });

  it("advances the simulation", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
      acceleration: [0, -10, 0],
      damping: 0,
    });

    const particle = surface.grid.getParticleIndex(1, 1);
    const offset = particle * 3;

    const initialY = surface.positions[offset + 1];

    surface.step(0.1);

    expect(surface.positions[offset + 1]).toBeLessThan(initialY);
  });

  it("can pin and unpin particles", () => {
    const surface = new SoftSurface({
      width: 2,
      height: 2,
      segmentsX: 1,
      segmentsY: 1,
    });

    surface.pin(0);

    expect(surface.inverseMasses[0]).toBe(0);

    surface.unpin(0);

    expect(surface.inverseMasses[0]).toBe(1);
  });

  it("produces the same result independently of render frame rate", () => {
    const options = {
      width: 2,
      height: 2,
      segmentsX: 2,
      segmentsY: 2,
      acceleration: [0, -10, 0] as const,
      damping: 0,
      fixedTimeStep: 1 / 120,
      maxSubsteps: 4,
    };

    const surface60 = new SoftSurface(options);
    const surface120 = new SoftSurface(options);

    surface60.step(1 / 60);

    surface120.step(1 / 120);
    surface120.step(1 / 120);

    expect(Array.from(surface60.positions)).toEqual(
      Array.from(surface120.positions),
    );
  });

  it("rejects invalid fixed timestep settings", () => {
    expect(
      () =>
        new SoftSurface({
          width: 2,
          height: 2,
          segmentsX: 2,
          segmentsY: 2,
          fixedTimeStep: 0,
        }),
    ).toThrow();

    expect(
      () =>
        new SoftSurface({
          width: 2,
          height: 2,
          segmentsX: 2,
          segmentsY: 2,
          maxSubsteps: 0,
        }),
    ).toThrow();
  });
});

it("accepts material presets", () => {
  const surface = new SoftSurface({
    width: 2,
    height: 2,
    segmentsX: 2,
    segmentsY: 2,
    preset: "silk",
  });

  expect(surface.particleCount).toBe(9);
});
