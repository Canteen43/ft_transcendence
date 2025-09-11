import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { Pong3DGameLoopBase } from './Pong3DGameLoopBase';

/**
 * Client Game Loop - Receives updates from master and renders directly
 * As per design document: No physics, just render from network updates
 */
export class Pong3DGameLoopClient extends Pong3DGameLoopBase {
	private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> =
		null;
	private thisPlayerId: number;
	private onInputSend?: (inputCommand: { k: number }) => void;
	private pong3DInstance: any; // Reference to main Pong3D instance for paddle access

	// Track current input state to only send changes
	private currentInputState = 0; // 0=none, 1=left/up, 2=right/down

	constructor(
		scene: BABYLON.Scene,
		thisPlayerId: number,
		onInputSend?: (inputCommand: { k: number }) => void,
		pong3DInstance?: any
	) {
		super(scene);
		this.thisPlayerId = thisPlayerId;
		this.onInputSend = onInputSend;
		this.pong3DInstance = pong3DInstance;

		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(
				`🎮 Client Mode: Player ${thisPlayerId} (render only, no physics)`
			);
		}
	}

	/**
	 * Start client mode - only rendering, no physics
	 */
	start(): void {
		if (this.renderObserver) {
			console.warn('Client game loop already running');
			return;
		}

		this.gameState.isRunning = true;

		// Simple render loop - no physics, just smooth rendering
		this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
			// Client just renders - all positions come from network
		});

		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(
				`🎮 Client rendering started for Player ${this.thisPlayerId}`
			);
		}
	}

	/**
	 * Stop client mode
	 */
	stop(): void {
		this.gameState.isRunning = false;

		if (this.renderObserver) {
			this.scene.onBeforeRenderObservable.remove(this.renderObserver);
			this.renderObserver = null;
		}

		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(`🎮 Client stopped for Player ${this.thisPlayerId}`);
		}
	}

	/**
	 * Receive gamestate from master and update positions directly
	 * Format: { "b": [x, z], "pd": [[x1,z1], [x2,z2], ...] }
	 */
	receiveGameState(gameStateMessage: {
		b: [number, number];
		pd: [number, number][];
	}): void {
		if (GameConfig.isGamestateLoggingEnabled()) {
			console.log(
				`📡 Player ${this.thisPlayerId} received:`,
				gameStateMessage
			);
		}

		// Update ball position directly (no physics)
		if (this.ballMesh) {
			const ballY = this.ballMesh.position.y; // Preserve Y position from GLB
			this.ballMesh.position.set(
				gameStateMessage.b[0], // X from network
				ballY, // Y preserved
				gameStateMessage.b[1] // Z from network
			);

			// Update internal game state
			this.gameState.ball.position.set(
				gameStateMessage.b[0],
				ballY,
				gameStateMessage.b[1]
			);
		}

		// Update other player paddle positions (skip own paddle for responsiveness)
		if (this.pong3DInstance && this.pong3DInstance.paddles) {
			gameStateMessage.pd.forEach((paddlePos, index) => {
				// Skip our own paddle if using local prediction
				if (index !== this.thisPlayerId - 1) {
					const paddle = this.pong3DInstance.paddles[index];
					if (paddle) {
						const paddleY = paddle.position.y; // Preserve Y from GLB
						paddle.position.set(
							paddlePos[0], // X from network
							paddleY, // Y preserved
							paddlePos[1] // Z from network
						);
					}
				}
			});
		}
	}

	/**
	 * Send input to master (only on input changes)
	 * Input encoding: 0=none, 1=left/up, 2=right/down
	 */
	sendInput(keyInput: number): void {
		// Only send if input changed (bandwidth optimization)
		if (keyInput !== this.currentInputState) {
			this.currentInputState = keyInput;

			const inputCommand = { k: keyInput };
			if (GameConfig.isDebugLoggingEnabled()) {
				console.log(
					`📡 Player ${this.thisPlayerId} input:`,
					inputCommand
				);
			}

			// Send via WebSocket callback
			if (this.onInputSend) {
				this.onInputSend(inputCommand);
			}
		}
	}

	/**
	 * Process local input for immediate paddle response + send to master
	 */
	processLocalInput(keyInput: number): void {
		// Optional: Move own paddle immediately for responsiveness
		// Will be corrected by master updates if needed
		if (this.pong3DInstance && this.pong3DInstance.setPaddlePosition) {
			// Apply local prediction here if desired
		}

		// Send to master
		this.sendInput(keyInput);
	}
}
