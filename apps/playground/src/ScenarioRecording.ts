export type ScenarioGrabEvent =
  | {
      step: number;
      type: "grab";
      point: [number, number, number];
    }
  | {
      step: number;
      type: "moveGrab";
      point: [number, number, number];
    }
  | {
      step: number;
      type: "release";
    };

export interface ScenarioConfiguration {
  width: number;
  height: number;

  segmentsX: number;
  segmentsY: number;

  preset: string;

  gravityY: number;

  iterations: number;

  fixedTimeStep: number;
  maxSubsteps: number;

  relaxation: number;

  bendModel: string;
  bendStiffness: number;

  selfCollisionEnabled: boolean;
  selfCollisionThickness: number;
  selfCollisionCellSize: number;
}

export interface RecordedScenario {
  version: 1;

  configuration: ScenarioConfiguration;

  initialPositions: number[];

  initialPreviousPositions: number[];

  initialInverseMasses: number[];

  events: ScenarioGrabEvent[];
}

export class ScenarioRecorder {
  private events: ScenarioGrabEvent[] = [];

  private recording = false;

  private currentStep = 0;

  start(
    configuration: ScenarioConfiguration,
    positions: Float32Array,
    previousPositions: Float32Array,
    inverseMasses: Float32Array,
  ): RecordedScenario {
    console.log("[ScenarioRecorder] start() ENTER");

    this.events.length = 0;
    this.currentStep = 0;
    this.recording = true;

    const scenario: RecordedScenario = {
      version: 1,

      configuration,

      initialPositions: Array.from(positions),

      initialPreviousPositions: Array.from(previousPositions),

      initialInverseMasses: Array.from(inverseMasses),

      events: this.events,
    };

    console.log("[ScenarioRecorder] returning", scenario);

    return scenario;
  }

  stop(): void {
    this.recording = false;
  }

  setStep(step: number): void {
    this.currentStep = step;
  }

  recordGrab(x: number, y: number, z: number): void {
    if (!this.recording) {
      return;
    }

    this.events.push({
      step: this.currentStep,
      type: "grab",
      point: [x, y, z],
    });
  }

  recordMoveGrab(x: number, y: number, z: number): void {
    if (!this.recording) {
      return;
    }

    this.events.push({
      step: this.currentStep,
      type: "moveGrab",
      point: [x, y, z],
    });
  }

  recordRelease(): void {
    if (!this.recording) {
      return;
    }

    this.events.push({
      step: this.currentStep,
      type: "release",
    });
  }

  getEvents(): readonly ScenarioGrabEvent[] {
    return this.events;
  }

  get isRecording(): boolean {
    return this.recording;
  }
}