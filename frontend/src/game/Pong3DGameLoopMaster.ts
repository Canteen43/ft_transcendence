import * as BABYLON from '@babylonjs/core';
import { MESSAGE_GAME_STATE } from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { webSocket } from '../utils/WebSocketWrapper';
import { GameConfig } from './GameConfig';
import { conditionalLog, conditionalWarn } from './Logger';
import { Pong3DGameLoop } from './Pong3DGameLoop';
import type {
	NetworkGameState,
	NetworkPowerupState,
} from './Pong3DGameLoopBase';
import type { PowerupNetworkSnapshot } from './Pong3Dpowerups';
import { POWERUP_TYPE_TO_ID } from './Pong3Dpowerups';

/**
 * Master game loop - IDENTICAL to local mode but adds network transmission
 * This is just local game + network sending. The main Pong3D class handles all game logic.
 */
export class Pong3DGameLoopMaster extends Pong3DGameLoop {
	private networkUpdateCallback: (gameState: any) => void;
	private networkUpdateInterval: NodeJS.Timeout | null = null;
	private gamestateLogInterval: NodeJS.Timeout | null = null;
	private networkSequence = 0;
	private readonly NETWORK_UPDATE_RATE = 60; // 60Hz network updates
	private readonly GAMESTATE_LOG_RATE = 1; // 1Hz gamestate logging
	private pong3DInstance: any; // Reference to get paddle positions
	private handleRemoteMove: (event: any) => void;
	private clientAuthoritativePaddles: boolean[] = new Array(4).fill(false);

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
			if (
				moveData &&
				typeof moveData.playerId === 'number' &&
				moveData.paddle
			) {
				this.processClientInput(
					moveData.playerId,
					moveData.paddle,
					moveData.serve === true
				);
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

		this.networkSequence = 0;
		this.clientAuthoritativePaddles.fill(false);
		if (GameConfig.isRemoteMode()) {
			const playerCount = this.pong3DInstance?.playerCount ?? 0;
			for (
				let i = 1;
				i < playerCount && i < this.clientAuthoritativePaddles.length;
				i++
			) {
				this.clientAuthoritativePaddles[i] = true;
			}
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
		this.clientAuthoritativePaddles.fill(false);

		// Stop EXACTLY the same as local mode
		super.stop();
		sessionStorage.removeItem('alias1');
		sessionStorage.removeItem('alias2');
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
		const playerCount = this.pong3DInstance?.playerCount ?? 0;
		const paddlePositions: Array<[number, number] | null> = new Array(
			Math.max(0, playerCount)
		).fill(null);

		const paddles = this.pong3DInstance?.paddles;
		if (Array.isArray(paddles) && paddles.length > 0) {
			conditionalLog('Master pong3DInstance.paddles:', paddles);
			for (let i = 0; i < playerCount; i++) {
				const paddle = paddles[i];
				conditionalLog(
					`Master paddle ${i}:`,
					paddle ? 'EXISTS' : 'NULL'
				);
				if (!paddle) {
					continue;
				}

				if (this.clientAuthoritativePaddles[i]) {
					paddlePositions[i] = null;
					continue;
				}

				const pos: [number, number] = [
					networkNumber(paddle.position.x),
					networkNumber(paddle.position.z),
				];
				paddlePositions[i] = pos;
				conditionalLog(
					`Master paddle ${i} position: [${paddle.position.x.toFixed(3)}, ${paddle.position.z.toFixed(3)}] -> network [${pos[0]}, ${pos[1]}]`
				);
			}
		} else {
			conditionalLog('Master pong3DInstance or paddles unavailable');
		}

		// Trim trailing null entries (no need to send paddles controlled by clients)
		while (
			paddlePositions.length > 0 &&
			paddlePositions[paddlePositions.length - 1] === null
		) {
			paddlePositions.pop();
		}

		conditionalLog('📡 Master sending pd:', paddlePositions);

		const networkState: NetworkGameState = {
			b: ballPosition,
			pd: paddlePositions,
		};
		const splitBall = this.pong3DInstance?.getSplitBallNetworkPosition?.();
		if (splitBall) {
			networkState.sb = [
				networkNumber(splitBall.x),
				networkNumber(splitBall.z),
			];
		}
		const powerupSnapshot =
			this.pong3DInstance?.getPowerupNetworkSnapshot?.() as
				| PowerupNetworkSnapshot
				| null
				| undefined;
		if (powerupSnapshot) {
			const powerupState: NetworkPowerupState = {
				t: POWERUP_TYPE_TO_ID[powerupSnapshot.type],
				x: networkNumber(powerupSnapshot.x * -1),
				z: networkNumber(powerupSnapshot.z),
				s: powerupSnapshot.state,
				p: powerupSnapshot.paddleIndex ?? -1,
			};
			networkState.pu = powerupState;
		}

		return networkState;
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

				// Attach sequence before publishing so all consumers share numbering
				networkGameState.seq = this.networkSequence++;
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
	 * Process paddle state from remote client
	 */
	processClientInput(
		playerId: number,
		paddleState: { pos: [number, number]; vel: [number, number] },
		requestServe: boolean
	): void {
		if (
			!paddleState ||
			!Array.isArray(paddleState.pos) ||
			paddleState.pos.length < 2 ||
			!Array.isArray(paddleState.vel) ||
			paddleState.vel.length < 2
		) {
			if (GameConfig.isDebugLoggingEnabled()) {
				conditionalWarn(
					`⚠️ Invalid paddle state from player ${playerId}:`,
					paddleState
				);
			}
			return;
		}

		const paddleIndex = playerId - 1;
		const paddles = this.pong3DInstance?.paddles;
		if (
			!Array.isArray(paddles) ||
			paddleIndex < 0 ||
			paddleIndex >= paddles.length
		) {
			return;
		}

		const paddleMesh = paddles[paddleIndex] as BABYLON.Mesh | null;
		if (!paddleMesh) {
			return;
		}

		this.clientAuthoritativePaddles[paddleIndex] = true;

		const currentY = paddleMesh.position.y;
		const nextPosition = new BABYLON.Vector3(
			paddleState.pos[0],
			currentY,
			paddleState.pos[1]
		);
		paddleMesh.position.copyFrom(nextPosition);

		const impostor = paddleMesh.physicsImpostor;
		if (impostor) {
			try {
				impostor.setLinearVelocity(
					new BABYLON.Vector3(
						paddleState.vel[0],
						0,
						paddleState.vel[1]
					)
				);
				const body = impostor.physicsBody;
				if (body) {
					body.position.x = nextPosition.x;
					body.position.y = nextPosition.y;
					body.position.z = nextPosition.z;
				}
			} catch (err) {
				if (GameConfig.isDebugLoggingEnabled()) {
					conditionalWarn('Failed to sync paddle impostor', err);
				}
			}
		}

		// Neutralise network key state so master physics does not reapply impulses
		if (this.pong3DInstance?.inputHandler) {
			this.pong3DInstance.inputHandler.setNetworkKeyState(
				paddleIndex,
				false,
				false
			);
		}

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(
				`🎮 Player ${playerId} paddle sync: pos=${paddleState.pos
					.map(v => v.toFixed(3))
					.join(',')}, vel=${paddleState.vel
					.map(v => v.toFixed(3))
					.join(',')}`
			);
		}

		if (requestServe && typeof (this as any).launchServe === 'function') {
			this.launchServe();
		}
	}
}
