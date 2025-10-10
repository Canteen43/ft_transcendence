// ============================================================================
// Pong3D AI System - Reactive AI with Pulse-Based Control
// ============================================================================

import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';

interface WizardVisualState {
	primaryLine: BABYLON.LinesMesh | null;
	extraLines: BABYLON.LinesMesh[];
	bounceDots: BABYLON.Mesh[];
	goalDot: BABYLON.Mesh | null;
}

export interface AIBallSnapshot {
	id?: string;
	meshUniqueId?: number;
	bodyId?: number;
	position: { x: number; y: number; z: number };
	velocity: { x: number; y: number; z: number };
}

interface BallState {
	id: string; // canonical key used for tracking visuals/velocity history
	label: string; // human readable identifier for debugging
	position: BABYLON.Vector3;
	velocity: BABYLON.Vector3;
	meshUniqueId?: number;
	bodyId?: number;
}

interface TrajectoryResult {
	id: string;
	intersectsOwnGoal: boolean;
	localTarget: number | null;
	totalDistance: number;
}

/**
 * Global AI configuration constants
 */
const BALL_OUT_DISTANCE = 9.0; // Distance from origin beyond which AI targets center (meters)
/**
 * AI Input states - exactly matching human player inputs
 */
export enum AIInput {
	LEFT = 'left',
	RIGHT = 'right',
	STOP = 'stop',
}

/**
 * Configuration parameters for AI behavior tuning
 */
export interface AIConfig {
	/** How often AI recalculates target position (Hz) - lower = more strategic, higher = more responsive */
	sampleRate: number;
	/** How often AI issues movement impulses toward target (Hz) - controls responsiveness */
	impulseFrequency: number;
	/** Duration of each movement impulse in milliseconds */
	impulseDuration: number;
	/** Deadzone radius where AI doesn't move (units) - smaller = more precise positioning */
	centralLimit: number;
	/** Maximum X-coordinate limit for paddle movement (symmetric around center) */
	xLimit: number;
	/** Optional AI behaviour style overrides */
	style?: 'standard' | 'wizard';
	/** Optional debug ray length for predictive aiming (meters) */
	predictionRayLength?: number;
}

/**
 * Game state data provided to AI controllers
 * Contains only the information AI needs for decision making
 */
export interface GameStateForAI {
	balls: AIBallSnapshot[];
	primaryBallId?: string;
	/**
	 * @deprecated Maintained for transitional compatibility; prefer using `balls`.
	 */
	ball: AIBallSnapshot;
	/**
	 * @deprecated Maintained for transitional compatibility; prefer using `balls`.
	 */
	otherBalls?: AIBallSnapshot[];
	paddlePositionsX: number[];
	paddlePositionsAlongAxis: number[];
	/** Normalized lateral movement axis for each paddle projected onto XZ plane */
	paddleAxes: { x: number; z: number }[];
	/** World-space origin each paddle oscillates around (XZ plane) */
	paddleOrigins: { x: number; z: number }[];
	/** Court boundaries for ray casting */
	courtBounds: {
		xMin: number;
		xMax: number;
		zMin: number;
		zMax: number;
	};
	/** Physics context for advanced AI raycasting */
	physics?: {
		engine: any;
		scene: BABYLON.Scene;
	};
}

