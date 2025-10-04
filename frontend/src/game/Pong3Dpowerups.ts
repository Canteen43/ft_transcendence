import * as BABYLON from '@babylonjs/core';
import '@babylonjs/core/Meshes/meshBuilder';
import { PowerupEntity } from './PowerupEntity';

export type PowerupType = 'split' | 'boost' | 'stretch' | 'shrink';

export const POWERUP_SESSION_FLAGS: Record<PowerupType, string> = {
	split: 'split',
	boost: 'boost',
	stretch: 'stretch',
	shrink: 'shrink',
};

export interface PowerupManagerOptions {
    spawnMinSeconds?: number;
    spawnMaxSeconds?: number;
    driftSpeed?: number;
    assetUrl?: string;
    visualSpinSpeed?: number; // radians per second
    spawnScaleDurationSeconds?: number; // visual grow-in duration
}

interface BasePowerupPrototype {
	type: PowerupType;
	root: BABYLON.TransformNode;
	collisionMeshName: string;
	spawnHeight: number;
}

// Replaced by PowerupEntity

const DEFAULT_MIN_SPAWN = 5;
const DEFAULT_MAX_SPAWN = 10;
const DEFAULT_DRIFT_SPEED = 2;
const POWERUP_ASSET_URL = '/powerups.glb';

/**
 * Manages loading, spawning, and updating power-up discs for Pong3D.
 */
export class Pong3DPowerups {
	private blockedTypes: Set<PowerupType> = new Set();
	private scene: BABYLON.Scene;
	private options: Required<PowerupManagerOptions>;
	private baseMeshes: Map<PowerupType, BasePowerupPrototype> = new Map();
    private activePowerups: Map<string, PowerupEntity> = new Map();
	private nextSpawnInSeconds: number = Number.POSITIVE_INFINITY;
	private elapsedSinceSpawn: number = 0;
	private enabledTypes: Set<PowerupType> = new Set();
	private assetsLoaded = false;
	private spawningPaused = false;
    private getBallCollisionTargets: (() => BABYLON.PhysicsImpostor[]) | null = null;
    private getWallCollisionTargets: (() => BABYLON.PhysicsImpostor[]) | null = null;
    private onBallCollision: ((entity: PowerupEntity) => void) | null = null;
    private onWallCollision: ((entity: PowerupEntity) => void) | null = null;

    constructor(scene: BABYLON.Scene, options: PowerupManagerOptions = {}) {
        this.scene = scene;
        this.options = {
            spawnMinSeconds: options.spawnMinSeconds ?? DEFAULT_MIN_SPAWN,
            spawnMaxSeconds: options.spawnMaxSeconds ?? DEFAULT_MAX_SPAWN,
            driftSpeed: options.driftSpeed ?? DEFAULT_DRIFT_SPEED,
            assetUrl: options.assetUrl ?? POWERUP_ASSET_URL,
            visualSpinSpeed: options.visualSpinSpeed ?? 0.5,
            spawnScaleDurationSeconds: options.spawnScaleDurationSeconds ?? 0.25,
        };

		if (this.options.spawnMaxSeconds < this.options.spawnMinSeconds) {
			const tmp = this.options.spawnMinSeconds;
			this.options.spawnMinSeconds = this.options.spawnMaxSeconds;
			this.options.spawnMaxSeconds = tmp;
		}
	}

	/** Load power-up meshes and cache prototypes. */
	public async loadAssets(): Promise<void> {
		if (this.assetsLoaded) return;

		try {
			const result = await BABYLON.SceneLoader.ImportMeshAsync(
				'',
				'',
				this.options.assetUrl,
				this.scene
			);

			const discoveredTypes = new Set<PowerupType>();

			result.meshes.forEach(mesh => {
				if (!(mesh instanceof BABYLON.AbstractMesh)) return;

				const matchedType = this.identifyMeshType(mesh.name);
				if (!matchedType || this.baseMeshes.has(matchedType)) return;

				const root = this.resolvePowerupRoot(mesh);
				const collisionMesh = this.findCollisionMesh(root);
				if (!collisionMesh) {
					console.warn(`Power-up ${matchedType} is missing a collision mesh; skipping.`);
					return;
				}

				root.setEnabled(false);
				collisionMesh.isPickable = false;
				discoveredTypes.add(matchedType);

				const spawnHeight = collisionMesh.getAbsolutePosition().y;
				this.baseMeshes.set(matchedType, {
					type: matchedType,
					root,
					collisionMeshName: collisionMesh.name,
					spawnHeight,
				});
			});

			this.assetsLoaded = true;
			console.log(
				`🟡 Power-up assets loaded: ${Array.from(discoveredTypes).join(', ')}`
			);
			this.hidePrototypeMeshes();
			this.scheduleNextSpawn();
		} catch (error) {
			console.error('Failed to load power-up assets', error);
			throw error;
		}
	}

