export interface Constraint {
  readonly stiffness: number;

  solve(
    positions: Float32Array,
    inverseMasses: Float32Array,
    stiffness?: number,
  ): void;
}