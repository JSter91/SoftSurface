import type {
  GrabOptions,
  SoftSurface,
} from "@softsurface/core";

import {
  Camera,
  Mesh,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

export interface SoftSurfacePointerInteractionOptions {
  grab?: GrabOptions;
  onGrabStart?: () => void;
  onGrabEnd?: () => void;
}

export class SoftSurfacePointerInteraction {
  private readonly surface: SoftSurface;
  private readonly mesh: Mesh;
  private readonly camera: Camera;
  private readonly domElement: HTMLElement;

  private readonly grabOptions?: GrabOptions;
  private readonly onGrabStart?: () => void;
  private readonly onGrabEnd?: () => void;

  private readonly raycaster = new Raycaster();
  private readonly pointer = new Vector2();

  private readonly dragPlane = new Plane();
  private readonly planeNormal = new Vector3();

  private readonly worldPoint = new Vector3();
  private readonly localPoint = new Vector3();

  private activePointerId: number | null = null;

  constructor(
    surface: SoftSurface,
    mesh: Mesh,
    camera: Camera,
    domElement: HTMLElement,
    options: SoftSurfacePointerInteractionOptions = {},
  ) {
    this.surface = surface;
    this.mesh = mesh;
    this.camera = camera;
    this.domElement = domElement;

    this.grabOptions = options.grab;
    this.onGrabStart = options.onGrabStart;
    this.onGrabEnd = options.onGrabEnd;

    /*
     * Capture phase is important.
     *
     * Our handler runs before OrbitControls and can
     * disable it if the pointer actually hits the surface.
     */
    this.domElement.addEventListener(
      "pointerdown",
      this.handlePointerDown,
      true,
    );

    this.domElement.addEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.domElement.addEventListener(
      "pointerup",
      this.handlePointerUp,
    );

    this.domElement.addEventListener(
      "pointercancel",
      this.handlePointerUp,
    );
  }

  dispose(): void {
    this.release();

    this.domElement.removeEventListener(
      "pointerdown",
      this.handlePointerDown,
      true,
    );

    this.domElement.removeEventListener(
      "pointermove",
      this.handlePointerMove,
    );

    this.domElement.removeEventListener(
      "pointerup",
      this.handlePointerUp,
    );

    this.domElement.removeEventListener(
      "pointercancel",
      this.handlePointerUp,
    );
  }

  private readonly handlePointerDown = (
    event: PointerEvent,
  ): void => {
    /*
     * Primary/left button only.
     */
    if (event.button !== 0) {
      return;
    }

    if (this.activePointerId !== null) {
      return;
    }

    this.updatePointer(event);

    this.camera.updateWorldMatrix(
      true,
      false,
    );

    this.mesh.updateWorldMatrix(
      true,
      false,
    );

    this.raycaster.setFromCamera(
      this.pointer,
      this.camera,
    );

    const intersections =
      this.raycaster.intersectObject(
        this.mesh,
        false,
      );

    const intersection =
      intersections[0];

    /*
     * Important:
     *
     * No hit means SoftSurface does absolutely nothing.
     * OrbitControls remains enabled and receives the
     * same pointer event.
     */
    if (!intersection) {
      return;
    }

    /*
     * Raycaster intersection is in world space.
     */
    this.worldPoint.copy(
      intersection.point,
    );

    /*
     * Build a drag plane passing through the hit point
     * and facing the camera.
     */
    this.camera.getWorldDirection(
      this.planeNormal,
    );

    this.dragPlane.setFromNormalAndCoplanarPoint(
      this.planeNormal,
      this.worldPoint,
    );

    /*
     * Convert world-space hit point into
     * SoftSurface local coordinates.
     */
    this.localPoint.copy(
      this.worldPoint,
    );

    this.mesh.worldToLocal(
      this.localPoint,
    );

    const affectedParticles =
      this.surface.grab(
        [
          this.localPoint.x,
          this.localPoint.y,
          this.localPoint.z,
        ],
        this.grabOptions,
      );

    /*
     * A mesh intersection alone isn't enough:
     * the grab radius must actually contain particles.
     */
    if (affectedParticles === 0) {
      return;
    }

    /*
     * Only NOW does the pointer belong to SoftSurface.
     */
    this.activePointerId =
      event.pointerId;

    /*
     * Because this listener runs in capture phase,
     * OrbitControls will see itself disabled when its
     * pointerdown handler runs.
     */
    this.onGrabStart?.();

    this.domElement.setPointerCapture(
      event.pointerId,
    );
  };

  private readonly handlePointerMove = (
    event: PointerEvent,
  ): void => {
    if (
      this.activePointerId !==
      event.pointerId
    ) {
      return;
    }

    this.updatePointer(event);

    this.camera.updateWorldMatrix(
      true,
      false,
    );

    this.mesh.updateWorldMatrix(
      true,
      false,
    );

    this.raycaster.setFromCamera(
      this.pointer,
      this.camera,
    );

    const intersection =
      this.raycaster.ray.intersectPlane(
        this.dragPlane,
        this.worldPoint,
      );

    if (!intersection) {
      return;
    }

    this.localPoint.copy(
      this.worldPoint,
    );

    this.mesh.worldToLocal(
      this.localPoint,
    );

    this.surface.moveGrab([
      this.localPoint.x,
      this.localPoint.y,
      this.localPoint.z,
    ]);
  };

  private readonly handlePointerUp = (
    event: PointerEvent,
  ): void => {
    if (
      this.activePointerId !==
      event.pointerId
    ) {
      return;
    }

    if (
      this.domElement.hasPointerCapture(
        event.pointerId,
      )
    ) {
      this.domElement.releasePointerCapture(
        event.pointerId,
      );
    }

    this.release();
  };

  private updatePointer(
    event: PointerEvent,
  ): void {
    const rect =
      this.domElement.getBoundingClientRect();

    this.pointer.x =
      ((event.clientX - rect.left) /
        rect.width) *
        2 -
      1;

    this.pointer.y =
      -(
        (event.clientY - rect.top) /
        rect.height
      ) *
        2 +
      1;
  }

  private release(): void {
    const wasActive =
      this.activePointerId !== null;

    this.surface.release();
    this.activePointerId = null;

    if (wasActive) {
      this.onGrabEnd?.();
    }
  }
}