	/** Update enabled power-up types based on session flags. */
	public setEnabledTypes(types: PowerupType[]): void {
		this.enabledTypes = new Set(types);
	}

    public configureCollisionTracking(options: {
        getBallTargets?: () => BABYLON.PhysicsImpostor[];
        getWallTargets?: () => BABYLON.PhysicsImpostor[];
        onBallCollision?: (entity: PowerupEntity) => void;
        onWallCollision?: (entity: PowerupEntity) => void;
    }): void {
        this.getBallCollisionTargets = options.getBallTargets ?? null;
        this.getWallCollisionTargets = options.getWallTargets ?? null;
        this.onBallCollision = options.onBallCollision ?? null;
        this.onWallCollision = options.onWallCollision ?? null;

        if (this.activePowerups.size === 0) return;
        this.activePowerups.forEach(entity => {
            const impostor = entity.getPhysicsImpostor();
            if (impostor) {
                this.attachCollisionHandlers(impostor, entity);
            }
        });
    }

    public refreshCollisionHandlers(): void {
        if (this.activePowerups.size === 0) return;
        this.activePowerups.forEach(entity => {
            const impostor = entity.getPhysicsImpostor();
            if (impostor) {
                this.attachCollisionHandlers(impostor, entity);
            }
        });
    }

	/** Advance timers, spawn new power-ups if needed, and update active discs. */
    public update(
        deltaSeconds: number,
        paddles: (BABYLON.Mesh | null)[],
        onPickup: (type: PowerupType, paddleIndex: number, entity?: PowerupEntity) => void,
        terminateWhenOutOfBounds: (type: PowerupType) => void
    ): void {
		if (!this.assetsLoaded) return;

		this.elapsedSinceSpawn += deltaSeconds;
		if (
			!this.spawningPaused &&
			this.enabledTypes.size > 0 &&
			this.activePowerups.size === 0 &&
			this.elapsedSinceSpawn >= this.nextSpawnInSeconds
		) {
			this.spawnRandomPowerup();
			this.scheduleNextSpawn();
		}

		const disposals: string[] = [];
		this.activePowerups.forEach(entity => {
			entity.update(deltaSeconds);
			// Remove after collect animation finishes
			if ((entity as any).isCollectDone && (entity as any).isCollectDone()) {
				disposals.push(entity.id);
				return;
			}
			// Out of bounds removal when not collecting
			if (!(entity as any).collecting && this.isOutOfBounds(entity.root.position as BABYLON.Vector3)) {
				terminateWhenOutOfBounds(entity.type);
				disposals.push(entity.id);
				return;
			}
			// Pickup trigger when not already collecting
			if (!(entity as any).collecting) {
				const collector = this.findCollectingPaddle(entity.collisionMesh, paddles);
				if (collector !== -1) {
                onPickup(entity.type, collector, entity);
                // Begin shrink-into-paddle animation
                entity.beginCollect(paddles[collector]!);
				}
			}
		});
		disposals.forEach(id => this.removePowerup(id));
	}

	/** Remove all active power-up discs and reset spawn timing. */
	public clearActivePowerups(): void {
		this.activePowerups.forEach(entity => {
			entity.dispose();
		});
		this.activePowerups.clear();
		this.scheduleNextSpawn();
		this.hidePrototypeMeshes();
	}

	public setTypeBlocked(type: PowerupType, blocked: boolean): void {
		if (blocked) {
			this.blockedTypes.add(type);
		} else {
			this.blockedTypes.delete(type);
		}
	}

	public setSpawningPaused(paused: boolean): void {
		this.spawningPaused = paused;
	}

	/** Force-spawn a given power-up type (primarily for testing). */
	public spawnPowerup(type: PowerupType): void {
		if (!this.assetsLoaded) return;
		if (this.blockedTypes.has(type)) {
			return;
		}
		const base = this.baseMeshes.get(type);
			if (!base) {
				console.warn(`Power-up prototype missing for type: ${type}`);
			return;
		}
		this.createActivePowerupInstance(base);
	}

