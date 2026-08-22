import type {
  GrabOptions,
  SoftSurface,
} from "@softsurface/core";

import type {
  RecordedScenario,
  ScenarioGrabEvent,
} from "./ScenarioRecording.js";

export class ScenarioReplay {
  private readonly surface: SoftSurface;

  private readonly scenario:
    RecordedScenario;

  private readonly grabOptions:
    GrabOptions;

  private eventIndex = 0;

  private currentStep = 0;

  constructor(
    surface: SoftSurface,
    scenario: RecordedScenario,
    grabOptions: GrabOptions,
  ) {
    this.surface = surface;
    this.scenario = scenario;
    this.grabOptions = grabOptions;

    this.validateState();

    /**
     * Restore the exact state captured when
     * recording started.
     */
    this.surface.positions.set(
      scenario.initialPositions,
    );

    this.surface.previousPositions.set(
      scenario.initialPreviousPositions,
    );

    this.surface.inverseMasses.set(
      scenario.initialInverseMasses,
    );
  }

  step(): number {
    /**
     * Events recorded at step N belong to the
     * state after N completed physics substeps.
     *
     * Therefore they must be applied BEFORE
     * advancing to step N + 1.
     */
    this.applyCurrentStepEvents();

    const executedSubsteps =
      this.surface.step(
        this.scenario
          .configuration
          .fixedTimeStep,
      );

    this.currentStep +=
      executedSubsteps;

    return executedSubsteps;
  }

  get stepIndex(): number {
    return this.currentStep;
  }

  get processedEvents(): number {
    return this.eventIndex;
  }

  get totalEvents(): number {
    return this.scenario.events.length;
  }

  get hasProcessedAllEvents(): boolean {
    return (
      this.eventIndex >=
      this.scenario.events.length
    );
  }

  private applyCurrentStepEvents(): void {
    while (
      this.eventIndex <
      this.scenario.events.length
    ) {
      const event =
        this.scenario.events[
          this.eventIndex
        ];

      if (
        event.step >
        this.currentStep
      ) {
        break;
      }

      this.applyEvent(event);

      this.eventIndex++;
    }
  }

  private applyEvent(
    event: ScenarioGrabEvent,
  ): void {
    switch (event.type) {
      case "grab":
        this.surface.grab(
          event.point,
          this.grabOptions,
        );
        break;

      case "moveGrab":
        this.surface.moveGrab(
          event.point,
        );
        break;

      case "release":
        this.surface.release();
        break;
    }
  }

  private validateState(): void {
    const expectedPositions =
      this.surface.positions.length;

    const expectedParticles =
      this.surface.inverseMasses.length;

    if (
      this.scenario
        .initialPositions
        .length !==
      expectedPositions
    ) {
      throw new Error(
        "Scenario positions do not match surface topology.",
      );
    }

    if (
      this.scenario
        .initialPreviousPositions
        .length !==
      expectedPositions
    ) {
      throw new Error(
        "Scenario previous positions do not match surface topology.",
      );
    }

    if (
      this.scenario
        .initialInverseMasses
        .length !==
      expectedParticles
    ) {
      throw new Error(
        "Scenario inverse masses do not match surface topology.",
      );
    }
  }
}