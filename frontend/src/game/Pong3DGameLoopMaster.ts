import * as BABYLON from '@babylonjs/core';
import { MESSAGE_GAME_STATE } from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { webSocket } from '../utils/WebSocketWrapper';
import { GameConfig } from './GameConfig';
import { Pong3DGameLoop } from './Pong3DGameLoop';

/**
 * Master game loop - IDENTICAL to local mode but adds network transmission
 * This is just local game + network sending. The main Pong3D class handles all game logic.
 */
export class Pong3DGameLoopMaster extends Pong3DGameLoop {
	private networkUpdateCallback: (gameState: any) => void;
	private networkUpdateInterval: NodeJS.Timeout | null = null;
	private gamestateLogInterval: NodeJS.Timeout | null = null;
	private readonly NETWORK_UPDATE_RATE = 30; // 30Hz network updates
	private readonly GAMESTATE_LOG_RATE = 1; // 1Hz gamestate logging
	private pong3DInstance: any; // Reference to get paddle positions

	constructor(
		scene: BABYLON.Scene,
		networkUpdateCallback: (gameState: any) => void,
		pong3DInstance?: any
	) {
		// EXACTLY the same as local mode
		super(scene);
		this.networkUpdateCallback = networkUpdateCallback;
		this.pong3DInstance = pong3DInstance;
	}

	/**
	 * Start - same as local + network transmission
	 */
	start(): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			console.log('🌐 Master Mode: Local Game + Network');
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

		// Stop EXACTLY the same as local mode
		super.stop();
	}

	/**
	 * Convert internal GameState to network format as per design document
	 * Returns: { "b": [x, z], "pd": [[x1,z1], [x2,z2], ...] }
	 */
	private convertToNetworkFormat(): any {
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

		if (this.pong3DInstance && this.pong3DInstance.paddles) {
			for (let i = 0; i < this.pong3DInstance.playerCount; i++) {
				const paddle = this.pong3DInstance.paddles[i];
				if (paddle) {
					paddlePositions.push([
						networkNumber(paddle.position.x),
						networkNumber(paddle.position.z),
					]);
				}
			}
		}

		return {
			b: ballPosition,
			pd: paddlePositions,
		};
	}

	/**
	 * Start sending network updates at 30Hz
	 */
	private startNetworkUpdates(): void {
		if (this.networkUpdateInterval) {
			clearInterval(this.networkUpdateInterval);
		}

		this.networkUpdateInterval = setInterval(() => {
			if (this.getGameState().isRunning) {
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
						console.warn(
							'Failed to send gamestate over websocket',
							err
						);
					}
				}
			}
		}, 1000 / this.NETWORK_UPDATE_RATE);

		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(
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
				if (this.getGameState().isRunning) {
					const networkGameState = this.convertToNetworkFormat();
					console.log(
						'📡 Master gamestate (network format):',
						networkGameState
					);
				}
			}, 1000 / this.GAMESTATE_LOG_RATE);

			if (GameConfig.isDebugLoggingEnabled()) {
				console.log(
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
		// TODO: Apply client input to appropriate paddle
		// For now, just validate the input
		if (input.k < 0 || input.k > 2) {
			if (GameConfig.isDebugLoggingEnabled()) {
				console.warn(
					`⚠️ Invalid input from player ${playerId}: ${input.k}`
				);
			}
			return;
		}

		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(
				`🎮 Processing input from player ${playerId}: ${input.k}`
			);
		}

		// TODO: Apply input to paddle based on game mode (2P, 3P, 4P)
		// This will be implemented when paddle control is added
	}
}
