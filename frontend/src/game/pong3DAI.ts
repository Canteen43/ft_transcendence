// ============================================================================
// Pong3D AI System - Reactive AI with Pulse-Based Control
// ============================================================================

import * as BABYLON from '@babylonjs/core';

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

	constructor(playerIndex: number, config: AIConfig) {
		this.playerIndex = playerIndex;
		this.config = config;
		this.lastSampleTime = 0;
		this.lastImpulseTime = 0;
		this.currentTargetX = null;
		this.currentInput = AIInput.STOP;
		this.inputEndTime = 0;
		this.targetDot = null;
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
			let predictedTarget = this.predictBallTrajectory(gameState);

			// Apply paddle center offset correction (paddle width = 1.5m, so half = 0.75m)
			// The paddle positioning system uses center reference, so we need to adjust target
			if (predictedTarget !== null) {
				const paddleOffset = 0.75; // Half paddle width
				const originalTarget = predictedTarget;
				// Offset direction depends on target sign to align paddle center with target
				predictedTarget +=
					predictedTarget > 0 ? -paddleOffset : paddleOffset;
				console.log(
					`🤖 Player ${this.playerIndex + 1} offset: ${originalTarget.toFixed(3)} -> ${predictedTarget.toFixed(3)} (offset: ${(predictedTarget - originalTarget).toFixed(3)})`
				);
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
				const paddleX =
					gameState.paddlePositionsX[this.playerIndex] || 0;
				const deltaX = this.currentTargetX - paddleX;

				console.log(
					`🤖 Player ${this.playerIndex + 1} movement: paddle=${paddleX.toFixed(3)}, target=${this.currentTargetX.toFixed(3)}, delta=${deltaX.toFixed(3)}`
				);

				// Within deadzone - no movement needed
				if (Math.abs(deltaX) <= this.config.centralLimit) {
					this.currentInput = AIInput.STOP;
					return this.currentInput;
				}

				// Check boundary limits before moving
				let desiredInput = AIInput.STOP;
				if (deltaX < 0 && paddleX > -this.config.xLimit) {
					desiredInput = AIInput.LEFT;
				} else if (deltaX > 0 && paddleX < this.config.xLimit) {
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
	 * Get the X-axis distance between ball and paddle
	 * Positive = ball is to the right of paddle
	 * Negative = ball is to the left of paddle
	 */
	private getTargetDeltaX(gameState: GameStateForAI): number {
		const ballX = gameState.ball.position.x;
		const paddleX = gameState.paddlePositionsX[this.playerIndex] || 0;
		return ballX - paddleX;
	}

	/**
	 * Predict where the ball will intersect the goal
	 * Simplified version - just return current ball position, or center if ball is too far out
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
			return 0; // Target center of court
		}

		// Ball is in normal range, track its current position
		return ballX;
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
		let dotY = 0.2; // Default height above paddle
		let dotZ = 0; // Default depth

		// Position dot at target location
		this.targetDot.position.set(this.currentTargetX, dotY, dotZ);
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
	} as AIConfig,

	MEDIUM: {
		sampleRate: 4.0,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.4,
		xLimit: 3.5,
	} as AIConfig,

	HARD: {
		sampleRate: 8.0, // Fast target updates - more responsive
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.3,
		xLimit: 3.5,
	} as AIConfig,

	EXPERT: {
		sampleRate: 16.0,
		impulseFrequency: 30,
		impulseDuration: 20,
		centralLimit: 0.3,
		xLimit: 3.5,
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

	const difficultyPart = playerName.substring(1).toUpperCase();
	if (difficultyPart in AI_DIFFICULTY_PRESETS) {
		return difficultyPart as keyof typeof AI_DIFFICULTY_PRESETS;
	}

	return 'MEDIUM'; // Default fallback
}
