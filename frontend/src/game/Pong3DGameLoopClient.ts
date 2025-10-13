import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { conditionalLog, conditionalWarn } from './Logger';
import { Pong3DGameLoopBase } from './Pong3DGameLoopBase';
import type { NetworkPowerupState } from './Pong3DGameLoopBase';

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
	private handleRemoteGameState: (event: any) => void;
	private keyboardObserver: BABYLON.Nullable<
		BABYLON.Observer<BABYLON.KeyboardInfo>
	> = null;
	private splitBallMesh: BABYLON.Mesh | null = null;

	// Track current input state to only send changes
	private currentInputState = 0; // 0=none, 1=left/up, 2=right/down
	private logCounter = 0; // Counter for throttling detailed logs to 1Hz
	// Track which keys are currently pressed to avoid spurious stop commands
	private keysPressed = new Set<string>();

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

		// Set up WebSocket listener for remote game state updates
		this.handleRemoteGameState = (event: any) => {
			this.receiveGameState(event.detail);
		};
		document.addEventListener(
			'remoteGameState',
			this.handleRemoteGameState
		);

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🎮 Client Mode: Player ${thisPlayerId} (render only, no physics)`
			);
		}
	}

	/**
	 * Start client mode - only rendering, no physics
	 */
	start(): void {
		if (this.renderObserver) {
			conditionalWarn('Client game loop already running');
			return;
		}

		this.gameState.isRunning = true;

		// Simple render loop - no physics, just smooth rendering
		this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
			// Client just renders - all positions come from network
		});

		// Set up keyboard input for sending input commands to master
		this.setupKeyboardInput();

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🎮 Client rendering started for Player ${this.thisPlayerId}`
			);
		}
	}

	/**
	 * Set up keyboard input for sending input commands to master
	 */
	private setupKeyboardInput(): void {
		// Remove existing observer if any
		if (this.keyboardObserver) {
			this.scene.onKeyboardObservable.remove(this.keyboardObserver);
		}

		this.keyboardObserver = this.scene.onKeyboardObservable.add(kbInfo => {
			switch (kbInfo.type) {
				case BABYLON.KeyboardEventTypes.KEYDOWN:
					this.handleKeyDown(kbInfo.event.key);
					break;
				case BABYLON.KeyboardEventTypes.KEYUP:
					this.handleKeyUp(kbInfo.event.key);
					break;
			}
		});
	}

	/**
	 * Handle key down events for sending input to master
	 */
	private handleKeyDown(key: string): void {
		// Track which arrow keys are pressed
		const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
		if (arrowKeys.includes(key)) {
			this.keysPressed.add(key);
		}

		let inputCommand = 0; // 0=none

		// Client mode: Use arrow keys to control this player's paddle
		switch (key) {
			case 'ArrowUp':
			case 'ArrowLeft':
				inputCommand = 1; // Move up/left
				break;
			case 'ArrowDown':
			case 'ArrowRight':
				inputCommand = 2; // Move down/right
				break;
		}

		if (inputCommand !== 0) {
			this.sendInput(inputCommand);
		}
	}

	/**
	 * Handle key up events
	 */
	private handleKeyUp(key: string): void {
		// Track which arrow keys are released
		const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
		if (arrowKeys.includes(key)) {
			this.keysPressed.delete(key);
			
			// Only send stop command if NO arrow keys are pressed anymore
			if (this.keysPressed.size === 0 && this.currentInputState !== 0) {
				this.sendInput(0); // Stop movement
			} else if (this.keysPressed.size > 0) {
				// If other keys are still pressed, re-send the correct input command
				// Check which keys are still held and send appropriate command
				const hasUpLeft = this.keysPressed.has('ArrowUp') || this.keysPressed.has('ArrowLeft');
				const hasDownRight = this.keysPressed.has('ArrowDown') || this.keysPressed.has('ArrowRight');
				
				if (hasUpLeft) {
					this.sendInput(1); // Continue moving up/left
				} else if (hasDownRight) {
					this.sendInput(2); // Continue moving down/right
				}
			}
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

		// Remove keyboard observer
		if (this.keyboardObserver) {
			this.scene.onKeyboardObservable.remove(this.keyboardObserver);
			this.keyboardObserver = null;
		}

		// Remove WebSocket listener
		document.removeEventListener(
			'remoteGameState',
			this.handleRemoteGameState
		);

		if (this.splitBallMesh && !this.splitBallMesh.isDisposed()) {
			try {
				this.splitBallMesh.dispose(true, true);
			} catch (_) {}
		}
		this.splitBallMesh = null;

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(`🎮 Client stopped for Player ${this.thisPlayerId}`);
		}
	}

	/**
	 * Receive gamestate from master and update positions directly
	 * Format: { "b": [x, z], "pd": [[x1,z1], [x2,z2], ...] }
	 */
	receiveGameState(gameStateMessage?: {
		b: [number, number];
		pd: [number, number][];
		sb?: [number, number] | null;
		pu?: NetworkPowerupState | null;
	}): void {
		if (
			!gameStateMessage ||
			!Array.isArray(gameStateMessage.b) ||
			gameStateMessage.b.length < 2 ||
			!Array.isArray(gameStateMessage.pd)
		) {
			return;
		}
		conditionalLog('📡 Client received pd:', gameStateMessage.pd);

		if (GameConfig.isGamestateLoggingEnabled()) {
			conditionalLog(
				`📡 Player ${this.thisPlayerId} received:`,
				gameStateMessage
			);
		}

		// Throttle detailed logging to 1Hz (every 30 messages at 30Hz)
		this.logCounter = (this.logCounter + 1) % 30;
		const shouldLogDetails = this.logCounter === 0;

		// Update ball position directly (no physics)
		if (this.ballMesh) {
			const ballY = this.ballMesh.position.y; // Preserve Y position from GLB
			this.ballMesh.position.set(
				gameStateMessage.b[0] * -1, // X from network
				ballY, // Y preserved
				gameStateMessage.b[1] // Z from network
			);

			// Update internal game state
			this.gameState.ball.position.set(
				gameStateMessage.b[0] * -1,
				ballY,
				gameStateMessage.b[1]
			);
		}

		// Update all paddle positions from network
		const paddles = this.pong3DInstance?.paddles;
		if (Array.isArray(paddles)) {
			if (shouldLogDetails) {
				conditionalLog(
					'Client pong3DInstance.paddles:',
					paddles
				);
			}
			gameStateMessage.pd.forEach((paddlePos, index) => {
				if (!Array.isArray(paddlePos) || paddlePos.length < 2) {
					return;
				}
				const paddle = paddles[index];
				if (shouldLogDetails) {
					conditionalLog(
						`Client paddle ${index}:`,
						paddle ? 'EXISTS' : 'NULL',
						paddlePos
					);
				}
				if (paddle) {
					const oldPos = paddle.position.clone();
					const paddleY = paddle.position.y; // Preserve Y from GLB
					const newPosition = new BABYLON.Vector3(
						paddlePos[0], // X from network
						paddleY, // Y preserved
						paddlePos[1] // Z from network
					);

					// Update mesh position only (client is viewer, no physics needed)
					paddle.position.copyFrom(newPosition);
					if (shouldLogDetails) {
						conditionalLog(
							`Client updated paddle ${index} from [${oldPos.x.toFixed(3)}, ${oldPos.z.toFixed(3)}] to [${paddlePos[0].toFixed(3)}, ${paddlePos[1].toFixed(3)}]`
						);
					}

					if (GameConfig.isDebugLoggingEnabled()) {
						conditionalLog(
							`🎮 Client updated paddle ${index + 1} position: [${paddlePos[0]}, ${paddlePos[1]}]`
						);
					}
				}
			});
		} else {
			if (shouldLogDetails) {
				conditionalLog(
					'Client pong3DInstance or paddles is null:',
					this.pong3DInstance
				);
			}
		}

		this.updateSplitBall(gameStateMessage.sb);
		this.handlePowerupState(gameStateMessage.pu);
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
				conditionalLog(
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
	 * Set ball velocity (client doesn't control physics, so this is a no-op)
	 */
	setBallVelocity(_velocity: BABYLON.Vector3): void {
		// Client doesn't run physics - velocity is controlled by master
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🎮 Client ignoring setBallVelocity - physics controlled by master`
			);
		}
	}

	private ensureSplitBallMesh(): BABYLON.Mesh | null {
		if (this.splitBallMesh && !this.splitBallMesh.isDisposed()) {
			return this.splitBallMesh;
		}
		if (!this.ballMesh) {
			return null;
		}
		const clone = this.ballMesh.clone(
			`remoteSplitBall.${performance.now()}`,
			null
		);
		if (!clone) {
			return null;
		}
		try {
			clone.physicsImpostor?.dispose();
		} catch (_) {}
		clone.physicsImpostor = null as any;
		clone.isPickable = false;
		clone.checkCollisions = false;
		clone.position = this.ballMesh.position.clone();
		clone.rotationQuaternion =
			this.ballMesh.rotationQuaternion?.clone() ??
			BABYLON.Quaternion.Identity();
		try {
			const ballColour = new BABYLON.Color3(0, 1, 1);
			if (
				clone.material &&
				'albedoColor' in (clone.material as any) &&
				typeof (clone.material as any).clone === 'function'
			) {
				const pbr = (clone.material as any).clone(
					`remoteSplitBall.material.${performance.now()}`
				);
				(pbr as any).albedoColor = ballColour;
				clone.material = pbr as any;
			} else {
				const mat = new BABYLON.StandardMaterial(
					`remoteSplitBall.standardMat.${performance.now()}`,
					this.scene
				);
				mat.diffuseColor = ballColour;
				mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
				clone.material = mat;
			}
		} catch (_) {}
		this.splitBallMesh = clone;
		return clone;
	}

	private updateSplitBall(
		position: [number, number] | null | undefined
	): void {
		if (!position || position.length < 2) {
			this.clearSplitBallMesh();
			return;
		}
		const mesh = this.ensureSplitBallMesh();
		if (!mesh) {
			return;
		}
		const ballY = mesh.position.y || this.ballMesh?.position.y || 0;
		mesh.position.set(position[0] * -1, ballY, position[1]);
		mesh.setEnabled(true);
	}

	private clearSplitBallMesh(): void {
		if (this.splitBallMesh && !this.splitBallMesh.isDisposed()) {
			this.splitBallMesh.setEnabled(false);
		}
	}

	private handlePowerupState(state?: NetworkPowerupState | null): void {
		if (this.pong3DInstance?.handleRemotePowerupState) {
			this.pong3DInstance.handleRemotePowerupState(state ?? null);
		}
	}
}
