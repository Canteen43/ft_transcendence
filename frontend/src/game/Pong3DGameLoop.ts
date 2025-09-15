import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import type { GameState } from './Pong3DGameLoopBase';

export class Pong3DGameLoop {
	protected scene: BABYLON.Scene;
	private ballMesh: BABYLON.Mesh | null = null;
	private gameState: GameState;
	private originalBallPosition: BABYLON.Vector3 = new BABYLON.Vector3(
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
				velocity: this.generateRandomStartingVelocity(5), // Random starting direction
			},
			isRunning: false,
		};
	}

	/**
	 * Set the ball mesh reference (called from main Pong3D class)
	 */
	setBallMesh(ballMesh: BABYLON.Mesh): void {
		this.ballMesh = ballMesh;

		if (this.ballMesh) {
			// Store the original GLB position (especially the Y value)
			this.originalBallPosition = this.ballMesh.position.clone();

			// Initialize game state position to the original position
			this.gameState.ball.position = this.originalBallPosition.clone();

			if (GameConfig.isDebugLoggingEnabled()) {
				console.log(
					`🎾 Ball original position: ${this.originalBallPosition.toString()}`
				);
			}
		}
	}

	/**
	 * Start the game loop
	 */
	start(): void {
		// console.log("🎾 Starting Pong3D Game Loop with Physics Engine");
		this.gameState.isRunning = true;

		// The physics engine runs in the background. We just need to apply initial velocity.
		this.resetBall();

		// Register the render loop to sync our gameState with the physics simulation
		this.scene.registerBeforeRender(() => {
			if (this.gameState.isRunning) {
				this.update();
			}
		});
	}

	/**
	 * Stop the game loop
	 */
	stop(): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			console.log('⏹️ Stopping Pong3D Game Loop');
		}
		this.gameState.isRunning = false;
		// Stop the ball
		if (this.ballMesh && this.ballMesh.physicsImpostor) {
			this.ballMesh.physicsImpostor.setLinearVelocity(
				BABYLON.Vector3.Zero()
			);
		}
	}

	/**
	 * Reset ball to center with initial velocity
	 */
	resetBall(): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;

		// Reset position via the mesh, which the physics engine will pick up
		this.ballMesh.position.set(
			this.originalBallPosition.x,
			this.originalBallPosition.y,
			this.originalBallPosition.z
		);

		// Stop any existing motion
		this.ballMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
		this.ballMesh.physicsImpostor.setAngularVelocity(
			BABYLON.Vector3.Zero()
		);

		// Set new random starting velocity by applying an impulse.
		// Impulse is better than setting velocity directly for a more realistic start.
		const startingVelocity = this.generateRandomStartingVelocity(5);
		this.ballMesh.physicsImpostor.applyImpulse(
			startingVelocity,
			this.ballMesh.getAbsolutePosition()
		);

		// Sync gameState
		this.gameState.ball.position = this.ballMesh.position.clone();
		this.gameState.ball.velocity = startingVelocity;

		// console.log(`🔄 Ball reset to position: ${this.gameState.ball.position.toString()}`);
	}

	/**
	 * Main update loop - called every frame
	 */
	private update(): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;

		// The physics engine moves the ball automatically.
		// We just need to sync our internal gameState with the physics impostor's state.
		this.gameState.ball.position = this.ballMesh.getAbsolutePosition();
		const linearVelocity =
			this.ballMesh.physicsImpostor.getLinearVelocity();
		if (linearVelocity) {
			this.gameState.ball.velocity = linearVelocity;
		}

		// Boundary detection is handled by the main Pong3D class
	}

	/**
	 * Get current game state (useful for debugging)
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

	/**
	 * Set ball velocity (for testing different speeds)
	 */
	setBallVelocity(velocity: BABYLON.Vector3): void {
		if (this.ballMesh && this.ballMesh.physicsImpostor) {
			this.ballMesh.physicsImpostor.setLinearVelocity(velocity);
		}
	}

	/**
	 * Generate a random starting velocity with configurable speed and angle range
	 */
	private generateRandomStartingVelocity(speed: number = 5): BABYLON.Vector3 {
		// Random direction: forward or backward (±1)
		const zDirection = Math.random() < 0.5 ? 1 : -1;

		// Calculate X and Z components
		// Use a limited angle range to keep game playable
		const maxAngle = Math.PI / 3; // 60 degrees max from straight line
		const randomAngle = (Math.random() - 0.5) * 2 * maxAngle; // -60° to +60°

		const x = Math.sin(randomAngle) * speed;
		const z = Math.cos(randomAngle) * speed * zDirection;

		const velocity = new BABYLON.Vector3(x, 0, z);

		// console.log(`🎲 Random starting velocity: ${velocity.toString()} (angle: ${(randomAngle * 180 / Math.PI).toFixed(1)}°)`);
		return velocity;
	}
}
