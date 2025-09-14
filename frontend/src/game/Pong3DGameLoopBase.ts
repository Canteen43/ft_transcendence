import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';

export interface GameState {
	ball: {
		position: BABYLON.Vector3;
		velocity: BABYLON.Vector3;
	};
	isRunning: boolean;
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
			console.log(
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
				console.log('🏐 Ball reset to original position');
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
	 * Set ball velocity (for testing different speeds)
	 */
	setBallVelocity(velocity: BABYLON.Vector3): void {
		if (this.ballMesh && this.ballMesh.physicsImpostor) {
			this.ballMesh.physicsImpostor.setLinearVelocity(velocity);
		}
	}

	/**
	 * Get current game state (useful for debugging and network sync)
	 */
	getGameState(): GameState {
		// Ensure the gameState is up-to-date with the physics engine before returning
		if (this.ballMesh && this.ballMesh.physicsImpostor) {
			this.gameState.ball.position = this.ballMesh.getAbsolutePosition();
			const linearVelocity =
				this.ballMesh.physicsImpostor.getLinearVelocity();
			if (linearVelocity) {
				this.gameState.ball.velocity = linearVelocity;
			}
		}
		return {
			ball: {
				position: this.gameState.ball.position.clone(),
				velocity: this.gameState.ball.velocity.clone(),
			},
			isRunning: this.gameState.isRunning,
		};
	}
}
