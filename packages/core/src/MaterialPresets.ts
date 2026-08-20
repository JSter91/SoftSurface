export type SoftSurfacePreset =
  | "cloth"
  | "silk"
  | "paper"
  | "rubber"
  | "gel";

export interface MaterialParameters {
  structuralStiffness: number;
  shearStiffness: number;
  bendStiffness: number;
  damping: number;
}

export const MATERIAL_PRESETS = {
  cloth: {
    structuralStiffness: 0.99,
    shearStiffness: 0.92,
    bendStiffness: 0.25,
    damping: 0.03,
  },

  silk: {
    structuralStiffness: 0.985,
    shearStiffness: 0.85,
    bendStiffness: 0.08,
    damping: 0.025,
  },

  paper: {
    structuralStiffness: 0.999,
    shearStiffness: 0.98,
    bendStiffness: 0.9,
    damping: 0.045,
  },

  rubber: {
    structuralStiffness: 0.82,
    shearStiffness: 0.78,
    bendStiffness: 0.4,
    damping: 0.04,
  },

  gel: {
    structuralStiffness: 0.9,
    shearStiffness: 0.75,
    bendStiffness: 0.15,
    damping: 0.1,
  },
} as const;