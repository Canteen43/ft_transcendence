import * as BABYLON from '@babylonjs/core';
import { state } from '../utils/State';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';
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
	private serveDelayTimeout: number | null = null; // Track serve delay timeout
	private pendingServeVelocity: BABYLON.Vector3 | null = null; // Stored velocity for serve launch

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
			waitingForServe: false,
			servingPlayer: -1,
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
			// Check if the serving player is an AI
			const isServingPlayerAI = 
				this.pong3D?.playerNames?.[initialServingPlayer]?.startsWith('*') || false;

			if (isServingPlayerAI) {
				// AI server: Position ball and wait 4 seconds, then auto-serve
				if (GameConfig.isDebugLoggingEnabled()) {
					conditionalLog(
						`🤖 AI is serving - will show ball for 4 seconds then auto-serve`
					);
				}
				this.serveDelayTimeout = window.setTimeout(() => {
					if (this.gameState.isRunning) {
						state.gameOngoing = true;
						// Position ball in serve position and wait for input
						this.resetBall(initialServingPlayer, true); // true = wait for input
						
						// Auto-launch serve after another 4 seconds
						window.setTimeout(() => {
							if (this.gameState.isRunning && this.gameState.waitingForServe) {
								this.launchServe();
							}
						}, 4000); // 4 seconds to show the static ball
					}
					this.serveDelayTimeout = null;
				}, 1000); // 1 second initial delay
			} else {
				// Human server: Wait 1 second then wait for input
				this.serveDelayTimeout = window.setTimeout(() => {
					if (this.gameState.isRunning) {
						// Position ball at serve location and wait for player input
						state.gameOngoing = true;
						this.resetBall(initialServingPlayer, true); // true = wait for input
					}
					this.serveDelayTimeout = null;
				}, 1000); // 1 second delay
			}
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

		// Clear any pending serve delay timeout
		if (this.serveDelayTimeout !== null) {
			window.clearTimeout(this.serveDelayTimeout);
			this.serveDelayTimeout = null;
		}

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
	resetBall(servingPlayerIndex?: number, waitForInput: boolean = false): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;

		// Reset per-serve visual/effect state FIRST (this clears hit history)
		try {
			if (this.pong3D && typeof this.pong3D.onServeStart === 'function') {
				this.pong3D.onServeStart();
			}
		} catch (_) {}

		let servePosition: BABYLON.Vector3;
		let serveVelocity: BABYLON.Vector3;

		if (servingPlayerIndex !== undefined && this.pong3D) {
			// SERVE SYSTEM: Reset ball from paddle position toward court center
			const paddle = this.pong3D.getPaddle(servingPlayerIndex);
			if (paddle) {
				// Update hit tracking - the server "hit" the ball (AFTER onServeStart clears history)
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
						sign === 0 ? 0 : Math.min(serveOffset, maxApproach);
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
						sign === 0 ? 0 : Math.min(serveOffset, maxApproach);
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
				const spreadAngle = (Math.random() - 0.5) * 2 * angleLimit;
				const rotationMatrix = BABYLON.Matrix.RotationAxis(
					BABYLON.Vector3.Up(),
					spreadAngle
				);
				let spreadDirection = BABYLON.Vector3.TransformCoordinates(
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

		if (waitForInput && servingPlayerIndex !== undefined) {
			// Wait for serving player input before launching ball
			this.gameState.waitingForServe = true;
			this.gameState.servingPlayer = servingPlayerIndex;
			this.gameState.ball.position = this.ballMesh.position.clone();
			this.gameState.ball.velocity = BABYLON.Vector3.Zero();
			
			// Store the serve velocity for later use
			this.pendingServeVelocity = serveVelocity;
			
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog(
					`🎾 Ball positioned for serve - waiting for Player ${servingPlayerIndex + 1} to press a movement key`
				);
			}
		} else {
			// Immediate serve (normal behavior after goals)

			// Play ping sound for serve
			if (this.pong3D && typeof this.pong3D.audioSystem?.playSoundEffectWithHarmonic === 'function') {
				void this.pong3D.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');
			}

			this.ballMesh.physicsImpostor.applyImpulse(
				serveVelocity,
				this.ballMesh.getAbsolutePosition()
			);

			// Sync gameState
			this.gameState.ball.position = this.ballMesh.position.clone();
			this.gameState.ball.velocity = serveVelocity;
			this.gameState.waitingForServe = false;
			this.gameState.servingPlayer = -1;
		}

		// conditionalLog(`🔄 Ball reset to position: ${this.gameState.ball.position.toString()}`);
	}

	/**
	 * Launch the serve (called when serving player presses input)
	 */
	public launchServe(): void {
		if (!this.gameState.waitingForServe || !this.pendingServeVelocity || !this.ballMesh) {
			return;
		}

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🚀 Player ${this.gameState.servingPlayer + 1} launched serve!`
			);
		}

		// Play ping sound for serve launch
		if (this.pong3D && typeof this.pong3D.audioSystem?.playSoundEffectWithHarmonic === 'function') {
			void this.pong3D.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');
		}

		// Apply the stored serve velocity
		this.ballMesh.physicsImpostor?.applyImpulse(
			this.pendingServeVelocity,
			this.ballMesh.getAbsolutePosition()
		);

		// Update game state
		this.gameState.ball.velocity = this.pendingServeVelocity.clone();
		this.gameState.waitingForServe = false;
		this.gameState.servingPlayer = -1;
		this.pendingServeVelocity = null;
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
			waitingForServe: this.gameState.waitingForServe,
			servingPlayer: this.gameState.servingPlayer,
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