/**
 * Reactive AI controller for Pong3D
 *
 * Uses sample-based decision making with pulse control:
 * - Samples ball position at configurable intervals
 * - Calculates required paddle movement
 * - Issues short input pulses proportional to distance
 * - Returns to neutral between pulses
 */
	export class Pong3DAI {
	private config: AIConfig;
	private playerIndex: number;
	private lastSampleTime: number;
	private lastImpulseTime: number;
	private currentTargetX: number | null;
	private currentInput: AIInput;
	private inputEndTime: number;
	private targetDot: BABYLON.Mesh | null;
	private wizardVisuals = new Map<string, WizardVisualState>();
	private previousBallVelocities = new Map<string, BABYLON.Vector3>();
	private static wizardVisualizationEnabled = false;

	constructor(playerIndex: number, config: AIConfig) {
		this.playerIndex = playerIndex;
		this.config = config;
		this.lastSampleTime = 0;
		this.lastImpulseTime = 0;
		this.currentTargetX = null;
		this.currentInput = AIInput.STOP;
		this.inputEndTime = 0;
		this.targetDot = null;
		this.wizardVisuals = new Map();
		this.previousBallVelocities = new Map();
	}

	public static toggleWizardVisualization(force?: boolean): boolean {
		if (typeof force === 'boolean') {
			Pong3DAI.wizardVisualizationEnabled = force;
		} else {
			Pong3DAI.wizardVisualizationEnabled =
				!Pong3DAI.wizardVisualizationEnabled;
		}
		return Pong3DAI.wizardVisualizationEnabled;
	}

	public static isWizardVisualizationEnabled(): boolean {
		return Pong3DAI.wizardVisualizationEnabled;
	}

	/**
	 * Update AI state and return current input
	 * Called every frame by the input system (60 times/second)
	 */
	update(gameState: GameStateForAI): AIInput {
		const now = performance.now();

		// Check if current input pulse has expired
		if (now >= this.inputEndTime) {
			this.currentInput = AIInput.STOP;
		}

		// Check if it's time for a new sample/decision (at sampleRate Hz)
		if (now - this.lastSampleTime >= 1000 / this.config.sampleRate) {
			this.lastSampleTime = now;
			// Update target position using advanced prediction
			let predictedTarget =
				this.config.style === 'wizard'
					? this.performWizardPrediction(gameState)
					: this.predictBallTrajectory(gameState);

			// Apply paddle center offset correction (paddle width = 1.5m, so half = 0.75m)
			// The paddle positioning system uses center reference, so we need to adjust target
			if (predictedTarget !== null) {
				const paddleOffset = 0.75; // Half paddle width
				const shouldOffset = Math.abs(predictedTarget) > paddleOffset * 0.5;
				if (shouldOffset) {
					const originalTarget = predictedTarget;
					// Offset direction depends on target sign to align paddle center with target
					predictedTarget +=
						predictedTarget > 0 ? -paddleOffset : paddleOffset;
					if (GameConfig.isDebugLoggingEnabled()) {
						conditionalLog(
							`🤖 Player ${this.playerIndex + 1} offset: ${originalTarget.toFixed(3)} -> ${predictedTarget.toFixed(3)} (offset: ${(predictedTarget - originalTarget).toFixed(3)})`
						);
					}
				}
			}

			this.currentTargetX = predictedTarget;
			// Update visual target indicator
			//this.updateTargetDot(gameState);
		}

		// Check if it's time for a new movement impulse (at impulseFrequency Hz)
		if (now - this.lastImpulseTime >= 1000 / this.config.impulseFrequency) {
			this.lastImpulseTime = now;

			// Every impulse cycle: calculate movement toward current target
				if (this.currentTargetX !== null) {
					const paddlePosition = this.getPaddlePositionAlongAxis(gameState);
					const deltaX = this.currentTargetX - paddlePosition;

					if (GameConfig.isDebugLoggingEnabled()) {
						conditionalLog(
							`🤖 Player ${this.playerIndex + 1} movement: paddle=${paddlePosition.toFixed(3)}, target=${this.currentTargetX.toFixed(3)}, delta=${deltaX.toFixed(3)}`
						);
					}

				// Within deadzone - no movement needed
				if (Math.abs(deltaX) <= this.config.centralLimit) {
					this.currentInput = AIInput.STOP;
					return this.currentInput;
				}

				// Check boundary limits before moving
					let desiredInput = AIInput.STOP;
					if (deltaX < 0 && paddlePosition > -this.config.xLimit) {
						desiredInput = AIInput.LEFT;
					} else if (deltaX > 0 && paddlePosition < this.config.xLimit) {
						desiredInput = AIInput.RIGHT;
				}

				// Issue a new impulse with configured duration
				if (desiredInput !== AIInput.STOP) {
					this.currentInput = desiredInput;
					this.inputEndTime = now + this.config.impulseDuration;
				}
			}
		}

		return this.currentInput;
	}

	/**
	 * Resolve the player's movement axis from the shared game state.
	 */
	private getPlayerAxis(gameState: GameStateForAI): BABYLON.Vector3 {
		const axisData = gameState.paddleAxes?.[this.playerIndex];
		if (axisData) {
			const axisVec = new BABYLON.Vector3(axisData.x, 0, axisData.z);
			if (axisVec.lengthSquared() > 1e-6) {
				return BABYLON.Vector3.Normalize(axisVec);
			}
		}
		return BABYLON.Vector3.Right();
	}

	/** Get the world-space origin the paddle oscillates around. */
	private getPlayerOrigin(gameState: GameStateForAI): BABYLON.Vector3 {
		const originData = gameState.paddleOrigins?.[this.playerIndex];
		if (originData) {
			return new BABYLON.Vector3(originData.x, 0, originData.z);
		}
		return BABYLON.Vector3.Zero();
	}

	private getBallSnapshots(gameState: GameStateForAI): AIBallSnapshot[] {
		if (gameState.balls && gameState.balls.length > 0) {
			return gameState.balls;
		}
		const fallback: AIBallSnapshot[] = [];
		if (gameState.ball) {
			fallback.push(gameState.ball);
		}
		if (gameState.otherBalls && gameState.otherBalls.length > 0) {
			fallback.push(...gameState.otherBalls);
		}
		return fallback;
	}

	private getPrimaryBallSnapshot(
		gameState: GameStateForAI
	): AIBallSnapshot | null {
		const snapshots = this.getBallSnapshots(gameState);
		if (snapshots.length === 0) {
			return null;
		}
		if (gameState.primaryBallId) {
			const primary = snapshots.find(
				snapshot => snapshot.id && snapshot.id === gameState.primaryBallId
			);
			if (primary) {
				return primary;
			}
		}
		return snapshots[0];
	}

	private resolveBallIdentity(
		snapshot: AIBallSnapshot,
		index: number
	): { key: string; label: string } {
		const { id, meshUniqueId, bodyId } = snapshot;
		const label =
			id ??
			(typeof meshUniqueId === 'number'
				? `ball_${meshUniqueId}`
				: `ball_${index}`);
		if (typeof bodyId === 'number') {
			return { key: `body_${bodyId}`, label };
		}
		if (typeof meshUniqueId === 'number') {
			return { key: `mesh_${meshUniqueId}`, label };
		}
		if (id) {
			return { key: `id_${id}`, label };
		}
		return { key: `anon_${index}`, label };
	}

	/** Project an arbitrary point onto the player's local movement axis. */
	private projectOntoAxis(
		position: BABYLON.Vector3,
		origin: BABYLON.Vector3,
		axis: BABYLON.Vector3
	): number {
		const axisLengthSq = axis.lengthSquared();
		if (axisLengthSq <= 1e-6) {
			// Fallback to world X displacement if axis data is unavailable
			return position.x - origin.x;
		}
		const axisNorm = axisLengthSq === 1
			? axis
			: BABYLON.Vector3.Normalize(axis);
		const relative = position.subtract(origin);
		return BABYLON.Vector3.Dot(relative, axisNorm);
	}

	private doesMeshBelongToPlayerGoal(mesh?: BABYLON.AbstractMesh | null): boolean {
		if (!mesh) return false;
		const name = mesh.name?.toLowerCase() ?? '';
		const expected = `goal${this.playerIndex + 1}`;
		return name.includes(expected);
	}

	private getBallPositionAlongAxis(gameState: GameStateForAI): number {
		const paddleAxis = this.getPlayerAxis(gameState);
		const paddleOrigin = this.getPlayerOrigin(gameState);
		const ballSnapshot = this.getPrimaryBallSnapshot(gameState);
		if (!ballSnapshot) {
			return 0;
		}
		const ballPos = new BABYLON.Vector3(
			ballSnapshot.position.x,
			0,
			ballSnapshot.position.z
		);
		return this.projectOntoAxis(ballPos, paddleOrigin, paddleAxis);
	}

	private getPaddlePositionAlongAxis(gameState: GameStateForAI): number {
		return (
			gameState.paddlePositionsAlongAxis?.[this.playerIndex] ??
			gameState.paddlePositionsX[this.playerIndex] ??
			0
		);
	}

	/**
	 * Get the distance between ball and paddle along the paddle's movement axis.
	 * Positive = ball is toward the paddle's "right" direction.
	 */
	private getTargetDeltaX(gameState: GameStateForAI): number {
		const ballAlongAxis = this.getBallPositionAlongAxis(gameState);
		const paddleAlongAxis = this.getPaddlePositionAlongAxis(gameState);
		return ballAlongAxis - paddleAlongAxis;
	}

	/** Convert a local-axis displacement back to world coordinates. */
	private getWorldPositionFromAxis(
		localPosition: number,
		gameState: GameStateForAI
	): BABYLON.Vector3 {
		const axis = this.getPlayerAxis(gameState);
		const origin = this.getPlayerOrigin(gameState);
		return origin.add(axis.scale(localPosition));
	}

	/**
	 * Perform wizard-style prediction: trace the ball path with reflections until a goal hit.
	 * Returns the local-axis target position for the paddle.
	 */
	private performWizardPrediction(gameState: GameStateForAI): number | null {
		const physics = gameState.physics;
		if (!physics || !physics.scene) {
			this.disableWizardVisuals();
			return this.getBallPositionAlongAxis(gameState);
		}

		const ballStates = this.buildBallStates(gameState);
		if (ballStates.length === 0) {
			this.disableWizardVisuals();
			return this.getBallPositionAlongAxis(gameState);
		}

		const scene = physics.scene;
		const physicsEngine = scene.getPhysicsEngine();
		const plugin = physicsEngine?.getPhysicsPlugin?.();
		const world: CANNON.World | undefined = (plugin as any)?.world;
		const maxBounces = 8;
		const raySegmentLength = this.config.predictionRayLength ?? 20;
		const predicate = (mesh: BABYLON.AbstractMesh): boolean => {
			if (!mesh.physicsImpostor) return false;
			if (mesh.physicsImpostor.type !== BABYLON.PhysicsImpostor.MeshImpostor)
				return false;
			const name = mesh.name?.toLowerCase() || '';
			return /wall/.test(name) || /goal/.test(name);
		};
		const results: TrajectoryResult[] = [];
		ballStates.forEach((state, idx) => {
			results.push(
				this.traceWizardTrajectory(
					state,
					gameState,
					scene,
					idx,
					world,
					maxBounces,
					raySegmentLength,
					predicate
				)
			);
		});

		const activeIds = new Set(results.map(r => r.id));
		if (!Pong3DAI.isWizardVisualizationEnabled()) {
			this.disableWizardVisuals();
		} else {
			this.cleanupWizardVisuals(activeIds);
		}
		for (const key of Array.from(this.previousBallVelocities.keys())) {
			if (!activeIds.has(key)) {
				this.previousBallVelocities.delete(key);
			}
		}

		const best = results
			.filter(r => r.intersectsOwnGoal && r.localTarget !== null)
			.sort((a, b) => a.totalDistance - b.totalDistance)[0];

		if (best && best.localTarget !== null) {
			return best.localTarget;
		}

		return 0;
	}

	private findMeshForPhysicsBody(
		scene: BABYLON.Scene,
		body: CANNON.Body | null
	): BABYLON.AbstractMesh | null {
		if (!body) return null;
		for (const mesh of scene.meshes) {
			if (mesh.physicsImpostor?.physicsBody === body) {
				return mesh;
			}
		}
		return null;
	}

	private disableWizardVisuals(): void {
		this.wizardVisuals.forEach(visual => {
			if (visual.primaryLine && !visual.primaryLine.isDisposed()) {
				visual.primaryLine.setEnabled(false);
			}
			for (const line of visual.extraLines) {
				if (line && !line.isDisposed()) line.setEnabled(false);
			}
			for (const dot of visual.bounceDots) {
				if (dot && !dot.isDisposed()) dot.setEnabled(false);
			}
			if (visual.goalDot && !visual.goalDot.isDisposed()) {
				visual.goalDot.setEnabled(false);
			}
		});
	}

	private markNoShadows(
		mesh: BABYLON.AbstractMesh | BABYLON.Mesh | BABYLON.LinesMesh | null
	): void {
		if (!mesh || mesh.isDisposed()) return;
		(mesh as any).doNotCastShadows = true;
	}

	private getWizardVisual(id: string): WizardVisualState {
		let visual = this.wizardVisuals.get(id);
		if (!visual) {
			visual = {
				primaryLine: null,
				extraLines: [],
				bounceDots: [],
				goalDot: null,
			};
			this.wizardVisuals.set(id, visual);
		}
		return visual;
	}

	private updateWizardVisual(
		id: string,
		segments: Array<{ start: BABYLON.Vector3; end: BABYLON.Vector3 }>,
		bouncePoints: BABYLON.Vector3[],
		goalPoint: BABYLON.Vector3 | null,
		scene: BABYLON.Scene,
		planeY: number,
		color: BABYLON.Color3
	): void {
		const visual = this.getWizardVisual(id);
		if (segments.length === 0) {
			if (visual.primaryLine && !visual.primaryLine.isDisposed()) {
				visual.primaryLine.setEnabled(false);
			}
			for (const line of visual.extraLines) {
				if (line && !line.isDisposed()) line.setEnabled(false);
			}
			for (const dot of visual.bounceDots) {
				if (dot && !dot.isDisposed()) dot.setEnabled(false);
			}
			if (visual.goalDot && !visual.goalDot.isDisposed()) {
				visual.goalDot.setEnabled(false);
			}
			return;
		}

		const primaryPoints = [segments[0].start, segments[0].end];
		visual.primaryLine = this.updateLineMesh(
			visual.primaryLine,
			`aiWizardRay_player${this.playerIndex}_${id}`,
			primaryPoints,
			scene,
			color
		);
		if (visual.primaryLine) {
			visual.primaryLine.isPickable = false;
			this.markNoShadows(visual.primaryLine);
		}

		const extraCount = segments.length - 1;
		for (let i = 0; i < extraCount; i++) {
			const segment = segments[i + 1];
			const points = [segment.start, segment.end];
			const updated = this.updateLineMesh(
				visual.extraLines[i] ?? null,
				`aiWizardExtraRay_player${this.playerIndex}_${id}_${i}`,
				points,
				scene,
				color
			);
			visual.extraLines[i] = updated;
			if (updated) {
				updated.isPickable = false;
				this.markNoShadows(updated);
			}
		}
		for (let i = extraCount; i < visual.extraLines.length; i++) {
			const line = visual.extraLines[i];
			if (line && !line.isDisposed()) line.setEnabled(false);
		}
		visual.extraLines.length = extraCount;

		for (let i = 0; i < bouncePoints.length; i++) {
			const point = bouncePoints[i];
			point.y = planeY;
			let dot = visual.bounceDots[i];
			if (!dot || dot.isDisposed()) {
				dot = BABYLON.MeshBuilder.CreateSphere(
					`aiWizardBounce_player${this.playerIndex}_${id}_${i}`,
					{ diameter: 0.12 },
					scene
				);
				const material = new BABYLON.StandardMaterial(
					`aiWizardBounceMat_player${this.playerIndex}_${id}_${i}`,
					scene
				);
				material.emissiveColor = new BABYLON.Color3(1, 0.078, 0.576);
				material.disableLighting = true;
				dot.material = material;
				visual.bounceDots[i] = dot;
			}
			dot.isPickable = false;
			dot.receiveShadows = false;
			this.markNoShadows(dot);
			dot.position.copyFrom(point);
			dot.setEnabled(true);
		}
		for (let i = bouncePoints.length; i < visual.bounceDots.length; i++) {
			const dot = visual.bounceDots[i];
			if (dot && !dot.isDisposed()) dot.setEnabled(false);
		}

		if (goalPoint) {
			if (!visual.goalDot || visual.goalDot.isDisposed()) {
				visual.goalDot = BABYLON.MeshBuilder.CreateSphere(
					`aiWizardGoal_player${this.playerIndex}_${id}`,
					{ diameter: 0.18 },
					scene
				);
				const material = new BABYLON.StandardMaterial(
					`aiWizardGoalMat_player${this.playerIndex}_${id}`,
					scene
				);
				material.emissiveColor = new BABYLON.Color3(0.2, 1, 0.2);
				material.disableLighting = true;
				visual.goalDot.material = material;
			}
			visual.goalDot!.isPickable = false;
			visual.goalDot!.receiveShadows = false;
			this.markNoShadows(visual.goalDot!);
			const dotPosition = new BABYLON.Vector3(goalPoint.x, planeY, goalPoint.z);
			visual.goalDot.position.copyFrom(dotPosition);
			visual.goalDot.setEnabled(true);
		} else if (visual.goalDot && !visual.goalDot.isDisposed()) {
			visual.goalDot.setEnabled(false);
		}
	}

	private cleanupWizardVisuals(activeIds: Set<string>): void {
		for (const [id, visual] of Array.from(this.wizardVisuals.entries())) {
			if (!activeIds.has(id)) {
				if (visual.primaryLine && !visual.primaryLine.isDisposed()) {
					visual.primaryLine.setEnabled(false);
				}
				for (const line of visual.extraLines) {
					if (line && !line.isDisposed()) line.setEnabled(false);
				}
				for (const dot of visual.bounceDots) {
					if (dot && !dot.isDisposed()) dot.setEnabled(false);
				}
				if (visual.goalDot && !visual.goalDot.isDisposed()) {
					visual.goalDot.setEnabled(false);
				}
				this.wizardVisuals.delete(id);
			}
		}
	}

	private getWizardLineColorForBall(ballIndex: number): BABYLON.Color3 {
		const base = this.getWizardLineColor();
		if (ballIndex === 0) return base;
		const factor = 0.6;
		return new BABYLON.Color3(
			base.r * factor + (1 - factor),
			base.g * factor + (1 - factor),
			base.b * factor + (1 - factor)
		);
	}

	private buildBallStates(gameState: GameStateForAI): BallState[] {
		const snapshots = this.getBallSnapshots(gameState);
		const rawStates = snapshots.map((snapshot, index) => {
			const { key, label } = this.resolveBallIdentity(snapshot, index);
			return {
				id: key,
				label,
				position: new BABYLON.Vector3(
					snapshot.position.x,
					snapshot.position.y,
					snapshot.position.z
				),
				velocity: new BABYLON.Vector3(
					snapshot.velocity.x,
					snapshot.velocity.y,
					snapshot.velocity.z
				),
				meshUniqueId: snapshot.meshUniqueId,
				bodyId: snapshot.bodyId,
			};
		});

		return rawStates.map(state => {
			const velocityLengthSq = state.velocity.lengthSquared();
			if (velocityLengthSq <= 1e-6) {
				const fallback = this.previousBallVelocities.get(state.id);
				if (fallback && fallback.lengthSquared() > 1e-6) {
					state.velocity = fallback.clone();
				}
			} else {
				this.previousBallVelocities.set(state.id, state.velocity.clone());
			}
			return state;
		});
	}

private traceWizardTrajectory(
		state: BallState,
		gameState: GameStateForAI,
		scene: BABYLON.Scene,
		ballIndex: number,
		world: CANNON.World | undefined,
		maxBounces: number,
		raySegmentLength: number,
		predicate: (mesh: BABYLON.AbstractMesh) => boolean
	): TrajectoryResult {
		const id = state.id;
		const color = this.getWizardLineColorForBall(ballIndex);
		const segments: Array<{ start: BABYLON.Vector3; end: BABYLON.Vector3 }> = [];
		const bouncePoints: BABYLON.Vector3[] = [];
		let goalPoint: BABYLON.Vector3 | null = null;
		let intersectsOwnGoal = false;
		let totalDistance = 0;

		const velocityLengthSq = state.velocity.lengthSquared();
		const planeY = state.position.y;
		if (velocityLengthSq <= 1e-6) {
			if (Pong3DAI.isWizardVisualizationEnabled()) {
				this.updateWizardVisual(state.id, [], [], null, scene, planeY, color);
			}
			return {
				id,
				intersectsOwnGoal: false,
				localTarget: null,
				totalDistance: Number.POSITIVE_INFINITY,
			};
		}

		let currentOrigin = state.position.clone();
		let currentDirection = state.velocity.normalize();
		let displayStart = new BABYLON.Vector3(currentOrigin.x, planeY, currentOrigin.z);
		let previousPoint3D = currentOrigin.clone();

		const cannonWorld = world;

		for (let bounce = 0; bounce < maxBounces; bounce++) {
			const segmentStart = displayStart.clone();
		let hitPoint3D: BABYLON.Vector3 | null = null;
		let hitNormal: BABYLON.Vector3 | null = null;
		let hitMesh: BABYLON.AbstractMesh | null = null;
		let hitBodyId: number | undefined;

				const ray = new BABYLON.Ray(
					currentOrigin.clone(),
					currentDirection.clone(),
					raySegmentLength
				);
				let bestDistance = Number.POSITIVE_INFINITY;
				let bestPoint: BABYLON.Vector3 | null = null;
				let bestNormal: BABYLON.Vector3 | null = null;
				let bestMesh: BABYLON.AbstractMesh | null = null;
				let bestBodyId: number | undefined;
				let fallbackDistance = Number.POSITIVE_INFINITY;
				let fallbackPoint: BABYLON.Vector3 | null = null;
				let fallbackNormal: BABYLON.Vector3 | null = null;
				let fallbackMesh: BABYLON.AbstractMesh | null = null;
				let fallbackBodyId: number | undefined;

				if (cannonWorld) {
					const result = new CANNON.RaycastResult();
					const fromVec = new CANNON.Vec3(
						currentOrigin.x,
						currentOrigin.y,
						currentOrigin.z
					);
					const toVec = new CANNON.Vec3(
						currentOrigin.x + currentDirection.x * raySegmentLength,
						currentOrigin.y + currentDirection.y * raySegmentLength,
						currentOrigin.z + currentDirection.z * raySegmentLength
					);
					cannonWorld.raycastClosest(fromVec, toVec, { skipBackfaces: false } as any, result);
					if (result.hasHit) {
						const point = new BABYLON.Vector3(
							result.hitPointWorld.x,
							result.hitPointWorld.y,
							result.hitPointWorld.z
						);
						const normalVec = new BABYLON.Vector3(
							result.hitNormalWorld.x,
							result.hitNormalWorld.y,
							result.hitNormalWorld.z
						);
						const normalizedNormal =
							normalVec.lengthSquared() > 1e-6 ? normalVec.normalize() : null;
						const distanceAlongRay = BABYLON.Vector3.Dot(
							point.subtract(currentOrigin),
							currentDirection
						);
						if (distanceAlongRay > 1e-3) {
							const normalOpposesRay =
								normalizedNormal
									? BABYLON.Vector3.Dot(normalizedNormal, currentDirection) <= -1e-3
									: false;
							if (normalOpposesRay) {
								if (distanceAlongRay < bestDistance) {
									bestDistance = distanceAlongRay;
									bestPoint = point.clone();
									bestNormal = normalizedNormal;
									bestMesh = this.findMeshForPhysicsBody(scene, result.body);
									bestBodyId = result.body?.id;
								}
							} else if (distanceAlongRay < fallbackDistance) {
								fallbackDistance = distanceAlongRay;
								fallbackPoint = point.clone();
								fallbackNormal = normalizedNormal;
								fallbackMesh = this.findMeshForPhysicsBody(scene, result.body);
								fallbackBodyId = result.body?.id;
							}
						}
					}
				}

				const picks = scene.multiPickWithRay(ray, predicate) ?? [];
				for (const pick of picks) {
					if (!pick || !pick.hit || !pick.pickedPoint) continue;
					const point = pick.pickedPoint.clone();
					const distanceFromPick =
						pick.distance !== undefined
							? pick.distance
							: BABYLON.Vector3.Dot(
								point.subtract(currentOrigin),
								currentDirection
							);
					if (distanceFromPick <= 1e-3) {
						continue;
					}
					const pickNormal = pick.getNormal(true, true) || pick.getNormal(true);
					const normalizedNormal = pickNormal && pickNormal.lengthSquared() > 1e-6
						? BABYLON.Vector3.Normalize(pickNormal)
						: null;
					const normalOpposesRay =
						normalizedNormal
							? BABYLON.Vector3.Dot(normalizedNormal, currentDirection) <= -1e-3
							: false;
					if (normalOpposesRay) {
						if (distanceFromPick < bestDistance) {
							bestDistance = distanceFromPick;
							bestPoint = point;
							bestNormal = normalizedNormal;
							bestMesh = pick.pickedMesh || null;
							bestBodyId = pick.pickedMesh?.physicsImpostor?.physicsBody?.id;
						}
					} else if (distanceFromPick < fallbackDistance) {
						fallbackDistance = distanceFromPick;
						fallbackPoint = point;
						fallbackNormal = normalizedNormal;
						fallbackMesh = pick.pickedMesh || null;
						fallbackBodyId = pick.pickedMesh?.physicsImpostor?.physicsBody?.id;
					}
				}

				if (bestPoint) {
					hitPoint3D = bestPoint.clone();
					hitNormal = bestNormal;
					hitMesh = bestMesh;
					hitBodyId = bestBodyId;
				} else if (fallbackPoint) {
					hitPoint3D = fallbackPoint.clone();
					hitNormal = fallbackNormal;
					hitMesh = fallbackMesh;
					hitBodyId = fallbackBodyId;
				}

				if (!hitNormal || hitNormal.lengthSquared() <= 1e-6) {
					const fallbackPick = picks.find(p => p?.hit && p.pickedPoint);
					if (fallbackPick) {
						const pickNormal =
							fallbackPick.getNormal(true, true) || fallbackPick.getNormal(true);
						if (pickNormal && pickNormal.lengthSquared() > 1e-6) {
							hitNormal = BABYLON.Vector3.Normalize(pickNormal);
						}
					}
				}

			if (hitPoint3D) {
				const bodySelf =
					state.bodyId !== undefined &&
					hitBodyId !== undefined &&
					hitBodyId === state.bodyId;
				const meshSelf =
					state.meshUniqueId !== undefined &&
					hitMesh &&
					hitMesh.uniqueId === state.meshUniqueId;
				if (bodySelf || meshSelf) {
					const safePoint = hitPoint3D.add(currentDirection.scale(0.3));
					currentOrigin = safePoint;
					displayStart = new BABYLON.Vector3(safePoint.x, planeY, safePoint.z);
					previousPoint3D = safePoint.clone();
					bounce--;
					continue;
				}
			}

			if (!hitPoint3D) {
				const endPoint = currentOrigin.add(currentDirection.scale(raySegmentLength));
				segments.push({
					start: segmentStart,
					end: new BABYLON.Vector3(endPoint.x, planeY, endPoint.z),
				});
				totalDistance += BABYLON.Vector3.Distance(previousPoint3D, endPoint);
				break;
			}

			const flattenedHit = new BABYLON.Vector3(
				hitPoint3D.x,
				planeY,
				hitPoint3D.z
			);
			segments.push({ start: segmentStart, end: flattenedHit.clone() });
			totalDistance += BABYLON.Vector3.Distance(previousPoint3D, hitPoint3D);
			previousPoint3D = hitPoint3D.clone();

			const meshName = hitMesh?.name?.toLowerCase() || '';
			const isGoalHit = /goal/.test(meshName);
			const isWallHit = /wall/.test(meshName);
			if (!isGoalHit && !isWallHit) {
				const skipDistance = meshName.includes('ball') ? 0.8 : 0.2;
				const safePoint = hitPoint3D.add(currentDirection.scale(skipDistance));
				currentOrigin = safePoint;
				displayStart = new BABYLON.Vector3(safePoint.x, planeY, safePoint.z);
				previousPoint3D = safePoint.clone();
				bounce--;
				continue;
			}

			if (!hitNormal || hitNormal.lengthSquared() <= 1e-6) {
				break;
			}
			if (BABYLON.Vector3.Dot(hitNormal, currentDirection) > 0) {
				hitNormal = hitNormal.negate();
			}

			if (isGoalHit) {
				if (this.doesMeshBelongToPlayerGoal(hitMesh)) {
					goalPoint = flattenedHit.clone();
					intersectsOwnGoal = true;
				}
				break;
			}

			const reflection = BABYLON.Vector3.Reflect(currentDirection, hitNormal);
			if (reflection.lengthSquared() <= 1e-6) {
				break;
			}

			bouncePoints.push(flattenedHit.clone());

			const reflectionDirection = reflection.normalize();
			currentOrigin = hitPoint3D.add(reflectionDirection.scale(0.05));
			currentDirection = reflectionDirection;
			displayStart = flattenedHit.clone();
			previousPoint3D = currentOrigin.clone();
		}

		if (Pong3DAI.isWizardVisualizationEnabled()) {
			this.updateWizardVisual(
				id,
				segments,
				bouncePoints,
				goalPoint,
				scene,
				planeY,
				color
			);
		}

		let localTarget: number | null = null;
		if (intersectsOwnGoal && goalPoint) {
			const paddleAxis = this.getPlayerAxis(gameState);
			const paddleOrigin = this.getPlayerOrigin(gameState);
			const flattenedTarget = new BABYLON.Vector3(goalPoint.x, 0, goalPoint.z);
			localTarget = this.projectOntoAxis(flattenedTarget, paddleOrigin, paddleAxis);
		}

		return {
			id,
			intersectsOwnGoal,
			localTarget,
			totalDistance: intersectsOwnGoal ? totalDistance : Number.POSITIVE_INFINITY,
		};
	}


	private updateLineMesh(
		existing: BABYLON.LinesMesh | null,
		name: string,
		points: BABYLON.Vector3[],
		scene: BABYLON.Scene,
		color: BABYLON.Color3
	): BABYLON.LinesMesh {
		if (!existing || existing.isDisposed()) {
			existing = BABYLON.MeshBuilder.CreateLines(
				name,
				{ points, updatable: true },
				scene
			);
		} else {
			BABYLON.MeshBuilder.CreateLines(
				name,
				{ points, instance: existing },
				undefined
			);
		}
		existing.color = color;
		existing.isPickable = false;
		this.markNoShadows(existing);
		existing.setEnabled(true);
		return existing;
	}

	private getWizardLineColor(): BABYLON.Color3 {
		switch (this.playerIndex) {
			case 0:
				return new BABYLON.Color3(1, 0, 0); // Red
			case 1:
				return new BABYLON.Color3(0, 0.388, 1); // Blue
			case 2:
				return new BABYLON.Color3(0, 1, 0); // Green
			case 3:
				return new BABYLON.Color3(0, 1, 1); // Cyan
			default:
				return new BABYLON.Color3(1, 1, 1);
		}
	}

	/**
	 * Predict where the ball will intersect the goal along the paddle's axis.
	 * Simplified version - just return current projected ball position, or center if ball is too far out
	 */
	private predictBallTrajectory(gameState: GameStateForAI): number | null {
		const primaryBall = this.getPrimaryBallSnapshot(gameState);
		if (!primaryBall) {
			return 0;
		}
		const ballX = primaryBall.position.x;
		const ballZ = primaryBall.position.z;

		// Check if ball is too far from origin (out of bounds)
		const distanceFromOrigin = Math.sqrt(ballX * ballX + ballZ * ballZ);
		if (distanceFromOrigin > BALL_OUT_DISTANCE) {
			conditionalLog(
				`🤖 Player ${this.playerIndex + 1} ball out of bounds (${distanceFromOrigin.toFixed(1)}m > ${BALL_OUT_DISTANCE}m), targeting center`
			);
			return 0; // Target center of court in local coordinates
		}

		// Ball is in normal range, project its position onto the paddle axis
		return this.getBallPositionAlongAxis(gameState);
	}

	/**
	 * Update the visual target indicator dot
	 */
	private updateTargetDot(gameState: GameStateForAI): void {
		if (!gameState.physics || this.currentTargetX === null) {
			// Hide dot if no physics context or no target
			if (this.targetDot) {
				this.targetDot.setEnabled(false);
			}
			return;
		}

		const { scene } = gameState.physics;

		// Create dot if it doesn't exist
		if (!this.targetDot) {
			this.targetDot = BABYLON.MeshBuilder.CreateSphere(
				`aiTargetDot_player${this.playerIndex}`,
				{ diameter: 0.1 },
				scene
			);
			this.targetDot.isPickable = false;
			this.targetDot.receiveShadows = false;
			this.markNoShadows(this.targetDot);
			const material = new BABYLON.StandardMaterial(
				`aiTargetDotMaterial_player${this.playerIndex}`,
				scene
			);
			material.emissiveColor = new BABYLON.Color3(1, 0.078, 0.576); // Pink color
			material.disableLighting = true;
			this.targetDot.material = material;
		}

		// Position the dot at the target X location, slightly above paddle level
		// For 2-player mode: position at Y=0.2, Z=0
		// For 3/4-player modes: we'll need to adjust based on player position
		const dotY = 0.2; // Default height above paddle
		const targetWorldPos = this.getWorldPositionFromAxis(
			this.currentTargetX,
			gameState
		);

		// Position the dot at the target location projected into world space
		this.targetDot.position.set(
			targetWorldPos.x,
			dotY,
			targetWorldPos.z
		);
		this.targetDot.setEnabled(true);
	}

	/**
	 * Update AI configuration (for dynamic difficulty adjustment)
	 */
	updateConfig(newConfig: Partial<AIConfig>): void {
		this.config = { ...this.config, ...newConfig };
	}

	/**
	 * Get current AI configuration
	 */
	getConfig(): AIConfig {
		return { ...this.config };
	}

	/**
	 * Reset AI state (useful when restarting games)
	 */
	reset(): void {
		this.lastSampleTime = 0;
		this.lastImpulseTime = 0;
		this.currentTargetX = null;
		this.currentInput = AIInput.STOP;
		this.inputEndTime = 0;
		// Hide target dot
		if (this.targetDot) {
			this.targetDot.setEnabled(false);
		}
		this.wizardVisuals.forEach(visual => {
			if (visual.primaryLine) {
				visual.primaryLine.dispose(false, true);
			}
			for (const line of visual.extraLines) {
				line.dispose(false, true);
			}
			for (const dot of visual.bounceDots) {
				dot.dispose(false, true);
			}
			if (visual.goalDot) {
				visual.goalDot.dispose(false, true);
			}
		});
		this.wizardVisuals.clear();
		this.previousBallVelocities.clear();
	}

}

