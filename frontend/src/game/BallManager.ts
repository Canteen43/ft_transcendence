import * as BABYLON from '@babylonjs/core';
import { BallEntity, type BallEntityConfig } from './BallEntity';

export class BallManager {
  private entities: BallEntity[] = [];
  private byImpostor = new Map<BABYLON.PhysicsImpostor, BallEntity>();
  private config: BallEntityConfig;

  constructor(config: BallEntityConfig = {}) {
    this.config = { ...config };
  }

  addSplitBall(
    mesh: BABYLON.Mesh,
    impostor: BABYLON.PhysicsImpostor,
    baseY: number
  ): BallEntity {
    const entity = new BallEntity(mesh, impostor, baseY, this.config);
    this.entities.push(entity);
    this.byImpostor.set(impostor, entity);
    return entity;
  }

  removeByImpostor(impostor: BABYLON.PhysicsImpostor | null | undefined): void {
    if (!impostor) return;
    const entity = this.byImpostor.get(impostor);
    if (!entity) return;
    this.byImpostor.delete(impostor);
    const idx = this.entities.indexOf(entity);
    if (idx !== -1) this.entities.splice(idx, 1);
  }

  findByImpostor(impostor: BABYLON.PhysicsImpostor | null | undefined): BallEntity | null {
    if (!impostor) return null;
    return this.byImpostor.get(impostor) ?? null;
  }

  applySpinToBall(impostor: BABYLON.PhysicsImpostor | null | undefined, paddleVelocity: BABYLON.Vector3): void {
    const entity = this.findByImpostor(impostor);
    if (!entity) return;
    entity.applySpinFromPaddle(paddleVelocity);
  }

  updateAll(targetSpeed: number): void {
    for (const e of this.entities) {
      e.update(targetSpeed);
    }
  }

  getEntities(): readonly BallEntity[] {
    return this.entities;
  }

  recordHit(impostor: BABYLON.PhysicsImpostor | null | undefined, paddleIndex: number): void {
    const e = this.findByImpostor(impostor);
    if (e) e.recordHit(paddleIndex);
  }

  resetHistories(): void {
    for (const e of this.entities) e.resetHitHistory();
  }

  resetEffectsAll(): void {
    for (const e of this.entities) e.resetEffects();
  }

  setSpinDelayMs(delayMs: number): void {
    this.config.spinDelayMs = delayMs;
    for (const entity of this.entities) {
      entity.setSpinDelay(delayMs);
    }
  }

  clear(): void {
    this.entities.length = 0;
    this.byImpostor.clear();
  }
}
