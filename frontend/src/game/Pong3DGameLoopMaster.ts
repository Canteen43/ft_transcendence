import * as BABYLON from '@babylonjs/core';
import { MESSAGE_GAME_STATE } from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { webSocket } from '../utils/WebSocketWrapper';
import { GameConfig } from './GameConfig';
import { conditionalLog, conditionalWarn } from './Logger';
import { Pong3DGameLoop } from './Pong3DGameLoop';
import type { NetworkGameState } from './Pong3DGameLoopBase';

/**
 * Master game loop - IDENTICAL to local mode but adds network transmission
 * This is just local game + network sending. The main Pong3D class handles all game logic.
 */
export class Pong3DGameLoopMaster extends Pong3DGameLoop {
	private networkUpdateCallback: (gameState: any) => void;
	private networkUpdateInterval: NodeJS.Timeout | null = null;
	private gamestateLogInterval: NodeJS.Timeout | null = null;
	private readonly NETWORK_UPDATE_RATE = 60; // 60Hz network updates
	private readonly GAMESTATE_LOG_RATE = 1; // 1Hz gamestate logging
	private pong3DInstance: any; // Reference to get paddle positions
	private handleRemoteMove: (event: any) => void;

	constructor(
		scene: BABYLON.Scene,
		networkUpdateCallback: (gameState: any) => void,
		pong3DInstance?: any
	) {
		// Pass pong3DInstance to parent constructor for paddle access in serve system
		super(scene, pong3DInstance);
		this.networkUpdateCallback = networkUpdateCallback;
		this.pong3DInstance = pong3DInstance;

		// Set up listener for remote player input
		this.handleRemoteMove = (event: any) => {
			const moveData = event.detail;
			if (moveData.playerId && moveData.input) {
				this.processClientInput(moveData.playerId, moveData.input);
			}
		};
		document.addEventListener('remoteMove', this.handleRemoteMove);
	}