	private identifyMeshType(name: string | null | undefined): PowerupType | null {
		if (!name) return null;
		const normalized = name.toLowerCase();
		if (normalized.includes('powerup.split')) return 'split';
		if (normalized.includes('powerup.boost')) return 'boost';
		if (normalized.includes('powerup.stretch')) return 'stretch';
		if (normalized.includes('powerup.shrink')) return 'shrink';
		return null;
	}

	private scheduleNextSpawn(): void {
		this.elapsedSinceSpawn = 0;
		const min = this.options.spawnMinSeconds;
		const max = this.options.spawnMaxSeconds;
		const range = max - min;
		this.nextSpawnInSeconds = min + Math.random() * range;
	}

	private spawnRandomPowerup(): void {
		if (this.enabledTypes.size === 0) return;
		const available = Array.from(this.enabledTypes).filter(
			type => !this.blockedTypes.has(type)
		);
		if (available.length === 0) return;
		const selected = available[Math.floor(Math.random() * available.length)];
		const base = this.baseMeshes.get(selected);
		if (!base) {
			console.warn(
				`Attempted to spawn power-up of type ${selected} but prototype was not loaded.`
			);
			return;
		}
		this.createActivePowerupInstance(base);
	}

	private createActivePowerupInstance(base: BasePowerupPrototype): void {
		const cloneRoot = base.root.clone(
			`powerup.${base.type}.instance.${performance.now()}`,
			null
		);
		if (!cloneRoot) return;
		base.root.setEnabled(false);
		cloneRoot.setEnabled(true);
		const spawnY = Math.max(base.spawnHeight, 0.5);
		cloneRoot.position.set(0, spawnY, 0);

		const collisionMesh = this.findCollisionMesh(cloneRoot, base.collisionMeshName);
		if (!collisionMesh) {
			console.warn(`Power-up ${base.type} clone missing collision mesh; disposing.`);
			cloneRoot.dispose(true, true);
			return;
		}
		collisionMesh.isPickable = false;

		const direction = this.randomHorizontalDirection();
		const initialVelocity = direction.scale(this.options.driftSpeed);

		const active = this.setupPhysicsForPowerup(
			base,
			cloneRoot,
			collisionMesh,
			initialVelocity
		);

		this.activePowerups.set(active.id, active);

		console.log(`✨ Spawned power-up ${base.type} with velocity ${initialVelocity.toString()}`);
		this.hidePrototypeMeshes();
	}

    // Movement and spin handled by PowerupEntity

	private removePowerup(id: string): void {
		const entity = this.activePowerups.get(id);
		if (!entity) return;
		entity.dispose();
		this.activePowerups.delete(id);
		this.hidePrototypeMeshes();
	}

	private randomHorizontalDirection(): BABYLON.Vector3 {
		const angle = Math.random() * Math.PI * 2;
		return new BABYLON.Vector3(Math.cos(angle), 0, Math.sin(angle));
	}

    // Removed; handled inside entity

	private findCollectingPaddle(
		collisionMesh: BABYLON.AbstractMesh,
		paddles: (BABYLON.Mesh | null)[]
	): number {
		for (let i = 0; i < paddles.length; i++) {
			const paddle = paddles[i];
			if (!paddle) continue;
			if (collisionMesh.intersectsMesh(paddle, true)) {
				return i;
			}
		}
		return -1;
	}

	private isOutOfBounds(position: BABYLON.Vector3): boolean {
		const limit = 35; // Reuse court bounds (should match Pong3D out-of-bounds distance)
		return (
			Math.abs(position.x) > limit || Math.abs(position.z) > limit
		);
	}

	private hidePrototypeMeshes(): void {
		this.baseMeshes.forEach(proto => {
			if (proto.root.isDisposed()) return;
			if (proto.root.isEnabled()) {
				proto.root.setEnabled(false);
			}
		});
	}

	private attachCollisionHandlers(
		impostor: BABYLON.PhysicsImpostor,
		entity: PowerupEntity
	): void {
		if (this.getBallCollisionTargets) {
			const ballTargets = this.getBallCollisionTargets() ?? [];
			if (ballTargets.length > 0) {
				entity.registerCollisionTargets('ball', ballTargets, target => {
					impostor.registerOnPhysicsCollide(target, () => {
						if (this.onBallCollision) {
							this.onBallCollision(entity);
						}
					});
				});
			}
		}

		if (this.getWallCollisionTargets) {
			const wallTargets = this.getWallCollisionTargets() ?? [];
			if (wallTargets.length > 0) {
				entity.registerCollisionTargets('wall', wallTargets, target => {
					impostor.registerOnPhysicsCollide(target, () => {
						if (this.onWallCollision) {
							this.onWallCollision(entity);
						}
					});
				});
			}
		}
	}

