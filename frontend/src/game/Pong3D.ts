// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core/Physics/Plugins/cannonJSPlugin';
import * as CANNON from 'cannon-es';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import '@babylonjs/core/Layers/glowLayer';
import * as GUI from '@babylonjs/gui';
import { relative } from 'path';
import {
	DEFAULT_MAX_SCORE,
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_POINT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { ReplayModal } from '../modals/ReplayModal';
import { TextModal } from '../modals/TextModal';
import { GameScreen } from '../screens/GameScreen';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { Trophy } from '../visual/Trophy';
import { BallEntity } from './BallEntity';
import { BallManager } from './BallManager';
import { GameConfig } from './GameConfig';
import {
	conditionalError as loggerConditionalError,
	conditionalLog as loggerConditionalLog,
	conditionalWarn as loggerConditionalWarn,
} from './Logger';
import { Pong3DAudio } from './Pong3DAudio';
import { Pong3DBallEffects } from './Pong3DBallEffects';
import { Pong3DGameLoop } from './Pong3DGameLoop';
import type { NetworkPowerupState } from './Pong3DGameLoopBase';
import { Pong3DGameLoopClient } from './Pong3DGameLoopClient';
import { Pong3DGameLoopMaster } from './Pong3DGameLoopMaster';
import { Pong3DInput } from './Pong3DInput';
import {
	applyCameraPosition,
	type CameraSettings,
	DEFAULT_CAMERA_SETTINGS,
	getCameraPosition,
} from './Pong3DPOV';
import { createPong3DUI } from './Pong3DUI';
import {
	Pong3DPowerups,
	POWERUP_ID_TO_TYPE,
	POWERUP_SESSION_FLAGS,
	type PowerupNetworkSnapshot,
	type PowerupType,
} from './Pong3Dpowerups';
import {
	AI_DIFFICULTY_PRESETS,
	type AIBallSnapshot,
	type AIConfig,
	type GameStateForAI,
	getAIDifficultyFromName,
	Pong3DAI,
} from './pong3DAI';

// ============================================================================

/**
 * Pong3D - A 3D Pong game engine supporting 2-4 players
 *
 * Features:
 * - Supports 2, 3, or 4 players via constructor options
 * - Automatically loads appropriate GLB model (pong2p.glb, pong3p.glb, pong4p.glb)
 * - Automatic paddle detection by name (paddle1, paddle2, paddle3, paddle4)
 * - Uniform handling of all players through arrays
 * - Configurable camera, lighting, and game settings
 * - Integrated GUI with scores and player info
 *
 * Usage:
 * - Specify playerCount in options: new Pong3D(container, { playerCount: 4 })
 * - Appropriate GLB model will be loaded automatically
 * - Override with modelUrlOverride if needed for custom models
 */

export interface Pong3DOptions {
	importedLightScale?: number; // multiply imported light intensities by this as blender lighting comes in way too strong
	playerCount?: 2 | 3 | 4; // Number of players (2, 3, or 4)
	thisPlayer?: 1 | 2 | 3 | 4; // POV player (1 = default position, 2-4 = rotated perspectives)
	modelUrlOverride?: string; // Override automatic model selection
	local?: boolean; // Local 2-player mode vs network play (only applies when playerCount = 2)
	outOfBoundsDistance?: number; // Distance threshold for out-of-bounds detection (±units on X/Z axis)
	gameScreen?: GameScreen; // Reference to GameScreen for modal management
}

// Game state - simplified to arrays for uniform handling
interface GameState {
	paddlePositionsX: number[]; // x positions for paddles 0-3 (players 1-2 and some 3-4)
	paddlePositionsY: number[]; // y positions for paddles 2-3 (players 3-4 in 4-player mode)
	waitingForServe?: boolean; // True when ball is positioned but waiting for server input
	servingPlayer?: number; // Index of player who will serve (-1 if none)
}

//The outer bounding box of all meshes used, helps to place default lights and cameras
interface BoundingInfo {
	min: BABYLON.Vector3;
	max: BABYLON.Vector3;
}

interface SplitBall {
	mesh: BABYLON.Mesh;
	impostor: BABYLON.PhysicsImpostor;
}

interface GlowEffectState {
	key: string;
	color: BABYLON.Color3;
	durationMs: number;
	startTime: number;
	strength: number;
	animationFrame: number | null;
	active: boolean;
	holdDurationMs: number;
	fadeDurationMs: number;
}

interface GlowMeshState {
	mesh: BABYLON.Mesh;
	material: BABYLON.Material & { emissiveColor?: BABYLON.Color3 };
	baseEmissive: BABYLON.Color3;
	addedToGlowLayer: boolean;
	effects: Map<string, GlowEffectState>;
}

export class Pong3D {
	private static readonly SOUND_PADDLE = 0;
	private static readonly SOUND_WALL = 1;
	private static readonly SOUND_POWERUP_BALL = 2;
	private static readonly SOUND_POWERUP_WALL = 3;
	private remoteScoreUpdateHandler?: (event: Event) => void;
	private remoteGameStateHandler?: (event: Event) => void;

	private static babylonWarnFilterInstalled = false;
	// Debug flag - set to false to disable all debug logging for better performance
	// private static readonly DEBUG_ENABLED = false;

	// Debug helper method - now uses GameConfig
	private debugLog(...args: any[]): void {
		loggerConditionalLog(...args);
	}

	// Conditional console methods that respect GameConfig
	private conditionalLog(...args: any[]): void {
		loggerConditionalLog(...args);
	}

	private conditionalWarn(...args: any[]): void {
		loggerConditionalWarn(...args);
	}

	private conditionalError(...args: any[]): void {
		loggerConditionalError(...args);
	}

	private static ensureBabylonWarningsFiltered(): void {
		if (Pong3D.babylonWarnFilterInstalled) return;
		const suppressFragment = 'MeshImpostor only collides against spheres';
		const patchWarn = (target: any, key: string): void => {
			if (!target || typeof target[key] !== 'function') return;
			const original = target[key].bind(target);
			target[key] = (...args: any[]) => {
				const message = args[0];
				if (
					typeof message === 'string' &&
					message.includes(suppressFragment)
				) {
					return;
				}
				original(...args);
			};
		};
		patchWarn(BABYLON.Tools, 'Warn');
		patchWarn(BABYLON.Logger, 'Warn');
		Pong3D.babylonWarnFilterInstalled = true;
	}

	/** Called by game loop when a serve starts to reset per-ball visual/effect state */
	public onServeStart(): void {
		// Restore base material on main ball to avoid lingering orange after promotions
		if (this.ballMesh && this.baseBallMaterial) {
			this.ballMesh.material = this.baseBallMaterial;
		}
		// Reset global hit trackers
		this.lastPlayerToHitBall = -1;
		this.secondLastPlayerToHitBall = -1;
		// Reset per-ball histories and effects
		if (this.mainBallEntity) {
			this.mainBallEntity.resetHitHistory();
			this.mainBallEntity.resetEffects();
		}
		this.ballManager.resetHistories();
		this.ballManager.resetEffectsAll();
		// Reset shared effects (spin/rally) for safety
		this.ballEffects.resetAllEffects();
		this.clearRecentHitters();
	}

	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;

	// Paddle meshes - use arrays for uniform handling
	private paddles: (BABYLON.Mesh | null)[] = [null, null, null, null];
	private boundsXMin: number | null = null;
	private boundsXMax: number | null = null;
	private boundsZMin: number | null = null;
	private boundsZMax: number | null = null;

	// Configurable camera settings - initialized from POV module defaults
	private DEFAULT_CAMERA_RADIUS = DEFAULT_CAMERA_SETTINGS.defaultRadius;
	private DEFAULT_CAMERA_BETA = DEFAULT_CAMERA_SETTINGS.defaultBeta;
	private DEFAULT_CAMERA_TARGET_Y = DEFAULT_CAMERA_SETTINGS.defaultTargetY;
	private useGLBOrigin = DEFAULT_CAMERA_SETTINGS.useGLBOrigin ?? true; // Force camera to use GLB origin instead of calculated mesh center

	/** Get camera settings object for POV module */
	private getCameraSettings(): CameraSettings {
		return {
			defaultRadius: this.DEFAULT_CAMERA_RADIUS,
			defaultBeta: this.DEFAULT_CAMERA_BETA,
			defaultTargetY: this.DEFAULT_CAMERA_TARGET_Y,
			useGLBOrigin: this.useGLBOrigin,
		};
	}

	/** Determine game mode based on GameConfig settings */
	private getGameMode(): 'local' | 'master' | 'client' {
		if (GameConfig.isLocalMode()) {
			return 'local'; // Traditional local multiplayer
		} else if (GameConfig.isRemoteMode()) {
			if (GameConfig.getThisPlayer() === 1) {
				return 'master'; // Player 1 = authoritative server
			} else {
				return 'client'; // Players 2-4 = clients
			}
		}
		return 'local'; // Fallback
	}

	// Lighting configuration (can be overridden via constructor options or setters)
	private importedLightScale = 0.001; //turn down blender lighting: 10 kwatts = 10 babylon units

	private setupHDR(): void {
		// Create skybox with your background image
		const skybox = BABYLON.MeshBuilder.CreateSphere(
			'skybox',
			{ diameter: 1000 },
			this.scene
		);
		skybox.isPickable = false;
		const skyboxMaterial = new BABYLON.PBRMaterial('skybox', this.scene);
		skyboxMaterial.backFaceCulling = false;
		skyboxMaterial.unlit = true;
		skyboxMaterial.metallic = 0;
		skyboxMaterial.roughness = 1;
		const skyboxTexture = new BABYLON.Texture(
			'/psychedelic.hdr',
			this.scene
		);
		skyboxTexture.level = 0.4;
		skyboxMaterial.albedoTexture = skyboxTexture;
		skybox.material = skyboxMaterial;

		skybox.infiniteDistance = true;

		//short code for hdr
		// const envTexture = new BABYLON.HDRCubeTexture('/wasteland.hdr', this.scene, 512, false, true, false, true);
		// this.scene.environmentTexture = envTexture;
		// this.scene.createDefaultSkybox(envTexture, true);
	}

	// GUI
	private guiTexture: GUI.AdvancedDynamicTexture | null = null;

	// Backwards compatibility UI handles
	private score1Text: GUI.TextBlock | null = null;
	private score2Text: GUI.TextBlock | null = null;
	private Player1Info: GUI.TextBlock | null = null;
	private Player2Info: GUI.TextBlock | null = null;

	// Extended multi-player UI handles (when UI module is used)
	private uiPlayerNameTexts: GUI.TextBlock[] | null = null;
	private uiPlayerScoreTexts: GUI.TextBlock[] | null = null;
	private uiPlayerStacks: GUI.StackPanel[] | null = null;
	private uiMovePlayerTo:
		| ((i: number, pos: 'top' | 'bottom' | 'left' | 'right') => void)
		| null = null;
	private uiHandles: any = null; // Store full UI handles for winner display

	// Player data - simplified to arrays for uniform handling
	private playerNames: string[] = [
		GameConfig.getPlayerName(1),
		GameConfig.getPlayerName(2),
		GameConfig.getPlayerName(3),
		GameConfig.getPlayerName(4),
	];
	private playerScores: number[] = [0, 0, 0, 0];
	private playerCount: number = GameConfig.getPlayerCount();
	private thisPlayer: 1 | 2 | 3 | 4 = GameConfig.getThisPlayer() as
		| 1
		| 2
		| 3
		| 4;
	private local: boolean = false; // Local 2-player mode vs network play (only applies when playerCount = 2)
	private gameEnded: boolean = false; // Flag to track if game has ended (winner declared)
	private container: HTMLElement;
	private trophyInstance: Trophy | null = null;
	private trophyContainer: HTMLDivElement | null = null;
	private glowLayer: BABYLON.GlowLayer | null = null;
	private readonly glowPaddleStates = new Map<number, GlowMeshState>();
	private glowEffectKeyCounter = 0;
	private activeStretchTimeout: number | null = null;
	private splitBalls: SplitBall[] = [];
	private shadowGenerators: BABYLON.ShadowGenerator[] = [];
	private ballManager: BallManager = new BallManager({
		spinDelayMs: GameConfig.getSpinDelayMs(),
	});
	private mainBallEntity: BallEntity | null = null;
	private paddleOriginalScaleX: Map<number, number> = new Map();
	private paddleStretchTimeouts: Map<number, number> = new Map();
	private paddleShrinkTimeouts: Map<number, number> = new Map();
	private mainBallHandlersAttached = false;
	private baseBallY = 0;
	private readonly REMOTE_POWERUP_SPIN_SPEED = 0.5;
	private readonly REMOTE_POWERUP_SPAWN_DURATION = 0.25;
	private readonly REMOTE_POWERUP_COLLECT_DURATION = 0.25;
	private remotePowerupBaseScale: BABYLON.Vector3 = BABYLON.Vector3.One();
	private remotePowerupChildBaseScales: WeakMap<
		BABYLON.AbstractMesh,
		BABYLON.Vector3
	> = new WeakMap();
	// Debounce repeated paddle collision handling (prevents multiple rally increments per contact)
	private lastCollisionTimeMs: number = 0;
	private lastCollisionPaddleIndex: number = -1;
	// Global rally increment throttle (prevents rapid alternating-hit speed spikes)
	private lastRallyIncrementTimeGlobalMs: number = 0;
	private lastRallyIncrementPosXZ: BABYLON.Vector3 | null = null;
	private baseBallMaterial: BABYLON.Material | null = null;
	private powerupManager: Pong3DPowerups | null = null;
	private enabledPowerupTypes: PowerupType[] = [];
	private lastPowerupUpdateTimeMs = 0;
	private remotePowerupNode: BABYLON.TransformNode | null = null;
	private remotePowerupType: PowerupType | null = null;
	private lastRemotePowerupState: NetworkPowerupState | null = null;
	private pendingRemotePowerupState: NetworkPowerupState | null = null;
	private ballPositionHistory = new Map<number, BABYLON.Vector3>();

	private remotePowerupAnimation: {
		type: 'spawn' | 'collect';
		elapsed: number;
		duration: number;
		startPos: BABYLON.Vector3;
		targetPos: BABYLON.Vector3;
	} | null = null;
	private cleanupStaleRemotePowerups(
		except?: BABYLON.TransformNode | null
	): void {
		if (!this.scene) {
			return;
		}
		const keep = except ?? null;
		for (const node of this.scene.transformNodes) {
			if (!node || node === keep || !node.name) {
				continue;
			}
			if (node.isDisposed()) {
				continue;
			}
			if (node.name.includes('.remote.')) {
				try {
					node.dispose(false, false);
				} catch (_) {}
			}
		}
		for (const mesh of this.scene.meshes) {
			if (!mesh || mesh.isDisposed() || !mesh.name) {
				continue;
			}
			if (keep && mesh.parent === keep) {
				continue;
			}
			if (mesh.name.includes('.remote.')) {
				try {
					mesh.dispose(false, false);
				} catch (_) {}
			}
		}
	}

	private refreshPowerupConfiguration(): void {
		if (!this.powerupManager) return;
		if (this.gameMode === 'client') {
			const allTypes: PowerupType[] = [
				'split',
				'boost',
				'stretch',
				'shrink',
			];
			this.enabledPowerupTypes = allTypes;
			this.powerupManager.setEnabledTypes(allTypes);
			this.powerupManager.setSpawningPaused(true);
			this.powerupManager.clearActivePowerups();
			this.powerupManager.loadAssets().catch(error => {
				this.conditionalWarn(
					'Power-up assets failed to load (client)',
					error
				);
			});
			return;
		}

		const enabled: PowerupType[] = [];
		try {
			Object.entries(POWERUP_SESSION_FLAGS).forEach(
				([typeKey, sessionKey]) => {
					const value = sessionStorage.getItem(sessionKey);
					if (value === '1') {
						enabled.push(typeKey as PowerupType);
					}
				}
			);
		} catch (error) {
			this.conditionalWarn(
				'Session storage unavailable when reading power-up flags',
				error
			);
		}

		this.enabledPowerupTypes = enabled;
		this.powerupManager.setEnabledTypes(enabled);
		if (enabled.length > 0) {
			this.powerupManager.loadAssets().catch(error => {
				this.conditionalWarn('Power-up assets failed to load', error);
			});
		} else {
			this.powerupManager.clearActivePowerups();
		}
	}

	private updatePowerups(): void {
		if (!this.powerupManager) {
			return;
		}

		const now =
			typeof performance !== 'undefined' ? performance.now() : Date.now();
		if (this.lastPowerupUpdateTimeMs === 0) {
			this.lastPowerupUpdateTimeMs = now;
			return;
		}

		let deltaSeconds = (now - this.lastPowerupUpdateTimeMs) / 1000;
		this.lastPowerupUpdateTimeMs = now;
		if (!isFinite(deltaSeconds) || deltaSeconds <= 0) {
			return;
		}
		deltaSeconds = Math.min(deltaSeconds, 0.25); // Clamp to avoid huge teleporting steps

		if (this.gameMode === 'client') {
			this.updateRemotePowerupVisual(deltaSeconds);
			return;
		}

		if (this.enabledPowerupTypes.length === 0) {
			return;
		}

		// Pause spawning during game end, while a split ball is active, or when a goal has been scored
		// and we are waiting for the ball to reach boundary (dead-ball state).
		const pauseSpawning =
			this.gameEnded || this.splitBalls.length > 0 || this.goalScored;
		this.powerupManager.setSpawningPaused(pauseSpawning);

		this.powerupManager.update(
			deltaSeconds,
			this.paddles,
			(type, paddleIndex, entity) =>
				this.handlePowerupPickup(type, paddleIndex, entity as any),
			type => this.handlePowerupOutOfBounds(type)
		);
	}

	private updateRemotePowerupVisual(deltaSeconds: number): void {
		if (this.pendingRemotePowerupState) {
			const pending = this.pendingRemotePowerupState;
			this.pendingRemotePowerupState = null;
			this.handleRemotePowerupState(pending);
		}
		if (!this.remotePowerupNode || this.remotePowerupNode.isDisposed()) {
			return;
		}
		if (this.remotePowerupAnimation) {
			const anim = this.remotePowerupAnimation;
			anim.elapsed = Math.min(anim.elapsed + deltaSeconds, anim.duration);
			const t = anim.duration > 0 ? anim.elapsed / anim.duration : 1;
			if (anim.type === 'spawn') {
				const scale = Math.min(1, t);
				this.setRemotePowerupScale(scale);
			} else if (anim.type === 'collect') {
				const smooth = t * t * (3 - 2 * t);
				const newPos = BABYLON.Vector3.Lerp(
					anim.startPos,
					anim.targetPos,
					smooth
				);
				newPos.y = this.baseBallY;
				this.remotePowerupNode.position.copyFrom(newPos);
				const scale = Math.max(0, 1 - smooth);
				this.setRemotePowerupScale(scale);
			}
			if (anim.elapsed >= anim.duration) {
				if (anim.type === 'collect') {
					this.disposeRemotePowerupVisual();
				} else {
					this.setRemotePowerupScale(1);
				}
				this.remotePowerupAnimation = null;
				return;
			}
		}
		const spin = this.REMOTE_POWERUP_SPIN_SPEED * deltaSeconds;
		const increment = BABYLON.Quaternion.RotationAxis(
			BABYLON.Vector3.Up(),
			spin
		);
		const current =
			this.remotePowerupNode.rotationQuaternion ??
			BABYLON.Quaternion.Identity();
		this.remotePowerupNode.rotationQuaternion = current.multiply(increment);
	}

	private handlePowerupPickup(
		type: PowerupType,
		paddleIndex: number,
		entity?: any
	): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`⚡ Power-up collected: ${type} by paddle ${paddleIndex + 1}`
			);
		}
		const pickupSound = type === 'shrink' ? 'shrink' : 'powerup';
		void this.audioSystem.playSoundEffect(pickupSound);
		// If a goal has been scored and the ball is continuing to boundary, consider the ball out of play.
		// In this state, disallow split activation to prevent post-goal splitting.
		if (this.goalScored && type === 'split') {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					'⛔ Split ignored: ball is out of play (goal scored, waiting for boundary)'
				);
			}
			return;
		}
		// TODO: Apply concrete power-up effects (ball split, speed boost, paddle sizing)
		// Apply collect glow to paddle and disc (yellow for split)
		try {
			const paddle = this.paddles[paddleIndex] as BABYLON.Mesh | null;
			const yellow = new BABYLON.Color3(1, 0.95, 0.2);
			if (type === 'split') {
				if (paddle) this.flashMeshGlow(paddle, 500, yellow);
				if (entity && entity.collisionMesh) {
					this.flashMeshGlow(
						entity.collisionMesh as BABYLON.Mesh,
						500,
						yellow
					);
				}
			}
		} catch (_) {}

		switch (type) {
			case 'split':
				if (this.gameMode !== 'client') {
					this.activateSplitBallPowerup();
				}
				break;
			case 'stretch':
				this.applyStretchPowerup(paddleIndex, entity);
				break;
			case 'shrink':
				this.applyShrinkPowerup(paddleIndex, entity);
				break;
			default:
				break;
		}
	}

	/** Stretch power-up: glow green, scale paddle X 1.5x for 20s, update impostor, then restore */
	private animatePaddleScale(
		mesh: BABYLON.Mesh,
		startScale: number,
		endScale: number,
		durationMs: number,
		onComplete?: () => void
	): void {
		const duration = Math.max(0, durationMs);
		if (duration === 0 || Math.abs(endScale - startScale) < 1e-6) {
			mesh.scaling.x = endScale;
			if (onComplete) onComplete();
			return;
		}
		mesh.scaling.x = startScale;
		this.scene.stopAnimation(mesh, 'paddleStretchScale');
		const frameRate = 60;
		const totalFrames = (duration / 1000) * frameRate;
		const easing = new BABYLON.CubicEase();
		easing.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
		const animatable = BABYLON.Animation.CreateAndStartAnimation(
			'paddleStretchScale',
			mesh,
			'scaling.x',
			frameRate,
			totalFrames,
			startScale,
			endScale,
			BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
			easing,
			() => {
				mesh.scaling.x = endScale;
				if (onComplete) onComplete();
			}
		);
		if (!animatable && onComplete) {
			onComplete();
		}
	}
	private applyStretchPowerup(paddleIndex: number, entity?: any): void {
		const paddle = this.paddles[paddleIndex] as BABYLON.Mesh | null;
		if (!paddle) return;
		const green = new BABYLON.Color3(0.2, 1, 0.2);
		const stretchHoldDurationMs = 20000;
		const stretchGrowDurationMs = 1500;
		const stretchShrinkDurationMs = 1500;
		const totalGlowDurationMs =
			stretchHoldDurationMs + stretchShrinkDurationMs;
		if (this.activeStretchTimeout !== null) {
			window.clearTimeout(this.activeStretchTimeout);
			this.activeStretchTimeout = null;
		}
		this.disposeRemotePowerupVisual();
		if (this.powerupManager) {
			this.powerupManager.setTypeBlocked('stretch', true);
		}
		try {
			this.flashMeshGlow(paddle, totalGlowDurationMs, green, {
				key: `stretch-${paddle.uniqueId}`,
				holdDurationMs: stretchHoldDurationMs,
				fadeDurationMs: stretchShrinkDurationMs,
			});
		} catch (_) {}

		// Store original scale if not stored
		if (!this.paddleOriginalScaleX.has(paddleIndex)) {
			this.paddleOriginalScaleX.set(paddleIndex, paddle.scaling.x);
		}
		const original = this.paddleOriginalScaleX.get(paddleIndex)!;
		const target = original * 1.5; // 3 -> 4.5

		this.animatePaddleScale(
			paddle,
			original,
			target,
			stretchGrowDurationMs,
			() => {
				this.recreatePaddleImpostor(paddleIndex);
			}
		);

		// Clear any existing timeout
		const existing = this.paddleStretchTimeouts.get(paddleIndex);
		if (existing) window.clearTimeout(existing);

		const timeoutId = window.setTimeout(() => {
			const p = this.paddles[paddleIndex];
			if (!p) return;
			this.animatePaddleScale(
				p,
				p.scaling.x,
				original,
				stretchShrinkDurationMs,
				() => {
					this.recreatePaddleImpostor(paddleIndex);
					this.paddleStretchTimeouts.delete(paddleIndex);
					if (this.powerupManager) {
						this.powerupManager.setTypeBlocked('stretch', false);
					}
					this.activeStretchTimeout = null;
				}
			);
		}, stretchHoldDurationMs); // 20 seconds
		this.paddleStretchTimeouts.set(paddleIndex, timeoutId);
		this.activeStretchTimeout = timeoutId;
	}

	private applyShrinkPowerup(paddleIndex: number, entity?: any): void {
		const shrinkHoldDurationMs = 20000;
		const shrinkDownDurationMs = 1500;
		const shrinkRestoreDurationMs = 1500;
		const totalGlowDurationMs =
			shrinkHoldDurationMs + shrinkRestoreDurationMs;
		const red = new BABYLON.Color3(1, 0, 0);

		const opponents: { mesh: BABYLON.Mesh; index: number }[] = [];
		for (let i = 0; i < this.paddles.length; i++) {
			if (i === paddleIndex) continue;
			const mesh = this.paddles[i];
			if (!mesh) continue;
			opponents.push({ mesh, index: i });
		}

		if (this.powerupManager) {
			this.powerupManager.setTypeBlocked('shrink', true);
		}

		if (opponents.length === 0) {
			if (this.powerupManager) {
				this.powerupManager.setTypeBlocked('shrink', false);
			}
			return;
		}

		opponents.forEach(({ mesh, index }) => {
			try {
				this.flashMeshGlow(mesh, totalGlowDurationMs, red, {
					key: `shrink-${mesh.uniqueId}`,
					holdDurationMs: shrinkHoldDurationMs,
					fadeDurationMs: shrinkRestoreDurationMs,
				});
			} catch (_) {}

			if (!this.paddleOriginalScaleX.has(index)) {
				this.paddleOriginalScaleX.set(index, mesh.scaling.x);
			}
			const original = this.paddleOriginalScaleX.get(index)!;
			const target = original * 0.5;

			const existing = this.paddleShrinkTimeouts.get(index);
			if (existing) {
				window.clearTimeout(existing);
			}

			this.animatePaddleScale(
				mesh,
				mesh.scaling.x,
				target,
				shrinkDownDurationMs,
				() => {
					this.recreatePaddleImpostor(index);
				}
			);

			const timeoutId = window.setTimeout(() => {
				const paddle = this.paddles[index];
				if (!paddle) {
					this.paddleShrinkTimeouts.delete(index);
					this.onShrinkEffectComplete();
					return;
				}
				this.animatePaddleScale(
					paddle,
					paddle.scaling.x,
					original,
					shrinkRestoreDurationMs,
					() => {
						this.recreatePaddleImpostor(index);
						this.paddleShrinkTimeouts.delete(index);
						this.onShrinkEffectComplete();
					}
				);
			}, shrinkHoldDurationMs);

			this.paddleShrinkTimeouts.set(index, timeoutId);
		});
	}

	private onShrinkEffectComplete(): void {
		if (this.paddleShrinkTimeouts.size === 0 && this.powerupManager) {
			this.powerupManager.setTypeBlocked('shrink', false);
		}
	}

	/** Recreate a paddle's BoxImpostor with the current mesh scaling and reapply constraints */
	private recreatePaddleImpostor(paddleIndex: number): void {
		const paddle = this.paddles[paddleIndex];
		if (!paddle) return;
		try {
			paddle.physicsImpostor?.dispose();
		} catch (_) {}
		// Ensure bounding info reflects latest scaling before creating the impostor
		try {
			paddle.computeWorldMatrix(true);
			paddle.refreshBoundingInfo();
		} catch (_) {}
		paddle.physicsImpostor = new BABYLON.PhysicsImpostor(
			paddle,
			BABYLON.PhysicsImpostor.BoxImpostor,
			{
				mass: this.PADDLE_MASS,
				restitution: 1.0,
				friction: 0,
			},
			this.scene
		);
		const body: any = paddle.physicsImpostor.physicsBody;
		if (body) {
			body.linearDamping = 0;
			body.angularDamping = 1.0;
			body.fixedRotation = true;
			if (body.linearFactor) {
				if (this.playerCount === 3) {
					body.linearFactor.set(1, 0, 1);
				} else if (this.playerCount === 4 && paddleIndex >= 2) {
					body.linearFactor.set(0, 0, 1);
				} else {
					body.linearFactor.set(1, 0, 0);
				}
			}
			if (body.angularFactor) {
				body.angularFactor.set(0, 0, 0);
			}
		}

		this.bindPaddleToExistingBalls(paddleIndex);
	}

	/** Ensure a (re)created paddle impostor notifies all active balls on collision */
	private bindPaddleToExistingBalls(paddleIndex: number): void {
		if (this.gameMode !== 'local' && this.gameMode !== 'master') {
			return;
		}
		const paddle = this.paddles[paddleIndex];
		if (!paddle || !paddle.physicsImpostor) {
			return;
		}
		const paddleImpostor = paddle.physicsImpostor;

		const register = (ballImpostor?: BABYLON.PhysicsImpostor | null) => {
			if (!ballImpostor) return;
			const callback = (
				main: BABYLON.PhysicsImpostor,
				collided: BABYLON.PhysicsImpostor
			) => {
				const isBallMain = main === ballImpostor;
				const ball = isBallMain ? main : collided;
				const paddleBody = isBallMain ? collided : main;
				this.handleBallPaddleCollision(ball, paddleBody);
			};
			ballImpostor.registerOnPhysicsCollide(paddleImpostor, callback);
		};

		register(this.ballMesh?.physicsImpostor ?? null);
		for (const splitBall of this.splitBalls) {
			register(splitBall.impostor);
		}
	}

	private handlePowerupOutOfBounds(type: PowerupType): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(`💨 Power-up ${type} expired before pickup`);
		}
	}

	private activateSplitBallPowerup(): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;
		if (this.gameMode === 'client') return;
		// Prevent split if the ball is out of play (after a goal, before boundary reset)
		if (this.goalScored) return;
		if (this.splitBalls.length >= 1) {
			return;
		}

		const clone = this.ballMesh.clone(
			`splitBall.${performance.now()}`
		) as BABYLON.Mesh | null;
		if (!clone) return;

		clone.position = this.ballMesh.position.clone();
		clone.position.y = this.baseBallY;
		clone.rotationQuaternion =
			this.ballMesh.rotationQuaternion?.clone() ??
			BABYLON.Quaternion.Identity();
		clone.rotation = BABYLON.Vector3.Zero();
		clone.scaling = this.ballMesh.scaling.clone();
		// Assign a distinct orange material to the split ball for visual clarity
		try {
			// second ball colour
			const ballColour = new BABYLON.Color3(0, 1, 1);
			if (
				this.ballMesh.material &&
				'albedoColor' in (this.ballMesh.material as any)
			) {
				// PBR-based material clone
				const pbr = (this.ballMesh.material as any).clone(
					`splitBall.material.${performance.now()}`
				);
				(pbr as any).albedoColor = ballColour; // no emissive to avoid glow layer pickup
				clone.material = pbr as any;
			} else {
				const mat = new BABYLON.StandardMaterial(
					`splitBall.standardMat.${performance.now()}`,
					this.scene
				);
				mat.diffuseColor = ballColour;
				mat.specularColor = new BABYLON.Color3(0.2, 0.2, 0.2);
				clone.material = mat;
			}
		} catch (_) {
			clone.material = this.ballMesh.material;
		}
		clone.isVisible = true;

		const rallyInfo = this.ballEffects.getRallyInfo();
		const targetSpeed = rallyInfo.baseSpeed;

		const mainImpostor = this.ballMesh.physicsImpostor;
		const currentVelocity =
			mainImpostor.getLinearVelocity()?.clone() ?? null;
		let mainDirection = new BABYLON.Vector3(1, 0, 0);
		let mainSpeed = targetSpeed;
		if (currentVelocity && currentVelocity.lengthSquared() >= 1e-4) {
			currentVelocity.y = 0;
			const magnitude = currentVelocity.length();
			if (magnitude >= 1e-6) {
				mainDirection = currentVelocity.normalize();
			}
			mainSpeed = Math.max(magnitude, targetSpeed);
		}
		const mainVelocity = mainDirection.scale(mainSpeed);
		mainImpostor.setLinearVelocity(mainVelocity);

		// Position the clone one diameter behind the main ball along travel direction to avoid overlap
		const separation = mainDirection
			.clone()
			.normalize()
			.scale(Pong3D.BALL_RADIUS * 2 + 0.01);
		if (isFinite(separation.x)) {
			clone.position = clone.position.subtract(separation);
		}

		const splitVelocity = mainDirection.scale(-targetSpeed);

		const impostor = new BABYLON.PhysicsImpostor(
			clone,
			BABYLON.PhysicsImpostor.SphereImpostor,
			{ mass: 1, restitution: 1.0, friction: 0 },
			this.scene
		);
		if (impostor.physicsBody?.shapes?.[0]) {
			impostor.physicsBody.shapes[0].radius = Pong3D.BALL_RADIUS;
		}
		impostor.setLinearVelocity(splitVelocity);
		impostor.setAngularVelocity(BABYLON.Vector3.Zero());
		// Ensure split balls behave exactly like the main ball in plane and damping
		const sbBody: any = impostor.physicsBody;
		if (sbBody) {
			if (sbBody.linearFactor) {
				sbBody.linearFactor.set(1, 0, 1); // XZ only
			}
			sbBody.linearDamping = 0;
			sbBody.angularDamping = 0;
		}
		const impostorBody = impostor.physicsBody;
		if (impostorBody) {
			impostorBody.position.set(
				clone.position.x,
				this.baseBallY,
				clone.position.z
			);
		}

		const splitBall: SplitBall = {
			mesh: clone,
			impostor,
		};
		this.splitBalls.push(splitBall);
		// Register with ball manager for per-ball effects and normalization
		const splitEntity = this.ballManager.addSplitBall(
			clone,
			impostor,
			this.baseBallY
		);
		// Inherit hitter history from current primary ball (or global fallback)
		let inheritLast = this.lastPlayerToHitBall;
		let inheritSecond = this.secondLastPlayerToHitBall;
		if (this.mainBallEntity) {
			inheritLast = this.mainBallEntity.getLastHitter();
			inheritSecond = this.mainBallEntity.getSecondLastHitter();
		}
		splitEntity.setHitHistory(inheritLast, inheritSecond);
		this.attachSplitBallCollisionHandlers(splitBall);
		this.powerupManager?.refreshCollisionHandlers();
		this.ballEffects.resetRallySpeed();
	}

	private attachSplitBallCollisionHandlers(splitBall: SplitBall): void {
		const impostor = splitBall.impostor;
		const paddleImpostors = this.paddles
			.filter(p => p && p.physicsImpostor)
			.map(p => p!.physicsImpostor!);
		if (paddleImpostors.length > 0) {
			impostor.registerOnPhysicsCollide(
				paddleImpostors,
				(main, collided) => {
					this.handleBallPaddleCollision(main, collided);
				}
			);
		}

		const wallImpostors = this.scene.meshes
			.filter(
				mesh =>
					mesh &&
					mesh.name &&
					/wall/i.test(mesh.name) &&
					mesh.physicsImpostor
			)
			.map(mesh => mesh.physicsImpostor!);
		if (wallImpostors.length > 0) {
			impostor.registerOnPhysicsCollide(
				wallImpostors,
				(main, collided) => {
					this.handleBallWallCollision(main, collided);
				}
			);
		}

		const goalImpostors = this.goalMeshes
			.filter(goal => goal && goal.physicsImpostor)
			.map(goal => goal!.physicsImpostor!);
		if (goalImpostors.length > 0) {
			impostor.registerOnPhysicsCollide(
				goalImpostors,
				(main, collided) => {
					const goalIndex = this.goalMeshes.findIndex(
						goal => goal && goal.physicsImpostor === collided
					);
					if (goalIndex !== -1) {
						this.handleGoalCollision(goalIndex, main);
					}
				}
			);
		}
	}

	private attachMainBallCollisionHandlers(force: boolean = false): void {
		if (!this.ballMesh?.physicsImpostor) return;
		if (this.gameMode !== 'local' && this.gameMode !== 'master') return;
		if (this.mainBallHandlersAttached && !force) return;

		const impostor = this.ballMesh.physicsImpostor;
		const paddleImpostors = this.paddles
			.filter(p => p && p.physicsImpostor)
			.map(p => p!.physicsImpostor!);
		if (paddleImpostors.length > 0) {
			impostor.registerOnPhysicsCollide(
				paddleImpostors,
				(main, collided) => {
					this.handleBallPaddleCollision(main, collided);
				}
			);
		}

		const wallImpostors = this.scene.meshes
			.filter(
				mesh =>
					mesh &&
					mesh.name &&
					/wall/i.test(mesh.name) &&
					mesh.physicsImpostor
			)
			.map(mesh => mesh.physicsImpostor!);
		if (wallImpostors.length > 0) {
			impostor.registerOnPhysicsCollide(
				wallImpostors,
				(main, collided) => {
					this.handleBallWallCollision(main, collided);
				}
			);
		}

		const goalImpostors = this.goalMeshes
			.filter(goal => goal && goal.physicsImpostor)
			.map(goal => goal!.physicsImpostor!);
		if (goalImpostors.length > 0) {
			impostor.registerOnPhysicsCollide(
				goalImpostors,
				(main, collided) => {
					const goalIndex = this.goalMeshes.findIndex(
						goal => goal && goal.physicsImpostor === collided
					);
					if (goalIndex !== -1) {
						this.handleGoalCollision(goalIndex, main);
					}
				}
			);
		}

		this.mainBallHandlersAttached = true;
	}

	private promoteSplitBall(splitBall: SplitBall): void {
		const index = this.splitBalls.indexOf(splitBall);
		if (index !== -1) {
			this.splitBalls.splice(index, 1);
		}

		this.ballMesh = splitBall.mesh;
		this.ballMesh.position.y = this.baseBallY;
		this.ballEffects.setBallMesh(this.ballMesh);
		if (this.gameLoop) {
			this.gameLoop.setBallMesh(this.ballMesh);
		}
		this.mainBallHandlersAttached = false;
		this.attachMainBallCollisionHandlers(true);

		// This split ball becomes the main ball entity - reuse existing entity to preserve history/effects
		const existingEntity = this.ballManager.findByImpostor(
			splitBall.impostor
		);
		this.ballManager.removeByImpostor(splitBall.impostor);
		if (existingEntity) {
			existingEntity.setSpinDelay(GameConfig.getSpinDelayMs());
			this.mainBallEntity = existingEntity;
		} else {
			this.mainBallEntity = new BallEntity(
				splitBall.mesh,
				splitBall.impostor,
				this.baseBallY,
				{ spinDelayMs: GameConfig.getSpinDelayMs() }
			);
		}
	}

	private removeSplitBallByImpostor(
		impostor: BABYLON.PhysicsImpostor | null | undefined
	): void {
		if (!impostor) return;
		const index = this.splitBalls.findIndex(
			ball => ball.impostor === impostor
		);
		if (index === -1) return;
		const ball = this.splitBalls[index];
		this.ballManager.removeByImpostor(impostor);
		if (ball.impostor) {
			ball.impostor.dispose();
		}
		if (!ball.mesh.isDisposed()) {
			ball.mesh.material = null;
			ball.mesh.dispose();
		}
		this.splitBalls.splice(index, 1);
		if (this.splitBalls.length === 0) {
			this.ballEffects.resetRallySpeed();
		}
	}

	private clearSplitBalls(): void {
		while (this.splitBalls.length > 0) {
			const ball = this.splitBalls.pop()!;
			this.ballManager.removeByImpostor(ball.impostor);
			if (ball.impostor) {
				ball.impostor.dispose();
			}
			if (!ball.mesh.isDisposed()) {
				ball.mesh.material = null;
				ball.mesh.dispose();
			}
		}
		this.splitBalls.length = 0;
		this.ballManager.clear();
	}

	private isSplitBallImpostor(
		impostor: BABYLON.PhysicsImpostor | null | undefined
	): boolean {
		if (!impostor) return false;
		return this.splitBalls.some(ball => ball.impostor === impostor);
	}

	public getSplitBallNetworkPosition(): { x: number; z: number } | null {
		if (this.splitBalls.length === 0) {
			return null;
		}
		const ball = this.splitBalls[0];
		if (!ball || !ball.mesh || ball.mesh.isDisposed()) {
			return null;
		}
		return {
			x: ball.mesh.position.x,
			z: ball.mesh.position.z,
		};
	}

	public getPowerupNetworkSnapshot(): PowerupNetworkSnapshot | null {
		if (!this.powerupManager) {
			return null;
		}
		const active = this.powerupManager.getActiveNetworkSnapshot();
		if (active) {
			return active;
		}
		return this.powerupManager.consumePendingNetworkEvent();
	}

	public handleRemotePowerupState(state: NetworkPowerupState | null): void {
		if (this.gameMode !== 'client') {
			return;
		}
		if (!this.powerupManager) {
			this.pendingRemotePowerupState = state;
			return;
		}
		void this.powerupManager.loadAssets().catch(error => {
			this.conditionalWarn(
				'Power-up assets failed to load during remote state handling',
				error
			);
		});

		const previous = this.lastRemotePowerupState
			? { ...this.lastRemotePowerupState }
			: null;
		this.lastRemotePowerupState = state ? { ...state } : null;

		if (!state) {
			if (
				this.remotePowerupAnimation &&
				this.remotePowerupAnimation.type === 'collect'
			) {
				this.pendingRemotePowerupState = null;
				return;
			}
			this.disposeRemotePowerupVisual();
			this.pendingRemotePowerupState = null;
			return;
		}

		const type = POWERUP_ID_TO_TYPE[state.t];
		if (!type) {
			this.conditionalWarn(`Unknown remote power-up type id ${state.t}`);
			return;
		}

		const visual = this.ensureRemotePowerupVisual(type);
		if (!visual) {
			this.pendingRemotePowerupState = state;
			return;
		}
		this.pendingRemotePowerupState = null;

		const worldX = -state.x;
		const worldZ = state.z;
		visual.position.x = worldX;
		visual.position.z = worldZ;

		const previousStateValue = previous?.s ?? -1;
		const glowMesh = this.getRemotePowerupGlowMesh();
		const glowEntity = glowMesh
			? ({ collisionMesh: glowMesh } as any)
			: undefined;

		if (state.s === 0) {
			visual.setEnabled(true);
			if (!previous || previousStateValue !== 0) {
				this.setRemotePowerupScale(0);
				this.remotePowerupAnimation = {
					type: 'spawn',
					elapsed: 0,
					duration: this.REMOTE_POWERUP_SPAWN_DURATION,
					startPos: visual.position.clone(),
					targetPos: visual.position.clone(),
				};
			}
			return;
		}

		const isActivePickup = state.s === 1;
		const isInactivePickup = state.s === 2;

		if (
			isActivePickup &&
			typeof state.p === 'number' &&
			state.p >= 0 &&
			previousStateValue !== 1
		) {
			this.handlePowerupPickup(type, state.p, glowEntity);
		} else if (
			isInactivePickup &&
			typeof state.p === 'number' &&
			state.p >= 0 &&
			previousStateValue !== 1 &&
			previousStateValue !== 2
		) {
			this.handlePowerupPickup(type, state.p, glowEntity);
		}

		if (
			previousStateValue === 0 &&
			this.remotePowerupNode &&
			!this.remotePowerupNode.isDisposed()
		) {
			const startPos = this.remotePowerupNode.position.clone();
			let targetPos = startPos.clone();
			if (
				isActivePickup &&
				typeof state.p === 'number' &&
				state.p >= 0 &&
				state.p < this.paddles.length
			) {
				const paddle = this.paddles[state.p];
				if (paddle) {
					const absolute = paddle.getAbsolutePosition();
					targetPos = new BABYLON.Vector3(
						absolute.x,
						this.baseBallY,
						absolute.z
					);
				}
			}
			this.remotePowerupAnimation = {
				type: 'collect',
				elapsed: 0,
				duration: this.REMOTE_POWERUP_COLLECT_DURATION,
				startPos,
				targetPos,
			};
			return;
		}

		if (
			this.remotePowerupAnimation &&
			this.remotePowerupAnimation.type === 'collect'
		) {
			return;
		}

		this.disposeRemotePowerupVisual();
	}

	private ensureRemotePowerupVisual(
		type: PowerupType
	): BABYLON.TransformNode | null {
		if (!this.powerupManager) {
			return null;
		}
		if (
			this.remotePowerupNode &&
			!this.remotePowerupNode.isDisposed() &&
			this.remotePowerupType === type
		) {
			return this.remotePowerupNode;
		}
		this.disposeRemotePowerupVisual();
		const clone = this.powerupManager.clonePrototypeForNetwork(type);
		if (!clone) {
			return null;
		}
		clone.position.y = this.baseBallY;
		clone.rotationQuaternion = BABYLON.Quaternion.Identity();
		clone.rotation = BABYLON.Vector3.Zero();
		clone.scaling.setAll(1);
		this.remotePowerupBaseScale = clone.scaling.clone();
		this.remotePowerupChildBaseScales = new WeakMap();
		const meshes = clone.getChildMeshes(false);
		meshes.forEach(mesh => {
			mesh.isPickable = false;
			this.remotePowerupChildBaseScales.set(mesh, mesh.scaling.clone());
		});
		this.remotePowerupNode = clone;
		this.remotePowerupType = type;
		this.cleanupStaleRemotePowerups(clone);
		return clone;
	}

	private disposeRemotePowerupVisual(): void {
		if (this.remotePowerupNode && !this.remotePowerupNode.isDisposed()) {
			try {
				this.remotePowerupNode.dispose(false, false);
			} catch (_) {}
		}
		this.remotePowerupNode = null;
		this.remotePowerupType = null;
		this.remotePowerupAnimation = null;
		this.remotePowerupBaseScale = BABYLON.Vector3.One();
		this.remotePowerupChildBaseScales = new WeakMap();
		this.cleanupStaleRemotePowerups(null);
	}

	private getRemotePowerupGlowMesh(): BABYLON.Mesh | null {
		if (!this.remotePowerupNode || this.remotePowerupNode.isDisposed()) {
			return null;
		}
		const meshes = this.remotePowerupNode.getChildMeshes(false);
		const mesh = meshes.find(child => child instanceof BABYLON.Mesh) as
			| BABYLON.Mesh
			| undefined;
		return mesh ?? null;
	}

	private setRemotePowerupScale(scale: number): void {
		if (!this.remotePowerupNode || this.remotePowerupNode.isDisposed()) {
			return;
		}
		const clamped = Math.max(0, Math.min(1, scale));
		const base = this.remotePowerupBaseScale;
		this.remotePowerupNode.scaling.copyFromFloats(
			base.x * clamped,
			base.y * clamped,
			base.z * clamped
		);
		const meshes = this.remotePowerupNode.getChildMeshes(false);
		meshes.forEach(mesh => {
			let baseScale = this.remotePowerupChildBaseScales.get(mesh);
			if (!baseScale) {
				baseScale = mesh.scaling.clone();
				this.remotePowerupChildBaseScales.set(mesh, baseScale.clone());
			}
			mesh.scaling.copyFromFloats(
				baseScale.x * clamped,
				baseScale.y * clamped,
				baseScale.z * clamped
			);
		});
	}

	private getActiveBallImpostors(): BABYLON.PhysicsImpostor[] {
		const impostors: BABYLON.PhysicsImpostor[] = [];
		if (this.ballMesh?.physicsImpostor) {
			impostors.push(this.ballMesh.physicsImpostor);
		}
		for (const splitBall of this.splitBalls) {
			if (splitBall.impostor) {
				impostors.push(splitBall.impostor);
			}
		}
		return impostors;
	}

	private getWallPhysicsImpostors(): BABYLON.PhysicsImpostor[] {
		if (!this.scene) return [];
		return this.scene.meshes
			.filter(
				mesh =>
					mesh &&
					mesh.name &&
					/wall/i.test(mesh.name) &&
					mesh.physicsImpostor
			)
			.map(mesh => mesh.physicsImpostor!)
			.filter(Boolean);
	}

	private maintainSplitBallVelocities(): void {
		if (this.splitBalls.length === 0) return;
		const targetSpeed = this.ballEffects.getCurrentBallSpeed();
		this.splitBalls.forEach(ball => {
			const velocity = ball.impostor.getLinearVelocity();
			if (!velocity) return;
			const xz = new BABYLON.Vector3(velocity.x, 0, velocity.z);
			const speed = xz.length();
			if (speed === 0) return;
			const normalized = xz.scale(1 / speed);
			const corrected = normalized.scale(targetSpeed);
			ball.impostor.setLinearVelocity(
				new BABYLON.Vector3(corrected.x, 0, corrected.z)
			);
			const mesh = ball.mesh;
			if (Math.abs(mesh.position.y - this.baseBallY) > 0.001) {
				mesh.position.y = this.baseBallY;
				const body = ball.impostor.physicsBody;
				if (body) {
					body.position.y = this.baseBallY;
				}
			}
		});
	}

	private handleSplitBallAfterGoal(
		ballImpostor?: BABYLON.PhysicsImpostor | null
	): void {
		if (ballImpostor && this.isSplitBallImpostor(ballImpostor)) {
			this.removeSplitBallByImpostor(ballImpostor);
		}
	}

	// === GAME PHYSICS CONFIGURATION ===

	// Simple ball radius for physics impostor
	private static get BALL_RADIUS(): number {
		return GameConfig.getBallRadius();
	}

	// Ball settings (non-effects)
	public WINNING_SCORE = DEFAULT_MAX_SCORE; // Points needed to win the game
	private outOfBoundsDistance: number = GameConfig.getOutOfBoundsDistance(); // Distance threshold for out-of-bounds detection (±units on X/Z axis)

	// Physics engine settings
	private PHYSICS_TIME_STEP = GameConfig.getPhysicsTimeStep(); // Physics update frequency (120 Hz to reduce tunneling)
	private PHYSICS_SOLVER_ITERATIONS = GameConfig.getPhysicsSolverIterations(); // Cannon solver iterations per step (constraint convergence)
	// Ball control settings - velocity-based reflection angle modification
	private BALL_ANGLE_MULTIPLIER = GameConfig.getBallAngleMultiplier(); // Multiplier for angle influence strength (0.0 = no effect, 1.0 = full effect)

	// Safety: maximum allowed angle between outgoing ball vector and paddle normal
	// (in radians). If a computed outgoing direction would exceed this, it will be
	// clamped toward the paddle normal so the ball cannot be returned at an
	// extreme grazing/perpendicular angle which causes excessive wall bounces.
	// Max angle between outgoing ball vector and paddle normal (radians)
	private ANGULAR_RETURN_LIMIT = GameConfig.getAngularReturnLimit();
	public SERVE_ANGLE_LIMIT = GameConfig.getServeAngleLimit(); // ±10° serve spread (20° total)
	public SERVE_OFFSET = GameConfig.getServeOffset();

	// Paddle physics settings
	private PADDLE_MASS = GameConfig.getPaddleMass(); // Paddle mass for collision response
	private PADDLE_FORCE = GameConfig.getPaddleForce(); // Force applied when moving
	private PADDLE_RANGE = GameConfig.getPaddleRange(); // Movement range from center
	private PADDLE_MAX_VELOCITY = GameConfig.getPaddleMaxVelocity(); // Maximum paddle speed
	private PADDLE_BRAKING_FACTOR = GameConfig.getPaddleBrakingFactor(); // Velocity multiplier per frame when no input (0.92 = 8% reduction per frame)

	// === END CONFIGURATION ===

	// Debug logging
	private debugPaddleLogging = false; // Disabled by default
	private readonly PADDLE_LOG_INTERVAL = 250; // ms
	private lastPaddleLog = 0;

	// Track boundary stop state to avoid repeated velocity zeroing
	private paddleStoppedAtBoundary: boolean[] = [false, false, false, false];

	// Wall collision debouncing to prevent rapid-fire collisions
	private lastWallCollisionTime = 0;
	private readonly WALL_COLLISION_COOLDOWN_MS = 20; // ~2 frames at 60fps
	private wallCollisionCount = 0; // Track rapid wall collisions
	private wallCollisionResetTime = 0;

	// Store original GLB positions for relative movement
	private originalGLBPositions: { x: number; z: number }[] = [
		{ x: 0, z: 0 },
		{ x: 0, z: 0 },
		{ x: 0, z: 0 },
		{ x: 0, z: 0 },
	];

	// Game state
	private gameState: GameState = {
		paddlePositionsX: [0, 0, 0, 0], // x positions for paddles 0-3 (displacement from GLB)
		paddlePositionsY: [0, 0, 0, 0], // y positions for paddles 0-3 (displacement from GLB)
	};

	// Input handler
	private inputHandler: Pong3DInput | null = null;

	// Game loop (different types for local/master/client modes)
	private gameLoop:
		| Pong3DGameLoop
		| Pong3DGameLoopMaster
		| Pong3DGameLoopClient
		| null = null;
	private gameMode: 'local' | 'master' | 'client' = 'local';

	// Ball effects system
	private ballEffects: Pong3DBallEffects;

	// Audio system
	private audioSystem: Pong3DAudio;

	private ballMesh: BABYLON.Mesh | null = null;

	// Physics plugin reference for runtime tuning
	private physicsPlugin: CannonJSPlugin | null = null;

	// Resize handler reference for cleanup
	private resizeHandler: (() => void) | null = null;

	// GameScreen reference for modal management
	private gameScreen: GameScreen | null = null;

	// Goal detection
	private goalMeshes: (BABYLON.Mesh | null)[] = [null, null, null, null]; // Goal zones for each player
	private defenceMeshes: (BABYLON.Mesh | null)[] = [null, null, null, null]; // AI defence planes aligned with paddle fronts
	private lastPlayerToHitBall: number = -1; // Track which player last hit the ball (0-based index)
	private secondLastPlayerToHitBall: number = -1; // Track which player hit the ball before the last hitter (0-based index)
	private recentHitterHistory: number[] = [];
	private static readonly RECENT_HITTER_HISTORY_LIMIT = 10;
	private currentServer: number = -1; // Track which player should serve next (the one who conceded last)
	private onGoalCallback:
		| ((scoringPlayer: number, goalPlayer: number) => void)
		| null = null;
	private lastGoalTime: number = 0; // Prevent multiple goal triggers
	private readonly GOAL_COOLDOWN_MS = 2000; // 2 seconds between goals
	private goalScored: boolean = false; // Track when goal is scored but ball should continue moving
	private pendingGoalData: {
		scoringPlayer: number;
		goalPlayer: number;
		wasOwnGoal: boolean;
	} | null = null; // Store goal data for delayed reset
	private lastConcedingPlayer: number = -1; // Store the player who conceded the last goal for serve system

	/** Get the appropriate GLB model URL based on player count */
	private getModelUrlForPlayerCount(playerCount: number): string {
		switch (playerCount) {
			case 2:
				return '/pong2p.glb';
			case 3:
				return '/pong3p.glb';
			case 4:
				return '/pong4p.glb';
			default:
				this.conditionalWarn(
					`Invalid player count ${playerCount}, defaulting to 2 players`
				);
				return '/pong2p.glb';
		}
	}

	/** Initialize camera based on current player POV */
	private setupCamera(): void {
		const cameraPos = getCameraPosition(
			this.thisPlayer,
			this.playerCount,
			this.getCameraSettings(),
			this.local
		);

		this.camera = new BABYLON.ArcRotateCamera(
			'cam',
			cameraPos.alpha,
			cameraPos.beta,
			cameraPos.radius,
			cameraPos.target,
			this.scene
		);
		this.camera.attachControl(this.canvas, true);
		this.camera.wheelPrecision = 50;

		// Disable camera keyboard controls so arrow keys can be used for gameplay
		this.camera.keysUp = [];
		this.camera.keysDown = [];
		this.camera.keysLeft = [];
		this.camera.keysRight = [];

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`Camera set for Player ${this.thisPlayer} POV: alpha=${cameraPos.alpha.toFixed(2)}, beta=${cameraPos.beta.toFixed(2)}`
			);
		}
	}
	private setupEventListeners(): void {
		// Only initialize input handler in local/master modes
		if (this.gameMode !== 'client') {
			this.inputHandler = new Pong3DInput(this.canvas);
		}

		// Store resize handler reference for proper cleanup
		this.resizeHandler = () => this.engine.resize();
		window.addEventListener('resize', this.resizeHandler);

		// Listen for remote score updates (client mode only)
		if (this.gameMode === 'client') {
			this.conditionalLog(
				'🎮 Setting up remoteScoreUpdate event listener for client mode'
			);

			this.remoteScoreUpdateHandler = (event: Event) => {
				this.conditionalLog(
					'🎮 remoteScoreUpdate event received:',
					event
				);
				const customEvent = event as CustomEvent<{
					scoringPlayerUID: string;
				}>;
				this.conditionalLog(
					'🎮 Calling handleRemoteScoreUpdate with UID:',
					customEvent.detail.scoringPlayerUID
				);
				this.handleRemoteScoreUpdate(
					customEvent.detail.scoringPlayerUID
				);
			};

			document.addEventListener(
				'remoteScoreUpdate',
				this.remoteScoreUpdateHandler
			);
		} else {
			this.conditionalLog(
				'🎮 Not setting up remoteScoreUpdate listener - game mode:',
				this.gameMode
			);
		}

		// Listen for remote game state updates (clients only)
		if (this.gameMode !== 'master') {
			this.remoteGameStateHandler = (event: Event) => {
				const customEvent = event as CustomEvent<any>;
				const gameState = customEvent.detail;
				this.conditionalLog('📡 remoteGameState received:', gameState);

				if (gameState && typeof gameState.s === 'number') {
					this.handleRemoteSoundEffect(gameState.s);
				}
			};

			document.addEventListener(
				'remoteGameState',
				this.remoteGameStateHandler
			);
		} else {
			this.conditionalLog(
				'🎮 Skipping remoteGameState listener in master mode'
			);
		}
	}

	constructor(container: HTMLElement, options?: Pong3DOptions) {
		// Player count comes from GameConfig, set by frontend when players are ready
		this.container = container;
		Pong3D.ensureBabylonWarningsFiltered();
		this.thisPlayer =
			options?.thisPlayer ||
			(GameConfig.getThisPlayer() as 1 | 2 | 3 | 4); // Set POV player (default from GameConfig)
		this.local = options?.local ?? GameConfig.isLocalMode(); // Set local mode (default from GameConfig)
		if (options?.outOfBoundsDistance !== undefined) {
			this.outOfBoundsDistance = options.outOfBoundsDistance; // Override default if provided
		}
		this.gameScreen = options?.gameScreen || null; // Store GameScreen reference for modal management
		const modelUrl =
			options?.modelUrlOverride ||
			this.getModelUrlForPlayerCount(this.playerCount);

		this.debugLog(
			`Initializing Pong3D for ${this.playerCount} players with model: ${modelUrl}, POV: Player ${this.thisPlayer}, Local: ${this.local}`
		);

		// Initialize ball effects system
		this.ballEffects = new Pong3DBallEffects();
		this.ballEffects.setSpinDelay(GameConfig.getSpinDelayMs());

		// Initialize audio system
		this.audioSystem = new Pong3DAudio();

		// Create canvas inside container
		this.canvas = document.createElement('canvas');
		this.canvas.tabIndex = 0; // allow focus so keyboard input works without clicking
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		container.appendChild(this.canvas);
		window.requestAnimationFrame(() => {
			if (document.activeElement !== this.canvas) {
				this.canvas.focus({ preventScroll: true });
			}
		});

		// Initialize Babylon.js engine with alpha support
		this.engine = new BABYLON.Engine(this.canvas, true, {
			preserveDrawingBuffer: true,
			stencil: true,
			alpha: true,
		});

		this.scene = new BABYLON.Scene(this.engine);
		// Expose scene/game for devtools debugging (removed by bundler in prod)
		if (typeof window !== 'undefined') {
			(window as any).__pongScene = this.scene;
			(window as any).__pongGame = this;
		}
		// Make scene background transparent
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
		this.setupHDR();
		this.setupGlowEffects();
		this.powerupManager = new Pong3DPowerups(this.scene);
		this.powerupManager.configureCollisionTracking({
			getBallTargets: () => this.getActiveBallImpostors(),
			getWallTargets: () => this.getWallPhysicsImpostors(),
			onBallCollision: () => {
				void this.audioSystem.playSoundEffectWithHarmonic(
					'dong',
					'powerupHigh'
				);
				if (this.gameMode === 'master') {
					this.sendSoundEffectToClients(Pong3D.SOUND_POWERUP_BALL);
				}
			},
			onWallCollision: () => {
				void this.audioSystem.playSoundEffectWithHarmonic(
					'dong',
					'powerupLow'
				);
				if (this.gameMode === 'master') {
					this.sendSoundEffectToClients(Pong3D.SOUND_POWERUP_WALL);
				}
			},
		});
		this.lastPowerupUpdateTimeMs =
			typeof performance !== 'undefined' ? performance.now() : Date.now();

		// Apply provided options
		if (options) {
			if (typeof options.importedLightScale === 'number')
				this.importedLightScale = options.importedLightScale;
		}

		this.setupCamera();

		// Determine game mode based on GameConfig
		this.gameMode = this.getGameMode();
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🎮 Game mode detected: ${this.gameMode} (Player ${this.thisPlayer}, ${GameConfig.getPlayerCount()} players)`
			);
		}

		this.setupEventListeners();

		// Initialize alternate scoring for local 3p/4p tournament: start at max score
		try {
			const isLocalTournament =
				sessionStorage.getItem('gameMode') === 'local' &&
				sessionStorage.getItem('tournament') === '1';
			if (
				isLocalTournament &&
				this.playerCount >= 2 &&
				this.playerCount <= 4
			) {
				for (let i = 0; i < this.playerCount; i++) {
					this.playerScores[i] = this.WINNING_SCORE;
				}
			}
		} catch (_) {
			// sessionStorage may be unavailable; ignore
		}

		// Initialize appropriate game loop based on mode
		if (this.gameMode === 'local') {
			this.gameLoop = new Pong3DGameLoop(this.scene, this);
		} else if (this.gameMode === 'master') {
			this.gameLoop = new Pong3DGameLoopMaster(
				this.scene,
				gameState => {
					this.sendGameStateToClients(gameState);
				},
				this
			);
		} else if (this.gameMode === 'client') {
			this.gameLoop = new Pong3DGameLoopClient(
				this.scene,
				this.thisPlayer,
				input => {
					this.sendInputToMaster(input);
				},
				this
			);
		}

		this.refreshPowerupConfiguration();

		this.loadModel(modelUrl);
	}

	private loadModel(modelUrl: string): void {
		BABYLON.SceneLoader.Append(
			'',
			modelUrl,
			this.scene,
			scene => {
				this.onModelLoaded(scene);
				this.startRenderLoop();
			},
			null,
			(_scene, message) => {
				this.conditionalError('Error loading model:', message);
			}
		);
	}

	private onModelLoaded(scene: BABYLON.Scene): void {
		// Position camera based on scene bounds
		const loadedMeshes = scene.meshes.filter(
			m => m && m.getTotalVertices && m.getTotalVertices() > 0
		);
		const bounds = this.computeSceneBoundingInfo(
			loadedMeshes.length ? loadedMeshes : scene.meshes
		);

		if (bounds) {
			const size = bounds.max.subtract(bounds.min);
			const center = bounds.min.add(size.scale(0.5));

			// Choose camera target: either GLB origin or calculated mesh center
			if (this.useGLBOrigin) {
				// GLB origin mode - let the POV module handle the target, don't override it
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						'Using GLB origin mode - POV module controls target:',
						this.camera.target
					);
				}
			} else {
				// Use calculated mesh center with vertical offset
				const targetWithY = center.clone();
				targetWithY.y += this.DEFAULT_CAMERA_TARGET_Y;
				this.camera.setTarget(targetWithY);
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						'Using calculated mesh center for camera target:',
						targetWithY
					);
				}
			}

			// Don't override radius - let getCameraPosition control it
			// Fit camera radius to bounding sphere (for reference only)
			const computedRadius = Math.max(size.length() * 0.6, 1.5);
			const chosen = Math.max(computedRadius, this.DEFAULT_CAMERA_RADIUS);
			// this.camera.radius = chosen; // Commented out to allow custom radius per POV

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					'Computed radius:',
					computedRadius,
					'Available radius:',
					chosen,
					'Using POV radius from getCameraPosition',
					'Camera target:',
					this.camera.target
				);
			}
		}

		this.findPaddles(scene);
		this.findGoals(scene);
		this.findDefencePlanes(scene);
		this.findBall(scene);
		this.setupPhysicsImpostors(scene); // Create physics impostors for meshes

		// Setup GUI after model is loaded
		try {
			this.setupGui();
		} catch (e) {
			this.conditionalWarn('GUI setup failed:', e);
		}

		// Set up AI controllers for players with names starting with "*"
		this.setupAIControllers();

		// Reduce intensity of imported lights
		try {
			scene.lights.forEach(light => {
				if (light && typeof (light as any).intensity === 'number') {
					(light as any).intensity =
						(light as any).intensity * this.importedLightScale;
				}
			});
		} catch (e) {
			this.conditionalWarn('Could not adjust light intensities:', e);
		}

		// Setup shadows after lights are adjusted
		this.setupShadowSystem(scene);

		// Initialize audio system
		this.audioSystem
			.setScene(this.scene)
			.then(() => {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						'🔊 Audio system scene set and audio engine initialized'
					);
				}
				// Load audio assets after audio engine is ready
				return this.audioSystem.loadAudioAssets();
			})
			.catch(error => {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalWarn(
						'🔊 Audio initialization or loading failed:',
						error
					);
				}
			});

		scene.render();

		// Auto-start the game loop after everything is loaded
		if (this.gameLoop) {
			// Set the first server - prefer human players over AI
			const humanPlayers: number[] = [];
			const aiPlayers: number[] = [];
			
			for (let i = 0; i < this.playerCount; i++) {
				const playerName = this.playerNames[i];
				if (playerName && playerName.startsWith('*')) {
					aiPlayers.push(i);
				} else {
					humanPlayers.push(i);
				}
			}
			
			// Choose a human player if any exist, otherwise choose an AI
			if (humanPlayers.length > 0) {
				this.currentServer = humanPlayers[Math.floor(Math.random() * humanPlayers.length)];
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚀 Auto-starting game loop with human server: Player ${this.currentServer + 1}...`
					);
				}
			} else {
				this.currentServer = aiPlayers[Math.floor(Math.random() * aiPlayers.length)];
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚀 Auto-starting game loop with AI server: Player ${this.currentServer + 1}...`
					);
				}
			}
			
			if (GameConfig.isDebugLoggingEnabled()) {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚀 Auto-starting game loop with random server: Player ${this.currentServer + 1}...`
					);
				}
			}
			this.gameLoop.start();

			// Set up render loop for manual goal detection
			this.scene.registerBeforeRender(() => {
				this.checkManualGoalCollisions();
			});
			this.conditionalLog('🎯 Manual goal detection render loop started');
		}
	}

	private setupPhysicsImpostors(scene: BABYLON.Scene): void {
		this.debugLog('Setting up physics impostors...');

		// Enable physics engine with Cannon.js (back to working version)
		const gravityVector = BABYLON.Vector3.Zero(); // No gravity for Pong
		const physicsPlugin = new CannonJSPlugin(
			true,
			this.PHYSICS_SOLVER_ITERATIONS,
			CANNON
		);
		this.physicsPlugin = physicsPlugin;
		this.scene.enablePhysics(gravityVector, physicsPlugin);

		// Set physics time step for higher frequency updates to reduce tunneling
		this.scene.getPhysicsEngine()?.setTimeStep(this.PHYSICS_TIME_STEP);

		// Create physics impostors for goals now that physics is enabled
		this.goalMeshes.forEach((goal, index) => {
			if (goal && !goal.physicsImpostor) {
				try {
					goal.physicsImpostor = new BABYLON.PhysicsImpostor(
						goal,
						BABYLON.PhysicsImpostor.MeshImpostor,
						{ mass: 0, restitution: 0.0, friction: 0.0 },
						this.scene
					);

					// Make goal a sensor/trigger - detects collision but doesn't cause physical response
					if (goal.physicsImpostor.physicsBody) {
						// Disable collision response so ball passes through
						goal.physicsImpostor.physicsBody.collisionResponse = false;
						this.conditionalLog(
							`✅ Goal ${index + 1} (${goal.name}): Created sensor MeshImpostor (no collision response)`
						);
					} else {
						this.conditionalLog(
							`✅ Goal ${index + 1} (${goal.name}): Created MeshImpostor for physics collision detection`
						);
					}
				} catch (error) {
					this.conditionalWarn(
						`❌ Failed to create physics impostor for goal ${index + 1}:`,
						error
					);
				}
			}
		});

		this.defenceMeshes.forEach((defence, index) => {
			if (defence && !defence.physicsImpostor) {
				try {
					defence.physicsImpostor = new BABYLON.PhysicsImpostor(
						defence,
						BABYLON.PhysicsImpostor.MeshImpostor,
						{ mass: 0, restitution: 0.0, friction: 0.0 },
						this.scene
					);

					if (defence.physicsImpostor.physicsBody) {
						defence.physicsImpostor.physicsBody.collisionResponse = false;
					}

					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`🛡️ Defence ${index + 1} (${defence.name}): Created sensor MeshImpostor`
						);
					}
				} catch (error) {
					this.conditionalWarn(
						`❌ Failed to create physics impostor for defence ${index + 1}:`,
						error
					);
				}
			}
		});

		// Ball impostor (for local and master modes - both need physics)
		if (
			this.ballMesh &&
			(this.gameMode === 'local' || this.gameMode === 'master')
		) {
			// Simple de-parenting without world transform preservation
			if (this.ballMesh.parent) {
				this.ballMesh.parent = null;
			}
			this.ballMesh.physicsImpostor = new BABYLON.PhysicsImpostor(
				this.ballMesh,
				BABYLON.PhysicsImpostor.SphereImpostor,
				{ mass: 1, restitution: 1.0, friction: 0 },
				this.scene
			);

			// Set custom radius for physics impostor
			if (this.ballMesh.physicsImpostor.physicsBody) {
				// For Cannon.js physics body, we need to set the radius directly
				if (
					this.ballMesh.physicsImpostor.physicsBody.shapes &&
					this.ballMesh.physicsImpostor.physicsBody.shapes[0]
				) {
					this.ballMesh.physicsImpostor.physicsBody.shapes[0].radius =
						Pong3D.BALL_RADIUS;
				}
			}

			// Lock ball movement to X-Z plane (no Y movement)
			if (this.ballMesh.physicsImpostor.physicsBody) {
				if (this.ballMesh.physicsImpostor.physicsBody.linearFactor) {
					this.ballMesh.physicsImpostor.physicsBody.linearFactor.set(
						1,
						0,
						1
					); // X and Z only, no Y
				}
				// Remove any damping from ball so it doesn't slow down
				this.ballMesh.physicsImpostor.physicsBody.linearDamping = 0;
				this.ballMesh.physicsImpostor.physicsBody.angularDamping = 0;
			}

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`Created SphereImpostor for: ${this.ballMesh.name}`
				);
			}

			// Initialize main ball entity for per-ball updates
			if (this.ballMesh.physicsImpostor) {
				const baseY = this.ballMesh.position.y;
				this.mainBallEntity = new BallEntity(
					this.ballMesh,
					this.ballMesh.physicsImpostor,
					baseY,
					{ spinDelayMs: GameConfig.getSpinDelayMs() }
				);
			}
		} else if (this.ballMesh) {
			this.conditionalLog(
				`🏐 Skipped physics impostor for ball in ${this.gameMode} mode - using custom physics`
			);
		}

		// Capture original paddle positions BEFORE any de-parenting operations
		for (let i = 0; i < this.playerCount; i++) {
			if (this.paddles[i]) {
				const paddle = this.paddles[i]!;
				this.debugLog(`=== Paddle ${i + 1} DEBUG INFO ===`);
				this.debugLog(
					`  - Local position: x=${paddle.position.x}, y=${paddle.position.y}, z=${paddle.position.z}`
				);
				this.debugLog(
					`  - World position: x=${paddle.absolutePosition.x}, y=${paddle.absolutePosition.y}, z=${paddle.absolutePosition.z}`
				);
				this.debugLog(
					`  - Parent: ${paddle.parent ? paddle.parent.name : 'none'}`
				);

				// Check the raw transform data
				this.debugLog(
					`  - Transform matrix elements [12,13,14]: [${paddle.getWorldMatrix().m[12]}, ${paddle.getWorldMatrix().m[13]}, ${paddle.getWorldMatrix().m[14]}]`
				);

				// Check mesh bounding box
				if (paddle.getBoundingInfo) {
					const bbox = paddle.getBoundingInfo().boundingBox;
					this.debugLog(
						`  - Bounding box min: (${bbox.minimum.x}, ${bbox.minimum.y}, ${bbox.minimum.z})`
					);
					this.debugLog(
						`  - Bounding box max: (${bbox.maximum.x}, ${bbox.maximum.y}, ${bbox.maximum.z})`
					);
					this.debugLog(
						`  - Bounding box center: (${bbox.center.x}, ${bbox.center.y}, ${bbox.center.z})`
					);
				}

				// Check if this is a mesh with geometry
				if (paddle instanceof BABYLON.Mesh) {
					const mesh = paddle as BABYLON.Mesh;
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`  - Is Mesh: true, hasVertexData: ${mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) !== null}`
						);
					}

					// Check if vertices are positioned relative to origin
					const positions = mesh.getVerticesData(
						BABYLON.VertexBuffer.PositionKind
					);
					if (positions && positions.length >= 6) {
						if (GameConfig.isDebugLoggingEnabled()) {
							this.conditionalLog(
								`  - First vertex: (${positions[0]}, ${positions[1]}, ${positions[2]})`
							);
							this.conditionalLog(
								`  - Second vertex: (${positions[3]}, ${positions[4]}, ${positions[5]})`
							);
						}
					}
				}

				// Check if there are any transforms in the parent hierarchy
				if (paddle.parent) {
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`  - Checking parent hierarchy for transforms...`
						);
					}
					let currentParent: BABYLON.Node | null = paddle.parent;
					let level = 0;
					while (currentParent && level < 3) {
						if (currentParent instanceof BABYLON.TransformNode) {
							const transform =
								currentParent as BABYLON.TransformNode;
							if (GameConfig.isDebugLoggingEnabled()) {
								this.conditionalLog(
									`    Parent ${level} (${currentParent.name}): pos(${transform.position.x}, ${transform.position.y}, ${transform.position.z})`
								);
							}
						}
						currentParent = currentParent.parent;
						level++;
					}
				}

				// Store the WORLD positions (which have the correct transforms)
				// Note: The GLB has paddles on Z-axis, but we need them on X-axis for the game
				this.originalGLBPositions[i] = {
					x: paddle.absolutePosition.x, // Keep X as X
					z: paddle.absolutePosition.z, // Keep Z as Z
				};
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`  - Stored for game: x=${this.originalGLBPositions[i].x}, z=${this.originalGLBPositions[i].z}`
					);
				}
			}
		}

		// Paddles impostors
		this.paddles.forEach((paddle, paddleIndex) => {
			if (paddle) {
				// Preserve world transform (position AND rotation) before de-parenting
				const worldMatrix = paddle.getWorldMatrix();
				const position = new BABYLON.Vector3();
				const rotationQuaternion = new BABYLON.Quaternion();
				const scaling = new BABYLON.Vector3();
				worldMatrix.decompose(scaling, rotationQuaternion, position);

				// Simple de-parenting
				if (paddle.parent) {
					paddle.parent = null;
				}

				// Restore both position and rotation
				paddle.position = position;
				paddle.rotationQuaternion = rotationQuaternion;
				paddle.scaling = scaling;

				// Fix rotation for paddle 1 - rotate 180 degrees around Y-axis to face correct direction
				// Paddle 2 is assumed to be correctly oriented in the GLB model.
				if (paddleIndex === 0) {
					const yRotation = BABYLON.Quaternion.RotationAxis(
						BABYLON.Vector3.Up(),
						Math.PI
					);
					paddle.rotationQuaternion =
						paddle.rotationQuaternion!.multiply(yRotation);
				}

				if (GameConfig.isDebugLoggingEnabled()) {
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`Paddle ${paddleIndex + 1} AFTER positioning:`
						);
					}
					this.conditionalLog(
						`  - Game position: x=${paddle.position.x}, y=${paddle.position.y}, z=${paddle.position.z}`
					);
				}

				paddle.physicsImpostor = new BABYLON.PhysicsImpostor(
					paddle,
					BABYLON.PhysicsImpostor.BoxImpostor, // Use BoxImpostor to avoid edge collision issues
					{
						mass: this.PADDLE_MASS, // Use configurable paddle mass
						restitution: 1.0,
						friction: 0,
					},
					this.scene
				);
				// Set physics properties and lock rotation - NO DAMPING for pure force-based physics
				if (paddle.physicsImpostor.physicsBody) {
					paddle.physicsImpostor.physicsBody.linearDamping = 0; // No damping - pure force-based physics
					paddle.physicsImpostor.physicsBody.angularDamping = 1.0; // Maximum angular damping
					paddle.physicsImpostor.physicsBody.fixedRotation = true; // Lock all rotation

					// Set movement constraints based on player count and paddle index
					if (paddle.physicsImpostor.physicsBody.linearFactor) {
						if (this.playerCount === 3) {
							// 3-player mode: All paddles move along rotated axes (X and Z components)
							// Player 1: 0° (X-axis), Player 2: 120° (X,Z), Player 3: 240° (X,Z)
							// Allow movement in the X-Z plane for all 3-player paddles
							paddle.physicsImpostor.physicsBody.linearFactor.set(
								1,
								0,
								1
							); // X and Z axes
						} else if (this.playerCount === 4 && paddleIndex >= 2) {
							paddle.physicsImpostor.physicsBody.linearFactor.set(
								0,
								0,
								1
							); // Z-axis only for players 3-4
						} else {
							paddle.physicsImpostor.physicsBody.linearFactor.set(
								1,
								0,
								0
							); // X-axis only for default/2-player
						}
					}
					if (paddle.physicsImpostor.physicsBody.angularFactor) {
						paddle.physicsImpostor.physicsBody.angularFactor.set(
							0,
							0,
							0
						); // No rotation at all
					}
				}

				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`Created DYNAMIC BoxImpostor for: ${paddle.name}`
					);
				}
			}
		});

		// Walls (only create physics for actual wall collision geometry)
		scene.meshes.forEach(mesh => {
			// Only create physics for meshes that are specifically walls, not court surfaces
			if (
				mesh &&
				mesh.name &&
				!/ball/i.test(mesh.name) &&
				!/paddle/i.test(mesh.name) &&
				!/court/i.test(mesh.name) && // Exclude court surface meshes
				/wall/i.test(mesh.name) && // Only include wall meshes
				mesh.isVisible &&
				mesh.getTotalVertices() > 0
			) {
				this.conditionalLog(
					`Creating physics for wall mesh: ${mesh.name} (parent: ${mesh.parent ? mesh.parent.name : 'none'})`
				);
				this.conditionalLog(
					`  - Position: x=${mesh.position.x}, y=${mesh.position.y}, z=${mesh.position.z}`
				);
				this.conditionalLog(
					`  - World position: x=${mesh.absolutePosition.x}, y=${mesh.absolutePosition.y}, z=${mesh.absolutePosition.z}`
				);

				// De-parent wall meshes to fix physics collision detection
				if (mesh.parent) {
					const worldMatrix = mesh.getWorldMatrix();
					const position = new BABYLON.Vector3();
					const rotationQuaternion = new BABYLON.Quaternion();
					const scaling = new BABYLON.Vector3();
					worldMatrix.decompose(
						scaling,
						rotationQuaternion,
						position
					);

					mesh.parent = null;
					mesh.position = position;
					mesh.rotationQuaternion = rotationQuaternion;
					mesh.scaling = scaling;

					this.conditionalLog(
						`  - De-parented and repositioned to: x=${mesh.position.x}, y=${mesh.position.y}, z=${mesh.position.z}`
					);
				}

				mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
					mesh,
					BABYLON.PhysicsImpostor.MeshImpostor, // Use exact mesh shape instead of box
					{
						mass: 0,
						restitution: 1.0,
						friction: GameConfig.getWallFriction(),
					}, // Small tangential friction nudges exit angle without killing speed
					this.scene
				);
				this.conditionalLog(
					`Created static MeshImpostor for wall: ${mesh.name}`
				);
			}
		});

		// Set up collision detection for local and master modes
		if (
			this.ballMesh?.physicsImpostor &&
			(this.gameMode === 'local' || this.gameMode === 'master')
		) {
			this.attachMainBallCollisionHandlers(true);
			this.setupManualGoalDetection();
		} else if (this.gameMode !== 'local') {
			this.conditionalLog(
				`🎮 Skipped collision detection setup in ${this.gameMode} mode - using custom physics`
			);
		}
	}

	/**
	 * Handle ball-paddle collision to implement velocity-based ball control
	 * The paddle's velocity influences the ball's reflection angle
	 */
	private handleBallPaddleCollision(
		ballImpostor: BABYLON.PhysicsImpostor,
		paddleImpostor: BABYLON.PhysicsImpostor
	): void {
		// TEMPORARILY DISABLED: Collision debouncing to test stability
		// const currentTime = Date.now();
		// if (currentTime - this.lastCollisionTime < this.COLLISION_DEBOUNCE_MS) {
		// 	this.conditionalLog(`🚫 Collision debounced - too soon after last collision`);
		// 	return;
		// }
		// this.lastCollisionTime = currentTime;
		if (!this.ballMesh || !ballImpostor.physicsBody) return;

		const now =
			typeof performance !== 'undefined' ? performance.now() : Date.now();
		let paddleIndex = -1;
		for (let i = 0; i < this.playerCount; i++) {
			if (this.paddles[i]?.physicsImpostor === paddleImpostor) {
				paddleIndex = i;
				break;
			}
		}

		if (paddleIndex === -1) return; // Unknown paddle

		const collisionDebounceMs = GameConfig.getCollisionDebounceMs();
		const timeSinceLastHit = now - this.lastCollisionTimeMs;
		const isSamePaddleAsLastHit =
			this.lastCollisionPaddleIndex === paddleIndex &&
			timeSinceLastHit < collisionDebounceMs;
		if (isSamePaddleAsLastHit) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🚫 Collision debounced for paddle ${paddleIndex + 1} (Δt=${timeSinceLastHit.toFixed(1)}ms < ${collisionDebounceMs}ms)`
				);
			}
			// Refresh timestamp so the debounce window persists while the ball remains inside the paddle
			this.lastCollisionTimeMs = now;
			return;
		}

		// Update debounce tracking on first valid contact for this paddle
		this.lastCollisionPaddleIndex = paddleIndex;
		this.lastCollisionTimeMs = now;

		// Track which player last hit the ball
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(`🏓 Ball hit by Player ${paddleIndex + 1}`);
		}
		// Only shift last hitter to second last if it's a different player
		// If the same player hits twice in succession, they only become the last hitter
		if (this.lastPlayerToHitBall !== paddleIndex) {
			this.secondLastPlayerToHitBall = this.lastPlayerToHitBall;
		}
		this.lastPlayerToHitBall = paddleIndex;
		// Update per-ball hit history
		if (this.isSplitBallImpostor(ballImpostor)) {
			this.ballManager.recordHit(ballImpostor, paddleIndex);
		} else if (this.mainBallEntity) {
			this.mainBallEntity.recordHit(paddleIndex);
		}
		this.recordRecentHitter(paddleIndex);
		this.conditionalLog(
			`Last player to hit ball updated to: ${this.lastPlayerToHitBall}, Second last: ${this.secondLastPlayerToHitBall}`
		);

		// Play ping sound effect with harmonic variation
		this.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');

		// Send sound effect to clients (master mode only)
		if (this.gameMode === 'master') {
			this.sendSoundEffectToClients(Pong3D.SOUND_PADDLE);
		}

		const paddle = this.paddles[paddleIndex]!;
		if (!paddle.physicsImpostor?.physicsBody) return;

		// Get the collision normal from Cannon.js physics engine
		let paddleNormal = this.getCollisionNormal(
			ballImpostor,
			paddleImpostor
		);
		if (!paddleNormal) {
			this.conditionalWarn(
				`Could not get collision normal from Cannon.js, using geometric fallback`
			);
			// Fallback to geometric calculation
			paddleNormal = this.getPaddleNormal(paddle, paddleIndex);
			if (!paddleNormal) {
				// Final fallback to hardcoded normals
				if (this.playerCount === 2) {
					paddleNormal =
						paddleIndex === 0
							? new BABYLON.Vector3(0, 0, 1)
							: new BABYLON.Vector3(0, 0, -1);
				} else if (this.playerCount === 3) {
					const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
					const angle = angles[paddleIndex];
					paddleNormal = new BABYLON.Vector3(
						-Math.cos(angle),
						0,
						-Math.sin(angle)
					).normalize();
				} else if (this.playerCount === 4) {
					if (paddleIndex === 0)
						paddleNormal = new BABYLON.Vector3(0, 0, 1);
					else if (paddleIndex === 1)
						paddleNormal = new BABYLON.Vector3(0, 0, -1);
					else if (paddleIndex === 2)
						paddleNormal = new BABYLON.Vector3(-1, 0, 0);
					else paddleNormal = new BABYLON.Vector3(1, 0, 0);
				} else {
					paddleNormal = new BABYLON.Vector3(0, 0, 1); // Default
				}
			}
		}

		if (
			!isFinite(paddleNormal.x) ||
			!isFinite(paddleNormal.z) ||
			paddleNormal.lengthSquared() < 1e-6
		) {
			// Fallback to inward vector toward center for safety
			const inward = new BABYLON.Vector3(
				-paddle.position.x,
				0,
				-paddle.position.z
			).normalize();
			paddleNormal =
				inward.lengthSquared() > 0
					? inward
					: new BABYLON.Vector3(0, 0, 1);
		} else {
			paddleNormal = paddleNormal.normalize();
		}

		const planarMagnitudeSq =
			paddleNormal.x * paddleNormal.x + paddleNormal.z * paddleNormal.z;
		if (planarMagnitudeSq < 1e-6) {
			const fallbackNormal = this.getServeDirectionForPaddle(paddleIndex);
			if (fallbackNormal.lengthSquared() > 1e-6) {
				paddleNormal = fallbackNormal.normalize();
				this.conditionalLog(
					`⚠️ Collision normal lacked XZ component; using serve direction fallback for paddle ${paddleIndex + 1}`
				);
			} else {
				paddleNormal = new BABYLON.Vector3(0, 0, 1);
				this.conditionalLog(
					`⚠️ Collision normal fallback failed; defaulting to +Z for paddle ${paddleIndex + 1}`
				);
			}
		}

		this.conditionalLog(
			`🎯 Using final normal: (${paddleNormal.x.toFixed(3)}, ${paddleNormal.y.toFixed(3)}, ${paddleNormal.z.toFixed(3)})`
		);

		// Validate collision point to avoid edge collisions
		const ballPosition = this.ballMesh.position;
		const paddlePosition = paddle.position;
		const paddleBounds = paddle.getBoundingInfo().boundingBox;

		// Calculate relative position of ball to paddle center
		const relativePos = ballPosition.subtract(paddlePosition);

		// CRITICAL: Ensure normal always points toward the ball (away from paddle)
		const ballDirection = relativePos.normalize();
		if (BABYLON.Vector3.Dot(paddleNormal, ballDirection) < 0) {
			paddleNormal = paddleNormal.negate();
			this.conditionalLog(
				`🔄 Flipped normal to point toward ball: (${paddleNormal.x.toFixed(3)}, ${paddleNormal.y.toFixed(3)}, ${paddleNormal.z.toFixed(3)})`
			);
		}

		// For 2-player mode, check if collision is near the paddle face (not edges)
		if (this.playerCount === 2) {
			// Players 1,2 move on X-axis, paddle faces are on Z-axis
			const maxXOffset =
				(paddleBounds.maximum.x - paddleBounds.minimum.x) * 1; // Allow full paddle width
			if (Math.abs(relativePos.x) > maxXOffset) {
				this.conditionalLog(
					`🚫 Edge collision detected on Player ${paddleIndex + 1} paddle - ignoring (offset: ${relativePos.x.toFixed(3)}, limit: ${maxXOffset.toFixed(3)})`
				);
				return; // Ignore edge collisions
			}
		} else if (this.playerCount === 4) {
			// 4P Mode: P1/P2 walled off, working with P3/P4 (side paddles)
			// P3 and P4 use Z-axis edge collision detection
			const maxZOffset =
				(paddleBounds.maximum.z - paddleBounds.minimum.z) * 1; // Allow full paddle depth
			if (Math.abs(relativePos.z) > maxZOffset) {
				this.conditionalLog(
					`🚫 Edge collision detected on Player ${paddleIndex + 1} paddle - ignoring (4P Z-axis check)`
				);
				return; // Ignore edge collisions
			}
		}
		// For 3-player mode, we could add similar checks but it's more complex due to rotation

		// Get current velocities
		const ballVelocity = ballImpostor.getLinearVelocity();
		const paddleVelocity = paddle.physicsImpostor.getLinearVelocity();

		if (!ballVelocity || !paddleVelocity) return; // Determine movement axis for this paddle
		let paddleAxis = new BABYLON.Vector3(1, 0, 0); // Default for 2-player
		if (this.playerCount === 2) {
			// Player 2 paddle is rotated 180°; invert movement axis so dot product reflects on-screen direction
			if (paddleIndex === 1) {
				paddleAxis = new BABYLON.Vector3(-1, 0, 0);
			}
		} else if (this.playerCount === 3) {
			// Player 1: 0°, Player 2: 120°, Player 3: 240°
			// All paddles are rotated to face center, so their movement axes are adjusted
			if (paddleIndex === 0) {
				// Player 1 (0°) - bottom paddle
				paddleAxis = new BABYLON.Vector3(1, 0, 0); // Moves left-right (X-axis)
			} else if (paddleIndex === 1) {
				// Player 2 (120°) - upper left
				paddleAxis = new BABYLON.Vector3(-0.5, 0, -0.866); // Perpendicular to facing direction
			} else if (paddleIndex === 2) {
				// Player 3 (240°) - upper right
				paddleAxis = new BABYLON.Vector3(-0.5, 0, 0.866); // Perpendicular to facing direction
			}
			this.conditionalLog(
				`🔍 3P Mode: Paddle ${paddleIndex + 1} movement axis set to: (${paddleAxis.x.toFixed(3)}, ${paddleAxis.y.toFixed(3)}, ${paddleAxis.z.toFixed(3)})`
			);
		} else if (this.playerCount === 4) {
			// 4P Mode: P1/P2 walled off, working with P3/P4 (side paddles at 90° and 270°)
			if (paddleIndex === 2) {
				// P3 - Right paddle (270°)
				paddleAxis = new BABYLON.Vector3(0, 0, -1); // Moves up-down (negative Z)
			} else if (paddleIndex === 3) {
				// P4 - Left paddle (90°)
				paddleAxis = new BABYLON.Vector3(0, 0, 1); // Moves up-down (positive Z)
			}
			// P1 and P2 use default but they're walled off anyway
		}
		paddleAxis = paddleAxis.normalize();

		// Get paddle velocity along its movement axis
		const paddleVelAlong = BABYLON.Vector3.Dot(paddleVelocity, paddleAxis);

		// Define a threshold for "significant" paddle velocity
		// Lower threshold for 3P mode to make effects more visible
		const VELOCITY_THRESHOLD = this.playerCount === 3 ? 0.05 : 0.1;
		const hasPaddleVelocity = Math.abs(paddleVelAlong) > VELOCITY_THRESHOLD;

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🏓 Player ${paddleIndex + 1} - ${hasPaddleVelocity ? 'Moving' : 'Stationary'} paddle (${paddleVelAlong.toFixed(2)})`
			);
			this.conditionalLog(
				`🔍 Paddle velocity: (${paddleVelocity.x.toFixed(3)}, ${paddleVelocity.y.toFixed(3)}, ${paddleVelocity.z.toFixed(3)})`
			);
		}

		let axisNote = '';
		if (this.playerCount === 2 && paddleIndex === 1)
			axisNote = '[180° rotation]';
		else if (this.playerCount === 3) axisNote = '[Facing center]';
		else if (this.playerCount === 4) axisNote = '[P3/P4 side paddles]';

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🔍 Paddle movement axis: (${paddleAxis.x.toFixed(3)}, ${paddleAxis.y.toFixed(3)}, ${paddleAxis.z.toFixed(3)}) ${axisNote}`
			);
			this.conditionalLog(
				`🔍 Velocity threshold: ${VELOCITY_THRESHOLD}, actual abs velocity: ${Math.abs(paddleVelAlong).toFixed(3)}`
			);
		}

		// 🚨 DEBUG: Extra logging for 4P mode paddle detection
		if (this.playerCount === 4) {
			this.conditionalLog(
				`🚨 4P DEBUG: paddleIndex=${paddleIndex}, P3=${paddleIndex === 2}, P4=${paddleIndex === 3}`
			);
			this.conditionalLog(
				`🚨 4P DEBUG: Paddle velocity dot product = ${paddleVelAlong.toFixed(3)}`
			);
			this.conditionalLog(
				`🚨 4P DEBUG: Has paddle velocity? ${hasPaddleVelocity} (threshold: ${VELOCITY_THRESHOLD})`
			);
		}
		const velocityRatio = Math.max(
			-1.0,
			Math.min(1.0, paddleVelAlong / this.PADDLE_MAX_VELOCITY)
		);

		// IMPORTANT: For paddle orientation consistency
		// - Paddle 1 (bottom): moving right (+X) should deflect ball to +X (right side of court)
		// - Paddle 2 (top): moving right (+X) should deflect ball to +X (right side of court)
		// The rotation is applied around Y-axis, where positive rotation = rightward deflection
		// No inversion needed - the physics reflection handles orientation correctly

		// Calculate proper reflection direction first
		// We already have the collision normal from Cannon.js above

		let finalDirection: BABYLON.Vector3 | null = null;
		const surfaceNormal3D = paddleNormal.clone().normalize();
		const normalXZ = new BABYLON.Vector3(
			surfaceNormal3D.x,
			0,
			surfaceNormal3D.z
		);
		const basisNormal =
			normalXZ.lengthSquared() > 1e-6
				? normalXZ.normalize()
				: new BABYLON.Vector3(0, 0, 1);
		const ballVelXZ = new BABYLON.Vector3(
			ballVelocity.x,
			0,
			ballVelocity.z
		);
		const incomingSpeed = ballVelXZ.length();
		let baseDirection = basisNormal.clone();
		let baseAngle = 0;

		if (incomingSpeed > 1e-6) {
			const incomingDir = new BABYLON.Vector3(
				ballVelXZ.x / incomingSpeed,
				0,
				ballVelXZ.z / incomingSpeed
			);
			const normal3D = surfaceNormal3D;
			const dot = BABYLON.Vector3.Dot(incomingDir, normal3D);
			const reflection3D = incomingDir.subtract(normal3D.scale(2 * dot));
			const reflectionXZ = new BABYLON.Vector3(
				reflection3D.x,
				0,
				reflection3D.z
			);
			if (reflectionXZ.lengthSquared() > 1e-6) {
				baseDirection = reflectionXZ.normalize();
			}
		} else if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`⚠️ Ball velocity too small for reliable reflection; defaulting to paddle normal`
			);
		}

		baseAngle = this.signedAngleXZ(basisNormal, baseDirection);

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🎯 Base reflection angle: ${(
					(baseAngle * 180) /
					Math.PI
				).toFixed(1)}° relative to paddle normal`
			);
		}

		let targetAngle = baseAngle;
		let velocityAdjustment = 0;
		let desiredDirection: BABYLON.Vector3 | null = null;

		// ====== DEBUG: Verify we're detecting the right mode ======
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🚨 COLLISION DEBUG: activePlayerCount = ${this.playerCount}, paddleIndex = ${paddleIndex}, hasPaddleVelocity = ${hasPaddleVelocity}`
			);
			this.conditionalLog(
				`🚨 velocityRatio = ${velocityRatio.toFixed(3)}, paddleVelAlongAxis = ${paddleVelAlong.toFixed(3)}`
			);
		}

		if (hasPaddleVelocity) {
			// MOVING PADDLE: return angle proportional to paddle speed direction
			const scaledRatio = Math.max(
				-1,
				Math.min(1, velocityRatio * this.BALL_ANGLE_MULTIPLIER)
			);
			const shapedRatio =
				Math.sign(scaledRatio) * Math.sqrt(Math.abs(scaledRatio));
			let velocityBasedAngle = shapedRatio * this.ANGULAR_RETURN_LIMIT;

			// 🔒 CLAMP: Ensure velocity-based angle respects angular return limit
			velocityBasedAngle = Math.max(
				-this.ANGULAR_RETURN_LIMIT,
				Math.min(this.ANGULAR_RETURN_LIMIT, velocityBasedAngle)
			);

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🎯 MOVING PADDLE ANGULAR EFFECT: velocity=${paddleVelAlong.toFixed(
						2
					)} (${velocityRatio.toFixed(3)} of max), raw angle=${(
						(velocityBasedAngle * 180) /
						Math.PI
					).toFixed(1)}°`
				);
			}

			let effectiveVelocityAngle = velocityBasedAngle;
			if (
				this.playerCount === 3 &&
				(paddleIndex === 1 || paddleIndex === 2)
			) {
				effectiveVelocityAngle = -velocityBasedAngle;
				this.conditionalLog(
					`🔄 3P Mode velocity flip for Player ${paddleIndex + 1}: ${(
						(velocityBasedAngle * 180) /
						Math.PI
					).toFixed(1)}° → ${(
						(effectiveVelocityAngle * 180) /
						Math.PI
					).toFixed(1)}°`
				);
			} else if (
				this.playerCount === 4 &&
				(paddleIndex === 2 || paddleIndex === 3)
			) {
				effectiveVelocityAngle = -velocityBasedAngle;
				this.conditionalLog(
					`🔄 4P side paddle velocity flip: ${(
						(velocityBasedAngle * 180) /
						Math.PI
					).toFixed(
						1
					)}° → ${((effectiveVelocityAngle * 180) / Math.PI).toFixed(1)}°`
				);
			}

			velocityAdjustment = effectiveVelocityAngle;
			targetAngle = effectiveVelocityAngle;
		} else {
			// STATIONARY PADDLE: Physics-based reflection with angular limit
			const ballVelNormalized = ballVelocity.normalize();
			this.conditionalLog(
				`  - Ball velocity: (${ballVelNormalized.x.toFixed(3)}, ${ballVelNormalized.y.toFixed(3)}, ${ballVelNormalized.z.toFixed(3)})`
			);
			this.conditionalLog(
				`  - Paddle normal: (${surfaceNormal3D.x.toFixed(3)}, ${surfaceNormal3D.y.toFixed(3)}, ${surfaceNormal3D.z.toFixed(3)})`
			);
			const dotProduct = BABYLON.Vector3.Dot(
				ballVelNormalized,
				surfaceNormal3D
			);
			this.conditionalLog(
				`  - Dot product (ball·normal): ${dotProduct.toFixed(3)}`
			);

			// Calculate perfect physics reflection
			const perfectReflection = ballVelNormalized.subtract(
				surfaceNormal3D.scale(2 * dotProduct)
			);
			this.conditionalLog(
				`  - Perfect reflection: (${perfectReflection.x.toFixed(3)}, ${perfectReflection.y.toFixed(3)}, ${perfectReflection.z.toFixed(3)})`
			);

			// === 2D REFLECTION LOGIC ===
			// Check angle of perfect reflection from normal
			const reflectionDot = BABYLON.Vector3.Dot(
				perfectReflection,
				surfaceNormal3D
			);
			const reflectionAngle = Math.acos(Math.abs(reflectionDot));

			this.conditionalLog(
				`  - Perfect reflection angle from normal: ${((reflectionAngle * 180) / Math.PI).toFixed(1)}°`
			);
			this.conditionalLog(
				`  - Angular return limit: ${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
			);

			if (reflectionAngle <= this.ANGULAR_RETURN_LIMIT) {
				// Ball approach angle is within limits - use perfect reflection
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`✅ Using perfect reflection (incoming angle within limits)`
					);
				}
			} else {
				this.conditionalLog(
					`🔒 Clamping reflection: ${((reflectionAngle * 180) / Math.PI).toFixed(1)}° → ${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
				);
			}
		}

		const rotationMatrix = BABYLON.Matrix.RotationAxis(
			BABYLON.Vector3.Up(),
			targetAngle
		);
		const rotatedDirection = BABYLON.Vector3.TransformCoordinates(
			basisNormal,
			rotationMatrix
		).normalize();
		desiredDirection = new BABYLON.Vector3(
			rotatedDirection.x,
			0,
			rotatedDirection.z
		);

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🎯 Target angle after velocity adjustment: ${(
					(targetAngle * 180) /
					Math.PI
				).toFixed(1)}° (base ${((baseAngle * 180) / Math.PI).toFixed(
					1
				)}°, velocity ${((velocityAdjustment * 180) / Math.PI).toFixed(1)}°)`
			);
		}

		if (!desiredDirection || desiredDirection.lengthSquared() < 1e-6) {
			desiredDirection = basisNormal.clone();
		}

		const requestedAngle = this.signedAngleXZ(
			basisNormal,
			desiredDirection.normalize()
		);
		const limitedAngle = Math.max(
			-this.ANGULAR_RETURN_LIMIT,
			Math.min(this.ANGULAR_RETURN_LIMIT, requestedAngle)
		);
		if (
			Math.abs(limitedAngle - requestedAngle) > 1e-4 &&
			GameConfig.isDebugLoggingEnabled()
		) {
			this.conditionalLog(
				`🛡️ Angular clamp enforced: requested ${((requestedAngle * 180) / Math.PI).toFixed(1)}°, clamped to ${((limitedAngle * 180) / Math.PI).toFixed(1)}°`
			);
		}
		const limitedMatrix = BABYLON.Matrix.RotationAxis(
			BABYLON.Vector3.Up(),
			limitedAngle
		);
		finalDirection = BABYLON.Vector3.TransformCoordinates(
			basisNormal,
			limitedMatrix
		).normalize();
		const angleFromNormal = Math.abs(limitedAngle);

		this.conditionalLog(
			`🎯 Final direction (enforced): (${finalDirection.x.toFixed(3)}, ${finalDirection.y.toFixed(3)}, ${finalDirection.z.toFixed(3)})`
		);
		this.conditionalLog(
			`🎯 Final angle from normal (enforced): ${((angleFromNormal * 180) / Math.PI).toFixed(1)}° (limit ±${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°)`
		);
		this.conditionalLog('[AngularLimit]', {
			requestedAngleDeg: (requestedAngle * 180) / Math.PI,
			limitedAngleDeg: (limitedAngle * 180) / Math.PI,
			finalDirection: {
				x: finalDirection.x,
				y: finalDirection.y,
				z: finalDirection.z,
			},
			limitDeg: (this.ANGULAR_RETURN_LIMIT * 180) / Math.PI,
			paddleIndex,
			hasPaddleVelocity,
		});

		// Increment rally speed - globally throttled by time and distance traveled
		const rallyIntervalMs = GameConfig.getMinRallyIncrementIntervalMs();
		const rallyDistance = GameConfig.getMinRallyIncrementDistance();

		let allowIncrement =
			now - this.lastRallyIncrementTimeGlobalMs >= rallyIntervalMs;

		const currentBallPosXZ = new BABYLON.Vector3(
			this.ballMesh.position.x,
			0,
			this.ballMesh.position.z
		);
		if (this.lastRallyIncrementPosXZ) {
			const dx = currentBallPosXZ.x - this.lastRallyIncrementPosXZ.x;
			const dz = currentBallPosXZ.z - this.lastRallyIncrementPosXZ.z;
			const dist = Math.hypot(dx, dz);
			allowIncrement = allowIncrement && dist >= rallyDistance;
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`⏱️/📏 Increment gating: dt=${(
						now - this.lastRallyIncrementTimeGlobalMs
					).toFixed(
						1
					)}ms, dist=${dist.toFixed(2)} (min ${rallyDistance})`
				);
			}
		}

		if (allowIncrement) {
			this.ballEffects.incrementRallyHit();
			this.lastRallyIncrementTimeGlobalMs = now;
			this.lastRallyIncrementPosXZ = currentBallPosXZ;
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🚀 Rally speed incremented (global throttle ok)`
				);
			}
		} else {
			// Skip increment but still clamp to current target speed via newVelocity below
			if (GameConfig.isDebugLoggingEnabled()) {
				const deltaMs = (
					now - this.lastRallyIncrementTimeGlobalMs
				).toFixed(1);
				this.conditionalLog(
					`⏱️/📏 Rally increment throttled (Δt=${deltaMs}ms < ${rallyIntervalMs}ms or moved < ${rallyDistance})`
				);
			}
		}

		// Apply the new velocity with rally-adjusted speed
		const directionForVelocity = finalDirection ?? basisNormal.clone();
		const newVelocity = directionForVelocity.scale(
			this.ballEffects.getCurrentBallSpeed()
		);

		// Ensure Y component stays zero (2D movement only)
		newVelocity.y = 0;

		// Re-normalize after zeroing Y component to maintain correct angle
		if (newVelocity.length() > 0) {
			newVelocity
				.normalize()
				.scaleInPlace(this.ballEffects.getCurrentBallSpeed());
		}

		this.conditionalLog(
			`🎯 Velocity after Y-zero: (${newVelocity.x.toFixed(3)}, ${newVelocity.y.toFixed(3)}, ${newVelocity.z.toFixed(3)})`
		);

		// Apply the modified velocity
		ballImpostor.setLinearVelocity(newVelocity);

		// Position correction: ensure ball is outside paddle to prevent pass-through
		// Move ball slightly away from paddle surface along the paddle normal
		const paddleToBall = ballPosition.subtract(paddlePosition);

		// Project onto paddle normal to get distance from paddle face
		const ballRadius = Pong3D.BALL_RADIUS;
		let paddleThickness = 0.2;
		const paddleBoundingInfo = paddle.getBoundingInfo();
		if (paddleBoundingInfo) {
			const extents = paddleBoundingInfo.boundingBox.extendSizeWorld;
			const minHalfExtent = Math.min(extents.x, extents.y, extents.z);
			if (isFinite(minHalfExtent) && minHalfExtent > 0) {
				paddleThickness = Math.max(minHalfExtent * 2, 0.05);
			}
		}
		const minSeparation = ballRadius + paddleThickness * 0.5 + 0.02;

		// Gentle position correction - only if ball is too close
		const currentDistance = Math.abs(
			BABYLON.Vector3.Dot(paddleToBall, paddleNormal)
		);
		if (currentDistance < minSeparation) {
			const correctionDistance = minSeparation - currentDistance + 0.02; // Small additional buffer
			const correction = paddleNormal.scale(correctionDistance);
			// Determine which mesh this impostor belongs to (main or split)
			let targetMesh: BABYLON.Mesh | null = this.ballMesh;
			if (this.isSplitBallImpostor(ballImpostor)) {
				const found = this.splitBalls.find(
					b => b.impostor === ballImpostor
				);
				if (found) targetMesh = found.mesh;
			}
			if (targetMesh) {
				targetMesh.position = ballPosition.add(correction);
				// Also update physics impostor position to sync with visual position
				if (ballImpostor.physicsBody) {
					ballImpostor.physicsBody.position.set(
						targetMesh.position.x,
						targetMesh.position.y,
						targetMesh.position.z
					);
				}
			}

			this.conditionalLog(
				`🔧 Position correction applied: ${correctionDistance.toFixed(3)} units along normal`
			);
			if (targetMesh) {
				this.conditionalLog(
					`🔧 Ball moved from (${ballPosition.x.toFixed(3)}, ${ballPosition.y.toFixed(3)}, ${ballPosition.z.toFixed(3)}) to (${targetMesh.position.x.toFixed(3)}, ${targetMesh.position.y.toFixed(3)}, ${targetMesh.position.z.toFixed(3)})`
				);
			}
		} else {
			this.conditionalLog(
				`🔧 No position correction needed - current distance: ${currentDistance.toFixed(3)}, minimum: ${minSeparation.toFixed(3)}`
			);
		}
		if (hasPaddleVelocity) {
			// Apply spin to the correct ball instance
			if (this.isSplitBallImpostor(ballImpostor)) {
				this.ballManager.applySpinToBall(ballImpostor, paddleVelocity);
			} else if (this.mainBallEntity) {
				this.mainBallEntity.applySpinFromPaddle(paddleVelocity);
			} else {
				this.ballEffects.applySpinFromPaddle(paddleVelocity);
			}
		} else {
			// Stationary paddle - no new spin added, but preserve existing spin
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🌪️ Stationary paddle - preserving existing spin`
				);
			}
		}
		if (this.debugPaddleLogging || this.playerCount === 3) {
			this.conditionalLog(
				`Ball-Paddle Collision: Player ${paddleIndex + 1} (${hasPaddleVelocity ? 'Moving' : 'Stationary'} paddle)`
			);
			if (this.playerCount === 3) {
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				this.conditionalLog(
					`  - Paddle angle: ${((angles[paddleIndex] * 180) / Math.PI).toFixed(1)}°`
				);
				this.conditionalLog(
					`  - Paddle normal: (${paddleNormal.x.toFixed(2)}, ${paddleNormal.z.toFixed(2)})`
				);
			}
			this.conditionalLog(
				`  - Paddle velocity: ${paddleVelAlong.toFixed(2)} (ratio: ${velocityRatio.toFixed(2)})`
			);
			if (hasPaddleVelocity) {
				const velocityBasedAngle =
					velocityRatio * this.ANGULAR_RETURN_LIMIT;
				this.conditionalLog(
					`  - Velocity-based angle: ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}°`
				);
			} else {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`  - Using reflection with angular limit`
					);
				}
			}
			this.conditionalLog(
				`  - Final direction: (${directionForVelocity.x.toFixed(2)}, ${directionForVelocity.z.toFixed(2)})`
			);
			this.conditionalLog(
				`  - New velocity: (${newVelocity.x.toFixed(2)}, ${newVelocity.z.toFixed(2)})`
			);
		}
	}

	private detectMissedPaddleContacts(): void {
		if (this.gameMode !== 'local' && this.gameMode !== 'master') {
			return;
		}

		const ballImpostors = this.getActiveBallImpostors();
		if (ballImpostors.length === 0) {
			this.ballPositionHistory.clear();
			return;
		}

		const activeKeys = new Set<number>();
		for (const ballImpostor of ballImpostors) {
			const ballMesh = this.getMeshForBallImpostor(ballImpostor);
			if (!ballMesh) continue;
			const currentPosition = ballMesh.getAbsolutePosition();
			const key = this.getBallImpostorKey(ballImpostor);
			if (key === null) continue;

			activeKeys.add(key);

			const previous = this.ballPositionHistory.get(key);
			if (previous) {
				const handled = this.checkSegmentAgainstPaddles(
					previous,
					currentPosition,
					ballImpostor
				);
				const updatedMesh = this.getMeshForBallImpostor(ballImpostor);
				const finalPosition =
					handled && updatedMesh
						? updatedMesh.getAbsolutePosition()
						: currentPosition;
				this.ballPositionHistory.set(key, finalPosition.clone());
			} else {
				this.ballPositionHistory.set(key, currentPosition.clone());
			}
		}

		for (const key of Array.from(this.ballPositionHistory.keys())) {
			if (!activeKeys.has(key)) {
				this.ballPositionHistory.delete(key);
			}
		}
	}

	private getBallImpostorKey(
		impostor: BABYLON.PhysicsImpostor
	): number | null {
		const body: any = impostor.physicsBody;
		if (body && typeof body.id === 'number') {
			return body.id as number;
		}
		const obj = impostor.object as BABYLON.AbstractMesh | undefined;
		if (obj) {
			return obj.uniqueId;
		}
		return null;
	}

	private getMeshForBallImpostor(
		impostor: BABYLON.PhysicsImpostor
	): BABYLON.Mesh | null {
		const obj = impostor.object;
		if (obj instanceof BABYLON.Mesh) {
			return obj;
		}
		if (this.ballMesh?.physicsImpostor === impostor) {
			return this.ballMesh;
		}
		const split = this.splitBalls.find(ball => ball.impostor === impostor);
		return split?.mesh ?? null;
	}

	private checkSegmentAgainstPaddles(
		previous: BABYLON.Vector3,
		current: BABYLON.Vector3,
		ballImpostor: BABYLON.PhysicsImpostor
	): boolean {
		if (this.goalScored || this.gameEnded) {
			return false;
		}

		const radius = Pong3D.BALL_RADIUS;
		const segment = current.subtract(previous);
		if (segment.lengthSquared() < 1e-6) {
			return false;
		}

		for (let i = 0; i < this.playerCount; i++) {
			const paddle = this.paddles[i];
			const paddleImpostor = paddle?.physicsImpostor;
			if (!paddle || !paddleImpostor) continue;

			const normal = this.getPaddleNormal(paddle, i);
			if (!normal) continue;

			const plane = BABYLON.Plane.FromPositionAndNormal(
				paddle.getAbsolutePosition(),
				normal
			);
			const previousDistance = plane.signedDistanceTo(previous);
			const currentDistance = plane.signedDistanceTo(current);

			if (!(previousDistance > radius && currentDistance < -radius)) {
				continue;
			}

			const denom = currentDistance - previousDistance;
			if (Math.abs(denom) < 1e-6) continue;

			const targetDistance = Math.sign(previousDistance || 1) * radius;
			const t =
				(previousDistance - targetDistance) /
				(previousDistance - currentDistance);
			if (!isFinite(t) || t < 0 || t > 1) {
				continue;
			}

			const contactPoint = BABYLON.Vector3.Lerp(previous, current, t);
			if (!this.pointWithinPaddleBounds(contactPoint, paddle, radius)) {
				continue;
			}

			const directionSign = Math.sign(previousDistance || 1);
			this.resolveMissedPaddleHit(
				ballImpostor,
				paddleImpostor,
				paddle,
				contactPoint,
				normal,
				directionSign
			);
			return true;
		}

		return false;
	}

	private pointWithinPaddleBounds(
		point: BABYLON.Vector3,
		paddle: BABYLON.Mesh,
		margin: number
	): boolean {
		try {
			const inverse = paddle.getWorldMatrix().clone();
			inverse.invert();
			const localPoint = BABYLON.Vector3.TransformCoordinates(
				point,
				inverse
			);
			const bounds = paddle.getBoundingInfo();
			const min = bounds.minimum;
			const max = bounds.maximum;
			const tolerance = margin + 0.01;
			return (
				localPoint.x >= min.x - tolerance &&
				localPoint.x <= max.x + tolerance &&
				localPoint.y >= min.y - tolerance &&
				localPoint.y <= max.y + tolerance &&
				localPoint.z >= min.z - tolerance &&
				localPoint.z <= max.z + tolerance
			);
		} catch (error) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalWarn(
					'Failed to evaluate paddle bounds for missed collision check',
					error
				);
			}
			return true;
		}
	}

	private resolveMissedPaddleHit(
		ballImpostor: BABYLON.PhysicsImpostor,
		paddleImpostor: BABYLON.PhysicsImpostor,
		paddle: BABYLON.Mesh,
		contactPoint: BABYLON.Vector3,
		normal: BABYLON.Vector3,
		directionSign: number
	): void {
		const safeOffset = normal.scale(
			directionSign * (Pong3D.BALL_RADIUS + 0.01)
		);
		const correctedPosition = contactPoint.add(safeOffset);

		if (!isFinite(correctedPosition.y)) {
			correctedPosition.y = this.baseBallY;
		}
		if (Math.abs(correctedPosition.y - this.baseBallY) > 0.001) {
			correctedPosition.y = this.baseBallY;
		}

		const ballMesh = this.getMeshForBallImpostor(ballImpostor);
		if (ballMesh) {
			ballMesh.position.copyFrom(correctedPosition);
		}
		if (ballImpostor.physicsBody) {
			ballImpostor.physicsBody.position.set(
				correctedPosition.x,
				correctedPosition.y,
				correctedPosition.z
			);
		}

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`⚠️ Missed paddle collision corrected for ${paddle.name} (ball repositioned to ${correctedPosition.x.toFixed(3)}, ${correctedPosition.y.toFixed(3)}, ${correctedPosition.z.toFixed(3)})`
			);
		}

		this.handleBallPaddleCollision(ballImpostor, paddleImpostor);
	}

	private computeWallNormal(
		position: BABYLON.Vector3
	): BABYLON.Vector3 | null {
		if (
			this.boundsXMin === null ||
			this.boundsXMax === null ||
			this.boundsZMin === null ||
			this.boundsZMax === null
		)
			return null;

		const distances = [
			{
				value: Math.abs(position.x - this.boundsXMin),
				normal: new BABYLON.Vector3(1, 0, 0),
			},
			{
				value: Math.abs(position.x - this.boundsXMax),
				normal: new BABYLON.Vector3(-1, 0, 0),
			},
			{
				value: Math.abs(position.z - this.boundsZMin),
				normal: new BABYLON.Vector3(0, 0, 1),
			},
			{
				value: Math.abs(position.z - this.boundsZMax),
				normal: new BABYLON.Vector3(0, 0, -1),
			},
		];

		distances.sort((a, b) => a.value - b.value);
		return distances[0]?.normal ?? null;
	}

	private handleBallWallCollision(
		ballImpostor: BABYLON.PhysicsImpostor,
		_wallImpostor: BABYLON.PhysicsImpostor
	): void {
		const currentTime = performance.now();

		// Debounce wall collisions to prevent rapid-fire bouncing
		if (
			currentTime - this.lastWallCollisionTime <
			this.WALL_COLLISION_COOLDOWN_MS
		) {
			return; // Ignore collision if too soon after last one
		}

		// Track rapid collisions - reset count every 500ms
		if (currentTime - this.wallCollisionResetTime > 500) {
			this.wallCollisionCount = 0;
			this.wallCollisionResetTime = currentTime;
		}
		this.wallCollisionCount++;

		this.lastWallCollisionTime = currentTime;

		this.conditionalLog(
			`🧱 Ball-Wall Collision detected (count: ${this.wallCollisionCount})`
		);

		// Play pitched-down ping sound for wall collision with harmonic variation
		this.audioSystem.playSoundEffectWithHarmonic('ping', 'wall');

		// Send sound effect to clients (Master mode only)
		this.sendSoundEffectToClients(Pong3D.SOUND_WALL);

		// Corner handling: if near a convex corner (near X and Z bounds),
		// reflect velocity about the corner bisector to avoid unstable normals.
		const collisionMesh =
			(ballImpostor.object as BABYLON.Mesh | undefined) || this.ballMesh;

		if (
			this.boundsXMin !== null &&
			this.boundsXMax !== null &&
			this.boundsZMin !== null &&
			this.boundsZMax !== null &&
			collisionMesh
		) {
			const pos = collisionMesh.position;
			const eps = 0.25; // proximity threshold to consider as at-boundary
			const nearXMin = Math.abs(pos.x - this.boundsXMin) < eps;
			const nearXMax = Math.abs(pos.x - this.boundsXMax) < eps;
			const nearZMin = Math.abs(pos.z - this.boundsZMin) < eps;
			const nearZMax = Math.abs(pos.z - this.boundsZMax) < eps;

			const nx = nearXMin ? 1 : nearXMax ? -1 : 0;
			const nz = nearZMin ? 1 : nearZMax ? -1 : 0;

			if (nx !== 0 && nz !== 0) {
				const v = ballImpostor.getLinearVelocity();
				if (v && Math.abs(v.x) + Math.abs(v.z) > 1e-4) {
					const n = new BABYLON.Vector3(nx, 0, nz).normalize();
					const vXZ = new BABYLON.Vector3(v.x, 0, v.z);
					const dot = BABYLON.Vector3.Dot(vXZ, n);
					const reflected = vXZ.subtract(n.scale(2 * dot));
					ballImpostor.setLinearVelocity(
						new BABYLON.Vector3(reflected.x, 0, reflected.z)
					);
					// Nudge out along bisector to prevent re-colliding this frame
					const nudge = n.scale(0.15);
					collisionMesh.position = collisionMesh.position.add(nudge);
					if (ballImpostor.physicsBody) {
						ballImpostor.physicsBody.position.set(
							collisionMesh.position.x,
							collisionMesh.position.y,
							collisionMesh.position.z
						);
					}
				}
			}
		}

		// // Position correction: move ball slightly away from wall to prevent embedding
		// if (this.ballMesh && ballImpostor) {
		// 	const velocity = ballImpostor.getLinearVelocity();
		// 	if (velocity && velocity.length() > 0) {
		// 		// Move ball in direction of velocity (away from wall)
		// 		// Use gentle correction to avoid physics instability
		// 		const correctionDistance = 0.15; // Small, consistent correction
		// 		const correctionVector = velocity
		// 			.normalize()
		// 			.scale(correctionDistance);
		// 		const newPosition =
		// 			this.ballMesh.position.add(correctionVector);
		// 		this.ballMesh.position = newPosition;

		// 		// If too many rapid wall collisions, apply velocity damping
		// 		if (this.wallCollisionCount > 3) {
		// 			this.conditionalLog(
		// 				`🚫 Rapid wall collisions detected - applying velocity damping`
		// 			);
		// 			const dampedVel = velocity.scale(0.8); // Reduce velocity by 20%
		// 			ballImpostor.setLinearVelocity(dampedVel);
		// 		}
		// 	}
		// }

		// Preserve spin with configurable reduction only
		this.ballEffects.applyWallSpinFriction(
			GameConfig.getWallSpinFriction()
		);

		const velocity = ballImpostor.getLinearVelocity();
		if (velocity) {
			const velocityXZ = new BABYLON.Vector3(velocity.x, 0, velocity.z);
			const speed = velocityXZ.length();
			if (speed > 0.0001 && collisionMesh) {
				const normal = this.computeWallNormal(collisionMesh.position);
				if (normal) {
					const normalizedVelocity = velocityXZ.normalize();
					const dot = BABYLON.Vector3.Dot(normalizedVelocity, normal);
					const angle = Math.acos(BABYLON.Scalar.Clamp(dot, -1, 1));
					const ninety = Math.PI / 2;
					const threshold =
						GameConfig.getWallNearParallelAngleThreshold();
					const adjustment =
						GameConfig.getWallNearParallelAngleAdjustment();
					const maxAngle = GameConfig.getWallNearParallelMaxAngle();
					const isObtuse = angle >= ninety;
					const deltaFromParallel = Math.abs(ninety - angle);
					if (deltaFromParallel <= threshold) {
						const rawTangent = normalizedVelocity.subtract(
							normal.scale(dot)
						);
						let tangentDir = rawTangent;
						if (tangentDir.lengthSquared() < 1e-6) {
							// Head-on collision: derive a consistent tangent from velocity first, then fall back to axes
							tangentDir = BABYLON.Vector3.Cross(
								normal,
								normalizedVelocity
							);
							if (tangentDir.lengthSquared() < 1e-6) {
								tangentDir = BABYLON.Vector3.Cross(
									normal,
									BABYLON.Axis.Y
								);
								if (tangentDir.lengthSquared() < 1e-6) {
									tangentDir = BABYLON.Vector3.Cross(
										normal,
										BABYLON.Axis.X
									);
								}
							}
						}
						if (tangentDir.lengthSquared() >= 1e-6) {
							const tangentNormalized = tangentDir.normalize();
							let orientation = Math.sign(
								BABYLON.Vector3.Dot(
									normalizedVelocity,
									tangentNormalized
								)
							);
							if (orientation === 0) orientation = 1;

							const reducedDelta = Math.max(
								0,
								deltaFromParallel - adjustment
							);
							const cappedAngle = Math.min(
								maxAngle,
								ninety - 1e-3
							);
							const desiredDeviation = Math.max(
								reducedDelta,
								ninety - cappedAngle,
								1e-3
							);
							const targetAngle = isObtuse
								? ninety + desiredDeviation
								: ninety - desiredDeviation;

							const cosTarget = Math.cos(targetAngle);
							const sinTarget = Math.sin(targetAngle);
							const adjustedDir = normal
								.scale(cosTarget)
								.add(
									tangentNormalized.scale(
										sinTarget * orientation
									)
								);
							const adjusted = adjustedDir
								.normalize()
								.scale(speed);
							this.conditionalLog(
								`⬅️ Wall angle nudged: current=${((angle * 180) / Math.PI).toFixed(2)}°, target=${((targetAngle * 180) / Math.PI).toFixed(2)}°`
							);
							ballImpostor.setLinearVelocity(
								new BABYLON.Vector3(adjusted.x, 0, adjusted.z)
							);
						} else {
							this.conditionalLog(
								`⛔ Wall angle adjustment skipped (no tangent basis). current=${((angle * 180) / Math.PI).toFixed(2)}°`
							);
						}
					}
				}
			}
		}
		this.conditionalLog(
			`🌪️ Wall collision: Spin reduced by friction, new spin: ${this.ballEffects.getBallSpin().y.toFixed(2)}`
		);

		// Enforce minimum speed immediately after collision to avoid visible slowdowns
		const v = ballImpostor.getLinearVelocity();
		if (v) {
			const target = this.ballEffects.getCurrentBallSpeed();
			const xz = new BABYLON.Vector3(v.x, 0, v.z);
			const spd = xz.length();
			if (spd < target - 0.01 && spd > 0.0001) {
				const scaled = xz.scale(target / spd);
				ballImpostor.setLinearVelocity(
					new BABYLON.Vector3(scaled.x, 0, scaled.z)
				);
			}
		}
	}

	private clearRecentHitters(): void {
		this.recentHitterHistory.length = 0;
	}

	private recordRecentHitter(paddleIndex: number): void {
		if (paddleIndex < 0) return;
		const lastEntry =
			this.recentHitterHistory[this.recentHitterHistory.length - 1];
		if (lastEntry === paddleIndex) return;
		this.recentHitterHistory.push(paddleIndex);
		const overflow =
			this.recentHitterHistory.length -
			Pong3D.RECENT_HITTER_HISTORY_LIMIT;
		if (overflow > 0) {
			this.recentHitterHistory.splice(0, overflow);
		}
	}

	private findRecentNonGoalHitter(goalPlayer: number): number | null {
		for (let i = this.recentHitterHistory.length - 1; i >= 0; i--) {
			const candidate = this.recentHitterHistory[i];
			if (candidate !== goalPlayer && candidate !== -1) {
				return candidate;
			}
		}
		return null;
	}

	private handleGoalCollision(
		goalIndex: number,
		triggeringBall?: BABYLON.PhysicsImpostor | null
	): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🏆 GOAL COLLISION DETECTED! Goal index: ${goalIndex}`
			);
		}

		const wasSplitTrigger =
			triggeringBall && this.isSplitBallImpostor(triggeringBall);
		// Do NOT remove the split ball here; allow it to continue to boundary for the post-goal delay

		// Store the conceding player for serve system
		this.lastConcedingPlayer = goalIndex;

		// Check cooldown to prevent multiple triggers
		const currentTime = performance.now();
		if (currentTime - this.lastGoalTime < this.GOAL_COOLDOWN_MS) {
			this.conditionalLog(`Goal on cooldown, ignoring collision`);
			return;
		}

		// goalIndex is the player whose goal was hit (they conceded)
		// Determine last hitters based on the ball that triggered the goal
		let ballLast = this.lastPlayerToHitBall;
		let ballSecondLast = this.secondLastPlayerToHitBall;
		if (triggeringBall && this.isSplitBallImpostor(triggeringBall)) {
			const e = this.ballManager.findByImpostor(triggeringBall);
			if (e) {
				ballLast = e.getLastHitter();
				ballSecondLast = e.getSecondLastHitter();
			}
		} else if (this.mainBallEntity) {
			ballLast = this.mainBallEntity.getLastHitter();
			ballSecondLast = this.mainBallEntity.getSecondLastHitter();
		}

		// Check for own goals using per-ball last hitters
		let scoringPlayer = ballLast;
		const goalPlayer = goalIndex;
		let wasOwnGoal = false;
		let wasDirectServeOwnGoal = false;

		this.conditionalLog(`Last player to hit triggering ball: ${ballLast}`);
		this.conditionalLog(
			`Second last player to hit triggering ball: ${ballSecondLast}`
		);
		this.conditionalLog(`Goal player (conceding): ${goalPlayer}`);
		this.conditionalLog(`Current scores before goal:`, this.playerScores);

		// Check for own goal: if the player who last hit the ball is the same as the goal player
		if (scoringPlayer === goalPlayer) {
			wasOwnGoal = true;
			// For own goals, pick a random server from players that have paddles
			const validServers = [];
			for (let i = 0; i < this.playerCount; i++) {
				if (this.paddles[i]) {
					validServers.push(i);
				}
			}
			if (validServers.length > 0) {
				this.currentServer =
					validServers[
						Math.floor(Math.random() * validServers.length)
					];
			} else {
				// Fallback to random if no valid paddles (shouldn't happen)
				this.currentServer = Math.floor(
					Math.random() * this.playerCount
				);
			}
			this.conditionalLog(
				`🏴 OWN GOAL: Random server selected from ${validServers.length} valid paddles - Player ${this.currentServer + 1} will serve next`
			);

			const fallbackScorer = this.findRecentNonGoalHitter(goalPlayer);

			// Check if this is a direct serve into own goal (no other players hit the ball)
			if (ballSecondLast === -1) {
				if (fallbackScorer !== null) {
					scoringPlayer = fallbackScorer;
					this.conditionalLog(
						`🏴 OWN GOAL! Player ${goalPlayer + 1} scored in their own goal. Awarding point to Player ${scoringPlayer + 1} (recent opponent fallback)`
					);
				} else {
					wasDirectServeOwnGoal = true;
					// Direct serve own goal - no points awarded, but ball still travels to boundary
					this.conditionalLog(
						`🏴 DIRECT SERVE OWN GOAL! Player ${goalPlayer + 1} served directly into their own goal - no point awarded, ball will travel to boundary`
					);
				}
			} else if (ballSecondLast === goalPlayer) {
				if (fallbackScorer !== null) {
					scoringPlayer = fallbackScorer;
					this.conditionalLog(
						`🏴 OWN GOAL! Player ${goalPlayer + 1} scored in their own goal. Awarding point to Player ${scoringPlayer + 1} (fallback recent hitter)`
					);
				} else {
					wasDirectServeOwnGoal = true;
					this.conditionalLog(
						`🏴 OWN GOAL! Player ${goalPlayer + 1} scored in their own goal but no eligible opponent was recorded - no point awarded`
					);
				}
			} else {
				// Normal own goal after rally - award to second last player of triggering ball
				scoringPlayer = ballSecondLast;
				this.conditionalLog(
					`🏴 OWN GOAL! Player ${goalPlayer + 1} scored in their own goal. Awarding point to Player ${scoringPlayer + 1} (second last hitter)`
				);
			}
		}

		// Skip scoring only for direct-serve own goals (server never lost possession)
		if (
			wasOwnGoal &&
			wasDirectServeOwnGoal &&
			this.currentServer === goalPlayer &&
			ballLast === this.currentServer &&
			ballSecondLast === -1
		) {
			this.conditionalLog(
				`🏓 DIRECT SERVE OWN GOAL by Player ${goalPlayer + 1} - no point awarded`
			);
			this.currentServer = goalPlayer;
			this.secondLastPlayerToHitBall = -1;
			this.clearRecentHitters();
			this.lastGoalTime = performance.now();
		}

		// Check if the same player hit the ball twice in a row - no point awarded (except own goals)
		if (
			!wasOwnGoal &&
			scoringPlayer === ballSecondLast &&
			scoringPlayer !== -1
		) {
			this.conditionalLog(
				`🚫 DOUBLE HIT! Player ${scoringPlayer + 1} hit the ball twice in a row - no point awarded`
			);
			// Skip awarding the point and just reset for next rally
			this.currentServer = goalPlayer; // Conceding player serves next
			this.secondLastPlayerToHitBall = -1;
			this.clearRecentHitters();
			this.lastGoalTime = performance.now();
			this.handleSplitBallAfterGoal(triggeringBall);
			return; // Exit without awarding points
		}

		if (scoringPlayer === -1) {
			// Ball went into goal without being hit - award to conceding player
			scoringPlayer = goalPlayer;
			this.conditionalLog(
				`Ball went into goal without being hit - awarding to conceding player ${scoringPlayer + 1}`
			);
		}

		// Play goal sound effect
		this.audioSystem.playSoundEffect('goal');

		// Special scoring: local tournament 3p/4p (conceding player loses a point)
		const isLocalTournamentSpecial =
			sessionStorage.getItem('gameMode') === 'local' &&
			sessionStorage.getItem('tournament') === '1' &&
			this.playerCount >= 2 &&
			this.playerCount <= 4;

		if (isLocalTournamentSpecial) {
			// Penalize conceding player
			this.playerScores[goalPlayer] = Math.max(
				0,
				this.playerScores[goalPlayer] - 1
			);
			// Red glow for point lost
			this.flashPaddleGlow(goalPlayer + 1, 1500, false);
			this.conditionalLog(
				`Tournament scoring: Player ${goalPlayer + 1} loses a point ->`,
				this.playerScores
			);
		} else {
			// Original scoring: award point to scoring player (skip for direct-serve own goals)
			if (!wasDirectServeOwnGoal) {
				this.conditionalLog(
					`Awarding point to player ${scoringPlayer}...`
				);
				this.playerScores[scoringPlayer]++;
				this.flashPaddleGlow(scoringPlayer + 1);
				this.conditionalLog(
					`New scores after goal:`,
					this.playerScores
				);

				// Send score update to clients (only in master mode)
				this.conditionalLog(
					'🏆 sendScoreUpdateToClients called with scoringPlayer:',
					scoringPlayer
				);
				this.sendScoreUpdateToClients(scoringPlayer);
			} else {
				this.conditionalLog(
					`🏴 OWN GOAL: Skipping point award (no eligible opponent to credit)`
				);
			}
		}

		// Check for end-of-round conditions
		if (isLocalTournamentSpecial && this.playerScores[goalPlayer] <= 0) {
			// Eliminate conceding player and end round
			this.conditionalLog(
				`🏁 Elimination reached: Player ${goalPlayer + 1} hit 0`
			);

			// Play victory sound effect
			this.audioSystem.playSoundEffect('victory');

			// Mark game as ended and stop systems
			this.gameEnded = true;
			const physicsEngine = this.scene.getPhysicsEngine();
			if (physicsEngine) {
				this.scene.disablePhysicsEngine();
				this.conditionalLog(`🏆 Physics engine disabled - elimination`);
			}
			if (this.gameLoop) {
				this.gameLoop.stop();
			}

			// Update UI and handle tournament elimination flow
			this.updatePlayerInfoDisplay();
			const eliminationResult = this.handleLocalTournamentElimination();
			if (
				eliminationResult?.tournamentFinished &&
				this.playerCount === 2
			) {
				let winningIndex = -1;
				for (let i = 0; i < this.playerCount; i++) {
					if (i === goalPlayer) continue;
					if (
						winningIndex === -1 ||
						this.playerScores[i] > this.playerScores[winningIndex]
					) {
						winningIndex = i;
					}
				}
				if (
					winningIndex === -1 &&
					scoringPlayer !== goalPlayer &&
					scoringPlayer < this.playerCount
				) {
					winningIndex = scoringPlayer;
				}
				if (winningIndex !== -1) {
					this.handleLocalTournamentVictory(winningIndex);
				} else {
					this.conditionalWarn(
						'Unable to determine tournament winner after elimination'
					);
				}
			}
			const isLocalTournament =
				sessionStorage.getItem('gameMode') === 'local' &&
				sessionStorage.getItem('tournament') === '1';
			const skipModal =
				isLocalTournament &&
				!!eliminationResult &&
				eliminationResult.tournamentFinished;

			if (this.gameMode == 'local' && !skipModal) {
				if (this.gameScreen) {
					if (
						isLocalTournament &&
						eliminationResult?.eliminatedAlias
					) {
						new TextModal(
							this.container,
							`${eliminationResult.eliminatedAlias} was eliminated!`,
							'Next round',
							() => this.gameScreen!.reloadPong()
						);
					} else {
						new ReplayModal(
							this.container,
							'local',
							this.gameScreen
						);
					}
				} else {
					this.conditionalWarn(
						'GameScreen reference not available for Next Round/Replay'
					);
				}
			}

			setTimeout(() => {
				state.gameOngoing = false;
			}, 2000);

			// Reset trackers and return
			this.lastPlayerToHitBall = -1;
			this.secondLastPlayerToHitBall = -1;
			this.clearRecentHitters();
			this.lastGoalTime = performance.now();
			return;
		}

		if (
			!isLocalTournamentSpecial &&
			this.playerScores[scoringPlayer] >= this.WINNING_SCORE
		) {
			// Game over! Player wins
			const playerName =
				this.playerNames[scoringPlayer] ||
				`Player ${scoringPlayer + 1}`;
			this.conditionalLog(
				`🏆 GAME OVER! ${playerName} wins with ${this.WINNING_SCORE} points!`
			);

			// Play victory sound effect
			this.audioSystem.playSoundEffect('victory');

			// Show winner UI
			if (this.uiHandles) {
				this.uiHandles.showWinner(scoringPlayer, playerName);
			}

			// Mark game as ended - disable physics engine instead of just freezing ball
			this.gameEnded = true;

			// Stop the physics engine entirely when game ends (ball will stay in place)
			const physicsEngine = this.scene.getPhysicsEngine();
			if (physicsEngine) {
				this.scene.disablePhysicsEngine();
				this.conditionalLog(`🏆 Physics engine disabled - game ended`);
			}

			// Stop the active game loop so no further updates or network messages are emitted
			if (this.gameLoop) {
				this.gameLoop.stop();
			}

			// Update the UI with final scores
			this.updatePlayerInfoDisplay();

			this.handleLocalTournamentVictory(scoringPlayer);
			const eliminationResult = this.handleLocalTournamentElimination();
			const isLocalTournament =
				sessionStorage.getItem('gameMode') === 'local' &&
				sessionStorage.getItem('tournament') === '1';
			const skipModal =
				isLocalTournament &&
				!!eliminationResult &&
				eliminationResult.tournamentFinished;

			if (this.gameMode == 'local' && !skipModal) {
				if (this.gameScreen) {
					if (
						isLocalTournament &&
						eliminationResult?.eliminatedAlias
					) {
						new TextModal(
							this.container,
							`${eliminationResult.eliminatedAlias} was eliminated!`,
							'Next round',
							() => this.gameScreen!.reloadPong()
						);
					} else {
						new ReplayModal(
							this.container,
							'local',
							this.gameScreen
						);
					}
				} else {
					this.conditionalWarn(
						'GameScreen reference not available for Replay or next round'
					);
				}
			} else if (
				sessionStorage.getItem('gameMode') === 'remote' &&
				sessionStorage.getItem('tournament') === '0'
			) {
				state.replayCounter = 0;
				new ReplayModal(this.container, 'remote');
				// location.hash = '#home';
			}
			// Wait 7 seconds for victory music to finish, then set game status
			setTimeout(() => {
				state.gameOngoing = false;
				this.conditionalLog(
					`🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆 Victory music finished (7 seconds), gameOngoing set to false`
				);
				// if we are in a tournament redirect to tournament page
				if (
					sessionStorage.getItem('gameMode') === 'remote' &&
					sessionStorage.getItem('tournament') === '1'
				) {
					this.conditionalLog(
						'remote game, tourn = 1 -> redirecting to tournament'
					);
					location.hash = '#tournament';
				}
			}, 4500);

			// Call the goal callback for any additional handling
			if (this.onGoalCallback) {
				this.conditionalLog(`Calling goal callback for game end...`);
				this.onGoalCallback(scoringPlayer, goalPlayer);
			}

			// Reset cooldown and last player tracker - game is over
			this.lastPlayerToHitBall = -1;
			this.secondLastPlayerToHitBall = -1;
			this.clearRecentHitters();
			this.lastGoalTime = performance.now();

			// Let the ball continue its natural trajectory and exit bounds
			this.conditionalLog(
				`🏀 Ball will continue and exit naturally - no respawn`
			);
			this.handleSplitBallAfterGoal(triggeringBall);
			return;
		}

		this.conditionalLog(
			`🎯 GOAL! Player ${scoringPlayer + 1} scored against Player ${goalPlayer + 1}`
		);
		this.conditionalLog(
			`Score: ${this.playerScores.map((score, i) => `P${i + 1}: ${score}`).join(', ')}`
		);

		// Update the UI
		this.conditionalLog(`Updating UI display...`);
		this.updatePlayerInfoDisplay();
		this.conditionalLog(`UI update completed`);

		// Call the goal callback if set
		if (this.onGoalCallback) {
			this.conditionalLog(`Calling goal callback...`);
			this.onGoalCallback(scoringPlayer, goalPlayer);
		} else {
			this.conditionalLog(`No goal callback set`);
		}

		// Instead of immediately resetting the ball, let it continue to the boundary
		let continuingBall = false;
		if (wasSplitTrigger) {
			continuingBall = true;
		} else if (this.splitBalls.length > 0) {
			const replacement = this.splitBalls.shift()!;
			this.promoteSplitBall(replacement);
			continuingBall = true;
		}

		if (continuingBall) {
			// Mark goal state so boundary check will perform a proper serve reset
			this.goalScored = true;
			this.pendingGoalData = { scoringPlayer, goalPlayer, wasOwnGoal };

			// Determine next server now (conceding player unless own goal chooses random)
			if (!wasOwnGoal) {
				this.currentServer = goalPlayer; // Conceding player serves next
			} else {
				const validServers = [] as number[];
				for (let i = 0; i < this.playerCount; i++) {
					if (this.paddles[i]) {
						validServers.push(i);
					}
				}
				if (validServers.length > 0) {
					this.currentServer =
						validServers[
							Math.floor(Math.random() * validServers.length)
						];
				} else {
					this.currentServer = Math.floor(
						Math.random() * this.playerCount
					);
				}
				this.conditionalLog(
					`🏴 OWN GOAL: Random server selected from ${validServers.length} valid paddles - Player ${this.currentServer + 1} will serve next`
				);
			}

			// Reset rally/effect trackers and wait for boundary to trigger the serve
			this.ballEffects.resetRallySpeed();
			this.lastPlayerToHitBall = -1;
			this.secondLastPlayerToHitBall = -1;
			this.clearRecentHitters();
			this.lastGoalTime = performance.now();
			return;
		}

		// Store the goal data for later processing when the ball reaches the boundary
		this.goalScored = true;
		this.pendingGoalData = { scoringPlayer, goalPlayer, wasOwnGoal };

		this.conditionalLog(
			`🚀 Goal scored! Ball will continue to boundary before reset...`
		);

		// Reset the last player tracker - conceding player becomes the server for next rally (unless it was an own goal)
		if (!wasOwnGoal) {
			this.currentServer = goalPlayer; // Conceding player serves next
		} else {
			// For own goals, pick a random server from players that have paddles
			const validServers = [];
			for (let i = 0; i < this.playerCount; i++) {
				if (this.paddles[i]) {
					validServers.push(i);
				}
			}
			if (validServers.length > 0) {
				this.currentServer =
					validServers[
						Math.floor(Math.random() * validServers.length)
					];
			} else {
				// Fallback to random if no valid paddles (shouldn't happen)
				this.currentServer = Math.floor(
					Math.random() * this.playerCount
				);
			}
			this.conditionalLog(
				`🏴 OWN GOAL: Random server selected from ${validServers.length} valid paddles - Player ${this.currentServer + 1} will serve next`
			);
		}
		this.secondLastPlayerToHitBall = -1;
		this.clearRecentHitters();
		this.lastGoalTime = performance.now();
	}

	private setupManualGoalDetection(): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🔧 Manual goal detection available as backup (physics collision detection is primary)...`
			);
		}

		// Manual detection is available as backup but not continuously running
	}

	public checkManualGoalCollisions(): void {
		if (this.ballMesh) {
			const ballPosition = this.ballMesh.position;
			this.checkGeneralOutOfBounds(
				ballPosition,
				this.ballMesh.physicsImpostor ?? null
			);
			if (this.goalScored && this.pendingGoalData) {
				this.checkBoundaryCollisionAfterGoal(ballPosition);
			}
		}

		if (this.splitBalls.length > 0) {
			this.splitBalls.forEach(ball => {
				this.checkGeneralOutOfBounds(ball.mesh.position, ball.impostor);
			});
		}
	}

	private checkGeneralOutOfBounds(
		ballPosition: BABYLON.Vector3,
		ballImpostor?: BABYLON.PhysicsImpostor | null
	): void {
		const isSplitBall = this.isSplitBallImpostor(ballImpostor);
		const mainImpostor = this.ballMesh?.physicsImpostor ?? null;
		const isMainBall =
			ballImpostor === mainImpostor || (!ballImpostor && !isSplitBall);

		if (isMainBall && this.goalScored && this.pendingGoalData) {
			return; // Let goal resolution handle the main ball exit
		}

		const isOutOfBounds =
			Math.abs(ballPosition.x) > this.outOfBoundsDistance ||
			Math.abs(ballPosition.z) > this.outOfBoundsDistance;

		if (!isOutOfBounds) {
			return;
		}

		if (isSplitBall) {
			this.conditionalLog(
				`🌀 Split ball went out of bounds at ${ballPosition.toString()} - removing`
			);
			this.removeSplitBallByImpostor(ballImpostor ?? null);
			return;
		}

		if (isMainBall && this.splitBalls.length > 0) {
			this.conditionalLog(
				`🌀 Primary ball exited play; promoting remaining split ball`
			);
			const replacement = this.splitBalls.shift()!;
			if (ballImpostor) {
				ballImpostor.dispose();
			}
			if (this.ballMesh && !this.ballMesh.isDisposed()) {
				this.ballMesh.material = null;
				this.ballMesh.dispose();
			}
			this.promoteSplitBall(replacement);
			this.goalScored = false;
			this.pendingGoalData = null;
			this.ballEffects.resetAllEffects();
			return;
		}

		this.conditionalLog(
			`🏓 Ball went out of bounds! Position: ${ballPosition.toString()}, Threshold: ±${this.outOfBoundsDistance}`
		);

		if (this.gameEnded) {
			this.conditionalLog(
				`🏆 Game ended - stopping game loop, ball will not respawn`
			);
			if (this.gameLoop) {
				this.gameLoop.stop();
			}
			return;
		}

		if (this.gameLoop) {
			this.gameLoop.resetBall();
		}

		this.resetRallySpeed();
		this.goalScored = false;
		this.pendingGoalData = null;
		this.ballEffects.resetAllEffects();
		this.clearSplitBalls();

		this.conditionalLog(`⚡ Ball reset due to out of bounds`);
	}
	private checkBoundaryCollisionAfterGoal(
		ballPosition: BABYLON.Vector3
	): void {
		// Simple boundary check using configurable distance threshold
		const hitBoundary =
			Math.abs(ballPosition.x) > this.outOfBoundsDistance ||
			Math.abs(ballPosition.z) > this.outOfBoundsDistance;

		if (hitBoundary) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🎯 Ball reached boundary after goal! Position: ${ballPosition.toString()}, Threshold: ±${this.outOfBoundsDistance}`
				);
			}

			// Check if game has ended - if so, stop the game loop instead of respawning
			if (this.gameEnded) {
				this.conditionalLog(
					`🏆 Game ended - stopping game loop, ball will not respawn`
				);
				if (this.gameLoop) {
					this.gameLoop.stop();
				}
				return; // Exit without resetting ball
			}

			this.conditionalLog(`🔄 Resetting ball for new rally...`);

			// Now reset the ball (normal gameplay) with serve system
			if (this.gameLoop) {
				// For own goals, serve from random server like at game start. For regular goals, serve from conceding player's paddle
				const wasOwnGoal = this.pendingGoalData?.wasOwnGoal || false;
				if (wasOwnGoal) {
					this.gameLoop.resetBall(this.currentServer); // Serve from random server for own goals
					this.conditionalLog(
						`🏴 OWN GOAL: Ball served from random server Player ${this.currentServer + 1}`
					);
				} else {
					this.gameLoop.resetBall(this.lastConcedingPlayer); // Serve from conceding player's paddle
				}
			}

			// Reset rally speed system - new rally starts
			this.resetRallySpeed();

			// Clear the goal state and reset all ball effects
			this.goalScored = false;
			this.pendingGoalData = null;
			this.ballEffects.resetAllEffects();

			// Important: reset goal cooldown for the new rally so immediate goals count
			this.lastGoalTime = 0;

			this.conditionalLog(
				`⚡ Ball reset completed after boundary collision`
			);
		}
	}

	private setupShadowSystem(scene: BABYLON.Scene): void {
		// Reduced logging for shadow system setup
		// this.conditionalLog('🌟 Setting up shadow system...');

		try {
			// Reduced shadow debug logging
			// this.conditionalLog(`🔍 Shadow Debug: Total lights in scene: ${scene.lights.length}`);

			// Debug: Show all lights and their names - commented out for performance
			// scene.lights.forEach((light, index) => {
			// 	this.conditionalLog(`Light ${index + 1}: "${light.name}" (${light.getClassName()})`);
			// });

			// Find lights with "light" in their name (Light, Light.001, Light.002, etc.)
			const shadowCastingLights = scene.lights.filter(light => {
				const name = light.name.toLowerCase();
				const hasLight = name.includes('light');
				const isValidType =
					light instanceof BABYLON.DirectionalLight ||
					light instanceof BABYLON.SpotLight;

				this.conditionalLog(
					`🔍 Checking light "${light.name}": hasLight=${hasLight}, isValidType=${isValidType} (${light.getClassName()})`
				);

				return hasLight && isValidType;
			});

			this.conditionalLog(
				`🔍 Found ${shadowCastingLights.length} suitable lights for shadows`
			);

			if (shadowCastingLights.length === 0) {
				this.conditionalWarn(
					'❌ No suitable lights found for shadow casting'
				);
				this.conditionalLog(
					'💡 Make sure your GLB has lights with "light" in the name and they are SpotLight or DirectionalLight type'
				);
				return;
			}

			// Setup shadow generators for each light
			this.shadowGenerators = [];
			shadowCastingLights.forEach(light => {
				this.conditionalLog(
					`✅ Setting up shadow generator for light: ${light.name} (${light.getClassName()})`
				);

				// Create shadow generator
				const shadowGenerator = new BABYLON.ShadowGenerator(
					1024,
					light as BABYLON.DirectionalLight | BABYLON.SpotLight
				);
				this.shadowGenerators.push(shadowGenerator);

				// Add ball as shadow caster
				if (this.ballMesh) {
					shadowGenerator.addShadowCaster(this.ballMesh);
					this.conditionalLog(
						`✅ Added ball as shadow caster for ${light.name}`
					);
				} else {
					this.conditionalWarn(
						`⚠️ Ball mesh not available for shadow casting`
					);
				}

				// Configure shadow quality
				shadowGenerator.useExponentialShadowMap = true;
				shadowGenerator.bias = 0.00001;
			});

			// Add any existing split balls and powerup meshes as casters
			const addCasterIfMatch = (mesh: BABYLON.AbstractMesh) => {
				const name = (mesh?.name || '').toLowerCase();
				if (!name) return;
				if (name.includes('ball') || name.includes('powerup')) {
					this.shadowGenerators.forEach(gen =>
						gen.addShadowCaster(mesh as BABYLON.Mesh)
					);
				}
			};
			// Existing scene meshes
			scene.meshes.forEach(m => addCasterIfMatch(m));

			// Dynamically add future meshes (split balls, spawned powerups)
			scene.onNewMeshAddedObservable.add(m => {
				addCasterIfMatch(m);
			});

			// Find and setup shadow receivers (any mesh with court or wall in name)
			const shadowReceivers = scene.meshes.filter(mesh => {
				const name = mesh.name.toLowerCase();
				return name.includes('court') || name.includes('wall');
			});

			this.conditionalLog(
				`🔍 Found ${shadowReceivers.length} shadow receiver meshes:`
			);
			shadowReceivers.forEach(mesh => {
				mesh.receiveShadows = true;
				this.conditionalLog(
					`✅ Enabled shadow receiving for: ${mesh.name}`
				);
			});

			this.conditionalLog(
				`🎉 Shadow system setup complete: ${shadowCastingLights.length} lights, ${shadowReceivers.length} receivers`
			);
		} catch (error) {
			this.conditionalWarn('❌ Error setting up shadow system:', error);
		}
	}
	private computeSceneBoundingInfo(
		meshes: BABYLON.AbstractMesh[]
	): BoundingInfo | null {
		if (!meshes || meshes.length === 0) return null;

		let min = new BABYLON.Vector3(
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY,
			Number.POSITIVE_INFINITY
		);
		let max = new BABYLON.Vector3(
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY,
			Number.NEGATIVE_INFINITY
		);

		meshes.forEach(mesh => {
			if (!mesh.getBoundingInfo) return;
			const boundingInfo = mesh.getBoundingInfo();
			const bMin = boundingInfo.boundingBox.minimumWorld;
			const bMax = boundingInfo.boundingBox.maximumWorld;
			min = BABYLON.Vector3.Minimize(min, bMin);
			max = BABYLON.Vector3.Maximize(max, bMax);
		});

		return { min, max };
	}

	private findPaddles(scene: BABYLON.Scene): void {
		const meshes = scene.meshes;

		// Find all paddle meshes using case-insensitive name search
		const paddleMeshes = meshes.filter(
			m => m && m.name && /paddle/i.test(m.name)
		);

		// Try to identify paddles by numbered names for the expected number of players
		for (let i = 0; i < this.playerCount; i++) {
			const paddleNumber = i + 1;
			// Look for specific numbered paddle names first
			let paddle = paddleMeshes.find(
				m =>
					m &&
					m.name &&
					new RegExp(
						`paddle${paddleNumber}|player${paddleNumber}|p${paddleNumber}`,
						'i'
					).test(m.name)
			) as BABYLON.Mesh | undefined;

			// If no specific numbered paddle found, take the next available paddle
			if (!paddle && i < paddleMeshes.length) {
				paddle = paddleMeshes[i] as BABYLON.Mesh;
			}

			this.paddles[i] = paddle || null;
		}

		// Clear unused paddle slots
		for (let i = this.playerCount; i < 4; i++) {
			this.paddles[i] = null;
		}

		// Log what we found
		const foundPaddles = this.paddles.filter(p => p !== null);
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`Found ${foundPaddles.length}/${this.playerCount} expected paddles:`,
				foundPaddles.map(p => p?.name)
			);
		}

		if (foundPaddles.length === 0) {
			this.conditionalWarn('No paddle meshes found in the scene!');
			return;
		}

		if (foundPaddles.length < this.playerCount) {
			this.conditionalWarn(
				`Expected ${this.playerCount} paddles but only found ${foundPaddles.length}`
			);
		}

		// Initialize paddle positions from their mesh positions
		for (let i = 0; i < this.playerCount; i++) {
			if (this.paddles[i]) {
				// Initialize gameState as displacement from GLB position (starting at 0)
				this.gameState.paddlePositionsX[i] = 0;
				this.gameState.paddlePositionsY[i] = 0;
			} else {
				// Default for missing paddles
				this.gameState.paddlePositionsX[i] = 0;
				this.gameState.paddlePositionsY[i] = 0;
			}
		}

		// Sync mesh positions with the original GLB positions (since gameState starts at 0 displacement)
		for (let i = 0; i < this.playerCount; i++) {
			if (this.paddles[i]) {
				this.paddles[i]!.position.x = this.originalGLBPositions[i].x;
				this.paddles[i]!.position.z = this.originalGLBPositions[i].z;
			}
		}

		this.hideDuplicatePaddles(meshes);
	}

	private findBall(scene: BABYLON.Scene): void {
		const meshes = scene.meshes;

		// Find ball mesh using case-insensitive name search
		this.ballMesh =
			(meshes.find(m => m && m.name && /ball/i.test(m.name)) as
				| BABYLON.Mesh
				| undefined) || null;

		if (this.ballMesh) {
			this.conditionalLog(`Found ball mesh: ${this.ballMesh.name}`);
			// Set the ball mesh in the game loop and ball effects
			if (this.gameLoop) {
				this.gameLoop.setBallMesh(this.ballMesh);
			}
			this.ballEffects.setBallMesh(this.ballMesh);
			this.baseBallY = this.ballMesh.position.y;
			this.baseBallMaterial = this.ballMesh.material || null;
		} else {
			this.conditionalWarn('No ball mesh found in the scene!');
			// Create a simple ball if none exists
			this.createDefaultBall();
		}
	}

	private createDefaultBall(): void {
		// Create a simple sphere as a fallback ball
		this.ballMesh = BABYLON.MeshBuilder.CreateSphere(
			'defaultBall',
			{ diameter: 0.2 },
			this.scene
		);

		// Create a simple material
		const ballMaterial = new BABYLON.StandardMaterial(
			'ballMaterial',
			this.scene
		);
		ballMaterial.diffuseColor = new BABYLON.Color3(1, 1, 1); // White ball
		ballMaterial.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.1); // Slight glow
		this.ballMesh.material = ballMaterial;
		this.baseBallMaterial = ballMaterial;

		this.conditionalLog('Created default ball mesh');

		// Set the ball mesh in the game loop
		if (this.gameLoop) {
			this.gameLoop.setBallMesh(this.ballMesh);
		}
		this.baseBallY = this.ballMesh.position.y;
	}

	private findGoals(scene: BABYLON.Scene): void {
		const meshes = scene.meshes;

		this.conditionalLog(
			`🔍 Looking for goals in ${this.playerCount}-player mode... Total meshes: ${meshes.length}`
		);
		// Reduced goal debugging logging
		// this.conditionalLog(`🔍 Player count: ${this.playerCount}`);
		// this.conditionalLog(`🔍 Active player count: ${this.playerCount}`);

		// Find goal meshes using case-insensitive name search
		const goalMeshes = meshes.filter(
			m => m && m.name && /goal/i.test(m.name)
		);

		// Reduced goal mesh debugging
		// this.conditionalLog(`🔍 Found ${goalMeshes.length} meshes with "goal" in name:`, goalMeshes.map(m => m.name));

		// Try to identify goals by numbered names for the expected number of players
		for (let i = 0; i < this.playerCount; i++) {
			const goalNumber = i + 1;
			// this.conditionalLog(`🔍 Looking for goal${goalNumber}...`);

			// Look for specific numbered goal names first
			let goal = goalMeshes.find(
				m =>
					m &&
					m.name &&
					new RegExp(`goal${goalNumber}|g${goalNumber}`, 'i').test(
						m.name
					)
			) as BABYLON.Mesh | undefined;

			if (goal) {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`✅ Found goal${goalNumber}: ${goal.name}`
					);
				}
			} else {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(`❌ Could not find goal${goalNumber}`);
				}
				// If no specific numbered goal found, take the next available goal
				if (i < goalMeshes.length) {
					goal = goalMeshes[i] as BABYLON.Mesh;
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`📋 Fallback: Using ${goal?.name} as goal${goalNumber}`
						);
					}
				}
			}

			this.goalMeshes[i] = goal || null;
		}

		// Clear unused goal slots
		for (let i = this.playerCount; i < 4; i++) {
			this.goalMeshes[i] = null;
		}

		// Log what we found
		const foundGoals = this.goalMeshes.filter(g => g !== null);
		this.conditionalLog(
			`Found ${foundGoals.length}/${this.playerCount} expected goals:`,
			foundGoals.map(g => g?.name)
		);

		if (foundGoals.length === 0) {
			this.conditionalWarn(
				'No goal meshes found in the scene! Add meshes named "goal1", "goal2", etc. for score detection'
			);
			return;
		}

		this.conditionalLog(
			`🎯 GOAL DEBUG: Found ${foundGoals.length} goal meshes for ${this.playerCount} players`
		);
		this.conditionalLog(
			`🎯 GOAL DEBUG: Goal names:`,
			foundGoals.map(g => g?.name)
		);

		if (foundGoals.length < this.playerCount) {
			this.conditionalWarn(
				`Expected ${this.playerCount} goals but only found ${foundGoals.length}`
			);
		}

		// Make goal meshes invisible and set up physics collision detection
		this.goalMeshes.forEach((goal, index) => {
			if (goal) {
				// De-parent goal meshes to fix physics collision detection (similar to walls)
				if (goal.parent) {
					const worldMatrix = goal.getWorldMatrix();
					const position = new BABYLON.Vector3();
					const rotationQuaternion = new BABYLON.Quaternion();
					const scaling = new BABYLON.Vector3();
					worldMatrix.decompose(
						scaling,
						rotationQuaternion,
						position
					);

					goal.parent = null;
					goal.position = position;
					goal.rotationQuaternion = rotationQuaternion;
					goal.scaling = scaling;

					this.conditionalLog(
						`Goal ${index + 1} (${goal.name}): De-parented and repositioned to: x=${goal.position.x}, y=${goal.position.y}, z=${goal.position.z}`
					);
				}

				goal.isVisible = false; // Make invisible (collision detection only)
				goal.checkCollisions = false; // Disable Babylon collision detection

				// Physics impostors will be created in setupPhysicsImpostors after physics is enabled
				this.conditionalLog(
					`✅ Goal ${index + 1} (${goal.name}): Prepared for physics collision detection`
				);
			} else {
				this.conditionalLog(
					`❌ Goal ${index + 1}: Goal mesh is null or undefined`
				);
			}
		});
	}

	private findDefencePlanes(scene: BABYLON.Scene): void {
		const meshes = scene.meshes;
		const defenceCandidates = meshes.filter(
			m => m && m.name && /defen[cs]e/i.test(m.name)
		);

		for (let i = 0; i < this.playerCount; i++) {
			const defenceNumber = i + 1;
			let defence = defenceCandidates.find(m =>
				m?.name
					? new RegExp(`defen[cs]e${defenceNumber}`, 'i').test(m.name)
					: false
			) as BABYLON.Mesh | undefined;

			if (!defence && i < defenceCandidates.length) {
				defence = defenceCandidates[i] as BABYLON.Mesh;
			}

			if (defence) {
				if (defence.parent) {
					const worldMatrix = defence.getWorldMatrix();
					const position = new BABYLON.Vector3();
					const rotationQuaternion = new BABYLON.Quaternion();
					const scaling = new BABYLON.Vector3();
					worldMatrix.decompose(
						scaling,
						rotationQuaternion,
						position
					);
					defence.parent = null;
					defence.position = position;
					defence.rotationQuaternion = rotationQuaternion;
					defence.scaling = scaling;
				}
				defence.isVisible = false;
				defence.checkCollisions = false;
				defence.isPickable = false;
				defence.metadata = {
					...(typeof defence.metadata === 'object' &&
					defence.metadata !== null
						? defence.metadata
						: {}),
					aiDefence: true,
					aiPlayerIndex: i,
				};
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🛡️ Defence ${defenceNumber}: ${defence.name} prepared for AI sensor`
					);
				}
			} else if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`⚠️ Defence ${defenceNumber}: Not found in scene`
				);
			}

			this.defenceMeshes[i] = defence || null;
		}

		for (let i = this.playerCount; i < 4; i++) {
			this.defenceMeshes[i] = null;
		}
	}

	private hideDuplicatePaddles(meshes: BABYLON.AbstractMesh[]): void {
		try {
			const allPaddles = meshes.filter(
				m => m && m.name && /paddle/i.test(m.name)
			);
			const hidden: string[] = [];
			const EPS = 0.1; // meters

			allPaddles.forEach(m => {
				if (!m || this.paddles.includes(m as BABYLON.Mesh)) return;
				if (!m.position) return;

				// Compare distance to all active paddles
				const isDuplicate = this.paddles.some(paddle => {
					if (!paddle || !paddle.position) return false;
					const distance = BABYLON.Vector3.Distance(
						m.position,
						paddle.position
					);
					return distance < EPS;
				});

				if (isDuplicate) {
					m.isVisible = false;
					try {
						if (
							'setEnabled' in m &&
							typeof m.setEnabled === 'function'
						) {
							m.setEnabled(false);
						}
					} catch (e) {
						// Ignore
					}
					hidden.push(m.name || '<unnamed>');
				}
			});

			if (hidden.length) {
				this.conditionalLog('Hidden duplicate paddle meshes:', hidden);
			}
		} catch (err) {
			this.conditionalWarn('Error while hiding duplicate paddles:', err);
		}
	}

	private startRenderLoop(): void {
		// If GUI has hooked into the render loop, it replaced runRenderLoop itself.
		if (this.guiTexture) return;

		this.engine.runRenderLoop(() => {
			// Only update paddles in local/master modes - client receives paddle positions from network
			if (this.gameMode !== 'client') {
				this.updatePaddles();
			}
			this.updateBounds();
			this.checkManualGoalCollisions();

			this.updatePowerups();

			this.scene.render();
			this.maybeLogPaddles();
		});
	}

	/** Create a simple GUI overlay with scores and optional FPS */
	private setupGui(): void {
		if (this.guiTexture) return;
		const handles = createPong3DUI(this.scene, {
			playerNames: [...this.playerNames],
			playerScores: [...this.playerScores],
		});

		this.guiTexture = handles.guiTexture;
		// store array handles for multi-player updates
		this.uiPlayerNameTexts = handles.playerNameTexts;
		this.uiPlayerScoreTexts = handles.playerScoreTexts;
		this.uiPlayerStacks = handles.playerStacks;
		this.uiMovePlayerTo = handles.movePlayerTo;
		// Store full handles for winner display
		this.uiHandles = handles;

		// Position player info blocks based on active player count and court layout
		this.positionPlayerInfoBlocks();

		// Backwards-compat convenience: point single-player fields to first two players if available
		if (this.uiPlayerNameTexts && this.uiPlayerNameTexts.length > 0)
			this.Player1Info = this.uiPlayerNameTexts[0];
		if (this.uiPlayerScoreTexts && this.uiPlayerScoreTexts.length > 0)
			this.score1Text = this.uiPlayerScoreTexts[0];
		if (this.uiPlayerNameTexts && this.uiPlayerNameTexts.length > 1)
			this.Player2Info = this.uiPlayerNameTexts[1];
		if (this.uiPlayerScoreTexts && this.uiPlayerScoreTexts.length > 1)
			this.score2Text = this.uiPlayerScoreTexts[1];

		// Keep a simple render loop that updates the scene
		this.engine.runRenderLoop(() => {
			// Update AI controllers with current game state
			this.updateAIControllers();

			// Only update paddles in local/master modes - client receives paddle positions from network
			if (this.gameMode !== 'client') {
				this.updatePaddles();
			}
			this.updateBounds();
			this.checkManualGoalCollisions();
			this.updatePowerups();
			this.scene.render();
			this.maybeLogPaddles();
		});
	}

	/**
	 * Position player info blocks based on active player count and court layout:
	 * - 2 players: Player 1 = bottom, Player 2 = top
	 * - 3 players: Player 1 = bottom, Player 2 = right, Player 3 = left
	 * - 4 players: Player 1 = bottom, Player 2 = top, Player 3 = right, Player 4 = left
	 * - Inactive players are hidden
	 * Note: Left and right positioning styles are consistent across player counts
	 */
	private positionPlayerInfoBlocks(): void {
		if (!this.uiMovePlayerTo || !this.uiPlayerStacks) return;

		// Hide all players first
		for (let i = 0; i < this.uiPlayerStacks.length; i++) {
			this.uiPlayerStacks[i].isVisible = false;
		}

		// Place player info blocks relative to the current POV (`thisPlayer`).
		// 'rel' is the player index relative to thisPlayer: 0 => bottom, then
		// next positions depend on active player count.
		const povOffset =
			typeof this.thisPlayer === 'number' ? this.thisPlayer - 1 : 0;
		for (let i = 0; i < this.playerCount; i++) {
			// Special-case mappings for certain 4-player POVs
			// - when thisPlayer === 2 => P1=top, P2=bottom, P3=left, P4=right
			// - when thisPlayer === 4 => P1=right, P2=left, P3=top,  P4=bottom (viewer)
			let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
			if (this.playerCount === 4 && this.thisPlayer === 2) {
				const specialMap: ('top' | 'bottom' | 'left' | 'right')[] = [
					'top',
					'bottom',
					'left',
					'right',
				];
				position = specialMap[i] || 'bottom';
			} else if (this.playerCount === 4 && this.thisPlayer === 4) {
				// User requested mapping when viewing as Player 4
				// P1 -> right, P2 -> left, P3 -> top, P4 -> bottom (viewer)
				const specialMap: ('top' | 'bottom' | 'left' | 'right')[] = [
					'right',
					'left',
					'top',
					'bottom',
				];
				position = specialMap[i] || 'bottom';
			} else {
				const rel =
					(i - povOffset + this.playerCount) % this.playerCount;
				if (this.playerCount === 2) {
					position = rel === 0 ? 'bottom' : 'top';
				} else if (this.playerCount === 3) {
					position =
						rel === 0 ? 'bottom' : rel === 1 ? 'right' : 'left';
				} else if (this.playerCount === 4) {
					// Order when POV is player 1: [bottom, top, right, left]
					position =
						rel === 0
							? 'bottom'
							: rel === 1
								? 'top'
								: rel === 2
									? 'right'
									: 'left';
				}
			}
			// Special-case: in 4-player mode when viewing as Player 3, swap left/right blocks
			if (this.playerCount === 4 && this.thisPlayer === 3) {
				if (position === 'left') position = 'right';
				else if (position === 'right') position = 'left';
			}
			this.uiMovePlayerTo(i, position);
			if (this.uiPlayerStacks[i]) this.uiPlayerStacks[i].isVisible = true;
		}

		// Force a re-layout to ensure all positioning changes take effect
		if (this.guiTexture) {
			this.guiTexture.markAsDirty();
		}
	}

	/**
	 * Set up AI controllers for players with names starting with "*"
	 */
	private setupAIControllers(): void {
		this.conditionalLog('🤖 Setting up AI controllers...');

		for (let i = 0; i < this.playerCount; i++) {
			const playerName = this.playerNames[i];
			if (playerName && playerName.startsWith('*')) {
				this.conditionalLog(
					`🤖 Found AI player: ${playerName} (Player ${i + 1})`
				);

				// Get AI difficulty from player name
				const difficulty = getAIDifficultyFromName(playerName);
				const aiConfig = AI_DIFFICULTY_PRESETS[difficulty];

				// Log AI config for debugging
				this.conditionalLog(
					`🤖 AI config for Player ${i + 1} (${difficulty}):`,
					{
						sampleRate: aiConfig.sampleRate,
						impulseFrequency: aiConfig.impulseFrequency,
						impulseDuration: aiConfig.impulseDuration,
						centralLimit: aiConfig.centralLimit,
						xLimit: aiConfig.xLimit,
					}
				);

				// Set up AI controller for this player
				this.inputHandler?.setAIController(i, aiConfig);

				this.conditionalLog(
					`🤖 CONFIRMED: AI controller set up for playerIndex=${i} (Player ${i + 1})`
				);

				this.conditionalLog(
					`🤖 AI controller set up for Player ${i + 1} with ${difficulty} difficulty`
				);
			}
		}
	}

	/**
	 * Update AI controllers with current game state in the render loop
	 */
	private updateAIControllers(): void {
		if (!this.inputHandler) return;

		// Get current game state for AI
		const paddleAxes = Array.from({ length: 4 }, (_, i) => {
			if (this.playerCount === 3) {
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				const angle = angles[i] ?? 0;
				return {
					x: Math.cos(angle),
					z: Math.sin(angle),
				};
			}
			if (this.playerCount === 4) {
				return i >= 2 ? { x: 0, z: 1 } : { x: 1, z: 0 };
			}
			return { x: 1, z: 0 };
		});

		const paddleOrigins = Array.from({ length: 4 }, (_, i) => {
			const origin = this.originalGLBPositions[i];
			return origin ? { x: origin.x, z: origin.z } : { x: 0, z: 0 };
		});

		const paddlePositionsAlongAxis = Array.from({ length: 4 }, (_, i) => {
			const axis = paddleAxes[i];
			const origin = paddleOrigins[i];
			if (!axis) {
				return this.gameState.paddlePositionsX[i] || 0;
			}
			const axisVec = new BABYLON.Vector3(axis.x, 0, axis.z);
			if (axisVec.lengthSquared() <= 1e-6) {
				return this.gameState.paddlePositionsX[i] || 0;
			}
			axisVec.normalize();
			const originVec = new BABYLON.Vector3(origin.x, 0, origin.z);
			const paddle = this.paddles[i];
			if (paddle) {
				const relative = new BABYLON.Vector3(
					paddle.position.x - originVec.x,
					0,
					paddle.position.z - originVec.z
				);
				return BABYLON.Vector3.Dot(relative, axisVec);
			}
			// Fallback: derive from stored game state values
			if (this.playerCount === 4 && i >= 2) {
				const storedZ = this.gameState.paddlePositionsY?.[i] || 0;
				return storedZ - originVec.z;
			}
			return this.gameState.paddlePositionsX[i] || 0;
		});

		const splitBallSnapshots: AIBallSnapshot[] = this.ballManager
			.getEntities()
			.map(entity => {
				const pos = entity.mesh.position;
				const vel = entity.getVelocity() ?? BABYLON.Vector3.Zero();
				const snapshot: AIBallSnapshot = {
					id: `split_${entity.mesh.uniqueId}`,
					meshUniqueId: entity.mesh.uniqueId,
					bodyId: entity.impostor.physicsBody?.id,
					position: { x: pos.x, y: pos.y, z: pos.z },
					velocity: { x: vel.x, y: vel.y, z: vel.z },
				};
				return snapshot;
			});

		const mainEntity = this.mainBallEntity;
		const mainMesh = mainEntity?.mesh ?? this.ballMesh;
		const mainImpostor =
			mainEntity?.impostor ?? this.ballMesh?.physicsImpostor ?? null;
		const rawMainVelocity =
			mainEntity?.getVelocity() ?? mainImpostor?.getLinearVelocity();

		let mainBallSnapshot: AIBallSnapshot | null = null;
		if (mainMesh) {
			const velocityVec = rawMainVelocity
				? new BABYLON.Vector3(
						rawMainVelocity.x,
						rawMainVelocity.y,
						rawMainVelocity.z
					)
				: BABYLON.Vector3.Zero();
			mainBallSnapshot = {
				id: `main_${mainMesh.uniqueId}`,
				meshUniqueId: mainMesh.uniqueId,
				bodyId: mainImpostor?.physicsBody?.id,
				position: {
					x: mainMesh.position.x,
					y: mainMesh.position.y,
					z: mainMesh.position.z,
				},
				velocity: {
					x: velocityVec.x,
					y: velocityVec.y,
					z: velocityVec.z,
				},
			};
		}

		const ballSnapshots: AIBallSnapshot[] = [];
		if (mainBallSnapshot) {
			ballSnapshots.push(mainBallSnapshot);
		}
		ballSnapshots.push(...splitBallSnapshots);
		if (ballSnapshots.length === 0) {
			ballSnapshots.push({
				position: { x: 0, y: 0, z: 0 },
				velocity: { x: 0, y: 0, z: 0 },
			});
		}
		const primaryBall = ballSnapshots[0];
		const otherBallSnapshots =
			ballSnapshots.length > 1 ? ballSnapshots.slice(1) : undefined;

		const gameStateForAI: GameStateForAI = {
			balls: ballSnapshots,
			primaryBallId: mainBallSnapshot?.id ?? primaryBall.id,
			ball: primaryBall,
			otherBalls: otherBallSnapshots,
			paddlePositionsX: [...this.gameState.paddlePositionsX],
			paddlePositionsAlongAxis,
			paddleAxes,
			paddleOrigins,
			courtBounds: {
				xMin: this.boundsXMin || -5,
				xMax: this.boundsXMax || 5,
				zMin: this.boundsZMin || -5,
				zMax: this.boundsZMax || 5,
			},
			physics: this.scene.getPhysicsEngine()
				? {
						engine: this.scene.getPhysicsEngine()!,
						scene: this.scene,
					}
				: undefined,
		};

		// Update key state with AI inputs
		const keyStateWithAI =
			this.inputHandler.getKeyStateWithGameState(gameStateForAI);

		// Apply AI inputs to game state (this will be used by updatePaddles)
		// We need to update the input handler's internal key state
		this.inputHandler.setNetworkKeyState(
			0,
			keyStateWithAI.p1Left,
			keyStateWithAI.p1Right
		);
		this.inputHandler.setNetworkKeyState(
			1,
			keyStateWithAI.p2Left,
			keyStateWithAI.p2Right
		);
		this.inputHandler.setNetworkKeyState(
			2,
			keyStateWithAI.p3Left,
			keyStateWithAI.p3Right
		);
		this.inputHandler.setNetworkKeyState(
			3,
			keyStateWithAI.p4Left,
			keyStateWithAI.p4Right
		);
	}

	/** Update displayed scores (backwards compatible) */
	public setScores(p1: number, p2: number): void {
		this.playerScores[0] = p1;
		this.playerScores[1] = p2;
		this.updatePlayerInfoDisplay();
	}

	/** Update the on-screen Player info using current name/score fields */
	private updatePlayerInfoDisplay(): void {
		this.conditionalLog(`📊 Updating UI with scores:`, this.playerScores);

		// If extended UI is present, update arrays
		if (this.uiPlayerNameTexts && this.uiPlayerScoreTexts) {
			this.conditionalLog(`Using extended UI arrays`);
			for (
				let i = 0;
				i <
				Math.min(
					this.uiPlayerNameTexts.length,
					this.playerNames.length
				);
				i++
			) {
				this.uiPlayerNameTexts[i].text = this.playerNames[i];
				this.uiPlayerScoreTexts[i].text = String(this.playerScores[i]);
				this.conditionalLog(
					`Set Player ${i + 1}: ${this.playerNames[i]} - ${this.playerScores[i]}`
				);
			}
			return;
		}

		// Backwards compatibility for single player fields
		this.conditionalLog(`Using backwards compatibility UI`);
		if (this.Player1Info) {
			this.Player1Info.text = this.playerNames[0];
			this.conditionalLog(`Set Player1Info to: ${this.playerNames[0]}`);
		}
		if (this.score1Text) {
			this.score1Text.text = String(this.playerScores[0]);
			this.conditionalLog(`Set score1Text to: ${this.playerScores[0]}`);
		}
		if (this.Player2Info) {
			this.Player2Info.text = this.playerNames[1];
			this.conditionalLog(`Set Player2Info to: ${this.playerNames[1]}`);
		}
		if (this.score2Text) {
			this.score2Text.text = String(this.playerScores[1]);
			this.conditionalLog(`Set score2Text to: ${this.playerScores[1]}`);
		}

		// Handle remaining players if UI arrays exist but we're in backwards compatibility mode
		// This ensures score updates work for all players even when called before UI is fully set up
		if (this.uiPlayerNameTexts && this.uiPlayerScoreTexts) {
			for (
				let i = 0;
				i <
				Math.min(
					this.playerCount,
					this.uiPlayerNameTexts.length,
					this.uiPlayerScoreTexts.length
				);
				i++
			) {
				// Skip players 0 and 1 as they're handled above
				if (i < 2) continue;
				this.uiPlayerNameTexts[i].text = this.playerNames[i];
				this.uiPlayerScoreTexts[i].text = String(this.playerScores[i]);
				this.conditionalLog(
					`Set Player ${i + 1} (backwards compat with arrays): ${this.playerNames[i]} - ${this.playerScores[i]}`
				);
			}
		}
	}

	/** Set player names and update display */
	public setPlayerNames(
		p1: string,
		p2: string,
		p3?: string,
		p4?: string
	): void {
		this.playerNames[0] = p1;
		this.playerNames[1] = p2;
		if (typeof p3 === 'string') this.playerNames[2] = p3;
		if (typeof p4 === 'string') this.playerNames[3] = p4;
		this.updatePlayerInfoDisplay();
	}

	/** Set active player count (2, 3, or 4) - cannot exceed initial player count */
	public setActivePlayerCount(_count: number): void {
		// Since playerCount determines the court layout, we can't change it after initialization
		this.conditionalWarn(
			`Cannot change player count after initialization. Current player count: ${this.playerCount}`
		);
	}

	/** Set player scores and update display */
	public setPlayerScores(
		s1: number,
		s2: number,
		s3?: number,
		s4?: number
	): void {
		this.playerScores[0] = s1;
		this.playerScores[1] = s2;
		if (typeof s3 === 'number') this.playerScores[2] = s3;
		if (typeof s4 === 'number') this.playerScores[3] = s4;
		this.updatePlayerInfoDisplay();
	}

	/** Move a player's UI block to a named position: 'top'|'bottom'|'left'|'right' */
	public setPlayerUIPosition(
		playerIndex: number,
		position: 'top' | 'bottom' | 'left' | 'right'
	) {
		if (this.uiMovePlayerTo) this.uiMovePlayerTo(playerIndex, position);
	}

	/** Set the camera POV to a specific player's perspective */
	public setPlayerPOV(playerPOV: 1 | 2 | 3 | 4): void {
		this.thisPlayer = playerPOV;

		// Update camera position if camera is already initialized
		if (this.camera) {
			const cameraPos = getCameraPosition(
				this.thisPlayer,
				this.playerCount,
				this.getCameraSettings(),
				this.local
			);
			applyCameraPosition(this.camera, cameraPos, this.thisPlayer);
		}
	}

	/** Set the Player1Info text (backwards compatibility) */
	public setPlayer1Info(text: string): void {
		if (this.Player1Info) this.Player1Info.text = text;
	}

	/** Reset the rally speed system - called when a new rally starts */
	private resetRallySpeed(): void {
		this.ballEffects.resetRallySpeed();
		const currentSpeed = this.ballEffects.getCurrentBallSpeed();
		this.conditionalLog(
			`🔄 Rally reset: Speed back to base ${currentSpeed}`
		);

		// Reset last player to hit ball - new rally starts
		this.lastPlayerToHitBall = -1;
		this.secondLastPlayerToHitBall = -1;
		this.clearRecentHitters();

		// Reset global increment gating reference position to current ball pos
		if (this.ballMesh) {
			this.lastRallyIncrementPosXZ = new BABYLON.Vector3(
				this.ballMesh.position.x,
				0,
				this.ballMesh.position.z
			);
		} else {
			this.lastRallyIncrementPosXZ = null;
		}
	}

	private maintainConstantBallVelocity(): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;

		const currentVelocity =
			this.ballMesh.physicsImpostor.getLinearVelocity();
		if (!currentVelocity) return;

		// Apply Magnus force from spin (ball curving effect)
		this.applyMagnusForce();

		// Apply spin decay over time
		this.ballEffects.applySpinDecay();

		// Calculate current speed (magnitude) in X-Z plane only
		const currentSpeed = Math.sqrt(
			currentVelocity.x * currentVelocity.x +
				currentVelocity.z * currentVelocity.z
		);

		// Target speed from rally system
		const currentBallSpeed = this.ballEffects.getCurrentBallSpeed();

		// Always normalize main ball speed exactly to the current rally target
		if (currentSpeed > 0.0001) {
			const scale = currentBallSpeed / currentSpeed;
			const correctedVelocity = new BABYLON.Vector3(
				currentVelocity.x * scale,
				0,
				currentVelocity.z * scale
			);
			this.ballMesh.physicsImpostor.setLinearVelocity(correctedVelocity);
		}

		// Regardless of speed correction above, hard-lock Y velocity to 0 to keep ball in X-Z plane
		if (Math.abs(currentVelocity.y) > 0.0001) {
			this.ballMesh.physicsImpostor.setLinearVelocity(
				new BABYLON.Vector3(currentVelocity.x, 0, currentVelocity.z)
			);
		}

		// Clamp ball to baseline height to avoid drifting below/above court
		if (Math.abs(this.ballMesh.position.y - this.baseBallY) > 0.001) {
			this.ballMesh.position.y = this.baseBallY;
			const body = this.ballMesh.physicsImpostor.physicsBody;
			if (body) {
				body.position.y = this.baseBallY;
			}
		}
	}

	private applyMagnusForce(): void {
		// Use ball effects to apply Magnus force directly
		this.ballEffects.applyMagnusForce();
	}

	private updateBounds(): void {
		if (
			this.boundsXMin === null ||
			this.boundsXMax === null ||
			this.boundsZMin === null ||
			this.boundsZMax === null
		) {
			try {
				const allMeshes = this.scene.meshes;
				const info = this.computeSceneBoundingInfo(allMeshes);

				if (info) {
					this.boundsXMin = info.min.x;
					this.boundsXMax = info.max.x;
					this.boundsZMin = info.min.z;
					this.boundsZMax = info.max.z;
				}
			} catch (e) {
				// Ignore
			}
		}
	}

	private updatePaddles(): void {
		if (this.gameEnded) {
			this.ballPositionHistory.clear();
			return;
		}
		const loopRunning = this.gameLoop?.getGameState().isRunning ?? true;
		if (!loopRunning) {
			return;
		}

		this.detectMissedPaddleContacts();

		// Maintain main ball via per-ball entity if available, otherwise fallback
		const targetSpeedForMain = this.ballEffects.getCurrentBallSpeed();
		if (this.mainBallEntity) {
			this.mainBallEntity.update(targetSpeedForMain);
		} else {
			this.maintainConstantBallVelocity();
		}
		const targetSpeedForSplits = this.ballEffects.getCurrentBallSpeed();
		this.ballManager.updateAll(targetSpeedForSplits);

		// Sync serve waiting state from game loop
		if (this.gameLoop && 'getGameState' in this.gameLoop) {
			const gameLoopState = (this.gameLoop as any).getGameState();
			if (gameLoopState) {
				this.gameState.waitingForServe = gameLoopState.waitingForServe || false;
				this.gameState.servingPlayer = gameLoopState.servingPlayer ?? -1;
			}
		}

		// Get current key state from input handler
		const keyState = this.inputHandler?.getKeyState() || {
			p1Left: false,
			p1Right: false,
			p2Left: false,
			p2Right: false,
			p3Left: false,
			p3Right: false,
			p4Left: false,
			p4Right: false,
		};

		// Check if we're waiting for serve and the serving player pressed a key
		if (this.gameLoop && this.gameState.waitingForServe) {
			const servingPlayer = this.gameState.servingPlayer;
			const playerKeys = [
				{ left: keyState.p1Left, right: keyState.p1Right },
				{ left: keyState.p2Left, right: keyState.p2Right },
				{ left: keyState.p3Left, right: keyState.p3Right },
				{ left: keyState.p4Left, right: keyState.p4Right },
			];
			
			if (servingPlayer !== undefined && servingPlayer >= 0 && servingPlayer < playerKeys.length) {
				const keys = playerKeys[servingPlayer];
				if (keys.left || keys.right) {
					// Serving player pressed a movement key - launch the serve!
					if ('launchServe' in this.gameLoop) {
						(this.gameLoop as any).launchServe();
					}
				}
			}
		}

		this.conditionalLog(`🎮 Paddle update - keyState:`, keyState);

		// Key state arrays for easy iteration
		const leftKeys = [
			keyState.p1Left,
			keyState.p2Left,
			keyState.p3Left,
			keyState.p4Left,
		];
		const rightKeys = [
			keyState.p1Right,
			keyState.p2Right,
			keyState.p3Right,
			keyState.p4Right,
		];

		// Update only active paddles with anti-drift force-based physics
		for (let i = 0; i < this.playerCount; i++) {
			const paddle = this.paddles[i];
			if (!paddle || !paddle.physicsImpostor) continue;

			// SYNC: Update gameState with actual paddle positions from physics
			if (this.playerCount === 4 && i >= 2) {
				// 4-player mode: Players 3-4 move on Z-axis
				this.gameState.paddlePositionsY[i] = paddle.position.z;
			} else if (this.playerCount === 3) {
				// 3-player mode: Project position back to rotated axis
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				const angle = angles[i];
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				const relX = paddle.position.x - this.originalGLBPositions[i].x;
				const relZ = paddle.position.z - this.originalGLBPositions[i].z;
				// Project onto the rotated axis
				this.gameState.paddlePositionsX[i] = relX * cos + relZ * sin;
			} else {
				// 2-player mode: X-axis movement only
				this.gameState.paddlePositionsX[i] = paddle.position.x;
			}

			this.conditionalLog(
				`🔄 Player ${i + 1} position synced: physics=${paddle.position.x.toFixed(3)}, gameState=${this.gameState.paddlePositionsX[i]?.toFixed(3) || 'N/A'}`
			);

			// Determine movement axis
			let axis = new BABYLON.Vector3(1, 0, 0);
			if (this.playerCount === 3) {
				// Player 1: 0°, Player 2: 120°, Player 3: 240°
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				axis = new BABYLON.Vector3(
					Math.cos(angles[i]),
					0,
					Math.sin(angles[i])
				);
			} else if (this.playerCount === 4) {
				axis =
					i >= 2
						? new BABYLON.Vector3(0, 0, 1)
						: new BABYLON.Vector3(1, 0, 0);
			}
			const axisNorm = axis.normalize();

			// --- AXIS CONSTRAINT: Snap to axis before any movement or rendering ---
			if (this.playerCount === 3 && paddle && paddle.physicsImpostor) {
				const paddleMesh = paddle as BABYLON.Mesh;
				const impostor =
					paddleMesh.physicsImpostor as BABYLON.PhysicsImpostor;
				const originalPos = this.originalGLBPositions[i];
				const posVec = new BABYLON.Vector3(
					paddleMesh.position.x,
					0,
					paddleMesh.position.z
				);
				const originVec = new BABYLON.Vector3(
					originalPos.x,
					0,
					originalPos.z
				);
				const relPos = posVec.subtract(originVec);
				const projLen = BABYLON.Vector3.Dot(relPos, axisNorm);
				const projVec = axisNorm.scale(projLen);
				const correctedPos = originVec.add(projVec);
				paddleMesh.position.x = correctedPos.x;
				paddleMesh.position.z = correctedPos.z;
				// For velocity, zero out off-axis component
				const vel = impostor.getLinearVelocity();
				if (vel) {
					const velAlong = BABYLON.Vector3.Dot(vel, axisNorm);
					const velAlongVec = axisNorm.scale(velAlong);
					impostor.setLinearVelocity(velAlongVec);
				}
			}

			// Get current state
			const originalPos = this.originalGLBPositions[i];
			const currentPos = paddle.position;
			const currentVelocity = paddle.physicsImpostor.getLinearVelocity();
			if (!currentVelocity) continue; // skip if we can't read velocity
			const velAlong = BABYLON.Vector3.Dot(currentVelocity, axisNorm);
			const speedAlong = Math.abs(velAlong);

			// Check bounds - use AI xLimit for AI players, otherwise use PADDLE_RANGE
			const posAlongAxis = BABYLON.Vector3.Dot(currentPos, axisNorm);
			const originAlongAxis = BABYLON.Vector3.Dot(
				new BABYLON.Vector3(originalPos.x, 0, originalPos.z),
				axisNorm
			);
			const paddleRange = this.inputHandler?.hasAIController(i)
				? this.inputHandler.getAIControllerConfig(i)?.xLimit ||
					this.PADDLE_RANGE
				: this.PADDLE_RANGE;
			const minBound = originAlongAxis - paddleRange;
			const maxBound = originAlongAxis + paddleRange;
			// Boundary hysteresis to avoid vibrational clamp near extremes (especially 3P P2/P3)
			const BOUND_EPS = 0.02;
			const atMin = posAlongAxis <= minBound + BOUND_EPS;
			const atMax = posAlongAxis >= maxBound - BOUND_EPS;
			const isOutOfBounds =
				posAlongAxis < minBound - BOUND_EPS ||
				posAlongAxis > maxBound + BOUND_EPS;

			// Get player input
			const inputDir = (rightKeys[i] ? 1 : 0) - (leftKeys[i] ? 1 : 0);

			this.conditionalLog(
				`🎮 Player ${i + 1} input: left=${leftKeys[i]}, right=${rightKeys[i]}, inputDir=${inputDir}`
			);

			// GRADUAL BRAKING: Apply braking force instead of instant stop
			if (inputDir === 0 && !isOutOfBounds) {
				// Apply braking force proportional to current velocity
				const brakedVelocity = currentVelocity.scale(
					this.PADDLE_BRAKING_FACTOR
				);

				// Only apply braking if velocity is above a minimum threshold
				if (brakedVelocity.length() > 0.05) {
					paddle.physicsImpostor.setLinearVelocity(brakedVelocity);
				} else {
					// Complete stop only when velocity is very small
					paddle.physicsImpostor.setLinearVelocity(
						BABYLON.Vector3.Zero()
					);
				}
				continue; // Skip all other logic when braking
			} // ANTI-DRIFT: Clamp maximum velocity to prevent runaway acceleration
			if (speedAlong > this.PADDLE_MAX_VELOCITY) {
				const clampedVel = axisNorm.scale(
					Math.sign(velAlong) * this.PADDLE_MAX_VELOCITY
				);
				// Preserve non-movement-axis velocity components (should be zero anyway)
				const perpVel = currentVelocity.subtract(
					axisNorm.scale(velAlong)
				);
				paddle.physicsImpostor.setLinearVelocity(
					clampedVel.add(perpVel)
				);
			}

			// State machine: Only apply forces when needed
			if (isOutOfBounds || atMin || atMax) {
				// PRIORITY 1: Hit boundary - stop and clamp position to prevent overshoot
				if (!this.paddleStoppedAtBoundary[i]) {
					// First time hitting boundary - stop the paddle
					paddle.physicsImpostor.setLinearVelocity(
						BABYLON.Vector3.Zero()
					);
					this.paddleStoppedAtBoundary[i] = true;
				}

				// Clamp position to boundary to prevent overshoot
				const clampedPosAlongAxis = Math.max(
					minBound,
					Math.min(maxBound, posAlongAxis)
				);
				const clampedPos = new BABYLON.Vector3(
					originalPos.x,
					paddle.position.y,
					originalPos.z
				).add(axisNorm.scale(clampedPosAlongAxis - originAlongAxis));
				paddle.position = clampedPos;

				// Allow movement back toward valid area (any inward direction)
				if (inputDir !== 0) {
					const wantedDirection = Math.sign(inputDir);
					const outward =
						(atMax && wantedDirection > 0) ||
						(atMin && wantedDirection < 0);
					if (outward) {
						// At boundary and pushing outward: hold position, zero velocity, no impulse
						paddle.physicsImpostor.setLinearVelocity(
							BABYLON.Vector3.Zero()
						);
						// keep stopped flag true until user moves inward
					} else {
						// Inward movement: apply impulse inward and clear stopped flag
						const impulse = axisNorm.scale(
							wantedDirection * this.PADDLE_FORCE
						);
						paddle.physicsImpostor.applyImpulse(
							impulse,
							paddle.getAbsolutePosition()
						);
						this.paddleStoppedAtBoundary[i] = false;
					}
				}
			} else {
				// Reset boundary stop flag when paddle is back in valid area
				if (
					posAlongAxis > minBound + BOUND_EPS &&
					posAlongAxis < maxBound - BOUND_EPS
				) {
					this.paddleStoppedAtBoundary[i] = false;
				}

				if (inputDir !== 0) {
					// PRIORITY 2: Move based on input
					const wantedDirection = Math.sign(inputDir);
					const currentDirection = Math.sign(velAlong);

					if (
						currentDirection !== 0 &&
						wantedDirection !== currentDirection
					) {
						// Need to change direction - stop first, then apply new force
						paddle.physicsImpostor.setLinearVelocity(
							BABYLON.Vector3.Zero()
						);
						const impulse = axisNorm.scale(
							wantedDirection * this.PADDLE_FORCE
						);
						paddle.physicsImpostor.applyImpulse(
							impulse,
							paddle.getAbsolutePosition()
						);
					} else {
						// Same direction or starting from rest - accelerate
						const impulse = axisNorm.scale(
							wantedDirection * this.PADDLE_FORCE
						);
						paddle.physicsImpostor.applyImpulse(
							impulse,
							paddle.getAbsolutePosition()
						);
					}
				}

				// --- SOFT AXIS CONSTRAINT: Only correct off-axis drift if it exceeds epsilon ---
				if (this.playerCount === 3) {
					const posVec = new BABYLON.Vector3(
						paddle.position.x,
						0,
						paddle.position.z
					);
					const originVec = new BABYLON.Vector3(
						originalPos.x,
						0,
						originalPos.z
					);
					const relPos = posVec.subtract(originVec);
					const projLen = BABYLON.Vector3.Dot(relPos, axisNorm);
					const projVec = axisNorm.scale(projLen);
					const offAxisVec = relPos.subtract(projVec);
					const offAxisDist = offAxisVec.length();
					const AXIS_EPSILON = 0.01; // Allowable drift before correction
					if (offAxisDist > AXIS_EPSILON) {
						// Only correct the off-axis component, keep along-axis untouched
						const correctedPos = originVec.add(projVec);
						paddle.position.x = correctedPos.x;
						paddle.position.z = correctedPos.z;
					}
					// For velocity, zero out off-axis component but keep along-axis
					const vel = paddle.physicsImpostor.getLinearVelocity();
					if (vel) {
						const velAlong = BABYLON.Vector3.Dot(vel, axisNorm);
						const velAlongVec = axisNorm.scale(velAlong);
						const offAxisVel = vel.subtract(velAlongVec);
						if (offAxisVel.length() > AXIS_EPSILON) {
							// Only zero out the off-axis velocity
							paddle.physicsImpostor.setLinearVelocity(
								velAlongVec
							);
						}
					}
				}
			}
		}
	}

	private maybeLogPaddles(): void {
		if (!this.debugPaddleLogging) return;

		const now = performance.now();
		if (now - this.lastPaddleLog < this.PADDLE_LOG_INTERVAL) return;

		this.lastPaddleLog = now;
		const activePositionsX = this.gameState.paddlePositionsX.slice(
			0,
			this.playerCount
		);
		const activePositionsY = this.gameState.paddlePositionsY.slice(
			0,
			this.playerCount
		);
		this.conditionalLog(
			'Active paddle positions X:',
			activePositionsX,
			'Y:',
			activePositionsY
		);
	}

	// Public configuration methods
	public setDefaultCameraRadius(value: number): void {
		this.DEFAULT_CAMERA_RADIUS = value;
		this.conditionalLog(
			'DEFAULT_CAMERA_RADIUS ->',
			this.DEFAULT_CAMERA_RADIUS
		);
	}

	public setDefaultCameraBeta(value: number): void {
		this.DEFAULT_CAMERA_BETA = value;
		this.conditionalLog('DEFAULT_CAMERA_BETA ->', this.DEFAULT_CAMERA_BETA);
	}

	public setDefaultCameraTargetY(value: number): void {
		this.DEFAULT_CAMERA_TARGET_Y = value;
		this.conditionalLog(
			'DEFAULT_CAMERA_TARGET_Y ->',
			this.DEFAULT_CAMERA_TARGET_Y
		);
	}

	public setUseGLBOrigin(value: boolean): void {
		this.useGLBOrigin = value;
		this.conditionalLog('useGLBOrigin ->', this.useGLBOrigin);
		// Immediately apply the new setting by refreshing the camera POV
		this.setPlayerPOV(this.thisPlayer);
	}

	public setPhysicsTimeStep(timeStep: number): void {
		if (timeStep > 0) {
			this.PHYSICS_TIME_STEP = timeStep;
			GameConfig.setPhysicsTimeStep(timeStep);
			const physicsEngine = this.scene.getPhysicsEngine();
			if (physicsEngine) {
				physicsEngine.setTimeStep(this.PHYSICS_TIME_STEP);
				this.conditionalLog(
					'Physics time step updated to:',
					this.PHYSICS_TIME_STEP
				);
			}
		}
	}

	public getPhysicsTimeStep(): number {
		return this.PHYSICS_TIME_STEP;
	}

	public setPhysicsSolverIterations(iterations: number): void {
		const iters = Math.max(1, Math.min(100, Math.floor(iterations)));
		this.PHYSICS_SOLVER_ITERATIONS = iters;
		GameConfig.setPhysicsSolverIterations(iters);
		// Try to update live plugin if available
		const physicsEngine: any = this.scene.getPhysicsEngine?.() ?? null;
		const plugin: any = physicsEngine?._physicsPlugin ?? this.physicsPlugin;
		try {
			if (plugin && plugin.world && plugin.world.solver) {
				plugin.world.solver.iterations = iters;
				this.conditionalLog('Physics solver iterations ->', iters);
			}
		} catch (_) {
			// Silent if plugin internals are not accessible
		}
	}

	public getPhysicsSolverIterations(): number {
		return this.PHYSICS_SOLVER_ITERATIONS;
	}

	public setPaddleRange(value: number): void {
		this.PADDLE_RANGE = value;
		GameConfig.setPaddleRange(value);
		this.conditionalLog('PADDLE_RANGE ->', this.PADDLE_RANGE);
	}

	public setPaddleSpeed(value: number): void {
		this.PADDLE_FORCE = value;
		GameConfig.setPaddleForce(value);
		this.conditionalLog('PADDLE_FORCE (speed) ->', this.PADDLE_FORCE);
	}

	public setBallAngleMultiplier(multiplier: number): void {
		this.BALL_ANGLE_MULTIPLIER = Math.max(0, Math.min(50, multiplier));
		GameConfig.setBallAngleMultiplier(this.BALL_ANGLE_MULTIPLIER);
		this.conditionalLog(
			'BALL_ANGLE_MULTIPLIER ->',
			this.BALL_ANGLE_MULTIPLIER
		);
	}

	public setSpinDelayMs(delayMs: number): void {
		const clamped = Math.max(0, Math.min(10000, Math.floor(delayMs)));
		GameConfig.setSpinDelayMs(clamped);
		this.ballEffects.setSpinDelay(clamped);
		this.ballManager.setSpinDelayMs(clamped);
		if (this.mainBallEntity) {
			this.mainBallEntity.setSpinDelay(clamped);
		}
	}

	public setBallVelocityConstant(speed: number): void {
		this.ballEffects.setBallVelocityConstant(speed);
		this.conditionalLog('BALL_VELOCITY_CONSTANT ->', speed);
	}

	public setOnGoalCallback(
		callback: (scoringPlayer: number, goalPlayer: number) => void
	): void {
		this.onGoalCallback = callback;
		this.conditionalLog('Goal callback set');
	}

	public togglePaddleLogging(enabled?: boolean): void {
		if (typeof enabled === 'boolean') {
			this.debugPaddleLogging = enabled;
		} else {
			this.debugPaddleLogging = !this.debugPaddleLogging;
		}
		this.conditionalLog('debugPaddleLogging ->', this.debugPaddleLogging);
	}

	/** Set individual paddle position */
	public setPaddlePosition(index: number, position: number): void {
		if (index >= 0 && index < 4) {
			// Use AI xLimit for AI players, otherwise use PADDLE_RANGE
			const rangeLimit = this.inputHandler?.hasAIController(index)
				? this.inputHandler.getAIControllerConfig(index)?.xLimit ||
					this.PADDLE_RANGE
				: this.PADDLE_RANGE;
			const clampedPosition = Math.max(
				-rangeLimit,
				Math.min(rangeLimit, position)
			);

			if (this.playerCount === 4 && index >= 2) {
				// 4-player mode: Players 3-4 move on Y-axis
				this.gameState.paddlePositionsY[index] = clampedPosition;
				if (this.paddles[index]) {
					// Update physics impostor position (mesh will follow automatically)
					if (
						this.paddles[index]!.physicsImpostor &&
						this.paddles[index]!.physicsImpostor.physicsBody
					) {
						this.paddles[
							index
						]!.physicsImpostor.physicsBody.position.set(
							this.paddles[index]!.position.x,
							this.paddles[index]!.position.y,
							clampedPosition
						);
						// Mesh position will be updated by physics engine
					} else {
						// Fallback: update mesh directly if no physics impostor
						this.paddles[index]!.position.z = clampedPosition;
					}
				}
			} else if (this.playerCount === 3) {
				// 3-player mode: Position represents movement along rotated axis
				// Player 1: 0°, Player 2: 120°, Player 3: 240°
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				const angle = angles[index];
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);

				// Set position along the rotated axis
				this.gameState.paddlePositionsX[index] = clampedPosition * cos;
				this.gameState.paddlePositionsY[index] = clampedPosition * sin;

				if (this.paddles[index]) {
					// Update physics impostor position (mesh will follow automatically)
					if (
						this.paddles[index]!.physicsImpostor &&
						this.paddles[index]!.physicsImpostor.physicsBody
					) {
						this.paddles[
							index
						]!.physicsImpostor.physicsBody.position.set(
							this.gameState.paddlePositionsX[index],
							this.paddles[index]!.position.y,
							this.gameState.paddlePositionsY[index]
						);
						// Mesh position will be updated by physics engine
					} else {
						// Fallback: update mesh directly if no physics impostor
						this.paddles[index]!.position.x =
							this.gameState.paddlePositionsX[index];
						this.paddles[index]!.position.z =
							this.gameState.paddlePositionsY[index];
					}
				}
			} else {
				// 2-player mode: X-axis movement only
				this.gameState.paddlePositionsX[index] = clampedPosition;
				if (this.paddles[index]) {
					// Update physics impostor position (mesh will follow automatically)
					if (
						this.paddles[index]!.physicsImpostor &&
						this.paddles[index]!.physicsImpostor.physicsBody
					) {
						this.paddles[
							index
						]!.physicsImpostor.physicsBody.position.set(
							clampedPosition,
							this.paddles[index]!.position.y,
							this.paddles[index]!.position.z
						);
						// Mesh position will be updated by physics engine
					} else {
						// Fallback: update mesh directly if no physics impostor
						this.paddles[index]!.position.x = clampedPosition;
					}
				}
			}
		}
	}

	/** Get individual paddle position */
	public getPaddlePosition(index: number): number {
		// Return position from appropriate axis based on player index and mode
		if (this.playerCount === 4 && index >= 2) {
			return this.gameState.paddlePositionsY[index] || 0;
		} else if (this.playerCount === 3) {
			// For 3-player mode, return the position along the rotated axis
			// Player 1: 0°, Player 2: 120°, Player 3: 240°
			const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
			const angle = angles[index];
			const cos = Math.cos(angle);
			const sin = Math.sin(angle);
			const x = this.gameState.paddlePositionsX[index] || 0;
			const y = this.gameState.paddlePositionsY[index] || 0;

			// Project the 2D position back to the 1D rotated axis
			return x * cos + y * sin;
		} else {
			return this.gameState.paddlePositionsX[index] || 0;
		}
	}

	/** Get all paddle positions */
	public getPaddlePositions(): number[] {
		const positions: number[] = [];
		for (let i = 0; i < 4; i++) {
			if (this.playerCount === 4 && i >= 2) {
				positions[i] = this.gameState.paddlePositionsY[i];
			} else if (this.playerCount === 3) {
				// For 3-player mode, return position along rotated axis
				// Player 1: 0°, Player 2: 120°, Player 3: 240°
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				const angle = angles[i];
				const cos = Math.cos(angle);
				const sin = Math.sin(angle);
				const x = this.gameState.paddlePositionsX[i] || 0;
				const y = this.gameState.paddlePositionsY[i] || 0;
				positions[i] = x * cos + y * sin;
			} else {
				positions[i] = this.gameState.paddlePositionsX[i];
			}
		}
		return positions;
	}

	public resetPaddles(positions?: number[]): void {
		if (positions) {
			for (
				let i = 0;
				i < Math.min(positions.length, this.playerCount);
				i++
			) {
				if (this.playerCount === 4 && i >= 2) {
					this.gameState.paddlePositionsY[i] = positions[i];
				} else if (this.playerCount === 3) {
					// For 3-player mode, position represents movement along rotated axis
					// Player 1: 0°, Player 2: 120°, Player 3: 240°
					const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
					const angle = angles[i];
					const cos = Math.cos(angle);
					const sin = Math.sin(angle);
					this.gameState.paddlePositionsX[i] = positions[i] * cos;
					this.gameState.paddlePositionsY[i] = positions[i] * sin;
				} else {
					this.gameState.paddlePositionsX[i] = positions[i];
				}
			}
		} else {
			// Reset active players to center
			for (let i = 0; i < this.playerCount; i++) {
				this.gameState.paddlePositionsX[i] = 0;
				this.gameState.paddlePositionsY[i] = 0;
			}
		}

		// Update mesh positions for active players
		for (let i = 0; i < this.playerCount; i++) {
			if (this.paddles[i]) {
				if (this.playerCount === 4 && i >= 2) {
					this.paddles[i]!.position.z =
						this.gameState.paddlePositionsY[i];
				} else if (this.playerCount === 3) {
					this.paddles[i]!.position.x =
						this.gameState.paddlePositionsX[i];
					this.paddles[i]!.position.z =
						this.gameState.paddlePositionsY[i];
				} else {
					this.paddles[i]!.position.x =
						this.gameState.paddlePositionsX[i];
				}
			}
		}
	}

	// Lighting setters

	public setImportedLightScale(factor: number): void {
		if (typeof factor === 'number' && factor >= 0) {
			this.importedLightScale = factor;
			this.conditionalLog(
				'importedLightScale ->',
				this.importedLightScale
			);
		}
	}

	// Getters for debugging
	public getPaddle(index: number): BABYLON.Mesh | null {
		return this.paddles[index] || null;
	}

	public getPaddles(): (BABYLON.Mesh | null)[] {
		return [...this.paddles];
	}

	public getGameState(): GameState {
		return {
			paddlePositionsX: [...this.gameState.paddlePositionsX],
			paddlePositionsY: [...this.gameState.paddlePositionsY],
		};
	}

	/** Get player names */
	public getPlayerNames(): string[] {
		return [...this.playerNames];
	}

	/** Get player scores */
	public getPlayerScores(): number[] {
		return [...this.playerScores];
	}

	/**
	 * Get an inward-facing serve direction for a paddle (XZ plane normal toward arena)
	 * Used by the serve system to ensure serves go into the court for all layouts (2p/3p/4p).
	 */
	public getServeDirectionForPaddle(index: number): BABYLON.Vector3 {
		const paddle = this.paddles[index];
		if (!paddle) return new BABYLON.Vector3(0, 0, 0);
		// Robust inward direction: vector from paddle to arena origin in XZ plane
		const toCenter = new BABYLON.Vector3(
			0 - paddle.position.x,
			0,
			0 - paddle.position.z
		);
		if (toCenter.lengthSquared() > 1e-6) return toCenter.normalize();
		return new BABYLON.Vector3(0, 0, 0);
	}

	/** Clamp a serve direction against the standard angular return limit */
	public enforceAngularLimitForDirection(
		normal: BABYLON.Vector3,
		desired: BABYLON.Vector3,
		limitRad: number = this.ANGULAR_RETURN_LIMIT
	): BABYLON.Vector3 {
		return this.clampDirectionToLimit(normal, desired, limitRad);
	}

	/** Apply Magnus force to all active split balls using the same spin state */
	private applyMagnusToSplitBalls(): void {
		if (this.splitBalls.length === 0) return;
		// Remember original mesh bound to ballEffects
		const originalMesh = this.ballMesh || null;
		for (const sb of this.splitBalls) {
			if (!sb.mesh || !sb.impostor) continue;
			// Temporarily bind effects to this split ball and apply Magnus
			this.ballEffects.setBallMesh(sb.mesh);
			this.ballEffects.applyMagnusForce();
			// Ensure Y velocity is locked to plane
			const v = sb.impostor.getLinearVelocity();
			if (v && Math.abs(v.y) > 0.0001) {
				sb.impostor.setLinearVelocity(new BABYLON.Vector3(v.x, 0, v.z));
			}
		}
		// Restore original main ball binding
		this.ballEffects.setBallMesh(originalMesh);
	}

	/** Get active player count */
	public getActivePlayerCount(): number {
		return this.playerCount;
	}

	/** Get initial player count (max possible) */
	public getInitialPlayerCount(): number {
		return this.playerCount;
	}

	/** Check if game is in local 2-player mode */
	public isLocal(): boolean {
		return this.local;
	}

	/** Check if a player index is active */
	public isPlayerActive(index: number): boolean {
		return index >= 0 && index < this.playerCount;
	}

	// ============================================================================
	// GAME LOOP CONTROL METHODS
	// ============================================================================

	/** Start the game loop */
	public startGame(): void {
		this.clearLocalTournamentTrophy();
		// If no current server is set (first game), pick a random player to serve from those with paddles
		if (this.currentServer === -1) {
			const validServers = [];
			for (let i = 0; i < this.playerCount; i++) {
				if (this.paddles[i]) {
					validServers.push(i);
				}
			}
			if (validServers.length > 0) {
				this.currentServer =
					validServers[
						Math.floor(Math.random() * validServers.length)
					];
			} else {
				// Fallback to random if no valid paddles (shouldn't happen)
				this.currentServer = Math.floor(
					Math.random() * this.playerCount
				);
			}
		}

		if (this.gameLoop) {
			this.gameLoop.start();
		}

		// Reset hit tracking for new game
		this.lastPlayerToHitBall = -1;
		this.secondLastPlayerToHitBall = -1;
		this.clearRecentHitters();

		this.conditionalLog(
			`🎮 Game started: First server is Player ${this.currentServer + 1} (index ${this.currentServer})`
		);

		// Ensure ball effects start fresh when game begins
		this.ballEffects.resetAllEffects();
		this.conditionalLog(`🎮 Game started: Ball effects initialized`);
	}

	/** Stop the game loop */
	public stopGame(): void {
		if (this.gameLoop) {
			this.gameLoop.stop();
		}
	}

	/** Reset the ball to center position */
	public resetBall(): void {
		if (this.gameLoop) {
			this.gameLoop.resetBall();
		}
		// Reset rally speed when ball is manually reset
		this.resetRallySpeed();

		// IMPORTANT: Reset all ball effects on manual reset
		this.ballEffects.resetAllEffects();
		this.conditionalLog(`🔄 Manual ball reset: All effects cleared`);
	}

	/** Set rally speed increment percentage */
	public setRallySpeedIncrement(percentage: number): void {
		this.ballEffects.setRallySpeedIncrement(percentage);
		this.conditionalLog(`🚀 Rally speed increment set to ${percentage}%`);
	}

	/** Set maximum ball speed to prevent tunneling */
	public setMaxBallSpeed(maxSpeed: number): void {
		this.ballEffects.setMaxBallSpeed(maxSpeed);
		this.conditionalLog(`🏎️ Maximum ball speed set to ${maxSpeed}`);
	}

	/** Set winning score needed to end the game */
	public setWinningScore(score: number): void {
		this.WINNING_SCORE = Math.max(1, Math.min(100, score)); // Clamp between 1 and 100
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🏆 Winning score set to ${this.WINNING_SCORE} points`
			);
		}
	}

	/** Get current rally information */
	public getRallyInfo(): {
		hitCount: number;
		currentSpeed: number;
		baseSpeed: number;
		speedIncrease: number;
		maxSpeed: number;
	} {
		return this.ballEffects.getRallyInfo();
	}

	/** Set ball velocity (for testing different speeds) */
	public setBallVelocity(velocity: BABYLON.Vector3): void {
		if (this.gameLoop) {
			this.gameLoop.setBallVelocity(velocity);
		}
	}

	/** Get current game state from the game loop */
	public getGameLoopState(): any {
		return this.gameLoop ? this.gameLoop.getGameState() : null;
	}

	/**
	 * Get the collision normal from Cannon.js collision event
	 * This provides the actual surface normal at the collision point
	 */
	private getCollisionNormal(
		ballImpostor: BABYLON.PhysicsImpostor,
		paddleImpostor: BABYLON.PhysicsImpostor
	): BABYLON.Vector3 | null {
		try {
			// Get the physics bodies
			const ballBody = ballImpostor.physicsBody;
			const paddleBody = paddleImpostor.physicsBody;

			if (!ballBody || !paddleBody) return null;

			// Access the Cannon.js world to get contact information
			const world = ballBody.world;
			if (!world) return null;

			// Find the contact between these two bodies
			let contact = null;
			for (let i = 0; i < world.contacts.length; i++) {
				const c = world.contacts[i];
				if (
					(c.bi === ballBody && c.bj === paddleBody) ||
					(c.bi === paddleBody && c.bj === ballBody)
				) {
					contact = c;
					break;
				}
			}

			if (!contact) {
				this.conditionalWarn(
					'No contact found between ball and paddle'
				);
				return null;
			}

			// Get the contact normal
			// The normal always points from body i to body j
			let normal = contact.ni.clone();

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🔧 Raw Cannon.js contact normal: (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`
				);
				this.conditionalLog(
					`🔧 Contact: body i = ${contact.bi === ballBody ? 'ball' : 'paddle'}, body j = ${contact.bj === ballBody ? 'ball' : 'paddle'}`
				);
			}

			// If ball is body j, we need to flip the normal to point from paddle to ball
			if (contact.bj === ballBody) {
				normal.negate();
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🔧 Flipped normal (ball is body j): (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`
					);
				}
			}

			// Convert from Cannon Vector3 to Babylon Vector3
			const babylonNormal = new BABYLON.Vector3(
				normal.x,
				normal.y,
				normal.z
			);

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🔧 Final collision normal: (${babylonNormal.x.toFixed(3)}, ${babylonNormal.y.toFixed(3)}, ${babylonNormal.z.toFixed(3)})`
				);
			}

			// Project the normal to X-Z plane (we constrain motion to XZ)
			const normalizedNormal = babylonNormal.normalize();
			const normalXZ = new BABYLON.Vector3(
				normalizedNormal.x,
				0,
				normalizedNormal.z
			);
			if (normalXZ.length() > 0.1) {
				const correctedNormal = normalXZ.normalize();
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🔧 Projected normal to X-Z plane: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
					);
				}
				return correctedNormal;
			} else {
				// If X-Z components are too small, this might be a top/bottom collision
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalWarn(
						`🚨 Normal has minimal X-Z components: (${normalXZ.x.toFixed(3)}, ${normalXZ.y.toFixed(3)}, ${normalXZ.z.toFixed(3)})`
					);
				}
				// Fall back to the normalized original to avoid returning a zero vector
				return normalizedNormal;
			}
		} catch (error) {
			this.conditionalWarn(
				'Failed to get collision normal from Cannon.js:',
				error
			);
			return null;
		}
	}

	/**
	 * Calculate the actual surface normal of a paddle mesh
	 * This uses the mesh geometry to determine the true normal direction
	 */
	private getPaddleNormal(
		paddle: BABYLON.Mesh,
		paddleIndex: number
	): BABYLON.Vector3 | null {
		try {
			// Get the paddle's bounding box to understand its orientation
			const boundingInfo = paddle.getBoundingInfo();
			const size = boundingInfo.maximum.subtract(boundingInfo.minimum);

			// For a paddle, the smallest dimension should be the thickness (normal direction)
			// The largest dimensions are the width and height of the paddle face
			const dimensions = [
				{
					axis: 'x',
					size: Math.abs(size.x),
					vector: new BABYLON.Vector3(1, 0, 0),
				},
				{
					axis: 'y',
					size: Math.abs(size.y),
					vector: new BABYLON.Vector3(0, 1, 0),
				},
				{
					axis: 'z',
					size: Math.abs(size.z),
					vector: new BABYLON.Vector3(0, 0, 1),
				},
			];

			// Sort by size - smallest should be the thickness (normal direction)
			dimensions.sort((a, b) => a.size - b.size);

			// The normal should be along the axis with the smallest dimension
			let normal = dimensions[0].vector.clone();

			// Apply the paddle's world transformation to the normal
			if (paddle.rotationQuaternion) {
				normal = BABYLON.Vector3.TransformCoordinates(
					normal,
					paddle.getWorldMatrix()
				);
			} else if (
				paddle.rotation &&
				(paddle.rotation.x !== 0 ||
					paddle.rotation.y !== 0 ||
					paddle.rotation.z !== 0)
			) {
				const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
					paddle.rotation.y,
					paddle.rotation.x,
					paddle.rotation.z
				);
				normal = BABYLON.Vector3.TransformCoordinates(
					normal,
					rotationMatrix
				);
			}

			normal = normal.normalize();

			// Robust inward normal for 3P courts: use paddle->center vector in XZ plane
			if (this.playerCount === 3) {
				const inwardXZ = new BABYLON.Vector3(
					-paddle.position.x,
					0,
					-paddle.position.z
				);
				if (inwardXZ.lengthSquared() > 1e-6) {
					normal = inwardXZ.normalize();
				}
			} else {
				// Ensure the normal points toward the center of the play area (inward)
				const paddleToCenter = new BABYLON.Vector3(0, 0, 0).subtract(
					paddle.position
				);
				paddleToCenter.normalize();
				if (BABYLON.Vector3.Dot(normal, paddleToCenter) < 0) {
					normal.scaleInPlace(-1);
				}
			}

			this.conditionalLog(
				`🎯 Paddle ${paddleIndex + 1} calculated normal: (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`
			);
			this.conditionalLog(
				`🎯 Paddle ${paddleIndex + 1} dimensions: x=${size.x.toFixed(3)}, y=${size.y.toFixed(3)}, z=${size.z.toFixed(3)}`
			);

			return normal;
		} catch (error) {
			this.conditionalWarn(
				`Failed to calculate paddle normal for paddle ${paddleIndex + 1}:`,
				error
			);
			return null;
		}
	}

	/** Compute signed angle between two XZ-plane vectors around Y axis */
	private signedAngleXZ(from: BABYLON.Vector3, to: BABYLON.Vector3): number {
		const a = new BABYLON.Vector3(from.x, 0, from.z).normalize();
		const b = new BABYLON.Vector3(to.x, 0, to.z).normalize();
		const dot = BABYLON.Vector3.Dot(a, b);
		const clampedDot = Math.max(-1, Math.min(1, dot));
		const crossY = a.x * b.z - a.z * b.x; // Y component of cross(a,b)
		const angle = Math.acos(clampedDot);
		return crossY >= 0 ? angle : -angle;
	}

	private enforceAngularLimitXZ(
		normal: BABYLON.Vector3,
		desired: BABYLON.Vector3,
		limitRad: number
	): {
		direction: BABYLON.Vector3;
		signedAngle: number;
		requestedAngle: number;
		clamped: boolean;
	} {
		const epsilon = 1e-6;

		const normalXZ = new BABYLON.Vector3(normal.x, 0, normal.z);
		const basisNormal =
			normalXZ.lengthSquared() > epsilon
				? normalXZ.normalize()
				: new BABYLON.Vector3(0, 0, 1);

		let desiredXZ = new BABYLON.Vector3(desired.x, 0, desired.z);
		if (desiredXZ.lengthSquared() <= epsilon) {
			desiredXZ = basisNormal.clone();
		} else {
			desiredXZ.normalize();
		}

		let requestedAngle = this.signedAngleXZ(basisNormal, desiredXZ);
		if (!Number.isFinite(requestedAngle)) {
			requestedAngle = 0;
		}

		const maxAngle = Math.max(0, limitRad);
		const signedAngle = Math.max(
			-maxAngle,
			Math.min(maxAngle, requestedAngle)
		);
		const clamped = Math.abs(signedAngle - requestedAngle) > 1e-4;

		let enforcedDirection: BABYLON.Vector3;
		if (clamped) {
			const rotation = BABYLON.Matrix.RotationAxis(
				BABYLON.Vector3.Up(),
				signedAngle
			);
			const rotated = BABYLON.Vector3.TransformCoordinates(
				basisNormal,
				rotation
			);
			enforcedDirection = new BABYLON.Vector3(
				rotated.x,
				0,
				rotated.z
			).normalize();
		} else {
			enforcedDirection = desiredXZ.clone().normalize();
		}

		return {
			direction: enforcedDirection,
			signedAngle,
			requestedAngle,
			clamped,
		};
	}

	/** Clamp a desired outgoing direction to an angular limit relative to a normal (XZ plane) */
	private clampDirectionToLimit(
		normal: BABYLON.Vector3,
		desired: BABYLON.Vector3,
		limitRad: number
	): BABYLON.Vector3 {
		return this.enforceAngularLimitXZ(normal, desired, limitRad).direction;
	}

	/** Set the last player to hit the ball (used by game loop for serve tracking) */
	public setLastPlayerToHitBall(playerIndex: number): void {
		this.lastPlayerToHitBall = playerIndex;
		// Also update the ball entity's hit history for proper scoring
		if (this.mainBallEntity) {
			this.mainBallEntity.recordHit(playerIndex);
		}
	}

	/**
	 * Dispose of Babylon resources, stop render loop, remove event listeners, and clean up canvas.
	 * Call this when destroying the game or navigating away to prevent memory leaks.
	 */
	public dispose(): void {
		this.conditionalLog('🧹 Disposing Pong3D instance...');
		this.clearSplitBalls();
		this.teardownGlowEffects();
		this.clearLocalTournamentTrophy();

		// Stop the render loop first
		if (this.engine) {
			this.engine.stopRenderLoop();
			this.conditionalLog('✅ Stopped render loop');
		}

		// Clean up game loop
		if (this.gameLoop) {
			this.gameLoop.stop();
			this.gameLoop = null;
			this.conditionalLog('✅ Cleaned up game loop');
		}

		// Clean up input handler
		if (this.inputHandler) {
			this.inputHandler.cleanup();
			this.inputHandler = null;
			this.conditionalLog('✅ Cleaned up input handler');
		}

		// Remove window resize listener
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
			this.conditionalLog('✅ Removed resize event listener');
		}

		// Remove document event listeners
		if (this.remoteScoreUpdateHandler) {
			document.removeEventListener(
				'remoteScoreUpdate',
				this.remoteScoreUpdateHandler
			);
			this.remoteScoreUpdateHandler = undefined;
			this.conditionalLog('✅ Removed remoteScoreUpdate event listener');
		}

		if (this.remoteGameStateHandler) {
			document.removeEventListener(
				'remoteGameState',
				this.remoteGameStateHandler
			);
			this.remoteGameStateHandler = undefined;
			this.conditionalLog('✅ Removed remoteGameState event listener');
		}

		// Dispose audio system
		if (this.audioSystem) {
			this.audioSystem.dispose();
			this.conditionalLog('✅ Disposed audio system');
		}

		if (this.powerupManager) {
			this.powerupManager.setTypeBlocked('stretch', false);
			this.powerupManager.clearActivePowerups();
			this.powerupManager = null;
			this.conditionalLog('✅ Cleared power-up manager');
		}

		// Clear any pending timeouts to prevent memory leaks
		if (this.activeStretchTimeout !== null) {
			window.clearTimeout(this.activeStretchTimeout);
			this.activeStretchTimeout = null;
		}
		this.paddleStretchTimeouts.forEach(timeoutId => {
			window.clearTimeout(timeoutId);
		});
		this.paddleStretchTimeouts.clear();
		this.conditionalLog('✅ Cleared pending timeouts');

		// Dispose of Babylon scene (this also disposes meshes, materials, textures, etc.)
		if (this.scene) {
			this.scene.dispose();
			this.conditionalLog('✅ Disposed Babylon scene');
		}

		// Dispose of Babylon engine
		if (this.engine) {
			this.engine.dispose();
			this.conditionalLog('✅ Disposed Babylon engine');
		}

		// Remove canvas from DOM
		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
			this.conditionalLog('✅ Removed canvas from DOM');
		}

		// Clear ball manager and related resources
		if (this.ballManager) {
			this.ballManager.clear();
			this.ballManager = null as any;
			this.conditionalLog('✅ Cleared ball manager');
		}

		// Clear references to help with garbage collection
		this.guiTexture = null;
		this.ballMesh = null;
		this.paddles = [null, null, null, null];
		this.goalMeshes = [null, null, null, null];
		this.defenceMeshes = [null, null, null, null];
		this.scene = null as any;
		this.engine = null as any;
		this.canvas = null as any;
		this.camera = null as any;

		this.conditionalLog('🎉 Pong3D disposal complete');
	}

	/**
	 * Send game state to all clients (Master mode only)
	 */
	private sendGameStateToClients(gameState: any): void {
		// Reduced logging - only log structure occasionally, not every call
		// this.conditionalLog('📡 Master sending game state to clients:', gameState);

		try {
			// Send via WebSocket using team's message format
			const payloadString = JSON.stringify(gameState);
			const message: Message = {
				t: MESSAGE_GAME_STATE,
				d: payloadString,
			} as unknown as Message;
			webSocket.send(message);

			// Only log the WebSocket message structure occasionally for debugging
			// this.conditionalLog('📡 WebSocket message (GAME_STATE):', message);
		} catch (err) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalWarn(
					'Failed to send gamestate to clients over websocket',
					err
				);
			}
		}
	}

	/**
	 * Send sound effect to clients (Master mode only)
	 */
	private sendSoundEffectToClients(soundType: number): void {
		if (this.gameMode !== 'master') {
			return; // Only master sends sound effects
		}

		try {
			// Send via WebSocket using game's message format
			const soundData = { s: soundType }; // s = sound id (see SOUND_* constants)
			const payloadString = JSON.stringify(soundData);
			const message: Message = {
				t: MESSAGE_GAME_STATE,
				d: payloadString,
			} as unknown as Message;
			webSocket.send(message);

			this.conditionalLog(
				`🔊 Master sent sound effect ${soundType} to clients`
			);
		} catch (err) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalWarn(
					'Failed to send sound effect to clients over websocket',
					err
				);
			}
		}
	}

	/**
	 * Handle remote sound effect from WebSocket (both master and client modes)
	 */
	private handleRemoteSoundEffect(soundType: number): void {
		this.conditionalLog(`🔊 Remote sound effect received: ${soundType}`);

		// Play the appropriate sound effect based on type
		if (soundType === Pong3D.SOUND_PADDLE) {
			// Paddle ping
			this.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');
		} else if (soundType === Pong3D.SOUND_WALL) {
			// Wall ping
			this.audioSystem.playSoundEffectWithHarmonic('ping', 'wall');
		} else if (soundType === Pong3D.SOUND_POWERUP_BALL) {
			this.audioSystem.playSoundEffectWithHarmonic('dong', 'powerupHigh');
		} else if (soundType === Pong3D.SOUND_POWERUP_WALL) {
			this.audioSystem.playSoundEffectWithHarmonic('dong', 'powerupLow');
		} else {
			this.conditionalWarn(`Unknown sound effect type: ${soundType}`);
		}
	}

	/**
	 * Send score update to clients (Master mode only)
	 */
	private sendScoreUpdateToClients(scoringPlayerIndex: number): void {
		try {
			// Log current sessionStorage state for debugging
			this.conditionalLog('📡 Current sessionStorage UIDs:');
			for (let i = 1; i <= 4; i++) {
				const uid = GameConfig.getPlayerUID(i as 1 | 2 | 3 | 4);
				this.conditionalLog(`  📡 Player ${i} UID: ${uid || 'null'}`);
			}

			// Direct mapping: scoringPlayerIndex (0-based paddle/goal index) -> playerNumber (1-based UID key)
			// scoringPlayerIndex 0 = paddle1/goal1 defender = player1 UID
			// scoringPlayerIndex 1 = paddle2/goal2 defender = player2 UID
			// This mapping is consistent regardless of local/remote mode because the scoring logic
			// operates on the actual game-world paddle indices, not relative player positions
			const playerNumber = (scoringPlayerIndex + 1) as 1 | 2 | 3 | 4;
			const scoringPlayerUID = GameConfig.getPlayerUID(playerNumber);

			this.conditionalLog(
				`📡 Retrieved UID for scoring player ${scoringPlayerIndex} (mapped to player ${playerNumber}): ${scoringPlayerUID || 'null'}`
			);

			if (!scoringPlayerUID) {
				this.conditionalWarn(
					`No UID found for player ${playerNumber}, cannot send score update`
				);
				return;
			}

			this.conditionalLog(
				`🏆 Sending score update for Player ${scoringPlayerIndex} (UID: ${scoringPlayerUID})`
			);

			// Send via WebSocket using team's message format
			const message: Message = {
				t: MESSAGE_POINT,
				d: scoringPlayerUID,
			} as unknown as Message;
			this.conditionalLog(
				'📡 MESSAGE_POINT payload being sent:',
				JSON.stringify(message)
			);
			webSocket.send(message);

			this.conditionalLog(
				`📡 WebSocket message (POINT) sent successfully`
			);
		} catch (err) {
			this.conditionalWarn(
				'Failed to send score update to clients over websocket',
				err
			);
		}
	}

	/**
	 * Handle remote score update from WebSocket (client mode only)
	 */
	private handleRemoteScoreUpdate(scoringPlayerUID: string): void {
		this.conditionalLog(
			'🎮 handleRemoteScoreUpdate called with UID:',
			scoringPlayerUID
		);
		if (this.gameMode !== 'client') {
			this.conditionalWarn(
				'handleRemoteScoreUpdate called in non-client mode'
			);
			return;
		}

		if (!this.gameLoop?.getGameState().isRunning || this.gameEnded) {
			this.conditionalLog(
				'🎮 Ignoring score update because client game is not running'
			);
			return;
		}

		// Find the player index from the UID
		// Direct mapping: player1 UID -> index 0, player2 UID -> index 1, etc.
		// This matches the master's sending logic (scoringPlayerIndex 0 -> player1 UID)
		let scoringPlayerIndex = -1;
		
		for (let i = 0; i < this.playerCount; i++) {
			const playerUID = GameConfig.getPlayerUID(
				(i + 1) as 1 | 2 | 3 | 4
			);
			this.conditionalLog(
				`🎮 Checking player ${i + 1} UID:`,
				playerUID
			);
			if (playerUID === scoringPlayerUID) {
				scoringPlayerIndex = i;
				this.conditionalLog(
					`🎮 Match found! Scoring player index: ${scoringPlayerIndex}`
				);
				break;
			}
		}

		if (scoringPlayerIndex === -1) {
			this.conditionalWarn(
				`Could not find player with UID: ${scoringPlayerUID}`
			);
			return;
		}

		this.conditionalLog(
			`🎮 Found scoring player index: ${scoringPlayerIndex} for UID: ${scoringPlayerUID}`
		);

		// Update the score
		this.playerScores[scoringPlayerIndex]++;
		this.flashPaddleGlow(scoringPlayerIndex + 1);
		this.conditionalLog(
			`Remote score update: Player ${scoringPlayerIndex + 1} scored (UID: ${scoringPlayerUID}), new score: ${this.playerScores[scoringPlayerIndex]}`
		);
		this.conditionalWarn(
			`Remote score update: Player ${scoringPlayerIndex + 1} scored (UID: ${scoringPlayerUID}), new score: ${this.playerScores[scoringPlayerIndex]}`
		);

		// Update the UI
		this.updatePlayerInfoDisplay();

		// Check if player has won
		if (this.playerScores[scoringPlayerIndex] >= this.WINNING_SCORE) {
			const playerName =
				this.playerNames[scoringPlayerIndex] ||
				`Player ${scoringPlayerIndex + 1}`;
			this.conditionalLog(
				`🏆 GAME OVER! ${playerName} wins with ${this.WINNING_SCORE} points!`
			);

			// Play victory sound effect
			this.audioSystem.playSoundEffect('victory');

			// Show winner UI
			if (this.uiHandles) {
				this.uiHandles.showWinner(scoringPlayerIndex, playerName);
			}

			// Mark game as ended
			this.gameEnded = true;

			// Stop the game loop
			if (this.gameLoop) {
				this.gameLoop.stop();
			}

			if (
				sessionStorage.getItem('gameMode') === 'remote' &&
				sessionStorage.getItem('tournament') === '0'
			) {
				state.replayCounter = 0;
				new ReplayModal(this.container, 'remote');
				// location.hash = '#home';
			}

			// Wait 2 seconds for victory handling before redirecting when acting as master
			setTimeout(() => {
				state.gameOngoing = false;
				this.conditionalLog(
					'🏆 Victory handler delay finished, gameOngoing set to false'
				);

				// if we are in a tournament redirect to tournament page
				if (
					sessionStorage.getItem('gameMode') === 'remote' &&
					sessionStorage.getItem('tournament') === '1'
				) {
					this.conditionalLog(
						'remote game, tourn = 1 -> redirect to tournament'
					);
					location.hash = '#tournament';
				}
			}, 4500);
		}
	}

	/**
	 * Send input to master (Client mode only)
	 */
	private sendInputToMaster(input: { k: number }): void {
		// Reduced logging for input - only log occasionally
		// this.conditionalLog(`📡 Player ${this.thisPlayer} sending input to master:`, input);

		try {
			// Send via WebSocket using team's message format
			// Format expected by gameListener: { playerId: number, input: { k: number } }
			const moveData = {
				playerId: this.thisPlayer,
				input: input,
			};
			const payloadString = JSON.stringify(moveData);
			const message: Message = {
				t: MESSAGE_MOVE,
				d: payloadString,
			} as unknown as Message;
			webSocket.send(message);

			// Only log the WebSocket message structure occasionally for debugging
			// this.conditionalLog('📡 WebSocket message (MOVE):', message);
		} catch (err) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalWarn(
					'Failed to send input to master over websocket',
					err
				);
			}
		}
	}

	private handleLocalTournamentElimination(): {
		eliminatedAlias: string;
		remainingPlayers: number;
		tournamentFinished: boolean;
	} | null {
		const gameMode = sessionStorage.getItem('gameMode');
		const tournamentFlag = sessionStorage.getItem('tournament');
		if (gameMode !== 'local' || tournamentFlag !== '1') return null;

		const activeScores = this.playerScores.slice(0, this.playerCount);
		if (activeScores.length === 0) return null;

		const lowestScore = Math.min(...activeScores);
		const lowestPlayers: number[] = [];
		for (let i = 0; i < activeScores.length; i++) {
			if (activeScores[i] === lowestScore) lowestPlayers.push(i);
		}

		if (lowestPlayers.length !== 1) return null;

		const eliminatedIndex = lowestPlayers[0];
		const aliasKey = `alias${eliminatedIndex + 1}`;
		const eliminatedAlias =
			sessionStorage.getItem(aliasKey) ||
			this.playerNames[eliminatedIndex] ||
			`Player ${eliminatedIndex + 1}`;

		const currentCount = Number(
			sessionStorage.getItem('playerCount') ?? `${this.playerCount}`
		);
		const tournamentFinished = currentCount <= 2;
		let remainingPlayers = currentCount;

		// For active rounds (4p -> 3p, 3p -> 2p), swap the eliminated alias with the last active slot
		if (!tournamentFinished && currentCount > 0) {
			const lastActiveIndex = currentCount - 1; // 0-based index of aliasN (N=currentCount)
			if (eliminatedIndex !== lastActiveIndex) {
				const elimKey = `alias${eliminatedIndex + 1}`;
				const lastKey = `alias${lastActiveIndex + 1}`;
				const elimVal = sessionStorage.getItem(elimKey);
				const lastVal = sessionStorage.getItem(lastKey);
				if (lastVal !== null) sessionStorage.setItem(elimKey, lastVal);
				if (elimVal !== null) sessionStorage.setItem(lastKey, elimVal);

				const elimControlKey = `alias${eliminatedIndex + 1}controls`;
				const lastControlKey = `alias${lastActiveIndex + 1}controls`;
				const elimControlVal = sessionStorage.getItem(elimControlKey);
				const lastControlVal = sessionStorage.getItem(lastControlKey);
				if (lastControlVal !== null)
					sessionStorage.setItem(elimControlKey, lastControlVal);
				if (elimControlVal !== null)
					sessionStorage.setItem(lastControlKey, elimControlVal);
			}

			// Reduce player count for next round
			remainingPlayers = currentCount - 1;
			sessionStorage.setItem('playerCount', `${remainingPlayers}`);
			this.playerCount = remainingPlayers;
			state.playerCount = remainingPlayers;
		} else {
			// Keep player count at minimum 2 for the final match display
			remainingPlayers = Math.max(currentCount, 2);
		}

		return { eliminatedAlias, remainingPlayers, tournamentFinished };
	}

	private handleLocalTournamentVictory(winningPlayerIndex: number): void {
		const gameMode = sessionStorage.getItem('gameMode');
		const tournamentFlag = sessionStorage.getItem('tournament');
		if (gameMode !== 'local' || tournamentFlag !== '1') return;
		if (this.playerCount !== 2) return;

		const aliasKey = `alias${winningPlayerIndex + 1}`;
		const alias = sessionStorage.getItem(aliasKey);
		const winnerName =
			alias ||
			this.playerNames[winningPlayerIndex] ||
			`Player ${winningPlayerIndex + 1}`;
		sessionStorage.setItem('winner', winnerName);
		this.showLocalTournamentTrophy(winnerName);

		// Restore seed aliases back to regular aliases for future tournaments
		for (let i = 1; i <= 4; i++) {
			const seedAlias = GameConfig.getoriginalAlias(i as 1 | 2 | 3 | 4);
			if (seedAlias !== null) {
				sessionStorage.setItem(`alias${i}`, seedAlias);
			}
		}
	}

	private setupGlowEffects(): void {
		this.glowLayer = new BABYLON.GlowLayer('pongGlowLayer', this.scene);
		this.glowLayer.intensity = 0;
		// Exclude balls from glow so they never bloom during paddle glow effects
		if (this.ballMesh) {
			this.glowLayer.addExcludedMesh(this.ballMesh);
		}
		// Also exclude any future meshes whose name contains 'ball' (e.g., split clones)
		this.scene.onNewMeshAddedObservable.add(m => {
			try {
				const nm = (m?.name || '').toLowerCase();
				if (nm.includes('ball')) {
					this.glowLayer!.addExcludedMesh(m as BABYLON.Mesh);
				}
			} catch (_) {}
		});
	}

	/**
	 * Apply a temporary glow to a mesh. Effects stack and fade independently so
	 * long-running glows (stretch) can continue under short bursts (goals).
	 */
	private flashMeshGlow(
		mesh: BABYLON.Mesh,
		durationMs: number,
		glowColor: BABYLON.Color3,
		options?: {
			key?: string;
			fadeDurationMs?: number;
			holdDurationMs?: number;
		}
	): void {
		if (!this.glowLayer) return;
		const material = mesh.material as
			| (BABYLON.Material & { emissiveColor?: BABYLON.Color3 })
			| null;
		if (!material) return;
		if (!material.emissiveColor)
			material.emissiveColor = BABYLON.Color3.Black();

		const meshId = mesh.uniqueId;
		let state = this.glowPaddleStates.get(meshId);
		if (!state) {
			state = {
				mesh,
				material,
				baseEmissive: material.emissiveColor.clone(),
				addedToGlowLayer: false,
				effects: new Map(),
			};
			this.glowPaddleStates.set(meshId, state);
		}
		const meshState = state;

		if (!meshState.addedToGlowLayer && this.glowLayer) {
			try {
				this.glowLayer.addIncludedOnlyMesh(mesh);
				meshState.addedToGlowLayer = true;
			} catch (_) {}
		}

		const effectKey = options?.key ?? `glow-${++this.glowEffectKeyCounter}`;
		const existing = meshState.effects.get(effectKey);
		if (existing) {
			this.stopGlowEffect(meshState, existing);
		}

		const holdDuration = Math.max(options?.holdDurationMs ?? 0, 0);
		let fadeDuration = Math.max(options?.fadeDurationMs ?? 0, 0);
		if (options?.fadeDurationMs === undefined) {
			const impliedFade = Math.max(durationMs - holdDuration, 0);
			fadeDuration = impliedFade;
		}
		const totalDuration = holdDuration + fadeDuration;
		const effect: GlowEffectState = {
			key: effectKey,
			color: glowColor.clone(),
			durationMs: Math.max(totalDuration, 0),
			startTime: performance.now(),
			strength: 1,
			animationFrame: null,
			active: true,
			holdDurationMs: holdDuration,
			fadeDurationMs: fadeDuration,
		};
		meshState.effects.set(effectKey, effect);
		this.updateGlowLayerIntensity();
		this.recomputeMeshGlow(meshState);

		if (effect.durationMs === 0) {
			this.stopGlowEffect(meshState, effect);
			this.recomputeMeshGlow(meshState);
			if (meshState.effects.size === 0) this.cleanupMeshGlowState(meshId);
			return;
		}

		const animate = () => {
			if (!effect.active || !this.glowLayer) return;
			const elapsed = performance.now() - effect.startTime;
			let remainingIntensity = 1;
			if (elapsed <= effect.holdDurationMs) {
				remainingIntensity = 1;
			} else if (effect.fadeDurationMs > 0) {
				const fadeElapsed = Math.min(
					elapsed - effect.holdDurationMs,
					effect.fadeDurationMs
				);
				const fadeProgress = fadeElapsed / effect.fadeDurationMs;
				remainingIntensity = 1 - fadeProgress;
			} else {
				remainingIntensity = 0;
			}
			effect.strength = Math.max(remainingIntensity, 0);
			this.recomputeMeshGlow(meshState);
			if (elapsed >= effect.durationMs || effect.strength <= 0) {
				this.stopGlowEffect(meshState, effect);
				this.recomputeMeshGlow(meshState);
				if (meshState.effects.size === 0)
					this.cleanupMeshGlowState(meshId);
				return;
			}
			effect.animationFrame = window.requestAnimationFrame(animate);
		};
		effect.animationFrame = window.requestAnimationFrame(animate);
	}

	private stopGlowEffect(
		state: GlowMeshState,
		effect: GlowEffectState
	): void {
		if (!effect.active) return;
		effect.active = false;
		if (effect.animationFrame !== null) {
			window.cancelAnimationFrame(effect.animationFrame);
			effect.animationFrame = null;
		}
		state.effects.delete(effect.key);
	}

	private recomputeMeshGlow(state: GlowMeshState): void {
		const { material, baseEmissive, effects } = state;
		const result = baseEmissive.clone();
		effects.forEach(effect => {
			if (!effect.active || effect.strength <= 0) return;
			result.addInPlace(effect.color.scale(effect.strength));
		});
		material.emissiveColor = result;
	}

	private cleanupMeshGlowState(meshId: number): void {
		const state = this.glowPaddleStates.get(meshId);
		if (!state) return;
		Array.from(state.effects.values()).forEach(effect => {
			this.stopGlowEffect(state, effect);
		});
		state.material.emissiveColor = state.baseEmissive.clone();
		if (state.addedToGlowLayer && this.glowLayer) {
			try {
				this.glowLayer.removeIncludedOnlyMesh(state.mesh);
			} catch (_) {}
		}
		this.glowPaddleStates.delete(meshId);
		this.updateGlowLayerIntensity();
	}

	private updateGlowLayerIntensity(): void {
		if (!this.glowLayer) return;
		this.glowLayer.intensity = this.hasActiveGlowEffects()
			? GameConfig.getGlowBaseIntensity()
			: 0;
	}

	private hasActiveGlowEffects(): boolean {
		for (const state of this.glowPaddleStates.values()) {
			if (state.effects.size > 0) return true;
		}
		return false;
	}

	// Backwards-compatible wrapper for paddle glow on score
	private flashPaddleGlow(
		playerNumber: number,
		durationMs = 1500,
		point_gained = true
	): void {
		if (playerNumber < 1 || playerNumber > 4) return;
		const paddle = this.paddles[playerNumber - 1];
		if (!paddle || !this.glowLayer) return;
		const color = point_gained
			? new BABYLON.Color3(0, 1, 1)
			: new BABYLON.Color3(1, 0, 0);
		this.flashMeshGlow(paddle, durationMs, color, {
			key: `goal-${playerNumber}`,
		});
	}

	private teardownGlowEffects(): void {
		Array.from(this.glowPaddleStates.keys()).forEach(meshId => {
			this.cleanupMeshGlowState(meshId);
		});
		if (this.glowLayer) {
			this.glowLayer.dispose();
			this.glowLayer = null;
		}
	}

	private showLocalTournamentTrophy(winnerName: string): void {
		if (this.trophyInstance) {
			this.trophyInstance.dispose();
			this.trophyInstance = null;
		}
		if (this.trophyContainer) {
			this.trophyContainer.remove();
			this.trophyContainer = null;
		}

		const host =
			this.gameScreen?.element ?? this.container ?? document.body;
		const overlay = document.createElement('div');
		Object.assign(overlay.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			width: '100vw',
			height: '100vh',
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'center',
			pointerEvents: 'none',
			zIndex: '9',
		});
		host.appendChild(overlay);
		this.trophyContainer = overlay;
		this.trophyInstance = new Trophy(overlay, { winner: winnerName });
	}

	private clearLocalTournamentTrophy(): void {
		if (this.trophyInstance) {
			this.trophyInstance.dispose();
			this.trophyInstance = null;
		}
		if (this.trophyContainer) {
			this.trophyContainer.remove();
			this.trophyContainer = null;
		}
	}

	/**
	 * TEST METHOD: Simulate sending game state (for testing JSON messages)
	 */
	public testSendGameState(): void {
		if (this.gameMode === 'master') {
			const testGameState = {
				b: [1.23, -2.45], // Ball position
				pd: [
					[-2.0, 0],
					[2.0, 0],
				], // Paddle positions
			};
			this.sendGameStateToClients(testGameState);
		}
	}

	/**
	 * TEST METHOD: Simulate sending input (for testing JSON messages)
	 */
	public testSendInput(): void {
		if (this.gameMode === 'client') {
			const testInput = { k: 1 }; // Move left/up
			this.sendInputToMaster(testInput);
		}
	}

	/**
	 * TEST METHOD: Test audio playback manually
	 */
	public testAudio(): void {
		this.conditionalLog('🧪 Testing audio system...');
		this.audioSystem.testAudio();
	}
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a Pong3D instance with the default player count configuration
 * This is a shorthand for: new Pong3D(container, { playerCount: PLAYER_COUNT })
 */
export function createPong3D(
	container: HTMLElement,
	options?: Omit<Pong3DOptions, 'playerCount'>
): Pong3D {
	return new Pong3D(container, {
		playerCount: GameConfig.getPlayerCount() as 2 | 3 | 4,
		thisPlayer: GameConfig.getThisPlayer() as 1 | 2 | 3 | 4,
		...options,
	});
}

// ============================================================================
// LOGGING CONTROL FUNCTIONS
// ============================================================================

// Console helper functions removed per user request
// Debug logging is controlled via GameConfig.setDebugLogging() and GameConfig.setGamestateLogging()
