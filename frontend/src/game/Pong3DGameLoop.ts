import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';
import { state } from '../utils/State';
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
	private pong3D: any; // Reference to main Pong3D instance for paddle access

	constructor(scene: BABYLON.Scene, pong3D?: any) {
		this.scene = scene;
		this.pong3D = pong3D;

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
				conditionalLog(
					`🎾 Ball original position: ${this.originalBallPosition.toString()}`
				);
			}
		}
	}

	/**
	 * Start the game loop
	 */
	start(): void {
		// conditionalLog("🎾 Starting Pong3D Game Loop with Physics Engine");
		this.gameState.isRunning = true;

		// Check if there's a designated server from the pong3D instance
		let initialServingPlayer: number | undefined;
		if (this.pong3D && this.pong3D.currentServer >= 0) {
			initialServingPlayer = this.pong3D.currentServer;
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog(
					`🎾 FIRST SERVE: Starting with Player ${initialServingPlayer! + 1} as initial server`
				);
			}
		}

		// Only reset ball if we have a designated server (actual game start)
		// During auto-start in onModelLoaded, currentServer is -1, so don't reset ball
		if (initialServingPlayer !== undefined) {
			// Add 1-second delay before the first serve
			setTimeout(() => {
				if (this.gameState.isRunning) {
					// Check if game is still running
					// Mark game as ongoing right when we actually perform the first serve
					state.gameOngoing = true;
					this.resetBall(initialServingPlayer);
				}
			}, 1000); // 1 second delay
		} else {
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog(
					`🎾 INITIALIZATION: Game loop started without designated server - ball will remain at current position`
				);
			}
		}

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
			conditionalLog('⏹️ Stopping Pong3D Game Loop');
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
	 * Reset ball to center with initial velocity, or serve from paddle position if servingPlayerIndex provided
	 */
	resetBall(servingPlayerIndex?: number): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;

		let servePosition: BABYLON.Vector3;
		let serveVelocity: BABYLON.Vector3;

		if (servingPlayerIndex !== undefined && this.pong3D) {
			// SERVE SYSTEM: Reset ball from paddle position toward court center
			const paddle = this.pong3D.getPaddle(servingPlayerIndex);
			if (paddle) {
				// Update hit tracking - the server "hit" the ball
				this.pong3D.setLastPlayerToHitBall(servingPlayerIndex);

				// Position ball in front of paddle toward origin to avoid spawning inside paddle
				let baseDirection = new BABYLON.Vector3(0, 0, 0);
				if (
					this.pong3D &&
					typeof this.pong3D.getServeDirectionForPaddle === 'function'
				) {
					baseDirection =
						this.pong3D.getServeDirectionForPaddle(
							servingPlayerIndex
						);
				}
				if (baseDirection.lengthSquared() < 1e-6) {
					const courtCenter = BABYLON.Vector3.Zero();
					baseDirection = courtCenter.subtract(paddle.position);
				}
				baseDirection.y = 0;
				if (baseDirection.lengthSquared() < 1e-6) {
					baseDirection = new BABYLON.Vector3(0, 0, -1);
				} else {
					baseDirection.normalize();
				}

				const serveOffset =
					this.pong3D?.SERVE_OFFSET ?? GameConfig.getServeOffset();
				const ballRadius = GameConfig.getBallRadius();

				servePosition = paddle.position.clone();
				servePosition.y = this.originalBallPosition.y;

				const absX = Math.abs(baseDirection.x);
				const absZ = Math.abs(baseDirection.z);
				if (absX >= absZ) {
					const axisPos = paddle.position.x;
					let sign = axisPos > 0 ? -1 : axisPos < 0 ? 1 : 0;
					if (sign === 0) {
						sign =
							baseDirection.x > 0
								? 1
								: baseDirection.x < 0
								? -1
								: -1;
					}
					const maxApproach = Math.max(
						Math.abs(axisPos) - ballRadius,
						0
					);
					const appliedOffset =
						sign === 0
							? 0
							: Math.min(serveOffset, maxApproach);
					servePosition.x = axisPos + sign * appliedOffset;
					servePosition.z = paddle.position.z;
				} else {
					const axisPos = paddle.position.z;
					let sign = axisPos > 0 ? -1 : axisPos < 0 ? 1 : 0;
					if (sign === 0) {
						sign =
							baseDirection.z > 0
								? 1
								: baseDirection.z < 0
								? -1
								: -1;
					}
					const maxApproach = Math.max(
						Math.abs(axisPos) - ballRadius,
						0
					);
					const appliedOffset =
						sign === 0
							? 0
							: Math.min(serveOffset, maxApproach);
					servePosition.z = axisPos + sign * appliedOffset;
					servePosition.x = paddle.position.x;
				}

				// Recompute baseDirection from new servePosition toward origin to ensure correctness
				{
					const courtCenter = BABYLON.Vector3.Zero();
					baseDirection = courtCenter.subtract(servePosition);
					baseDirection.y = 0;
					if (baseDirection.lengthSquared() < 1e-6) {
						baseDirection = new BABYLON.Vector3(0, 0, -1);
					} else {
						baseDirection = baseDirection.normalize();
					}
				}

				const serveNormal = baseDirection.clone();

				// Add serve spread within configured limit
				const angleLimit =
					this.pong3D?.SERVE_ANGLE_LIMIT ??
					GameConfig.getServeAngleLimit();
				const spreadAngle =
					(Math.random() - 0.5) * 2 * angleLimit;
				const rotationMatrix =
					BABYLON.Matrix.RotationAxis(
						BABYLON.Vector3.Up(),
						spreadAngle
					);
				let spreadDirection =
					BABYLON.Vector3.TransformCoordinates(
						baseDirection,
						rotationMatrix
					).normalize();

				// Safety: if the spread accidentally points away from origin, flip it
				const toOrigin = BABYLON.Vector3.Zero()
					.subtract(servePosition)
					.normalize();
				if (BABYLON.Vector3.Dot(spreadDirection, toOrigin) < 0) {
					spreadDirection = spreadDirection.scale(-1);
				}

				if (
					this.pong3D &&
					typeof this.pong3D.enforceAngularLimitForDirection ===
						'function'
				) {
					spreadDirection =
						this.pong3D.enforceAngularLimitForDirection(
							serveNormal,
							spreadDirection,
							angleLimit
						);
				}

				// Set serve speed to base rally speed for immediate consistency
				let serveSpeed = 5;
				try {
					if (
						this.pong3D &&
						typeof this.pong3D.getRallyInfo === 'function'
					) {
						const info = this.pong3D.getRallyInfo();
						if (info && typeof info.baseSpeed === 'number') {
							serveSpeed = info.baseSpeed;
						}
					}
				} catch (_) {}
				serveVelocity = spreadDirection.scale(serveSpeed);
				serveVelocity.y = 0; // Keep in X-Z plane

				if (GameConfig.isDebugLoggingEnabled()) {
					conditionalLog(
						`🎾 SERVE: Player ${servingPlayerIndex + 1} serving from paddle position toward center`
					);
					conditionalLog(
						`🎾 Serve position: (${servePosition.x.toFixed(
							2
						)}, ${servePosition.y.toFixed(
							2
						)}, ${servePosition.z.toFixed(2)})`
					);
					conditionalLog(
						`🎾 Serve direction: (${spreadDirection.x.toFixed(
							2
						)}, ${spreadDirection.y.toFixed(
							2
						)}, ${spreadDirection.z.toFixed(2)})`
					);
					conditionalLog(
						`🎾 Spread angle: ${(
							(spreadAngle * 180) /
							Math.PI
						).toFixed(1)}°`
					);
				}
			} else {
				// Fallback to center if paddle not found
				servePosition = this.originalBallPosition.clone();
				serveVelocity = this.generateRandomStartingVelocity(5);
				conditionalLog(
					`⚠️ SERVE: Paddle ${servingPlayerIndex} not found, falling back to center reset`
				);
			}
		} else {
			// NORMAL RESET: Reset to center with random velocity
			servePosition = this.originalBallPosition.clone();
			serveVelocity = this.generateRandomStartingVelocity(5);
		}

		// Reset position via the mesh, which the physics engine will pick up
		this.ballMesh.position.set(
			servePosition.x,
			servePosition.y,
			servePosition.z
		);

		// Stop any existing motion
		this.ballMesh.physicsImpostor.setLinearVelocity(BABYLON.Vector3.Zero());
		this.ballMesh.physicsImpostor.setAngularVelocity(
			BABYLON.Vector3.Zero()
		);

		// Apply the serve velocity as an impulse
		this.ballMesh.physicsImpostor.applyImpulse(
			serveVelocity,
			this.ballMesh.getAbsolutePosition()
		);

		// Sync gameState
		this.gameState.ball.position = this.ballMesh.position.clone();
		this.gameState.ball.velocity = serveVelocity;

		// Notify main Pong3D to reset per-serve visual/effect state
		try {
			if (this.pong3D && typeof this.pong3D.onServeStart === 'function') {
				this.pong3D.onServeStart();
			}
		} catch (_) {}

		// conditionalLog(`🔄 Ball reset to position: ${this.gameState.ball.position.toString()}`);
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

		// conditionalLog(`🎲 Random starting velocity: ${velocity.toString()} (angle: ${(randomAngle * 180 / Math.PI).toFixed(1)}°)`);
		return velocity;
	}
}
