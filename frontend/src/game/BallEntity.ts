import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';

export interface BallEntityConfig {
  magnusCoefficient?: number; // default 0.14
  spinDecayFactor?: number;   // default 0.98
  spinDelayMs?: number;       // default 200
  spinTransferFactor?: number; // default 1.0
  impulseScale?: number;       // default ~frame time (0.016)
}

export class BallEntity {
  public readonly mesh: BABYLON.Mesh;
  public readonly impostor: BABYLON.PhysicsImpostor;
  private readonly baseY: number;

  // Per-ball effects
  private spin: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
  private magnusCoefficient: number;
  private spinDecayFactor: number;
  private spinDelayMs: number;
  private spinTransferFactor: number;
  private impulseScale: number;

  // Hit history for scoring (per ball)
  private lastHitter: number = -1;
  private secondLastHitter: number = -1;
  private spinActivatedAt: number = 0;
  private spinDelayActive = false;

  constructor(
    mesh: BABYLON.Mesh,
    impostor: BABYLON.PhysicsImpostor,
    baseY: number,
    config: BallEntityConfig = {}
  ) {
    this.mesh = mesh;
    this.impostor = impostor;
    this.baseY = baseY;
    // Use tuned defaults from earlier implementation
    this.magnusCoefficient = config.magnusCoefficient ?? 0.14;
    this.spinDecayFactor = config.spinDecayFactor ?? 0.98;
    this.spinDelayMs = config.spinDelayMs ?? GameConfig.getSpinDelayMs();
    this.spinTransferFactor = config.spinTransferFactor ?? 1.0;
    this.impulseScale = config.impulseScale ?? 0.016;
  }

  /** Apply paddle spin to this ball */
  applySpinFromPaddle(paddleVelocity: BABYLON.Vector3): void {
    // Scale paddle velocity contribution to spin for a more noticeable curve
    this.spin.addInPlace(paddleVelocity.scale(this.spinTransferFactor));
    this.spinActivatedAt = performance.now();
    this.spinDelayActive = true;
  }

  /** Apply Magnus force to curve the ball */
  applyMagnusForce(): void {
    const body = this.impostor;
    if (!body) return;
    const vel = body.getLinearVelocity();
    if (!vel) return;

    const now = performance.now();
    if (now - this.spinActivatedAt < this.spinDelayMs) {
      return;
    }
    if (this.spinDelayActive) {
      this.spinDelayActive = false;
    }

    const spinMag = this.spin.length();
    if (spinMag < 0.001) return;

    // Magnus force = spin x velocity, scaled
    const magnus = BABYLON.Vector3.Cross(this.spin, vel).scale(this.magnusCoefficient);

    // Match prior plane handling: if there is Y-component, redirect it into XZ plane
    if (Math.abs(magnus.y) > 0.001) {
      const vXZ = new BABYLON.Vector3(vel.x, 0, vel.z);
      if (vXZ.length() > 0.001) {
        // Perpendicular to velocity in XZ plane (use same orientation as tuned version)
        const perpendicular = new BABYLON.Vector3(vXZ.z, 0, -vXZ.x).normalize();
        const magnusForceXZ = perpendicular.scale(magnus.y);
        magnus.x = magnusForceXZ.x;
        magnus.z = magnusForceXZ.z;
      }
    }
    magnus.y = 0; // ensure no Y curving

    // Small impulse based on configured scale (~frame time)
    const impulse = magnus.scale(this.impulseScale);
    body.applyImpulse(impulse, this.mesh.position);
  }

  setSpinDelay(delayMs: number): void {
    const clamped = Math.max(0, delayMs);
    this.spinDelayMs = clamped;
    if (this.spinDelayActive && performance.now() - this.spinActivatedAt >= this.spinDelayMs) {
      this.spinDelayActive = false;
    }
  }

  /** Decay spin over time */
  decaySpin(): void {
    this.spin.scaleInPlace(this.spinDecayFactor);
    if (this.spin.length() < 0.01) this.spin.set(0, 0, 0);
  }

  /** Lock Y velocity and position to the play plane */
  lockToPlane(): void {
    const v = this.impostor.getLinearVelocity();
    if (v && Math.abs(v.y) > 0.0001) {
      this.impostor.setLinearVelocity(new BABYLON.Vector3(v.x, 0, v.z));
    }
    if (Math.abs(this.mesh.position.y - this.baseY) > 0.001) {
      this.mesh.position.y = this.baseY;
      const body: any = this.impostor.physicsBody;
      if (body) body.position.y = this.baseY;
    }
  }

  /** Normalize speed to a target (XZ) */
  normalizeSpeed(targetSpeed: number): void {
    const v = this.impostor.getLinearVelocity();
    if (!v) return;
    const xz = new BABYLON.Vector3(v.x, 0, v.z);
    const spd = xz.length();
    if (spd <= 0.0001) return;
    const scaled = xz.scale(targetSpeed / spd);
    this.impostor.setLinearVelocity(new BABYLON.Vector3(scaled.x, 0, scaled.z));
  }

  /** Per-frame update */
  update(targetSpeed: number): void {
    this.applyMagnusForce();
    this.decaySpin();
    this.lockToPlane();
    this.normalizeSpeed(targetSpeed);
  }

  /** Reset spin/effect state */
  resetEffects(): void {
    this.spin.set(0, 0, 0);
    this.spinActivatedAt = 0;
    this.spinDelayActive = false;
  }

  // ---- Convenience velocity helpers (encapsulate physics access) ----

  /** Get full 3D velocity from physics */
  getVelocity(): BABYLON.Vector3 | null {
    const v = this.impostor.getLinearVelocity();
    return v ? v.clone() : null;
  }

  /** Set full 3D velocity (Y will be clamped to 0 on next update) */
  setVelocity(v: BABYLON.Vector3): void {
    this.impostor.setLinearVelocity(v);
  }

  /** Get XZ velocity (Y=0) */
  getVelocityXZ(): BABYLON.Vector3 | null {
    const v = this.impostor.getLinearVelocity();
    return v ? new BABYLON.Vector3(v.x, 0, v.z) : null;
  }

  /** Directly set XZ velocity and zero Y */
  setVelocityXZ(vxz: BABYLON.Vector3): void {
    this.impostor.setLinearVelocity(new BABYLON.Vector3(vxz.x, 0, vxz.z));
  }

  /** Current XZ speed magnitude */
  getSpeedXZ(): number {
    const v = this.getVelocityXZ();
    return v ? v.length() : 0;
  }

  /** Set XZ direction and speed (normalizes direction internally) */
  setDirectionXZ(direction: BABYLON.Vector3, speed: number): void {
    const dir = new BABYLON.Vector3(direction.x, 0, direction.z);
    if (dir.lengthSquared() < 1e-8) return;
    const n = dir.normalize();
    this.setVelocityXZ(n.scale(speed));
  }

  // ---- Hit history API ----
  recordHit(paddleIndex: number): void {
    if (this.lastHitter !== paddleIndex) {
      this.secondLastHitter = this.lastHitter;
    }
    this.lastHitter = paddleIndex;
  }

  resetHitHistory(): void {
    this.lastHitter = -1;
    this.secondLastHitter = -1;
  }

  getLastHitter(): number { return this.lastHitter; }
  getSecondLastHitter(): number { return this.secondLastHitter; }

  /** Directly set hit history (used when cloning/splitting) */
  setHitHistory(last: number, second: number): void {
    this.lastHitter = typeof last === 'number' ? last : -1;
    this.secondLastHitter = typeof second === 'number' ? second : -1;
  }
}