	private setupPhysicsForPowerup(
		base: BasePowerupPrototype,
		cloneRoot: BABYLON.TransformNode,
		collisionMesh: BABYLON.Mesh,
		initialVelocity: BABYLON.Vector3
): PowerupEntity {
		cloneRoot.computeWorldMatrix(true);
		const worldPosition = cloneRoot.getAbsolutePosition();
		const worldRotation =
			cloneRoot.rotationQuaternion?.clone() ??
			BABYLON.Quaternion.FromEulerAngles(
				cloneRoot.rotation.x,
				cloneRoot.rotation.y,
				cloneRoot.rotation.z
			);

		collisionMesh.computeWorldMatrix(true);
		collisionMesh.refreshBoundingInfo();
		const bounds = collisionMesh.getBoundingInfo().boundingBox.extendSizeWorld;
		const radius = Math.max(bounds.x, bounds.z);
		const diameter = Math.max(radius * 2, 0.2);

		const physicsMesh = BABYLON.MeshBuilder.CreateSphere(
			`powerup.${base.type}.physics.${performance.now()}`,
			{ diameter },
			this.scene
		);
		physicsMesh.isVisible = false;
		physicsMesh.isPickable = false;
		physicsMesh.position.copyFrom(worldPosition);
		physicsMesh.rotationQuaternion = worldRotation;
		physicsMesh.layerMask = collisionMesh.layerMask;

		cloneRoot.parent = physicsMesh;
		cloneRoot.position = BABYLON.Vector3.Zero();
		cloneRoot.rotationQuaternion = BABYLON.Quaternion.Identity();
		cloneRoot.rotation = BABYLON.Vector3.Zero();

		collisionMesh.parent = cloneRoot;
		collisionMesh.setEnabled(true);

		const physicsImpostor = new BABYLON.PhysicsImpostor(
			physicsMesh,
			BABYLON.PhysicsImpostor.SphereImpostor,
			{
				mass: 3.0,
				restitution: 0.85,
				friction: 0.0,
			},
			this.scene
		);
		physicsImpostor.setLinearVelocity(initialVelocity);
		const physicsBody: any = physicsImpostor.physicsBody;
		if (physicsBody) {
			physicsBody.angularDamping = 0.9;
			physicsBody.linearDamping = 0.01;
		}

		const entity = new PowerupEntity({
			id: physicsMesh.uniqueId.toString(),
			type: base.type,
			physicsRoot: physicsMesh,
			visualRoot: cloneRoot,
			collisionMesh,
			physicsImpostor,
			initialVelocity: initialVelocity.clone(),
			planeY: worldPosition.y,
			visualSpinSpeed: this.options.visualSpinSpeed,
			spawnScaleDuration: this.options.spawnScaleDurationSeconds,
		});

		this.attachCollisionHandlers(physicsImpostor, entity);
		return entity;
	}

	private resolvePowerupRoot(mesh: BABYLON.AbstractMesh): BABYLON.TransformNode {
		let current: BABYLON.Node = mesh;
		const ownsPowerupName = (node: BABYLON.Node | null | undefined): boolean => {
			if (!node || !node.name) return false;
			return node.name.toLowerCase().includes('powerup');
		};
		while (
			current.parent &&
			current.parent instanceof BABYLON.TransformNode &&
			ownsPowerupName(current.parent)
		) {
			current = current.parent;
		}
		return current as BABYLON.TransformNode;
	}

	private findCollisionMesh(
		node: BABYLON.TransformNode,
		targetName?: string
	): BABYLON.Mesh | null {
		if (node instanceof BABYLON.Mesh) {
			return node;
		}
		const meshes = node.getChildMeshes(false);
		if (meshes.length === 0) return null;
		if (targetName) {
			const match = meshes.find(
				m => m.name === targetName && m instanceof BABYLON.Mesh
			);
			if (match) return match as BABYLON.Mesh;
		}
		const firstMesh = meshes.find(m => m instanceof BABYLON.Mesh);
		return firstMesh ? (firstMesh as BABYLON.Mesh) : null;
	}
}
