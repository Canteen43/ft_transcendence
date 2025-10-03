import * as BABYLON from '@babylonjs/core';

export type PowerupType = 'split' | 'boost' | 'stretch' | 'shrink';

export interface PowerupEntityParams {
  id: string;
  type: PowerupType;
  physicsRoot: BABYLON.TransformNode; // physics proxy (mesh), parent of visual
  visualRoot: BABYLON.TransformNode;   // visual clone parented to physicsRoot
  collisionMesh: BABYLON.Mesh;         // for intersectsMesh checks
  physicsImpostor: BABYLON.PhysicsImpostor | null;
  initialVelocity: BABYLON.Vector3;
  planeY: number;
  visualSpinSpeed: number; // radians per second
  spawnScaleDuration?: number; // seconds (0 = instant)
  collectDurationSeconds?: number; // seconds for shrink-into-paddle
}

export class PowerupEntity {
  readonly id: string;
  readonly type: PowerupType;
  readonly root: BABYLON.TransformNode;
  readonly visualRoot: BABYLON.TransformNode;
  readonly collisionMesh: BABYLON.Mesh;
  private impostor: BABYLON.PhysicsImpostor | null;
  private velocity: BABYLON.Vector3;
  private readonly planeY: number;
  private readonly spinSpeed: number;
  private readonly tmpQuat = BABYLON.Quaternion.Identity();
  private readonly spawnScaleDuration: number;
  private spawnScaleElapsed = 0;
  private collectTarget: BABYLON.Mesh | null = null;
  private readonly collectDuration: number = 0.2;
  private collectElapsed = 0;
  private collectStartPos: BABYLON.Vector3 | null = null;
  private collecting = false;

  constructor(params: PowerupEntityParams) {
    this.id = params.id;
    this.type = params.type;
    this.root = params.physicsRoot;
    this.visualRoot = params.visualRoot;
    this.collisionMesh = params.collisionMesh;
    this.impostor = params.physicsImpostor;
    this.velocity = params.initialVelocity.clone();
    this.planeY = params.planeY;
    this.spinSpeed = params.visualSpinSpeed;
    this.spawnScaleDuration = Math.max(0, params.spawnScaleDuration ?? 0.25);
    this.collectDuration = Math.max(0.05, params.collectDurationSeconds ?? 0.2);

    // Start scaled to zero for spawn grow-in effect
    try {
      this.visualRoot.scaling.set(0, 0, 0);
    } catch (_) {}
  }

  update(deltaSeconds: number): void {
    // Spawn scale-in animation
    if (this.spawnScaleElapsed < this.spawnScaleDuration) {
      this.spawnScaleElapsed = Math.min(
        this.spawnScaleElapsed + deltaSeconds,
        this.spawnScaleDuration
      );
      const t = this.spawnScaleDuration > 0 ? this.spawnScaleElapsed / this.spawnScaleDuration : 1;
      const s = Math.min(1, Math.max(0, t));
      try {
        this.visualRoot.scaling.set(s, s, s);
      } catch (_) {}
    }

    // If collecting, run shrink + move-to-paddle animation (kinematic)
    if (this.collecting && this.collectTarget) {
      this.collectElapsed = Math.min(this.collectElapsed + deltaSeconds, this.collectDuration);
      const t = this.collectDuration > 0 ? this.collectElapsed / this.collectDuration : 1;
      const smooth = t * t * (3 - 2 * t); // smoothstep

      // LERP position to paddle center
      const targetPos = this.collectTarget.getAbsolutePosition();
      const start = this.collectStartPos ?? this.root.position.clone();
      const newPos = BABYLON.Vector3.Lerp(start, targetPos, smooth);
      newPos.y = this.planeY; // stay on plane
      this.root.position.copyFrom(newPos);

      // Scale down to zero
      const s = Math.max(0, 1 - smooth);
      try { this.visualRoot.scaling.set(s, s, s); } catch (_) {}

      // No spin while shrinking (optional) — keep a tiny spin if desired
      return;
    }

    // Sync kinematics from physics if present, otherwise integrate manually
    if (this.impostor) {
      const v = this.impostor.getLinearVelocity();
      if (v) {
        if (Math.abs(v.y) > 0.0001) {
          this.impostor.setLinearVelocity(new BABYLON.Vector3(v.x, 0, v.z));
          this.velocity.set(v.x, 0, v.z);
        } else {
          this.velocity.copyFrom(v);
        }
      }
      // Clamp Y to plane
      const body: any = this.impostor.physicsBody;
      if (Math.abs(this.root.position.y - this.planeY) > 0.001) {
        this.root.position.y = this.planeY;
        if (body) body.position.y = this.planeY;
      }
    } else {
      // Kinematic fallback: integrate position in XZ
      const d = this.velocity.scale(deltaSeconds);
      this.root.position.addInPlace(new BABYLON.Vector3(d.x, 0, d.z));
      if (Math.abs(this.root.position.y - this.planeY) > 0.001) {
        this.root.position.y = this.planeY;
      }
    }

    // Visual spin
    if (!this.visualRoot.isDisposed()) {
      const spin = this.spinSpeed * deltaSeconds;
      const inc = BABYLON.Quaternion.RotationAxis(BABYLON.Vector3.Up(), spin);
      const current = this.visualRoot.rotationQuaternion ?? BABYLON.Quaternion.Identity();
      this.visualRoot.rotationQuaternion = current.multiply(inc);
    }
  }

  /** Begin collection animation: stop physics and animate toward paddle center */
  beginCollect(paddle: BABYLON.Mesh): void {
    this.collectTarget = paddle;
    this.collecting = true;
    this.collectElapsed = 0;
    this.collectStartPos = this.root.position.clone();
    if (this.impostor) {
      try { this.impostor.dispose(); } catch (_) {}
      this.impostor = null;
    }
  }

  /** Has the collect animation finished? */
  isCollectDone(): boolean {
    return this.collecting && this.collectElapsed >= this.collectDuration;
  }

  isOutOfBounds(limit: number): boolean {
    const p = this.root.position;
    return Math.abs(p.x) > limit || Math.abs(p.z) > limit;
  }

  intersectsPaddle(paddle: BABYLON.Mesh): boolean {
    try {
      return this.collisionMesh.intersectsMesh(paddle, true);
    } catch (_) {
      return false;
    }
  }

  dispose(): void {
    if (this.impostor) {
      this.impostor.dispose();
      this.impostor = null;
    }
    try {
      if (!this.visualRoot.isDisposed()) this.visualRoot.setEnabled(false);
    } catch (_) {}
    if (!this.root.isDisposed()) {
      this.root.dispose(true, true);
    }
  }
}