/**
 * Default AI configurations for different difficulty levels
 */
export const AI_DIFFICULTY_PRESETS = {
	EASY: {
		sampleRate: 1.0, // Slow target updates - predictable but easy to beat
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.5,
		xLimit: 3.5,
		style: 'standard',
	} as AIConfig,

	MEDIUM: {
		sampleRate: 4.0,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.4,
		xLimit: 3.5,
		style: 'standard',
	} as AIConfig,

	HARD: {
		sampleRate: 8.0, // Fast target updates - more responsive
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.3,
		xLimit: 3.5,
		style: 'standard',
	} as AIConfig,

	EXPERT: {
		sampleRate: 16.0,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.3,
		xLimit: 3.5,
		style: 'standard',
	} as AIConfig,

	CIRCE: {
		sampleRate: 1.0,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.35,
		xLimit: 3.5,
		style: 'wizard',
		predictionRayLength: 20,
	} as AIConfig,

	MERLIN: {
		sampleRate: 1.5,
		impulseFrequency: 20,
		impulseDuration: 20,
		centralLimit: 0.35,
		xLimit: 3.5,
		style: 'wizard',
		predictionRayLength: 20,
	} as AIConfig,

	MORGANA: {
		sampleRate: 1.9,
		impulseFrequency: 30,
		impulseDuration: 7,
		centralLimit: 0.3,
		xLimit: 3.5,
		style: 'wizard',
		predictionRayLength: 20,
	} as AIConfig,

	GANDALF: {
		sampleRate: 2.5,
		impulseFrequency: 35,
		impulseDuration: 7,
		centralLimit: 0.2,
		xLimit: 3.5,
		style: 'wizard',
		predictionRayLength: 20,
	} as AIConfig,
} as const;

/**
 * Utility function to check if a player name indicates AI control
 */
export function isAIPlayer(playerName: string): boolean {
	return playerName.startsWith('*');
}

/**
 * Extract AI difficulty from player name (e.g., "*HARD", "*EASY")
 * Falls back to MEDIUM if no difficulty specified
 */
export function getAIDifficultyFromName(
	playerName: string
): keyof typeof AI_DIFFICULTY_PRESETS {
	if (!isAIPlayer(playerName)) {
		return 'MEDIUM'; // Default for non-AI players
	}

	const difficultyPart = playerName.substring(1);
	const availableKeys = Object.keys(AI_DIFFICULTY_PRESETS);
	const match = availableKeys.find(
		key => key.toUpperCase() === difficultyPart.toUpperCase()
	);
	return (match as keyof typeof AI_DIFFICULTY_PRESETS) ?? 'MEDIUM';
}
