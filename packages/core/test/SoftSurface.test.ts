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

  it("applies self-collision response during simulation", () => {
    const baseOptions = {
      width: 1,
      height: 1,
      segmentsX: 1,
      segmentsY: 1,

      structuralStiffness: 0,
      shearStiffness: 0,
      bendStiffness: 0,

      relaxation: 0,

      acceleration: [0, 0, 0] as const,
      damping: 0,

      iterations: 1,

      fixedTimeStep: 1 / 120,
      maxSubsteps: 1,
    };

    const withoutCollision = new SoftSurface(baseOptions);

    const withCollision = new SoftSurface({
      ...baseOptions,

      selfCollision: {
        enabled: true,
        thickness: 0.05,
        cellSize: 1,
      },
    });

    /**
     * A 1 x 1 grid contains four particles and two
     * triangles.
     *
     * Move the bottom-right particle close to the
     * opposite triangle so we create a deterministic
     * self-collision.
     */
    const particle = withCollision.grid.getParticleIndex(1, 1);

    const triangleA = withCollision.grid.getParticleIndex(0, 0);

    const triangleB = withCollision.grid.getParticleIndex(0, 1);

    const triangleC = withCollision.grid.getParticleIndex(1, 0);

    const aOffset = triangleA * 3;

    const bOffset = triangleB * 3;

    const cOffset = triangleC * 3;

    const particleOffset = particle * 3;

    const contactX =
      (withCollision.positions[aOffset] +
        withCollision.positions[bOffset] +
        withCollision.positions[cOffset]) /
      3;

    const contactY =
      (withCollision.positions[aOffset + 1] +
        withCollision.positions[bOffset + 1] +
        withCollision.positions[cOffset + 1]) /
      3;

    const contactZ =
      (withCollision.positions[aOffset + 2] +
        withCollision.positions[bOffset + 2] +
        withCollision.positions[cOffset + 2]) /
      3;

    function placeParticle(surface: SoftSurface): void {
      surface.positions[particleOffset] = contactX;

      surface.positions[particleOffset + 1] = contactY;

      surface.positions[particleOffset + 2] = contactZ + 0.01;

      /**
       * Match previousPositions so the artificial setup
       * has zero initial Verlet velocity.
       */
      surface.previousPositions.set(surface.positions);
    }

    placeParticle(withoutCollision);

    placeParticle(withCollision);

    const beforeCollision = new Float32Array(withCollision.positions);

    withoutCollision.step(1 / 120);

    withCollision.step(1 / 120);

    /**
     * With all other simulation effects disabled,
     * the control surface should remain unchanged.
     */
    expect(Array.from(withoutCollision.positions)).toEqual(
      Array.from(beforeCollision),
    );

    /**
     * Self-collision must now be more than detection-only:
     * the solver should actually modify the geometry.
     */
    expect(Array.from(withCollision.positions)).not.toEqual(
      Array.from(beforeCollision),
    );

    expect(withCollision.selfCollisionStats?.contacts).toBeGreaterThan(0);
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
