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

export const MATERIAL_PRESETS: Readonly<
  Record<SoftSurfacePreset, Readonly<MaterialParameters>>
> = {
  cloth: {
    structuralStiffness: 0.95,
    shearStiffness: 0.8,
    bendStiffness: 0.3,
    damping: 0.03,
  },

  silk: {
    structuralStiffness: 0.9,
    shearStiffness: 0.7,
    bendStiffness: 0.12,
    damping: 0.025,
  },

  paper: {
    structuralStiffness: 1,
    shearStiffness: 0.95,
    bendStiffness: 0.85,
    damping: 0.05,
  },

  rubber: {
    structuralStiffness: 0.65,
    shearStiffness: 0.6,
    bendStiffness: 0.4,
    damping: 0.06,
  },

  gel: {
    structuralStiffness: 0.55,
    shearStiffness: 0.5,
    bendStiffness: 0.2,
    damping: 0.1,
  },
};