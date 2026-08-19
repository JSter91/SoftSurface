import { describe, expect, it } from "vitest";

import {
  MATERIAL_PRESETS,
  type SoftSurfacePreset,
} from "../src/MaterialPresets.js";

describe("MaterialPresets", () => {
  it("defines all supported presets", () => {
    const presets: SoftSurfacePreset[] = [
      "cloth",
      "silk",
      "paper",
      "rubber",
      "gel",
    ];

    for (const preset of presets) {
      expect(MATERIAL_PRESETS[preset]).toBeDefined();
    }
  });

  it("keeps material parameters within valid ranges", () => {
    for (const preset of Object.values(MATERIAL_PRESETS)) {
      expect(preset.structuralStiffness).toBeGreaterThanOrEqual(0);
      expect(preset.structuralStiffness).toBeLessThanOrEqual(1);

      expect(preset.shearStiffness).toBeGreaterThanOrEqual(0);
      expect(preset.shearStiffness).toBeLessThanOrEqual(1);

      expect(preset.bendStiffness).toBeGreaterThanOrEqual(0);
      expect(preset.bendStiffness).toBeLessThanOrEqual(1);

      expect(preset.damping).toBeGreaterThanOrEqual(0);
      expect(preset.damping).toBeLessThanOrEqual(1);
    }
  });
});
