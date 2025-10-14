import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { conditionalLog } from './Logger';

export interface GameState {
	ball: {
		position: BABYLON.Vector3;
		velocity: BABYLON.Vector3;
	};
	isRunning: boolean;
	waitingForServe: boolean; // True when ball is positioned but waiting for server input
	servingPlayer: number; // Index of player who will serve (-1 if none)
}

/**
 * Compact power-up payload broadcast in MESSAGE_GAME_STATE:
 * - `t`: type id (`0 split`, `1 boost`, `2 stretch`, `3 shrink`)
 * - `s`: state (`0 drifting`, `1 active pickup`, `2 inactive pickup/expiry`)
 * - `p`: paddle index involved, or `-1` when not applicable
 */
export interface NetworkPowerupState {
	t: number; // power-up type id
	x: number; // X position
	z: number; // Z position
	s: number; // state flag (0=floating,1=active absorb,2=inactive absorb/despawn)
	p: number; // paddle index (0-based) or -1 when not applicable
}

export interface NetworkGameState {
	b: [number, number];
	pd: [number, number][];
	sb?: [number, number] | null;
	pu?: NetworkPowerupState | null;
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
			waitingForServe: false,
			servingPlayer: -1,
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
	resetBall(servingPlayerIndex?: number): void {
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
