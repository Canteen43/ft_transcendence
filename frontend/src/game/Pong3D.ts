// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core/Physics/Plugins/cannonJSPlugin';
import * as CANNON from 'cannon-es';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import * as GUI from '@babylonjs/gui';
import {
	DEFAULT_MAX_SCORE,
	MESSAGE_GAME_STATE,
	MESSAGE_MOVE,
	MESSAGE_POINT,
} from '../../../shared/constants';
import type { Message } from '../../../shared/schemas/message';
import { ReplayModal } from '../modals/ReplayModal';
import { GameScreen } from '../screens/GameScreen';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { GameConfig } from './GameConfig';
import { Pong3DAudio } from './Pong3DAudio';
import { Pong3DBallEffects } from './Pong3DBallEffects';
import { Pong3DGameLoop } from './Pong3DGameLoop';
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
	AI_DIFFICULTY_PRESETS,
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
}

//The outer bounding box of all meshes used, helps to place default lights and cameras
interface BoundingInfo {
	min: BABYLON.Vector3;
	max: BABYLON.Vector3;
}

export class Pong3D {
	// Debug flag - set to false to disable all debug logging for better performance
	// private static readonly DEBUG_ENABLED = false;

	// Debug helper method - now uses GameConfig
	private debugLog(...args: any[]): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(...args);
		}
	}

	// Conditional console methods that respect GameConfig
	private conditionalLog(...args: any[]): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(...args);
		}
	}

	private conditionalWarn(...args: any[]): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			console.warn(...args);
		}
	}

	private conditionalError(...args: any[]): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			console.error(...args);
		}
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

	// === GAME PHYSICS CONFIGURATION ===

	// Simple ball radius for physics impostor
	private static readonly BALL_RADIUS = 0.325;

	// Ball settings (non-effects)
	public WINNING_SCORE = DEFAULT_MAX_SCORE; // Points needed to win the game
	private static readonly OUT_OF_BOUNDS_DISTANCE = 20; // Distance threshold for out-of-bounds detection (±units on X/Z axis)
	private outOfBoundsDistance: number = Pong3D.OUT_OF_BOUNDS_DISTANCE; // Distance threshold for out-of-bounds detection (±units on X/Z axis)

	// Physics engine settings
	private PHYSICS_TIME_STEP = 1 / 120; // Physics update frequency (120 Hz to reduce tunneling)

	// Ball control settings - velocity-based reflection angle modification
	private BALL_ANGLE_MULTIPLIER = 1.0; // Multiplier for angle influence strength (0.0 = no effect, 1.0 = full effect)

	// Safety: maximum allowed angle between outgoing ball vector and paddle normal
	// (in radians). If a computed outgoing direction would exceed this, it will be
	// clamped toward the paddle normal so the ball cannot be returned at an
	// extreme grazing/perpendicular angle which causes excessive wall bounces.
	private ANGULAR_RETURN_LIMIT = Math.PI / 4; // 60 degrees

	// Paddle physics settings
	private PADDLE_MASS = 2.8; // Paddle mass for collision response
	private PADDLE_FORCE = 15; // Force applied when moving
	private PADDLE_RANGE = 5; // Movement range from center
	private PADDLE_MAX_VELOCITY = 13; // Maximum paddle speed
	private PADDLE_BRAKING_FACTOR = 0.8; // Velocity multiplier per frame when no input (0.92 = 8% reduction per frame)

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

	// Resize handler reference for cleanup
	private resizeHandler: (() => void) | null = null;

	// GameScreen reference for modal management
	private gameScreen: GameScreen | null = null;

	// Goal detection
	private goalMeshes: (BABYLON.Mesh | null)[] = [null, null, null, null]; // Goal zones for each player
	private lastPlayerToHitBall: number = -1; // Track which player last hit the ball (0-based index)
	private secondLastPlayerToHitBall: number = -1; // Track which player hit the ball before the last hitter (0-based index)
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
		// Only initialize input handler in local/master modes - client sends input via WebSocket
		if (this.gameMode !== 'client') {
			this.inputHandler = new Pong3DInput(this.canvas);
		}

		// Store resize handler reference for proper cleanup
		this.resizeHandler = () => this.engine.resize();
		window.addEventListener('resize', this.resizeHandler);

		// Listen for remote score updates from WebSocket (client mode only)
		if (this.gameMode === 'client') {
			this.conditionalLog(
				'🎮 Setting up remoteScoreUpdate event listener for client mode'
			);
			document.addEventListener('remoteScoreUpdate', (event: Event) => {
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
			});
		} else {
			this.conditionalLog(
				'🎮 Not setting up remoteScoreUpdate listener - game mode:',
				this.gameMode
			);
		}

		// Listen for remote game state updates from WebSocket (both master and client modes)
		document.addEventListener('remoteGameState', (event: Event) => {
			const customEvent = event as CustomEvent<any>;
			const gameState = customEvent.detail;
			this.conditionalLog('📡 remoteGameState received:', gameState);

			// Handle sound effects if present in the game state
			if (gameState && typeof gameState.s === 'number') {
				this.handleRemoteSoundEffect(gameState.s);
			}
		});
	}

	constructor(container: HTMLElement, options?: Pong3DOptions) {
		// Player count comes from GameConfig, set by frontend when players are ready
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
		this.ballEffects = new Pong3DBallEffects(12); // 12 is default base ball speed

		// Initialize audio system
		this.audioSystem = new Pong3DAudio();

		// Create canvas inside container
		this.canvas = document.createElement('canvas');
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		container.appendChild(this.canvas);

		// Initialize Babylon.js engine with alpha support
		this.engine = new BABYLON.Engine(this.canvas, true, {
			preserveDrawingBuffer: true,
			stencil: true,
			alpha: true,
		});

		this.scene = new BABYLON.Scene(this.engine);
		// Make scene background transparent
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

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
			// Reduced logging for lights setup
			// this.conditionalLog(`🔍 Debugging lights in scene: Found ${scene.lights.length} lights total`);

			scene.lights.forEach(light => {
				// Reduced light debugging - only log on errors
				// this.conditionalLog(`Light ${index + 1}:`, {
				// 	name: light.name,
				// 	type: light.getClassName(),
				// 	intensity: (light as any).intensity,
				// 	position:
				// 		light instanceof BABYLON.DirectionalLight ||
				// 		light instanceof BABYLON.SpotLight
				// 			? (light as any).position
				// 			: 'N/A',
				// 	enabled: light.isEnabled(),
				// });

				if (light && typeof (light as any).intensity === 'number') {
					(light as any).intensity =
						(light as any).intensity * this.importedLightScale;
				}
			});
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					'Adjusted imported light intensities by factor',
					this.importedLightScale
				);
			}
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
			// Set a random server for the initial serve
			this.currentServer = Math.floor(Math.random() * this.playerCount);
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
		const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
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
					{ mass: 0, restitution: 0.95, friction: 0.1 }, // Slightly reduce restitution and add minimal friction
					this.scene
				);
				this.conditionalLog(
					`Created static MeshImpostor for wall: ${mesh.name}`
				);
			}
		});

		// Set up collision detection for local, master, AND client modes (all need goal detection)
		if (
			this.ballMesh?.physicsImpostor &&
			(this.gameMode === 'local' || this.gameMode === 'master')
		) {
			const paddleImpostors = this.paddles
				.filter(p => p && p.physicsImpostor)
				.map(p => p!.physicsImpostor!);

			if (paddleImpostors.length > 0) {
				this.ballMesh.physicsImpostor.registerOnPhysicsCollide(
					paddleImpostors,
					(main, collided) => {
						this.handleBallPaddleCollision(main, collided);
					}
				);
				this.conditionalLog(
					`Set up ball-paddle collision detection for ${paddleImpostors.length} paddles`
				);
			}

			// Set up wall collision detection for spin handling
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
				this.ballMesh.physicsImpostor.registerOnPhysicsCollide(
					wallImpostors,
					(main, collided) => {
						this.handleBallWallCollision(main, collided);
					}
				);
				this.conditionalLog(
					`Set up ball-wall collision detection for ${wallImpostors.length} walls`
				);
			}

			// Set up goal collision detection using physics
			const goalImpostors = this.goalMeshes
				.filter(goal => goal && goal.physicsImpostor)
				.map(goal => goal!.physicsImpostor!);

			this.conditionalLog(
				`🎯 Goal collision setup: Found ${this.goalMeshes.length} goal meshes, ${goalImpostors.length} with physics impostors`
			);

			if (goalImpostors.length > 0 && this.ballMesh?.physicsImpostor) {
				this.conditionalLog(
					`🎯 Registering physics collision detection for ${goalImpostors.length} goals...`
				);

				this.ballMesh.physicsImpostor.registerOnPhysicsCollide(
					goalImpostors,
					(main, collided) => {
						this.conditionalLog(
							`🎯 RAW PHYSICS COLLISION: main=${main}, collided=${collided}`
						);

						// Find which goal was hit
						const goalIndex = this.goalMeshes.findIndex(
							goal => goal && goal.physicsImpostor === collided
						);
						this.conditionalLog(
							`🎯 Physics goal collision detected! Goal index: ${goalIndex}, Collided impostor: ${collided}`
						);
						if (goalIndex !== -1) {
							this.conditionalLog(
								`🎯 Calling handleGoalCollision for goal ${goalIndex}`
							);
							this.handleGoalCollision(goalIndex);
						} else {
							this.conditionalLog(
								`❌ Could not find goal index for collided impostor`
							);
						}
					}
				);
				this.conditionalLog(
					`✅ Successfully set up ball-goal collision detection for ${goalImpostors.length} goals`
				);
			} else {
				this.conditionalLog(
					`❌ No goal physics impostors found! Goals may not be set up correctly.`
				);
			}

			// Set up manual goal detection as fallback
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

		// Find which paddle was hit
		let paddleIndex = -1;
		for (let i = 0; i < this.playerCount; i++) {
			if (this.paddles[i]?.physicsImpostor === paddleImpostor) {
				paddleIndex = i;
				break;
			}
		}

		if (paddleIndex === -1) return; // Unknown paddle

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
		this.conditionalLog(
			`Last player to hit ball updated to: ${this.lastPlayerToHitBall}, Second last: ${this.secondLastPlayerToHitBall}`
		);

		// Play ping sound effect with harmonic variation
		this.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');

		// Send sound effect to clients (master mode only)
		if (this.gameMode === 'master') {
			this.sendSoundEffectToClients(0); // 0 = paddle ping
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
				(paddleBounds.maximum.x - paddleBounds.minimum.x) * 0.6; // Allow 120% of paddle width (more lenient)
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
				(paddleBounds.maximum.z - paddleBounds.minimum.z) * 0.6; // Same as 2P X-offset
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
			// Handle paddle 2's 180° rotation in Blender
			// Paddle 2 was rotated 180° to face the opposite direction, so its local X-axis is flipped
			if (paddleIndex === 1) {
				// Paddle 2 (index 1)
				paddleAxis = new BABYLON.Vector3(-1, 0, 0); // Flipped X-axis due to 180° rotation
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

		let finalDirection: BABYLON.Vector3;

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
			// MOVING PADDLE: Return angle directly proportional to velocity
			// Ball deflects IN THE SAME DIRECTION as paddle movement
			// Moving left at max velocity → ball deflects left at max angle
			// Moving right at max velocity → ball deflects right at max angle
			let velocityBasedAngle = -velocityRatio * this.ANGULAR_RETURN_LIMIT; // NEGATED to correct direction

			// 🔒 CLAMP: Ensure velocity-based angle respects angular return limit
			velocityBasedAngle = Math.max(
				-this.ANGULAR_RETURN_LIMIT,
				Math.min(this.ANGULAR_RETURN_LIMIT, velocityBasedAngle)
			);

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🚨 velocityBasedAngle = ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}° (after clamping)`
				);
				if (GameConfig.isDebugLoggingEnabled()) {
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(`🎯 MOVING PADDLE ANGULAR EFFECT:`);
					}
				}
				this.conditionalLog(
					`  - Paddle velocity: ${paddleVelAlong.toFixed(2)} (${velocityRatio.toFixed(3)} of max)`
				);
			}
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`  - Ball deflects IN SAME DIRECTION as paddle movement`
				);
				this.conditionalLog(
					`  - Return angle: ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}° from normal [CORRECTED DIRECTION]`
				);
				this.conditionalLog(
					`  - Angular return limit: ±${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
				);
			}

			// 🚨 DEBUG: Extra logging for 4P mode
			if (this.playerCount === 4) {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚨🚨🚨 4P MODE MOVING PADDLE DETECTED! 🚨🚨🚨`
					);
				}
				this.conditionalLog(
					`🚨 Player ${paddleIndex + 1} velocity: ${paddleVelAlong.toFixed(3)}`
				);
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚨 Velocity ratio: ${velocityRatio.toFixed(3)}`
					);
				}
				this.conditionalLog(
					`🚨 Calculated angle: ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}°`
				);
			}

			// === SEPARATE PHYSICS FOR 2P vs 3P MODE ===
			if (this.playerCount === 2) {
				// 2-PLAYER MODE: Standard Y-axis rotation
				const rotationAxis = BABYLON.Vector3.Up();
				const rotationMatrix = BABYLON.Matrix.RotationAxis(
					rotationAxis,
					velocityBasedAngle
				);
				finalDirection = BABYLON.Vector3.TransformCoordinates(
					paddleNormal,
					rotationMatrix
				).normalize();
				if (GameConfig.isDebugLoggingEnabled()) {
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`🎯 2P Mode: Y-axis rotation applied`
						);
					}
				}
			} else if (this.playerCount === 3) {
				// 3-PLAYER MODE: Use same Y-axis rotation as 2P mode but adjust angle for paddle orientation
				this.conditionalLog(
					`🚨🚨🚨 3P Mode: EXECUTING 3P PHYSICS CODE PATH! 🚨🚨🚨`
				);
				this.conditionalLog(
					`🎯 3P Mode: Paddle ${paddleIndex + 1} at ${paddleIndex * 120}° - using proven 2P physics`
				);

				// Adjust angle direction for players 2 and 3 due to their paddle rotation
				let adjustedAngle = velocityBasedAngle;
				if (paddleIndex === 1 || paddleIndex === 2) {
					// Players 2 and 3
					adjustedAngle = -velocityBasedAngle; // Flip the angle direction
					this.conditionalLog(
						`🔄 3P Mode: Flipped angle for Player ${paddleIndex + 1} from ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}° to ${((adjustedAngle * 180) / Math.PI).toFixed(1)}°`
					);
				}

				const rotationAxis = BABYLON.Vector3.Up(); // Y-axis rotation (same as 2P mode)
				const rotationMatrix = BABYLON.Matrix.RotationAxis(
					rotationAxis,
					adjustedAngle
				);
				finalDirection = BABYLON.Vector3.TransformCoordinates(
					paddleNormal,
					rotationMatrix
				).normalize();

				this.conditionalLog(
					`🚨 3P Mode: Y-axis rotation applied - angle: ${((adjustedAngle * 180) / Math.PI).toFixed(1)}°`
				);
				this.conditionalLog(
					`🚨 3P Mode: Final direction: (${finalDirection.x.toFixed(3)}, ${finalDirection.z.toFixed(3)})`
				);
				this.conditionalLog(
					`🚨🚨🚨 3P Mode: CODE PATH EXECUTED SUCCESSFULLY! 🚨🚨🚨`
				);
			} else if (this.playerCount === 4) {
				// 4-PLAYER MODE: P1/P2 walled off, P3/P4 (side paddles) use X-axis rotation
				// Side paddles deflect ball along Z-axis using X-axis rotation (same effect as 2P Y-axis rotation)
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚨🚨🚨 4P MODE ANGULAR EFFECTS EXECUTING! 🚨🚨🚨`
					);
				}
				this.conditionalLog(
					`🚨 Player ${paddleIndex + 1}, original velocityBasedAngle: ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}°`
				);

				// Flip the angle direction for side paddles to correct the direction
				const flippedAngle = -velocityBasedAngle;
				this.conditionalLog(
					`🔄 4P Mode: Flipped angle for side paddle from ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}° to ${((flippedAngle * 180) / Math.PI).toFixed(1)}°`
				);

				const rotationAxis = new BABYLON.Vector3(0, 1, 0); // Y-axis rotation (keeps ball in XZ plane)
				const rotationMatrix = BABYLON.Matrix.RotationAxis(
					rotationAxis,
					flippedAngle
				);
				finalDirection = BABYLON.Vector3.TransformCoordinates(
					paddleNormal,
					rotationMatrix
				).normalize();

				this.conditionalLog(
					`🎯 4P Mode: Y-axis rotation applied for side paddles P3/P4 (keeps ball in XZ plane)`
				);
				this.conditionalLog(
					`🚨 Paddle normal before: (${paddleNormal.x.toFixed(3)}, ${paddleNormal.y.toFixed(3)}, ${paddleNormal.z.toFixed(3)})`
				);
				this.conditionalLog(
					`🚨 Final direction after: (${finalDirection.x.toFixed(3)}, ${finalDirection.y.toFixed(3)}, ${finalDirection.z.toFixed(3)})`
				);
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🚨🚨🚨 4P MODE ANGULAR EFFECTS COMPLETE! 🚨🚨🚨`
					);
				}
			} else {
				// FALLBACK: Default to 2P behavior for unknown player counts
				const rotationAxis = BABYLON.Vector3.Up();
				const rotationMatrix = BABYLON.Matrix.RotationAxis(
					rotationAxis,
					velocityBasedAngle
				);
				finalDirection = BABYLON.Vector3.TransformCoordinates(
					paddleNormal,
					rotationMatrix
				).normalize();
				this.conditionalLog(
					`🎯 ${this.playerCount}P Mode: Using 2P physics (fallback)`
				);
			}
		} else {
			// STATIONARY PADDLE: Physics-based reflection with angular limit
			const ballVelNormalized = ballVelocity.normalize();
			const dotProduct = BABYLON.Vector3.Dot(
				ballVelNormalized,
				paddleNormal
			);

			// Calculate perfect physics reflection
			const perfectReflection = ballVelNormalized.subtract(
				paddleNormal.scale(2 * dotProduct)
			);

			if (GameConfig.isDebugLoggingEnabled()) {
				if (GameConfig.isDebugLoggingEnabled()) {
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(`🎯 STATIONARY PADDLE REFLECTION:`);
					}
				}
			}
			this.conditionalLog(
				`  - Ball velocity: (${ballVelNormalized.x.toFixed(3)}, ${ballVelNormalized.y.toFixed(3)}, ${ballVelNormalized.z.toFixed(3)})`
			);
			this.conditionalLog(
				`  - Paddle normal: (${paddleNormal.x.toFixed(3)}, ${paddleNormal.y.toFixed(3)}, ${paddleNormal.z.toFixed(3)})`
			);
			this.conditionalLog(
				`  - Dot product (ball·normal): ${dotProduct.toFixed(3)}`
			);
			this.conditionalLog(
				`  - Perfect reflection: (${perfectReflection.x.toFixed(3)}, ${perfectReflection.y.toFixed(3)}, ${perfectReflection.z.toFixed(3)})`
			);
			// === 2D REFLECTION LOGIC ===
			// Check angle of perfect reflection from normal
			const reflectionDot = BABYLON.Vector3.Dot(
				perfectReflection,
				paddleNormal
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
				finalDirection = perfectReflection.normalize();
			} else {
				// Reflection angle exceeds limit - clamp by rotating toward normal
				this.conditionalLog(
					`🔒 Clamping reflection: ${((reflectionAngle * 180) / Math.PI).toFixed(1)}° → ${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
				);

				// Rotate perfect reflection toward normal by the excess angle
				const excessAngle = reflectionAngle - this.ANGULAR_RETURN_LIMIT;
				const rotationAxis = new BABYLON.Vector3(0, 1, 0); // Y-axis for X-Z plane
				const rotationMatrix = BABYLON.Matrix.RotationAxis(
					rotationAxis,
					excessAngle
				);
				finalDirection = BABYLON.Vector3.TransformCoordinates(
					perfectReflection,
					rotationMatrix
				).normalize();

				// Ensure Y=0 for 2D movement
				finalDirection.y = 0;
				finalDirection = finalDirection.normalize();

				const clampedAngle = Math.acos(
					Math.abs(BABYLON.Vector3.Dot(finalDirection, paddleNormal))
				);
				this.conditionalLog(
					`🔒 Clamped result: angle=${((clampedAngle * 180) / Math.PI).toFixed(1)}°, direction=(${finalDirection.x.toFixed(3)}, ${finalDirection.y.toFixed(3)}, ${finalDirection.z.toFixed(3)})`
				);
			}
		}

		this.conditionalLog(
			`🎯 Final direction: (${finalDirection.x.toFixed(3)}, ${finalDirection.y.toFixed(3)}, ${finalDirection.z.toFixed(3)})`
		);
		this.conditionalLog(
			`🎯 Final angle from normal: ${((Math.acos(Math.abs(BABYLON.Vector3.Dot(finalDirection, paddleNormal))) * 180) / Math.PI).toFixed(1)}°`
		);

		// Increment rally speed - ball gets faster with each paddle hit during rally
		this.ballEffects.incrementRallyHit();

		// Apply the new velocity with rally-adjusted speed
		const newVelocity = finalDirection.scale(
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
		const ballRadius = 0.1; // Approximate ball radius (adjust based on your ball size)
		const paddleThickness = 0.2; // Approximate paddle thickness
		const minSeparation = ballRadius + paddleThickness * 0.5 + 0.05; // Smaller buffer for stability

		// Gentle position correction - only if ball is too close
		const currentDistance = Math.abs(
			BABYLON.Vector3.Dot(paddleToBall, paddleNormal)
		);
		if (currentDistance < minSeparation) {
			const correctionDistance = minSeparation - currentDistance + 0.02; // Small additional buffer
			const correction = paddleNormal.scale(correctionDistance);
			this.ballMesh.position = ballPosition.add(correction);

			// Also update physics impostor position to sync with visual position
			if (this.ballMesh.physicsImpostor) {
				this.ballMesh.physicsImpostor.physicsBody.position.set(
					this.ballMesh.position.x,
					this.ballMesh.position.y,
					this.ballMesh.position.z
				);
			}

			this.conditionalLog(
				`🔧 Position correction applied: ${correctionDistance.toFixed(3)} units along normal`
			);
			this.conditionalLog(
				`🔧 Ball moved from (${ballPosition.x.toFixed(3)}, ${ballPosition.y.toFixed(3)}, ${ballPosition.z.toFixed(3)}) to (${this.ballMesh.position.x.toFixed(3)}, ${this.ballMesh.position.y.toFixed(3)}, ${this.ballMesh.position.z.toFixed(3)})`
			);
		} else {
			this.conditionalLog(
				`🔧 No position correction needed - current distance: ${currentDistance.toFixed(3)}, minimum: ${minSeparation.toFixed(3)}`
			);
		}
		if (hasPaddleVelocity) {
			// Apply spin to ball using the full paddle velocity vector (preserve direction)
			this.ballEffects.applySpinFromPaddle(paddleVelocity);
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
				`  - Final direction: (${finalDirection.x.toFixed(2)}, ${finalDirection.z.toFixed(2)})`
			);
			this.conditionalLog(
				`  - New velocity: (${newVelocity.x.toFixed(2)}, ${newVelocity.z.toFixed(2)})`
			);
		}
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
		this.sendSoundEffectToClients(1); // 1 = wall ping

		// Position correction: move ball slightly away from wall to prevent embedding
		if (this.ballMesh && ballImpostor) {
			const velocity = ballImpostor.getLinearVelocity();
			if (velocity && velocity.length() > 0) {
				// Move ball in direction of velocity (away from wall)
				// Use gentle correction to avoid physics instability
				const correctionDistance = 0.15; // Small, consistent correction
				const correctionVector = velocity
					.normalize()
					.scale(correctionDistance);
				const newPosition =
					this.ballMesh.position.add(correctionVector);
				this.ballMesh.position = newPosition;

				// If too many rapid wall collisions, apply velocity damping
				if (this.wallCollisionCount > 3) {
					this.conditionalLog(
						`🚫 Rapid wall collisions detected - applying velocity damping`
					);
					const dampedVel = velocity.scale(0.8); // Reduce velocity by 20%
					ballImpostor.setLinearVelocity(dampedVel);
				}
			}
		}

		// When ball hits wall, spin is preserved but may be modified by friction
		// For realistic physics, some spin energy is lost
		this.ballEffects.applyWallSpinFriction(0.8); // 20% spin loss on wall collision

		this.conditionalLog(
			`🌪️ Wall collision: Spin reduced by friction, new spin: ${this.ballEffects.getBallSpin().y.toFixed(2)}`
		);
	}

	private handleGoalCollision(goalIndex: number): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🏆 GOAL COLLISION DETECTED! Goal index: ${goalIndex}`
			);
		}

		// Store the conceding player for serve system
		this.lastConcedingPlayer = goalIndex;

		// Check cooldown to prevent multiple triggers
		const currentTime = performance.now();
		if (currentTime - this.lastGoalTime < this.GOAL_COOLDOWN_MS) {
			this.conditionalLog(`Goal on cooldown, ignoring collision`);
			return;
		}

		// goalIndex is the player whose goal was hit (they conceded)
		// Check for own goals using secondLastPlayerToHitBall
		let scoringPlayer = this.lastPlayerToHitBall;
		const goalPlayer = goalIndex;
		let wasOwnGoal = false;
		let wasDirectServeOwnGoal = false;

		this.conditionalLog(`Last player to hit ball: ${scoringPlayer}`);
		this.conditionalLog(
			`Second last player to hit ball: ${this.secondLastPlayerToHitBall}`
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

			// Check if this is a direct serve into own goal (no other players hit the ball)
			if (this.secondLastPlayerToHitBall === -1) {
				wasDirectServeOwnGoal = true;
				// Direct serve own goal - no points awarded, but ball still travels to boundary
				this.conditionalLog(
					`🏴 DIRECT SERVE OWN GOAL! Player ${goalPlayer + 1} served directly into their own goal - no point awarded, ball will travel to boundary`
				);
			} else {
				// Normal own goal after rally - award to second last player
				scoringPlayer = this.secondLastPlayerToHitBall;
				this.conditionalLog(
					`🏴 OWN GOAL! Player ${goalPlayer + 1} scored in their own goal. Awarding point to Player ${scoringPlayer + 1} (second last hitter)`
				);
			}
		}

		// Check if the server hit the ball into their own goal - no point awarded
		if (
			this.currentServer === goalPlayer &&
			this.lastPlayerToHitBall === this.currentServer &&
			this.secondLastPlayerToHitBall !== -1 // Only if ball was hit by someone else first
		) {
			this.conditionalLog(
				`🏓 SERVER OWN GOAL! Player ${goalPlayer + 1} (server) hit the ball into their own goal after being hit by others - no point awarded`
			);
			// Skip awarding the point and just reset for next rally
			this.currentServer = goalPlayer; // Conceding player serves next
			this.secondLastPlayerToHitBall = -1;
			this.lastGoalTime = performance.now();
			return; // Exit without awarding points
		}

		// Check if the same player hit the ball twice in a row - no point awarded
		if (
			scoringPlayer === this.secondLastPlayerToHitBall &&
			scoringPlayer !== -1
		) {
			this.conditionalLog(
				`🚫 DOUBLE HIT! Player ${scoringPlayer + 1} hit the ball twice in a row - no point awarded`
			);
			// Skip awarding the point and just reset for next rally
			this.currentServer = goalPlayer; // Conceding player serves next
			this.secondLastPlayerToHitBall = -1;
			this.lastGoalTime = performance.now();
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

		// Award point to the scoring player (skip for direct serve own goals)
		if (!wasDirectServeOwnGoal) {
			this.conditionalLog(`Awarding point to player ${scoringPlayer}...`);
			this.playerScores[scoringPlayer]++;
			this.conditionalLog(`New scores after goal:`, this.playerScores);

			// Send score update to clients (only in master mode)
			this.conditionalLog(
				'🏆 sendScoreUpdateToClients called with scoringPlayer:',
				scoringPlayer
			);
			this.sendScoreUpdateToClients(scoringPlayer);
		} else {
			this.conditionalLog(
				`🏴 DIRECT SERVE OWN GOAL: Skipping point award for invalid serve`
			);
		}

		// Check if player has won (configurable winning score)
		if (this.playerScores[scoringPlayer] >= this.WINNING_SCORE) {
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

			// HELENE: i think it would be nice to have the button right away
			if (this.gameMode == 'local') {
				if (this.gameScreen) {
					new ReplayModal(this.gameScreen);
				} else {
					this.conditionalWarn(
						'GameScreen reference not available for ReplayModal'
					);
				}
			}
			// Wait 7 seconds for victory music to finish, then set game status
			setTimeout(() => {
				state.gameOngoing = false;
				this.conditionalLog(
					`🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆 Victory music finished (7 seconds), gameOngoing set to false`
				);
				if (sessionStorage.getItem('tournament') === '1') {
					location.hash = '#tournament';
				}
			}, 7000);

			// if we are in a tournament redirect to tournament page

			// Call the goal callback for any additional handling
			if (this.onGoalCallback) {
				this.conditionalLog(`Calling goal callback for game end...`);
				this.onGoalCallback(scoringPlayer, goalPlayer);
			}

			// Reset cooldown and last player tracker - game is over
			this.lastPlayerToHitBall = -1;
			this.secondLastPlayerToHitBall = -1;
			this.lastGoalTime = performance.now();

			// Let the ball continue its natural trajectory and exit bounds
			this.conditionalLog(
				`🏀 Ball will continue and exit naturally - no respawn`
			);
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
		if (!this.ballMesh) return;

		const ballPosition = this.ballMesh.position;

		// Always check for general out of bounds (independent of goal scoring)
		this.checkGeneralOutOfBounds(ballPosition);

		// If a goal was scored and we're waiting for the ball to reach the boundary, check for boundary collision
		if (this.goalScored && this.pendingGoalData) {
			this.checkBoundaryCollisionAfterGoal(ballPosition);
		}

		// Manual goal detection is disabled - we rely on physics collision detection only
		// The MeshImpostor handles rotated goals properly
	}

	private checkGeneralOutOfBounds(ballPosition: BABYLON.Vector3): void {
		// If a goal was scored and we're waiting for boundary collision, don't do general out-of-bounds check
		if (this.goalScored && this.pendingGoalData) {
			return; // Let checkBoundaryCollisionAfterGoal handle the reset
		}

		// Simple out-of-bounds check using configurable distance threshold
		const isOutOfBounds =
			Math.abs(ballPosition.x) > this.outOfBoundsDistance ||
			Math.abs(ballPosition.z) > this.outOfBoundsDistance;

		if (isOutOfBounds) {
			this.conditionalLog(
				`🏓 Ball went out of bounds! Position: ${ballPosition.toString()}, Threshold: ±${this.outOfBoundsDistance}`
			);

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

			// Reset ball immediately for general out of bounds (normal gameplay)
			if (this.gameLoop) {
				this.gameLoop.resetBall();
			}

			// Reset rally speed system - new rally starts
			this.resetRallySpeed();

			// Clear any pending goal state if ball went truly out of bounds
			this.goalScored = false;
			this.pendingGoalData = null;
			this.ballEffects.resetAllEffects();

			this.conditionalLog(`⚡ Ball reset due to out of bounds`);
		}
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
			shadowCastingLights.forEach(light => {
				this.conditionalLog(
					`✅ Setting up shadow generator for light: ${light.name} (${light.getClassName()})`
				);

				// Create shadow generator
				const shadowGenerator = new BABYLON.ShadowGenerator(
					1024,
					light as BABYLON.DirectionalLight | BABYLON.SpotLight
				);

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

		this.conditionalLog('Created default ball mesh');

		// Set the ball mesh in the game loop
		if (this.gameLoop) {
			this.gameLoop.setBallMesh(this.ballMesh);
		}
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

				console.log(
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
				return i >= 2
					? { x: 0, z: 1 }
					: { x: 1, z: 0 };
			}
			return { x: 1, z: 0 };
		});

		const paddleOrigins = Array.from({ length: 4 }, (_, i) => {
			const origin = this.originalGLBPositions[i];
			return origin
				? { x: origin.x, z: origin.z }
				: { x: 0, z: 0 };
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

		const gameStateForAI: GameStateForAI = {
			ball: {
				position: this.ballMesh
					? {
							x: this.ballMesh.position.x,
							y: this.ballMesh.position.y,
							z: this.ballMesh.position.z,
						}
					: { x: 0, y: 0, z: 0 },
				velocity: this.ballMesh?.physicsImpostor
					? (() => {
							const vel =
								this.ballMesh!.physicsImpostor!.getLinearVelocity();
							return vel
								? {
										x: vel.x,
										y: vel.y,
										z: vel.z,
									}
								: { x: 0, y: 0, z: 0 };
						})()
					: { x: 0, y: 0, z: 0 },
			},
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

		// Only adjust if ball is moving and speed differs significantly from target
		const currentBallSpeed = this.ballEffects.getCurrentBallSpeed();
		if (
			currentSpeed > 0.1 &&
			Math.abs(currentSpeed - currentBallSpeed) > 0.5
		) {
			// Normalize the X-Z velocity and scale to current rally speed
			const scale = currentBallSpeed / currentSpeed;
			const correctedVelocity = new BABYLON.Vector3(
				currentVelocity.x * scale,
				0, // Keep Y locked to 0
				currentVelocity.z * scale
			);
			this.ballMesh.physicsImpostor.setLinearVelocity(correctedVelocity);
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
			return;
		}
		const loopRunning = this.gameLoop?.getGameState().isRunning ?? true;
		if (!loopRunning) {
			return;
		}
		// Maintain constant ball velocity
		this.maintainConstantBallVelocity();

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
			const isOutOfBounds =
				posAlongAxis < minBound || posAlongAxis > maxBound;

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
			if (isOutOfBounds) {
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
					const isMovingInward =
						(posAlongAxis < minBound && wantedDirection > 0) ||
						(posAlongAxis > maxBound && wantedDirection < 0);

					// Allow any movement that brings paddle back inward
					if (isMovingInward) {
						const impulse = axisNorm.scale(
							wantedDirection * this.PADDLE_FORCE
						);
						paddle.physicsImpostor.applyImpulse(
							impulse,
							paddle.getAbsolutePosition()
						);
						this.paddleStoppedAtBoundary[i] = false; // Reset boundary stop flag
					}
				}
			} else {
				// Reset boundary stop flag when paddle is back in valid area
				this.paddleStoppedAtBoundary[i] = false;

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

	public setPaddleRange(value: number): void {
		this.PADDLE_RANGE = value;
		this.conditionalLog('PADDLE_RANGE ->', this.PADDLE_RANGE);
	}

	public setPaddleSpeed(value: number): void {
		this.PADDLE_FORCE = value;
		this.conditionalLog('PADDLE_FORCE (speed) ->', this.PADDLE_FORCE);
	}

	public setBallAngleMultiplier(multiplier: number): void {
		this.BALL_ANGLE_MULTIPLIER = Math.max(0, Math.min(2, multiplier)); // Clamp between 0-2
		this.conditionalLog(
			'BALL_ANGLE_MULTIPLIER ->',
			this.BALL_ANGLE_MULTIPLIER
		);
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

			// 🚨 CRITICAL: Ensure normal points AWAY from paddle surface (for proper reflection)
			// For correct physics reflection: normal should point into the space where ball reflects
			// Check if ball velocity and normal have same direction (both positive or both negative)
			const ballVelocity =
				this.ballMesh!.physicsImpostor!.getLinearVelocity()!;
			const normalizedVelocity = ballVelocity.normalize();
			const normalizedNormal = babylonNormal.normalize();
			const dotProduct = BABYLON.Vector3.Dot(
				normalizedVelocity,
				normalizedNormal
			);

			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(
					`🔧 Ball velocity direction: (${normalizedVelocity.x.toFixed(3)}, ${normalizedVelocity.y.toFixed(3)}, ${normalizedVelocity.z.toFixed(3)})`
				);
				this.conditionalLog(
					`🔧 Dot product (velocity·normal): ${dotProduct.toFixed(3)}`
				);
			}

			let correctedNormal = normalizedNormal;
			if (dotProduct > 0.1) {
				// Ball moving toward normal means normal points AWAY from surface - this is CORRECT for reflection
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						'🔧 Normal correctly points away from paddle surface'
					);
				}
			} else if (dotProduct < -0.1) {
				// Ball moving away from normal means normal points wrong way - flip it
				correctedNormal = normalizedNormal.negate();
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						'🔧 CORRECTED: Flipped normal to point away from paddle surface'
					);
					this.conditionalLog(
						`🔧 Corrected normal: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
					);
				}
			}

			// Validate the normal direction - it should point roughly toward the center
			// For a 2-player game, paddle normals should be roughly ±Z direction
			// Since Y movement is constrained, project the normal to X-Z plane
			const normalXZ = new BABYLON.Vector3(
				correctedNormal.x,
				0,
				correctedNormal.z
			);
			if (normalXZ.length() > 0.1) {
				// Use the projected normal if it's significant
				correctedNormal = normalXZ.normalize();
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`🔧 Projected normal to X-Z plane: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
					);
				}
			} else {
				// If X-Z components are too small, this might be a top/bottom collision
				this.conditionalWarn(
					`🚨 Normal has minimal X-Z components: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
				);
			}

			return correctedNormal;
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

			// Ensure the normal points toward the center of the play area (inward)
			// Calculate vector from paddle to center (0,0,0)
			const paddleToCenter = new BABYLON.Vector3(0, 0, 0).subtract(
				paddle.position
			);
			paddleToCenter.normalize();

			// If normal points away from center, flip it
			if (BABYLON.Vector3.Dot(normal, paddleToCenter) < 0) {
				normal.scaleInPlace(-1);
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

	/** Set the last player to hit the ball (used by game loop for serve tracking) */
	public setLastPlayerToHitBall(playerIndex: number): void {
		this.lastPlayerToHitBall = playerIndex;
	}

	/**
	 * Dispose of Babylon resources, stop render loop, remove event listeners, and clean up canvas.
	 * Call this when destroying the game or navigating away to prevent memory leaks.
	 */
	public dispose(): void {
		this.conditionalLog('🧹 Disposing Pong3D instance...');

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

		// Dispose audio system
		if (this.audioSystem) {
			this.audioSystem.dispose();
			this.conditionalLog('✅ Disposed audio system');
		}

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

		// Clear references to help with garbage collection
		this.guiTexture = null;
		this.ballMesh = null;
		this.paddles = [null, null, null, null];
		this.goalMeshes = [null, null, null, null];
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
			const soundData = { s: soundType }; // s = sound, 0 = paddle ping, 1 = wall ping
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
		if (soundType === 0) {
			// Paddle ping
			this.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');
		} else if (soundType === 1) {
			// Wall ping
			this.audioSystem.playSoundEffectWithHarmonic('ping', 'wall');
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

			// Get the scoring player's UID from GameConfig
			const scoringPlayerUID = GameConfig.getPlayerUID(
				(scoringPlayerIndex + 1) as 1 | 2 | 3 | 4
			); // Convert 0-based to 1-based

			this.conditionalLog(
				`📡 Retrieved UID for scoring player ${scoringPlayerIndex + 1}: ${scoringPlayerUID || 'null'}`
			);

			if (!scoringPlayerUID) {
				this.conditionalWarn(
					`No UID found for player ${scoringPlayerIndex + 1}, cannot send score update`
				);
				return;
			}

			this.conditionalLog(
				`🏆 Sending score update for Player ${scoringPlayerIndex + 1} (UID: ${scoringPlayerUID})`
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

		// Find the player index from the UID
		let scoringPlayerIndex = -1;
		for (let i = 0; i < this.playerCount; i++) {
			const playerUID = GameConfig.getPlayerUID((i + 1) as 1 | 2 | 3 | 4);
			this.conditionalLog(`🎮 Checking player ${i + 1} UID:`, playerUID);
			if (playerUID === scoringPlayerUID) {
				scoringPlayerIndex = i;
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
		this.conditionalLog(
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

			// Wait 7 seconds for victory music to finish, then set game status and redirect if tournament
			setTimeout(() => {
				state.gameOngoing = false;
				this.conditionalLog(
					`🏆🏆🏆🏆🏆🏆🏆🏆🏆🏆 Victory music finished (7 seconds), gameOngoing set to false`
				);

				// if we are in a tournament redirect to tournament page
				if (sessionStorage.getItem('tournament') === '1') {
					location.hash = '#tournament';
				}
			}, 7000);
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
