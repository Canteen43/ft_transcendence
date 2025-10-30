import * as BABYLON from '@babylonjs/core';
import { GameConfig } from './GameConfig';
import { conditionalLog, conditionalWarn } from './Logger';
import {
	isMobileInputEnabled,
	MobileControlSide,
	MobileControlsOverlay,
} from './MobileControlsOverlay';
import type {
	NetworkGameState,
	NetworkPowerupState,
} from './Pong3DGameLoopBase';
import { Pong3DGameLoopBase } from './Pong3DGameLoopBase';

export interface ClientPaddleStatePayload {
	pos: { x: number; z: number };
	vel: { x: number; z: number };
	serve?: boolean;
}

/**
 * Client Game Loop - renders master updates while simulating the local paddle
 * Locally applies input to keep the player's paddle responsive and streams
 * position/velocity back to the master.
 */
export class Pong3DGameLoopClient extends Pong3DGameLoopBase {
	private renderObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> =
		null;
	private thisPlayerId: number;
	private onInputSend?: (state: ClientPaddleStatePayload) => void;
	private pong3DInstance: any; // Reference to main Pong3D instance for paddle access
	private handleRemoteGameState: (event: any) => void;
	private keyboardObserver: BABYLON.Nullable<
		BABYLON.Observer<BABYLON.KeyboardInfo>
	> = null;
	private splitBallMesh: BABYLON.Mesh | null = null;
	private mobileControls?: MobileControlsOverlay;
	private localPaddleMesh: BABYLON.Mesh | null = null;
	private localPaddleOrigin: BABYLON.Vector3 | null = null;
	private localMovementAxis: BABYLON.Vector3 = new BABYLON.Vector3(1, 0, 0);
	private localDisplacement = 0;
	private localSpeed = 0;
	private localVelocityVector: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0);
	private localStoppedAtBoundary = false;
	private readonly paddleMass = GameConfig.getPaddleMass();
	private readonly paddleForce = GameConfig.getPaddleForce();
	private readonly localMaxVelocity = GameConfig.getPaddleMaxVelocity();
	private readonly localBrakeFactor = GameConfig.getPaddleBrakingFactor();
	private readonly movementRange = GameConfig.getPaddleRange();
	private broadcastAccumulator = 0;
	private readonly broadcastInterval = 1 / 60; // seconds
	private lastSentState: ClientPaddleStatePayload | null = null;
	private timeSinceLastSend = 0;
	private pendingServeMessage = false;
	private hasSentServeMessage = false;
	private renderDelayMs = GameConfig.getNetworkRenderDelayMs();
	private maxBufferRetentionMs = GameConfig.getNetworkBufferRetentionMs();
	private stateBuffer: Array<{
		timestamp: number;
		seq: number;
		state: NetworkGameState;
	}> = [];
	private nextSyntheticSequence = 0;
	private lastAppliedSeq = -1;

	// Track current input state to only send changes
	private currentInputState = 0; // 0=none, 1=left/up, 2=right/down
	private logCounter = 0; // Counter for throttling detailed logs to 1Hz
	// Track which keys are currently pressed to avoid spurious stop commands
	private keysPressed = new Set<string>();

	constructor(
		scene: BABYLON.Scene,
		thisPlayerId: number,
		onInputSend?: (state: ClientPaddleStatePayload) => void,
		pong3DInstance?: any
	) {
		super(scene);
		this.thisPlayerId = thisPlayerId;
		this.onInputSend = onInputSend;
		this.pong3DInstance = pong3DInstance;

		this.setupMobileControls();

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
				`🎮 Client Mode: Player ${thisPlayerId} (local paddle authority)`
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

		this.stateBuffer = [];
		this.nextSyntheticSequence = 0;
		this.lastAppliedSeq = -1;
		this.renderDelayMs = GameConfig.getNetworkRenderDelayMs();
		this.maxBufferRetentionMs = GameConfig.getNetworkBufferRetentionMs();

		this.gameState.isRunning = true;

		// Drive local client-side simulation each render frame
		this.renderObserver = this.scene.onBeforeRenderObservable.add(() => {
			this.stepLocalSimulation();
			this.renderFromBuffer();
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

	private setupMobileControls(): void {
		if (!isMobileInputEnabled()) {
			return;
		}

		this.mobileControls = new MobileControlsOverlay({
			onStateChange: (side, pressed) =>
				this.handleMobileControlChange(side, pressed),
		});
	}

	private handleMobileControlChange(
		side: MobileControlSide,
		pressed: boolean
	): void {
		const key = side === 'left' ? 'ArrowLeft' : 'ArrowRight';
		if (pressed) {
			this.handleKeyDown(key);
		} else {
			this.handleKeyUp(key);
		}
	}

	private stepLocalSimulation(): void {
		const engine = this.scene.getEngine();
		if (!engine) {
			return;
		}
		const deltaMs = engine.getDeltaTime();
		if (!Number.isFinite(deltaMs) || deltaMs <= 0) {
			return;
		}
		const deltaSeconds = Math.min(deltaMs / 1000, 0.05);
		if (!this.gameState.isRunning) {
			return;
		}

		const paddle = this.resolveLocalPaddle();
		if (!paddle) {
			return;
		}

		this.updateMovementAxis();
		this.simulateLocalPaddlePhysics(deltaSeconds, paddle);
		this.maybeBroadcastPaddleState(deltaSeconds, paddle);
	}

	private resolveLocalPaddle(): BABYLON.Mesh | null {
		if (this.localPaddleMesh && !this.localPaddleMesh.isDisposed()) {
			return this.localPaddleMesh;
		}

		const paddles = this.pong3DInstance?.paddles;
		if (!Array.isArray(paddles)) {
			return null;
		}

		const playerIndex = Math.max(0, this.thisPlayerId - 1);
		const paddle = paddles[playerIndex] ?? null;
		if (!paddle) {
			return null;
		}

		this.localPaddleMesh = paddle;
		if (!this.localPaddleOrigin) {
			this.localPaddleOrigin = paddle.position.clone();
			this.localDisplacement = 0;
		}
		return this.localPaddleMesh;
	}

	private updateMovementAxis(): void {
		const paddles = this.pong3DInstance?.paddles;
		if (!Array.isArray(paddles)) {
			return;
		}
		const playerIndex = Math.max(0, this.thisPlayerId - 1);
		const playerCount = this.pong3DInstance?.playerCount ?? paddles.length;

		if (playerCount === 3) {
			const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
			const angle =
				angles[Math.max(0, Math.min(playerIndex, angles.length - 1))] ??
				0;
			this.localMovementAxis = new BABYLON.Vector3(
				Math.cos(angle),
				0,
				Math.sin(angle)
			).normalize();
		} else if (playerCount === 4 && playerIndex >= 2) {
			this.localMovementAxis = new BABYLON.Vector3(0, 0, 1);
		} else {
			this.localMovementAxis = new BABYLON.Vector3(1, 0, 0);
		}
	}

	private simulateLocalPaddlePhysics(
		deltaSeconds: number,
		paddle: BABYLON.Mesh
	): void {
		if (!this.localPaddleOrigin) {
			this.localPaddleOrigin = paddle.position.clone();
			this.localDisplacement = 0;
		}

		const impostor = paddle.physicsImpostor;
		if (!impostor) {
			return;
		}

		const axisNorm = this.localMovementAxis.clone().normalize();
		this.localMovementAxis = axisNorm.clone();
		const origin = this.localPaddleOrigin!;
		const originVec = new BABYLON.Vector3(origin.x, 0, origin.z);
		const posVec = new BABYLON.Vector3(
			paddle.position.x,
			0,
			paddle.position.z
		);

		const originAlongAxis = BABYLON.Vector3.Dot(originVec, axisNorm);
		const posAlongAxis = BABYLON.Vector3.Dot(posVec, axisNorm);
		this.localDisplacement = posAlongAxis - originAlongAxis;

		const velocity = impostor.getLinearVelocity() ?? BABYLON.Vector3.Zero();
		const velAlong = BABYLON.Vector3.Dot(velocity, axisNorm);
		const speedAlong = Math.abs(velAlong);

		const minBound = originAlongAxis - this.movementRange;
		const maxBound = originAlongAxis + this.movementRange;
		const BOUND_EPS = 0.02;
		const atMin = posAlongAxis <= minBound + BOUND_EPS;
		const atMax = posAlongAxis >= maxBound - BOUND_EPS;
		const isOutOfBounds =
			posAlongAxis < minBound - BOUND_EPS ||
			posAlongAxis > maxBound + BOUND_EPS;

		const inputDir = this.getDesiredDirection();

		if (inputDir === 0 && !isOutOfBounds) {
			const brakedVelocity = velocity.scale(this.localBrakeFactor);
			if (brakedVelocity.length() > 0.05) {
				impostor.setLinearVelocity(brakedVelocity);
			} else {
				impostor.setLinearVelocity(BABYLON.Vector3.Zero());
			}
			this.localSpeed = 0;
			this.localStoppedAtBoundary = false;
			const brakingVelocity =
				impostor.getLinearVelocity() ?? BABYLON.Vector3.Zero();
			this.localVelocityVector = new BABYLON.Vector3(
				brakingVelocity.x,
				0,
				brakingVelocity.z
			);
			const finalPosAlongAxis = BABYLON.Vector3.Dot(
				new BABYLON.Vector3(paddle.position.x, 0, paddle.position.z),
				axisNorm
			);
			this.localDisplacement = finalPosAlongAxis - originAlongAxis;
			return;
		}

		if (speedAlong > this.localMaxVelocity) {
			const clamped = axisNorm.scale(
				Math.sign(velAlong) * this.localMaxVelocity
			);
			const perp = velocity.subtract(axisNorm.scale(velAlong));
			impostor.setLinearVelocity(clamped.add(perp));
		}

		if (isOutOfBounds || atMin || atMax) {
			if (!this.localStoppedAtBoundary) {
				impostor.setLinearVelocity(BABYLON.Vector3.Zero());
				this.localStoppedAtBoundary = true;
			}

			const clampedPosAlongAxis = Math.max(
				minBound,
				Math.min(maxBound, posAlongAxis)
			);
			const clampedPos = originVec.add(
				axisNorm.scale(clampedPosAlongAxis - originAlongAxis)
			);
			paddle.position.x = clampedPos.x;
			paddle.position.z = clampedPos.z;
			const body = impostor.physicsBody as any;
			if (body?.position) {
				body.position.x = clampedPos.x;
				body.position.y = paddle.position.y;
				body.position.z = clampedPos.z;
			}

			if (inputDir !== 0) {
				const outward =
					(atMax && inputDir > 0) || (atMin && inputDir < 0);
				if (!outward) {
					const impulse = axisNorm.scale(inputDir * this.paddleForce);
					impostor.applyImpulse(
						impulse,
						paddle.getAbsolutePosition()
					);
					this.localStoppedAtBoundary = false;
				} else {
					impostor.setLinearVelocity(BABYLON.Vector3.Zero());
				}
			}
			this.localDisplacement = clampedPosAlongAxis - originAlongAxis;
		} else if (inputDir !== 0) {
			const currentDirection = Math.sign(velAlong);
			const wantedDirection = Math.sign(inputDir);
			if (
				currentDirection !== 0 &&
				wantedDirection !== currentDirection
			) {
				impostor.setLinearVelocity(BABYLON.Vector3.Zero());
			}
			const impulse = axisNorm.scale(wantedDirection * this.paddleForce);
			impostor.applyImpulse(impulse, paddle.getAbsolutePosition());
		}

		if (
			posAlongAxis > minBound + BOUND_EPS &&
			posAlongAxis < maxBound - BOUND_EPS
		) {
			this.localStoppedAtBoundary = false;
		}

		const rawVelocity =
			impostor.getLinearVelocity() ?? BABYLON.Vector3.Zero();
		const finalVelocity = new BABYLON.Vector3(
			rawVelocity.x,
			0,
			rawVelocity.z
		);
		this.localVelocityVector = finalVelocity;
		this.localSpeed = BABYLON.Vector3.Dot(finalVelocity, axisNorm);
		const finalPosAlongAxis = BABYLON.Vector3.Dot(
			new BABYLON.Vector3(paddle.position.x, 0, paddle.position.z),
			axisNorm
		);
		this.localDisplacement = finalPosAlongAxis - originAlongAxis;
	}

	private maybeBroadcastPaddleState(
		deltaSeconds: number,
		paddle: BABYLON.Mesh
	): void {
		if (!this.onInputSend) {
			return;
		}

		this.broadcastAccumulator += deltaSeconds;
		this.timeSinceLastSend += deltaSeconds;
		if (this.broadcastAccumulator < this.broadcastInterval) {
			return;
		}
		this.broadcastAccumulator = 0;

		const state: ClientPaddleStatePayload = {
			pos: {
				x: this.roundNetworkNumber(paddle.position.x),
				z: this.roundNetworkNumber(paddle.position.z),
			},
			vel: {
				x: this.roundNetworkNumber(this.localVelocityVector.x),
				z: this.roundNetworkNumber(this.localVelocityVector.z),
			},
			serve: this.pendingServeMessage || undefined,
		};

		const serveRequested = !!state.serve;
		const significantChange =
			serveRequested ||
			!this.lastSentState ||
			this.hasMeaningfulDelta(this.lastSentState, state);
		const timeoutExceeded = this.timeSinceLastSend >= 0.5;

		if (!significantChange && !timeoutExceeded) {
			return;
		}

		this.timeSinceLastSend = 0;
		this.lastSentState = {
			pos: { ...state.pos },
			vel: { ...state.vel },
			serve: state.serve,
		};
		this.pendingServeMessage = false;
		this.onInputSend(state);
	}

	private getDesiredDirection(): number {
		if (this.currentInputState === 1) return -1;
		if (this.currentInputState === 2) return 1;
		return 0;
	}

	private roundNetworkNumber(value: number): number {
		return Math.abs(value) < 0.0001 ? 0 : Math.round(value * 1000) / 1000;
	}

	private hasMeaningfulDelta(
		previous: ClientPaddleStatePayload,
		next: ClientPaddleStatePayload
	): boolean {
		if (!!previous.serve !== !!next.serve) {
			return true;
		}
		const posDiff =
			Math.abs(previous.pos.x - next.pos.x) +
			Math.abs(previous.pos.z - next.pos.z);
		const velDiff =
			Math.abs(previous.vel.x - next.vel.x) +
			Math.abs(previous.vel.z - next.vel.z);
		const POS_EPS = 0.003;
		const VEL_EPS = 0.01;
		return posDiff > POS_EPS || velDiff > VEL_EPS;
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
			if (!this.hasSentServeMessage) {
				this.pendingServeMessage = true;
				this.hasSentServeMessage = true;
				this.broadcastAccumulator = this.broadcastInterval;
			}
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
				const hasUpLeft =
					this.keysPressed.has('ArrowUp') ||
					this.keysPressed.has('ArrowLeft');
				const hasDownRight =
					this.keysPressed.has('ArrowDown') ||
					this.keysPressed.has('ArrowRight');

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

		this.freezeDynamicBodies();

		if (this.renderObserver) {
			this.scene.onBeforeRenderObservable.remove(this.renderObserver);
			this.renderObserver = null;
		}

		this.stateBuffer = [];
		this.lastAppliedSeq = -1;

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
		this.mobileControls?.destroy();
		this.mobileControls = undefined;

		if (this.splitBallMesh && !this.splitBallMesh.isDisposed()) {
			try {
				this.splitBallMesh.dispose(true, true);
			} catch (_) {}
		}
		this.splitBallMesh = null;

		this.localPaddleMesh = null;
		this.localPaddleOrigin = null;
		this.localDisplacement = 0;
		this.localSpeed = 0;
		this.localVelocityVector.setAll(0);
		this.broadcastAccumulator = 0;
		this.timeSinceLastSend = 0;
		this.lastSentState = null;
		this.pendingServeMessage = false;
		this.hasSentServeMessage = false;
		this.localStoppedAtBoundary = false;

		if (GameConfig.isDebugLoggingEnabled()) {
			conditionalLog(`🎮 Client stopped for Player ${this.thisPlayerId}`);
		}
		sessionStorage.removeItem('alias1');
		sessionStorage.removeItem('alias2');
	}

	private freezeDynamicBodies(): void {
		if (this.ballMesh?.physicsImpostor) {
			try {
				this.ballMesh.physicsImpostor.setLinearVelocity(
					BABYLON.Vector3.Zero()
				);
				this.ballMesh.physicsImpostor.setAngularVelocity(
					BABYLON.Vector3.Zero()
				);
			} catch (_) {
				// ignore
			}
		}

		const paddles = this.pong3DInstance?.paddles;
		if (Array.isArray(paddles)) {
			for (const paddle of paddles) {
				const impostor = paddle?.physicsImpostor;
				if (!impostor) continue;
				try {
					impostor.setLinearVelocity(BABYLON.Vector3.Zero());
					impostor.setAngularVelocity(BABYLON.Vector3.Zero());
				} catch (_) {
					// ignore
				}
			}
		}
	}

	/**
	 * Receive gamestate from master and update positions directly
	 * Format: { "b": [x, z], "pd": [[x1,z1] | null, ...] }
	 */
	receiveGameState(gameStateMessage?: NetworkGameState | null): void {
		if (
			!gameStateMessage ||
			!Array.isArray(gameStateMessage.b) ||
			gameStateMessage.b.length < 2
		) {
			return;
		}
		if (!Array.isArray(gameStateMessage.pd)) {
			gameStateMessage.pd = [];
		}
		this.enqueueNetworkState(gameStateMessage);
	}

	private enqueueNetworkState(message: NetworkGameState): void {
		const now =
			typeof performance !== 'undefined' ? performance.now() : Date.now();
		const seq =
			typeof message.seq === 'number'
				? message.seq
				: this.nextSyntheticSequence++;
		this.nextSyntheticSequence = Math.max(
			this.nextSyntheticSequence,
			seq + 1
		);
		const sanitized: NetworkGameState = {
			b: [message.b[0], message.b[1]],
			pd: message.pd.map(p =>
				Array.isArray(p) && p.length >= 2
					? ([p[0], p[1]] as [number, number])
					: null
			),
			seq,
		};
		if (Array.isArray(message.sb) && message.sb.length >= 2) {
			sanitized.sb = [message.sb[0], message.sb[1]];
		}
		if (message.pu) {
			sanitized.pu = { ...message.pu };
		}
		this.stateBuffer.push({ timestamp: now, seq, state: sanitized });

		const cutoff = now - this.maxBufferRetentionMs;
		while (
			this.stateBuffer.length > 0 &&
			this.stateBuffer[0].timestamp < cutoff
		) {
			this.stateBuffer.shift();
		}
		const MAX_FRAMES = 180;
		if (this.stateBuffer.length > MAX_FRAMES) {
			this.stateBuffer.splice(0, this.stateBuffer.length - MAX_FRAMES);
		}

		this.logCounter = (this.logCounter + 1) % 30;
		if (this.logCounter === 0) {
			conditionalLog(
				`📡 Buffered game state seq=${seq}, buffer depth=${this.stateBuffer.length}`
			);
		}
	}

	private renderFromBuffer(): void {
		if (!this.gameState.isRunning || this.stateBuffer.length === 0) {
			return;
		}
		const now =
			typeof performance !== 'undefined' ? performance.now() : Date.now();
		const targetTime = now - this.renderDelayMs;
		const frames = this.stateBuffer;
		let previous = frames[0];
		let next = frames[frames.length - 1];

		for (let i = 0; i < frames.length; i++) {
			const frame = frames[i];
			if (frame.timestamp <= targetTime) {
				previous = frame;
			}
			if (frame.timestamp >= targetTime) {
				next = frame;
				break;
			}
		}

		if (targetTime <= frames[0].timestamp) {
			previous = frames[0];
			next = frames[0];
		} else if (targetTime >= frames[frames.length - 1].timestamp) {
			previous = frames[frames.length - 1];
			next = previous;
		}

		const denom = next.timestamp - previous.timestamp;
		const blend =
			denom <= 0
				? 0
				: this.clamp01((targetTime - previous.timestamp) / denom);
		this.applyNetworkState(previous.state, next.state, blend);
	}

	private applyNetworkState(
		previous: NetworkGameState,
		next: NetworkGameState,
		blend: number
	): void {
		const lerp = (a: number, b: number, t: number): number =>
			a + (b - a) * t;

		const ballX = lerp(previous.b[0], next.b[0], blend);
		const ballZ = lerp(previous.b[1], next.b[1], blend);
		if (this.ballMesh) {
			const ballY = this.ballMesh.position.y;
			this.ballMesh.position.set(ballX * -1, ballY, ballZ);
			this.gameState.ball.position.set(ballX * -1, ballY, ballZ);
		}

		const paddles = this.pong3DInstance?.paddles;
		if (Array.isArray(paddles)) {
			const localIndex = Math.max(0, this.thisPlayerId - 1);
			const count = Math.max(previous.pd.length, next.pd.length);
			for (let i = 0; i < count; i++) {
				if (i === localIndex) {
					continue;
				}
				const prevPos = i < previous.pd.length ? previous.pd[i] : null;
				const nextPos = i < next.pd.length ? next.pd[i] : prevPos;
				if (!Array.isArray(prevPos) && !Array.isArray(nextPos)) {
					continue;
				}
				const from = Array.isArray(prevPos)
					? prevPos
					: (nextPos as [number, number]);
				const to = Array.isArray(nextPos) ? nextPos : from;
				if (!from || !to) {
					continue;
				}
				const paddleMesh = paddles[i];
				if (!paddleMesh) {
					continue;
				}
				const paddleY = paddleMesh.position.y;
				const x = lerp(from[0], to[0], blend);
				const z = lerp(from[1], to[1], blend);
				paddleMesh.position.set(x, paddleY, z);
			}
		}

		const sb = this.interpolatePair(previous.sb, next.sb, blend);
		this.updateSplitBall(sb);

		const powerup = this.interpolatePowerup(previous.pu, next.pu, blend);
		this.handlePowerupState(powerup);

		const seq = Math.max(
			typeof previous.seq === 'number' ? previous.seq : -1,
			typeof next.seq === 'number' ? next.seq : -1
		);
		if (seq >= 0) {
			this.lastAppliedSeq = seq;
		}
	}

	private interpolatePair(
		previous: [number, number] | null | undefined,
		next: [number, number] | null | undefined,
		blend: number
	): [number, number] | null {
		if (!previous && !next) {
			return null;
		}
		if (!previous) {
			return next ? [next[0], next[1]] : null;
		}
		if (!next) {
			return [previous[0], previous[1]];
		}
		const lerp = (a: number, b: number, t: number): number =>
			a + (b - a) * t;
		return [
			lerp(previous[0], next[0], blend),
			lerp(previous[1], next[1], blend),
		];
	}

	private interpolatePowerup(
		previous: NetworkPowerupState | null | undefined,
		next: NetworkPowerupState | null | undefined,
		blend: number
	): NetworkPowerupState | null {
		if (!previous && !next) {
			return null;
		}
		if (!previous) {
			return next ? { ...next } : null;
		}
		if (!next) {
			return { ...previous };
		}
		const lerp = (a: number, b: number, t: number): number =>
			a + (b - a) * t;
		return {
			t: blend >= 0.5 ? next.t : previous.t,
			s: blend >= 0.5 ? next.s : previous.s,
			p: blend >= 0.5 ? next.p : previous.p,
			x: lerp(previous.x, next.x, blend),
			z: lerp(previous.z, next.z, blend),
		};
	}

	private clamp01(value: number): number {
		if (value <= 0) {
			return 0;
		}
		if (value >= 1) {
			return 1;
		}
		return value;
	}

	/**
	 * Send input to master (only on input changes)
	 * Input encoding: 0=none, 1=left/up, 2=right/down
	 */
	sendInput(keyInput: number): void {
		if (keyInput === this.currentInputState) {
			return;
		}
		this.currentInputState = keyInput;
		this.broadcastAccumulator = this.broadcastInterval;
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
