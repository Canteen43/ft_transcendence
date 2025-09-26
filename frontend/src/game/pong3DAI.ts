// ============================================================================
// Pong3D AI System - Reactive AI with Pulse-Based Control
// ============================================================================

import * as BABYLON from '@babylonjs/core';
import * as CANNON from 'cannon-es';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';

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
	ball: {
		position: { x: number; y: number; z: number };
		velocity: { x: number; y: number; z: number };
	};
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
	private predictionRay: BABYLON.LinesMesh | null;
	private wizardExtraRays: BABYLON.LinesMesh[];
	private wizardBounceDots: BABYLON.Mesh[];
	private wizardGoalDot: BABYLON.Mesh | null;
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
		this.predictionRay = null;
		this.wizardExtraRays = [];
		this.wizardBounceDots = [];
		this.wizardGoalDot = null;
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

	private getBallPositionAlongAxis(gameState: GameStateForAI): number {
		const paddleAxis = this.getPlayerAxis(gameState);
		const paddleOrigin = this.getPlayerOrigin(gameState);
		const ballPos = new BABYLON.Vector3(
			gameState.ball.position.x,
			0,
			gameState.ball.position.z
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

		const ballPosition = new BABYLON.Vector3(
			gameState.ball.position.x,
			gameState.ball.position.y,
			gameState.ball.position.z
		);
		const ballVelocity = new BABYLON.Vector3(
			gameState.ball.velocity.x,
			gameState.ball.velocity.y,
			gameState.ball.velocity.z
		);
		const planeY = ballPosition.y;

		if (ballVelocity.lengthSquared() <= 1e-6) {
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

		const segments: Array<{
			start: BABYLON.Vector3;
			end: BABYLON.Vector3;
		}> = [];
		const bouncePoints: BABYLON.Vector3[] = [];
		let goalPoint: BABYLON.Vector3 | null = null;

		let currentOrigin = ballPosition.clone();
		let currentDirection = ballVelocity.normalize();
		let displayStart = new BABYLON.Vector3(ballPosition.x, planeY, ballPosition.z);

		for (let bounce = 0; bounce < maxBounces; bounce++) {
			const segmentStart = displayStart.clone();
			let hitPoint3D: BABYLON.Vector3 | null = null;
			let hitNormal: BABYLON.Vector3 | null = null;
			let hitMesh: BABYLON.AbstractMesh | null = null;

			if (world) {
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
				world.raycastClosest(fromVec, toVec, { skipBackfaces: false } as any, result);
				if (result.hasHit) {
					hitPoint3D = new BABYLON.Vector3(
						result.hitPointWorld.x,
						result.hitPointWorld.y,
						result.hitPointWorld.z
					);
					hitNormal = new BABYLON.Vector3(
						result.hitNormalWorld.x,
						result.hitNormalWorld.y,
						result.hitNormalWorld.z
					);
					if (hitNormal.lengthSquared() > 1e-6) {
						hitNormal = hitNormal.normalize();
					}
					hitMesh = this.findMeshForPhysicsBody(scene, result.body);
				}
			}

			const ray = new BABYLON.Ray(
				currentOrigin.clone(),
				currentDirection.clone(),
				raySegmentLength
			);
			const pick = scene.pickWithRay(ray, predicate, false);

			if (!hitPoint3D && pick?.hit && pick.pickedPoint) {
				hitPoint3D = pick.pickedPoint.clone();
			}
			if (pick?.hit && pick.pickedPoint) {
				if (!hitMesh) {
					hitMesh = pick.pickedMesh || null;
				}
				if ((!hitNormal || hitNormal.lengthSquared() <= 1e-6)) {
					const pickNormal =
						pick.getNormal(true, true) || pick.getNormal(true);
					if (pickNormal && pickNormal.lengthSquared() > 1e-6) {
						hitNormal = BABYLON.Vector3.Normalize(pickNormal);
					}
				}
			}

			if (!hitPoint3D) {
				const endPoint = currentOrigin.add(currentDirection.scale(raySegmentLength));
				segments.push({
					start: segmentStart,
					end: new BABYLON.Vector3(endPoint.x, planeY, endPoint.z),
				});
				break;
			}

			const meshName = hitMesh?.name?.toLowerCase() || '';
			const isGoalHit = /goal/.test(meshName);
			const isWallHit = /wall/.test(meshName);

			const flattenedHit = new BABYLON.Vector3(
				hitPoint3D.x,
				planeY,
				hitPoint3D.z
			);
			segments.push({ start: segmentStart, end: flattenedHit.clone() });

			if (!isGoalHit && !isWallHit) {
				currentOrigin = hitPoint3D.add(currentDirection.scale(0.05));
				displayStart = flattenedHit.clone();
				continue;
			}

			if (!hitNormal || hitNormal.lengthSquared() <= 1e-6) {
				break;
			}
			if (BABYLON.Vector3.Dot(hitNormal, currentDirection) > 0) {
				hitNormal = hitNormal.negate();
			}

			if (isGoalHit) {
				goalPoint = flattenedHit.clone();
				break;
			}

			const reflection = BABYLON.Vector3.Reflect(
				currentDirection,
				hitNormal
			);
			if (reflection.lengthSquared() <= 1e-6) {
				break;
			}

			bouncePoints.push(flattenedHit.clone());

			const reflectionDirection = reflection.normalize();
			currentOrigin = hitPoint3D.add(reflectionDirection.scale(0.05));
			currentDirection = reflectionDirection;
			displayStart = flattenedHit.clone();
		}

		if (Pong3DAI.isWizardVisualizationEnabled()) {
			this.updateWizardLines(segments, scene);
			this.updateWizardBounceDots(bouncePoints, scene, planeY);
			this.updateWizardGoalDot(goalPoint, scene, planeY);
		} else {
			this.disableWizardVisuals();
		}

		const lastSegment = segments.length > 0 ? segments[segments.length - 1] : null;
		const finalPoint = goalPoint ?? lastSegment?.end ?? null;
		if (!finalPoint) {
			return this.getBallPositionAlongAxis(gameState);
		}

		const paddleAxis = this.getPlayerAxis(gameState);
		const paddleOrigin = this.getPlayerOrigin(gameState);
		const flattenedTarget = new BABYLON.Vector3(finalPoint.x, 0, finalPoint.z);
		return this.projectOntoAxis(flattenedTarget, paddleOrigin, paddleAxis);
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
		if (this.predictionRay) {
			this.predictionRay.setEnabled(false);
		}
		for (const line of this.wizardExtraRays) {
			if (line && !line.isDisposed()) {
				line.setEnabled(false);
			}
		}
		for (const dot of this.wizardBounceDots) {
			if (dot && !dot.isDisposed()) {
				dot.setEnabled(false);
			}
		}
		if (this.wizardGoalDot && !this.wizardGoalDot.isDisposed()) {
			this.wizardGoalDot.setEnabled(false);
		}
	}

	private updateWizardLines(
		segments: Array<{ start: BABYLON.Vector3; end: BABYLON.Vector3 }>,
		scene: BABYLON.Scene
	): void {
		if (segments.length === 0) {
			this.disableWizardVisuals();
			return;
		}

		const primaryPoints = [segments[0].start, segments[0].end];
		this.predictionRay = this.updateLineMesh(
			this.predictionRay,
			`aiWizardRay_player${this.playerIndex}`,
			primaryPoints,
			scene,
			this.getWizardLineColor()
		);

		const extraCount = segments.length - 1;
		for (let i = 0; i < extraCount; i++) {
			const segment = segments[i + 1];
			const points = [segment.start, segment.end];
			const name = `aiWizardRay_player${this.playerIndex}_seg${i + 1}`;
			const existing = this.wizardExtraRays[i] || null;
			const updated = this.updateLineMesh(
				existing,
				name,
				points,
				scene,
				this.getWizardLineColor()
			);
			this.wizardExtraRays[i] = updated;
		}

		for (let i = extraCount; i < this.wizardExtraRays.length; i++) {
			const line = this.wizardExtraRays[i];
			if (line && !line.isDisposed()) {
				line.setEnabled(false);
			}
		}
	}

	private updateWizardBounceDots(
		points: BABYLON.Vector3[],
		scene: BABYLON.Scene,
		planeY: number
	): void {
		for (let i = 0; i < points.length; i++) {
			const point = points[i];
			point.y = planeY;
			let dot = this.wizardBounceDots[i];
			if (!dot || dot.isDisposed()) {
				dot = BABYLON.MeshBuilder.CreateSphere(
					`aiWizardBounce_player${this.playerIndex}_${i}`,
					{ diameter: 0.12 },
					scene
				);
				const material = new BABYLON.StandardMaterial(
					`aiWizardBounceMat_player${this.playerIndex}_${i}`,
					scene
				);
				material.emissiveColor = new BABYLON.Color3(1, 0.078, 0.576);
				material.disableLighting = true;
				dot.material = material;
				this.wizardBounceDots[i] = dot;
			}
			dot.position.copyFrom(point);
			dot.setEnabled(true);
		}

		for (let i = points.length; i < this.wizardBounceDots.length; i++) {
			const dot = this.wizardBounceDots[i];
			if (dot && !dot.isDisposed()) {
				dot.setEnabled(false);
			}
		}
	}

	private updateWizardGoalDot(
		goalPoint: BABYLON.Vector3 | null,
		scene: BABYLON.Scene,
		planeY: number
	): void {
		if (!goalPoint) {
			if (this.wizardGoalDot && !this.wizardGoalDot.isDisposed()) {
				this.wizardGoalDot.setEnabled(false);
			}
			return;
		}

		if (!this.wizardGoalDot || this.wizardGoalDot.isDisposed()) {
			this.wizardGoalDot = BABYLON.MeshBuilder.CreateSphere(
				`aiWizardGoal_player${this.playerIndex}`,
				{ diameter: 0.18 },
				scene
			);
			const material = new BABYLON.StandardMaterial(
				`aiWizardGoalMat_player${this.playerIndex}`,
				scene
			);
			material.emissiveColor = new BABYLON.Color3(0.2, 1, 0.2);
			material.disableLighting = true;
			this.wizardGoalDot.material = material;
		}

		const dotPosition = new BABYLON.Vector3(goalPoint.x, planeY, goalPoint.z);
		this.wizardGoalDot.position.copyFrom(dotPosition);
		this.wizardGoalDot.setEnabled(true);
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
		const ballX = gameState.ball.position.x;
		const ballZ = gameState.ball.position.z;

		// Check if ball is too far from origin (out of bounds)
		const distanceFromOrigin = Math.sqrt(ballX * ballX + ballZ * ballZ);
		if (distanceFromOrigin > BALL_OUT_DISTANCE) {
			console.log(
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
		if (this.predictionRay) {
			this.predictionRay.dispose(false, true);
			this.predictionRay = null;
		}
		for (const line of this.wizardExtraRays) {
			line.dispose(false, true);
		}
		this.wizardExtraRays = [];
		for (const dot of this.wizardBounceDots) {
			dot.dispose(false, true);
		}
		this.wizardBounceDots = [];
		if (this.wizardGoalDot) {
			this.wizardGoalDot.dispose(false, true);
			this.wizardGoalDot = null;
		}
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
		sampleRate: 1.4,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.35,
		xLimit: 3.5,
		style: 'wizard',
		predictionRayLength: 20,
	} as AIConfig,

	MORGANA: {
		sampleRate: 1.8,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.35,
		xLimit: 3.5,
		style: 'wizard',
		predictionRayLength: 20,
	} as AIConfig,

	GANDALF: {
		sampleRate: 2.5,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.35,
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
