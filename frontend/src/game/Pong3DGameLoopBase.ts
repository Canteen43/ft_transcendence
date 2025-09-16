import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';

export interface GameState {
	ball: {
		position: BABYLON.Vector3;
		velocity: BABYLON.Vector3;
	};
	isRunning: boolean;
}

export interface NetworkGameState {
	b: [number, number];
	pd: [number, number][];
}

/**
 * Base class for game loops - contains common functionality
 */
export abstract class Pong3DGameLoopBase {
	protected scene: BABYLON.Scene;
	protected ballMesh: BABYLON.Mesh | null = null;
	protected gameState: GameState;
	protected originalBallPosition: BABYLON.Vector3 = new BABYLON.Vector3(
		0,
		0,
		0
	);

	constructor(scene: BABYLON.Scene) {
		this.scene = scene;

		// Initialize game state - will be updated when ball mesh is set
		this.gameState = {
			ball: {
				position: new BABYLON.Vector3(0, 0, 0), // Will be updated to original position
				velocity: this.generateRandomStartingVelocity(10), // Increased speed for custom physics
			},
			isRunning: false,
		};
	}

	/**
	 * Set the ball mesh reference (called from main Pong3D class)
	 */
	setBallMesh(ballMesh: BABYLON.Mesh): void {
		this.ballMesh = ballMesh;

		// Capture original position for resets
		this.originalBallPosition = ballMesh.position.clone();
		this.gameState.ball.position = ballMesh.position.clone();

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				'🏐 Ball mesh set, original position:',
				this.originalBallPosition
			);
		}
	}

	/**
	 * Generate random starting velocity for ball
	 */
	protected generateRandomStartingVelocity(speed: number): BABYLON.Vector3 {
		const angle = Math.random() * 2 * Math.PI;
		const x = Math.cos(angle) * speed;
		const z = Math.sin(angle) * speed;
		return new BABYLON.Vector3(x, 0, z);
	}

	/**
	 * Reset ball to original position with new random velocity
	 */
	resetBall(): void {
		if (this.ballMesh) {
			this.ballMesh.position = this.originalBallPosition.clone();
			this.gameState.ball.position = this.originalBallPosition.clone();
			this.gameState.ball.velocity =
				this.generateRandomStartingVelocity(10); // Increased speed for custom physics
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog('🏐 Ball reset to original position');
			}
		}
	}

	/**
	 * Start the game loop
	 */
	abstract start(): void;

	/**
	 * Stop the game loop
	 */
	abstract stop(): void;

	/**
	 * Get current game state for network transmission
	 */
	getGameState() {
		return this.gameState;
	}
}