	/**
	 * Start - same as local + network transmission
	 */
	start(): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog('🌐 Master Mode: Local Game + Network');
		}

		// Start EXACTLY the same as local mode
		super.start();

		// Add ONLY network transmission
		this.startNetworkUpdates();
		this.startGamestateLogging();
	}

	/**
	 * Stop - same as local + stop network transmission
	 */
	stop(): void {
		// Stop network transmission
		this.stopNetworkUpdates();
		this.stopGamestateLogging();

		// Remove event listener
		document.removeEventListener('remoteMove', this.handleRemoteMove);

		// Stop EXACTLY the same as local mode
		super.stop();
	}

	/**
	 * Convert internal GameState to network format as per design document
	 * Returns: { "b": [x, z], "pd": [[x1,z1], [x2,z2], ...] }
	 */
	private convertToNetworkFormat(): NetworkGameState {
		const gameState = this.getGameState();

		// Helper function for network transmission - clean precision
		const networkNumber = (num: number): number => {
			// Clean tiny values and round to 3 decimals for network efficiency
			return Math.abs(num) < 0.001 ? 0 : Math.round(num * 1000) / 1000;
		};

		// Ball position [x, z] - network optimized
		const ballPosition: [number, number] = [
			networkNumber(gameState.ball.position.x),
			networkNumber(gameState.ball.position.z),
		];

		// Paddle positions [[x1,z1], [x2,z2], ...] - network optimized
		const paddlePositions: [number, number][] = [];

		const paddles = this.pong3DInstance?.paddles;
		if (Array.isArray(paddles) && paddles.length > 0) {
			conditionalLog('Master pong3DInstance.paddles:', paddles);
			for (let i = 0; i < this.pong3DInstance.playerCount; i++) {
				const paddle = paddles[i];
				conditionalLog(
					`Master paddle ${i}:`,
					paddle ? 'EXISTS' : 'NULL'
				);
				if (paddle) {
					const pos: [number, number] = [
						networkNumber(paddle.position.x),
						networkNumber(paddle.position.z),
					];
					paddlePositions.push(pos);
					conditionalLog(
						`Master paddle ${i} position: [${paddle.position.x.toFixed(3)}, ${paddle.position.z.toFixed(3)}] -> network [${pos[0]}, ${pos[1]}]`
					);
				}
			}
		} else {
			conditionalLog('Master pong3DInstance or paddles unavailable');
		}

		conditionalLog('📡 Master sending pd:', paddlePositions);

		return {
			b: ballPosition,
			pd: paddlePositions,
		};
	}
	private startNetworkUpdates(): void {
		if (this.networkUpdateInterval) {
			clearInterval(this.networkUpdateInterval);
		}

		this.networkUpdateInterval = setInterval(() => {
			const gameState = this.getGameState();
			const paddles = this.pong3DInstance?.paddles;
			if (
				gameState.isRunning &&
				!this.pong3DInstance?.gameEnded &&
				Array.isArray(paddles) &&
				paddles.length > 0
			) {
				// Convert to network format as per design document
				const networkGameState = this.convertToNetworkFormat();

				// Existing callback used by local networking logic / server logic
				this.networkUpdateCallback(networkGameState);

				// Send continuous gamestate to websocket so remote clients get updates
				try {
					// serialize payload to match MessageSchema (d expected to be a string)
					const payloadString = JSON.stringify(networkGameState);

					const msg: Message = {
						t: MESSAGE_GAME_STATE,
						d: payloadString,
					} as unknown as Message;
					webSocket.send(msg);
				} catch (err) {
					if (GameConfig.isDebugLoggingEnabled()) {
						conditionalWarn(
							'Failed to send gamestate over websocket',
							err
						);
					}
				}
			} else {
				this.stopNetworkUpdates();
			}
		}, 1000 / this.NETWORK_UPDATE_RATE);

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`📡 Network updates started at ${this.NETWORK_UPDATE_RATE}Hz`
			);
		}
	}

	/**
	 * Stop sending network updates
	 */
	private stopNetworkUpdates(): void {
		if (this.networkUpdateInterval) {
			clearInterval(this.networkUpdateInterval);
			this.networkUpdateInterval = null;
		}
	}

	/**
	 * Start gamestate logging at 1Hz
	 */
	private startGamestateLogging(): void {
		if (this.gamestateLogInterval) {
			clearInterval(this.gamestateLogInterval);
		}

		if (GameConfig.isGamestateLoggingEnabled()) {
			this.gamestateLogInterval = setInterval(() => {
				const gameState = this.getGameState();
				if (gameState.isRunning && !this.pong3DInstance?.gameEnded) {
					const networkGameState = this.convertToNetworkFormat();
					conditionalLog(
						'📡 Master gamestate (network format):',
						networkGameState
					);
				} else {
					this.stopGamestateLogging();
				}
			}, 1000 / this.GAMESTATE_LOG_RATE);

			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog(
					`📊 Gamestate logging started at ${this.GAMESTATE_LOG_RATE}Hz`
				);
			}
		}
	}

	/**
	 * Stop gamestate logging
	 */
	private stopGamestateLogging(): void {
		if (this.gamestateLogInterval) {
			clearInterval(this.gamestateLogInterval);
			this.gamestateLogInterval = null;
		}
	}

	/**
	 * Process input from remote client
	 */
	processClientInput(playerId: number, input: { k: number }): void {
		// Validate input
		if (input.k < 0 || input.k > 2) {
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalWarn(
					`⚠️ Invalid input from player ${playerId}: ${input.k}`
				);
			}
			return;
		}

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🎮 Processing input from player ${playerId}: ${input.k}`
			);
		}

		// Apply input to appropriate paddle by setting network key state
		// This allows the input to be processed by updatePaddles() like local input
		if (this.pong3DInstance && this.pong3DInstance.inputHandler) {
			const paddleIndex = playerId - 1; // Convert player ID (1-4) to array index (0-3)

			// Convert input command to key state
			let leftPressed = false;
			let rightPressed = false;

			switch (input.k) {
				case 0: // Stop - no movement
					leftPressed = false;
					rightPressed = false;
					break;
				case 1: // Move left/up
					leftPressed = true;
					rightPressed = false;
					break;
				case 2: // Move right/down
					leftPressed = false;
					rightPressed = true;
					break;
			}

			// Set the network key state - this will be processed by updatePaddles()
			this.pong3DInstance.inputHandler.setNetworkKeyState(
				paddleIndex,
				leftPressed,
				rightPressed
			);

			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalLog(
					`🎮 Player ${playerId} network input: left=${leftPressed}, right=${rightPressed}`
				);
			}
		}
	}
}
