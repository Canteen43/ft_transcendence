// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core/Physics/Plugins/cannonJSPlugin';
import * as CANNON from 'cannon-es';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import * as GUI from '@babylonjs/gui';
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
	private static readonly DEBUG_ENABLED = false;

	// Debug helper method - now uses GameConfig
	private debugLog(...args: any[]): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			console.log(...args);
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

	// Ball settings (non-effects)
	public WINNING_SCORE = 10; // Points needed to win the game
	private outOfBoundsDistance: number = 20; // Distance threshold for out-of-bounds detection (±units on X/Z axis)

	// Ball control settings - velocity-based reflection angle modification
	private BALL_ANGLE_MULTIPLIER = 1.0; // Multiplier for angle influence strength (0.0 = no effect, 1.0 = full effect)

	// Safety: maximum allowed angle between outgoing ball vector and paddle normal
	// (in radians). If a computed outgoing direction would exceed this, it will be
	// clamped toward the paddle normal so the ball cannot be returned at an
	// extreme grazing/perpendicular angle which causes excessive wall bounces.
	private ANGULAR_RETURN_LIMIT = Math.PI / 4; // 60 degrees

	// Paddle physics settings
	private PADDLE_MASS = 3; // Paddle mass for collision response
	private PADDLE_FORCE = 15; // Force applied when moving
	private PADDLE_RANGE = 5; // Movement range from center
	private PADDLE_MAX_VELOCITY = 12; // Maximum paddle speed
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

	// Goal detection
	private goalMeshes: (BABYLON.Mesh | null)[] = [null, null, null, null]; // Goal zones for each player
	private lastPlayerToHitBall: number = -1; // Track which player last hit the ball (0-based index)
	private onGoalCallback:
		| ((scoringPlayer: number, goalPlayer: number) => void)
		| null = null;
	private lastGoalTime: number = 0; // Prevent multiple goal triggers
	private readonly GOAL_COOLDOWN_MS = 2000; // 2 seconds between goals
	private goalScored: boolean = false; // Track when goal is scored but ball should continue moving
	private pendingGoalData: {
		scoringPlayer: number;
		goalPlayer: number;
	} | null = null; // Store goal data for delayed reset

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
		// Initialize input handler - it will manage keyboard and canvas events
		this.inputHandler = new Pong3DInput(this.canvas);

		// Store resize handler reference for proper cleanup
		this.resizeHandler = () => this.engine.resize();
		window.addEventListener('resize', this.resizeHandler);
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
		this.setupEventListeners();

		// Determine game mode based on GameConfig
		this.gameMode = this.getGameMode();
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🎮 Game mode detected: ${this.gameMode} (Player ${this.thisPlayer}, ${GameConfig.getPlayerCount()} players)`
			);
		}

		// Initialize appropriate game loop based on mode
		if (this.gameMode === 'local') {
			this.gameLoop = new Pong3DGameLoop(this.scene);
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
				}
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

		// Reduce intensity of imported lights
		try {
			// Reduced logging for lights setup
			// this.conditionalLog(`🔍 Debugging lights in scene: Found ${scene.lights.length} lights total`);

			scene.lights.forEach((light, index) => {
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
					console.log(
						'🔊 Audio system scene set and audio engine initialized'
					);
				}
				// Load audio assets after audio engine is ready
				return this.audioSystem.loadAudioAssets();
			})
			.catch(error => {
				if (GameConfig.isDebugLoggingEnabled()) {
					console.warn(
						'🔊 Audio initialization or loading failed:',
						error
					);
				}
			});

		scene.render();

		// Auto-start the game loop after everything is loaded
		if (this.gameLoop) {
			if (GameConfig.isDebugLoggingEnabled()) {
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog('🚀 Auto-starting game loop...');
				}
			}
			this.gameLoop.start();
		}
	}

	private setupPhysicsImpostors(scene: BABYLON.Scene): void {
		this.debugLog('Setting up physics impostors...');

		// Enable physics engine with Cannon.js (back to working version)
		const gravityVector = BABYLON.Vector3.Zero(); // No gravity for Pong
		const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
		this.scene.enablePhysics(gravityVector, physicsPlugin);

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

		// Set up collision detection for local AND master modes (both need full game logic)
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

			// Set up manual goal detection
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
		this.lastPlayerToHitBall = paddleIndex;
		this.conditionalLog(
			`Last player to hit ball updated to: ${this.lastPlayerToHitBall}`
		);

		// Play ping sound effect with harmonic variation
		this.audioSystem.playSoundEffectWithHarmonic('ping', 'paddle');

		const paddle = this.paddles[paddleIndex]!;
		if (!paddle.physicsImpostor?.physicsBody) return;

		// Get the collision normal from Cannon.js physics engine
		let paddleNormal = this.getCollisionNormal(
			ballImpostor,
			paddleImpostor
		);
		if (!paddleNormal) {
			console.warn(
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
		const paddleVelAlongAxis = BABYLON.Vector3.Dot(
			paddleVelocity,
			paddleAxis
		);

		// Define a threshold for "significant" paddle velocity
		// Lower threshold for 3P mode to make effects more visible
		const VELOCITY_THRESHOLD = this.playerCount === 3 ? 0.05 : 0.1;
		const hasPaddleVelocity =
			Math.abs(paddleVelAlongAxis) > VELOCITY_THRESHOLD;

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🏓 Player ${paddleIndex + 1} - ${hasPaddleVelocity ? 'Moving' : 'Stationary'} paddle (${paddleVelAlongAxis.toFixed(2)})`
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
				`🔍 Velocity threshold: ${VELOCITY_THRESHOLD}, actual abs velocity: ${Math.abs(paddleVelAlongAxis).toFixed(3)}`
			);
		}

		// 🚨 DEBUG: Extra logging for 4P mode paddle detection
		if (this.playerCount === 4) {
			this.conditionalLog(
				`🚨 4P DEBUG: paddleIndex=${paddleIndex}, P3=${paddleIndex === 2}, P4=${paddleIndex === 3}`
			);
			this.conditionalLog(
				`🚨 4P DEBUG: Paddle velocity dot product = ${paddleVelAlongAxis.toFixed(3)}`
			);
			this.conditionalLog(
				`🚨 4P DEBUG: Has paddle velocity? ${hasPaddleVelocity} (threshold: ${VELOCITY_THRESHOLD})`
			);
		}
		const velocityRatio = Math.max(
			-1.0,
			Math.min(1.0, paddleVelAlongAxis / this.PADDLE_MAX_VELOCITY)
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
				`🚨 velocityRatio = ${velocityRatio.toFixed(3)}, paddleVelAlongAxis = ${paddleVelAlongAxis.toFixed(3)}`
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
					`  - Paddle velocity: ${paddleVelAlongAxis.toFixed(2)} (${velocityRatio.toFixed(3)} of max)`
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
					`🚨 Player ${paddleIndex + 1} velocity: ${paddleVelAlongAxis.toFixed(3)}`
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
			// Check the OUTGOING angle (reflection angle from normal)
			const reflectionDot = BABYLON.Vector3.Dot(
				perfectReflection,
				paddleNormal
			);
			const outgoingAngleFromNormal = Math.acos(Math.abs(reflectionDot));

			this.conditionalLog(
				`  - Perfect reflection angle from normal: ${((outgoingAngleFromNormal * 180) / Math.PI).toFixed(1)}°`
			);
			this.conditionalLog(
				`  - Angular return limit: ${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
			);

			// === STANDARD REFLECTION LOGIC (works for all modes) ===
			if (outgoingAngleFromNormal <= this.ANGULAR_RETURN_LIMIT) {
				// Perfect reflection is within angular limits - use it
				if (GameConfig.isDebugLoggingEnabled()) {
					this.conditionalLog(
						`✅ Using perfect reflection (within limits)`
					);
				}
				finalDirection = perfectReflection.normalize();
			} else {
				// Perfect reflection exceeds angular limit - clamp it
				this.conditionalLog(
					`🔒 Clamping reflection: ${((outgoingAngleFromNormal * 180) / Math.PI).toFixed(1)}° → ${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
				);

				// Determine which side of the normal the reflection should be on
				// Use the cross product to determine the rotation axis and direction
				const rotationAxis = BABYLON.Vector3.Cross(
					paddleNormal,
					perfectReflection
				);

				if (rotationAxis.length() < 1e-6) {
					// Perfect reflection is parallel to normal (head-on collision) - return along normal
					finalDirection = paddleNormal.clone();
				} else {
					// Rotate the normal by exactly the angular limit toward the reflection
					const normalizedRotAxis = rotationAxis.normalize();
					const rotationMatrix = BABYLON.Matrix.RotationAxis(
						normalizedRotAxis,
						this.ANGULAR_RETURN_LIMIT
					);
					finalDirection = BABYLON.Vector3.TransformCoordinates(
						paddleNormal,
						rotationMatrix
					).normalize();
				}

				const clampedAngle = Math.acos(
					Math.abs(BABYLON.Vector3.Dot(finalDirection, paddleNormal))
				);
				this.conditionalLog(
					`🔒 Actual clamped angle: ${((clampedAngle * 180) / Math.PI).toFixed(1)}°`
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
				`  - Paddle velocity: ${paddleVelAlongAxis.toFixed(2)} (ratio: ${velocityRatio.toFixed(2)})`
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

		// Check cooldown to prevent multiple triggers
		const currentTime = performance.now();
		if (currentTime - this.lastGoalTime < this.GOAL_COOLDOWN_MS) {
			this.conditionalLog(`Goal on cooldown, ignoring collision`);
			return;
		}

		// goalIndex is the player whose goal was hit (they conceded)
		// The scoring player is the one who last hit the ball
		const scoringPlayer = this.lastPlayerToHitBall;
		const goalPlayer = goalIndex;

		this.conditionalLog(`Last player to hit ball: ${scoringPlayer}`);
		this.conditionalLog(`Goal player (conceding): ${goalPlayer}`);
		this.conditionalLog(`Current scores before goal:`, this.playerScores);

		if (scoringPlayer === -1) {
			this.conditionalWarn(
				'Goal detected but no player has hit the ball yet'
			);
			return;
		} // Prevent scoring against yourself (in case of weird physics)
		if (scoringPlayer === goalPlayer) {
			this.conditionalWarn(
				`Player ${scoringPlayer + 1} hit their own goal - no score`
			);
			return;
		}

		// Play goal sound effect only for legitimate scoring goals
		this.audioSystem.playSoundEffect('goal');

		// Award point to the scoring player
		this.conditionalLog(`Awarding point to player ${scoringPlayer}...`);
		this.playerScores[scoringPlayer]++;
		this.conditionalLog(`New scores after goal:`, this.playerScores);

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

			// Mark game as ended - ball will continue and exit naturally
			this.gameEnded = true;

			// Update the UI with final scores
			this.updatePlayerInfoDisplay();

			// Call the goal callback for any additional handling
			if (this.onGoalCallback) {
				this.conditionalLog(`Calling goal callback for game end...`);
				this.onGoalCallback(scoringPlayer, goalPlayer);
			}

			// Reset cooldown and last player tracker - game is over
			this.lastPlayerToHitBall = -1;
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
		this.pendingGoalData = { scoringPlayer, goalPlayer };

		this.conditionalLog(
			`🚀 Goal scored! Ball will continue to boundary before reset...`
		);

		// Reset the last player tracker and set cooldown
		this.lastPlayerToHitBall = -1;
		this.lastGoalTime = performance.now();
	}

	private setupManualGoalDetection(): void {
		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🔧 Setting up manual goal detection as backup...`
			);
		}

		// This will be called every frame to check for goal collisions manually
		this.scene.registerBeforeRender(() => {
			this.checkManualGoalCollisions();
		});
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

		// Check each goal for collision (only if no goal has been scored yet)
		if (!this.goalScored) {
			// Debug: Show how many goals we're checking
			const activeGoals = this.goalMeshes.filter(g => g !== null);
			if (activeGoals.length !== this.playerCount) {
				console.warn(
					`🚨 Goal count mismatch: Expected ${this.playerCount} goals, but have ${activeGoals.length} active goals`
				);
			}

			this.goalMeshes.forEach((goal, index) => {
				if (!goal) {
					// Debug: Show missing goals
					if (index < this.playerCount) {
						console.warn(
							`🚨 Goal ${index + 1} is missing for ${this.playerCount}-player mode`
						);
					}
					return;
				}

				// Debug: Periodically log goal checking (every 60 frames ~ 1 second)
				if (Math.random() < 0.016) {
					// ~1/60 chance
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`🔍 Checking goal ${index + 1} (${goal.name}) for ball collision...`
						);
					}
				}

				// Get goal bounding box
				const goalBounds = goal.getBoundingInfo().boundingBox;
				const goalMin = goalBounds.minimumWorld;
				const goalMax = goalBounds.maximumWorld;

				// Check if ball is inside goal bounds
				const isInside =
					ballPosition.x >= goalMin.x &&
					ballPosition.x <= goalMax.x &&
					ballPosition.y >= goalMin.y &&
					ballPosition.y <= goalMax.y &&
					ballPosition.z >= goalMin.z &&
					ballPosition.z <= goalMax.z;

				if (isInside) {
					if (GameConfig.isDebugLoggingEnabled()) {
						this.conditionalLog(
							`🎯 Manual goal detection: Ball inside Goal ${index + 1} (${goal.name})!`
						);
					}
					this.handleGoalCollision(index);
				}
			});
		}
	}

	private checkGeneralOutOfBounds(ballPosition: BABYLON.Vector3): void {
		// Simple out-of-bounds check for X and Z axes (ball is locked to Y plane)
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
			this.ballEffects.resetAllEffects();

			// Clear any pending goal state if ball went truly out of bounds
			this.goalScored = false;
			this.pendingGoalData = null;

			this.conditionalLog(`⚡ Ball reset due to out of bounds`);
		}
	}
	private checkBoundaryCollisionAfterGoal(
		ballPosition: BABYLON.Vector3
	): void {
		// Get scene boundaries
		if (this.boundsXMin === null || this.boundsXMax === null) {
			this.updateBounds();
			return; // Wait for bounds to be computed
		}

		// Check if ball has reached the boundary (add small margin for detection)
		const margin = 0.5;
		const hitBoundary =
			ballPosition.x <= this.boundsXMin + margin ||
			ballPosition.x >= this.boundsXMax - margin;

		if (hitBoundary) {
			if (GameConfig.isDebugLoggingEnabled()) {
				this.conditionalLog(`🎯 Ball reached boundary after goal!`);
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

			// Now reset the ball (normal gameplay)
			if (this.gameLoop) {
				this.gameLoop.resetBall();
			}

			// Reset rally speed system - new rally starts
			this.resetRallySpeed();

			// Reset last player to hit ball - new rally starts
			this.lastPlayerToHitBall = -1;

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
				console.warn('❌ No suitable lights found for shadow casting');
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
					console.warn(
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
			console.error('❌ Error setting up shadow system:', error);
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
			console.warn(
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

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog(
				`🔍 Looking for goals in ${this.playerCount}-player mode...`
			);
		}
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
			console.warn(
				'No goal meshes found in the scene! Add meshes named "goal1", "goal2", etc. for score detection'
			);
			return;
		}

		if (foundGoals.length < this.playerCount) {
			console.warn(
				`Expected ${this.playerCount} goals but only found ${foundGoals.length}`
			);
		}

		// Make goal meshes invisible and collision-only
		this.goalMeshes.forEach((goal, index) => {
			if (goal) {
				goal.isVisible = false; // Make completely invisible
				goal.checkCollisions = true; // Enable collision detection
				this.conditionalLog(
					`Goal ${index + 1} (${goal.name}): Made invisible for collision-only detection`
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
			console.warn('Error while hiding duplicate paddles:', err);
		}
	}

	private startRenderLoop(): void {
		// If GUI has hooked into the render loop, it replaced runRenderLoop itself.
		if (this.guiTexture) return;

		this.engine.runRenderLoop(() => {
			this.updateBounds();
			this.updatePaddles();

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
			this.updateBounds();
			this.updatePaddles();
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
		console.warn(
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
		if (this.boundsXMin === null || this.boundsXMax === null) {
			try {
				const allMeshes = this.scene.meshes;
				const info = this.computeSceneBoundingInfo(allMeshes);

				if (info) {
					this.boundsXMin = info.min.x;
					this.boundsXMax = info.max.x;
				}
			} catch (e) {
				// Ignore
			}
		}
	}

	private updatePaddles(): void {
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

			// Check bounds
			const posAlongAxis = BABYLON.Vector3.Dot(currentPos, axisNorm);
			const originAlongAxis = BABYLON.Vector3.Dot(
				new BABYLON.Vector3(originalPos.x, 0, originalPos.z),
				axisNorm
			);
			const minBound = originAlongAxis - this.PADDLE_RANGE;
			const maxBound = originAlongAxis + this.PADDLE_RANGE;
			const isOutOfBounds =
				posAlongAxis < minBound || posAlongAxis > maxBound;

			// Get player input
			const inputDir = (rightKeys[i] ? 1 : 0) - (leftKeys[i] ? 1 : 0);

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
			const clampedPosition = Math.max(
				-this.PADDLE_RANGE,
				Math.min(this.PADDLE_RANGE, position)
			);

			if (this.playerCount === 4 && index >= 2) {
				// 4-player mode: Players 3-4 move on Y-axis
				this.gameState.paddlePositionsY[index] = clampedPosition;
				if (this.paddles[index]) {
					this.paddles[index]!.position.z = clampedPosition;
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
					this.paddles[index]!.position.x =
						this.gameState.paddlePositionsX[index];
					this.paddles[index]!.position.z =
						this.gameState.paddlePositionsY[index];
				}
			} else {
				// 2-player mode: X-axis movement only
				this.gameState.paddlePositionsX[index] = clampedPosition;
				if (this.paddles[index]) {
					this.paddles[index]!.position.x = clampedPosition;
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
		if (this.gameLoop) {
			this.gameLoop.start();
		}

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

		// Reset last player to hit ball
		this.lastPlayerToHitBall = -1;

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
				console.warn('No contact found between ball and paddle');
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
				console.warn(
					`🚨 Normal has minimal X-Z components: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
				);
			}

			return correctedNormal;
		} catch (error) {
			console.warn(
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
			console.warn(
				`Failed to calculate paddle normal for paddle ${paddleIndex + 1}:`,
				error
			);
			return null;
		}
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
		// TODO: Send via WebSocket using team's message format
		// const message = {
		// 	t: 'g', // MESSAGE_GAME_STATE
		// 	d: JSON.stringify(gameState),
		// };
		// Only log the WebSocket message structure occasionally for debugging
		// this.conditionalLog('📡 WebSocket message (GAME_STATE):', message);
	}

	/**
	 * Send input to master (Client mode only)
	 */
	private sendInputToMaster(input: { k: number }): void {
		// Reduced logging for input - only log occasionally
		// this.conditionalLog(`📡 Player ${this.thisPlayer} sending input to master:`, input);
		// TODO: Send via WebSocket using team's message format
		// const message = {
		// 	t: 'm', // MESSAGE_MOVE
		// 	d: JSON.stringify(input),
		// };
		// Only log the WebSocket message structure occasionally for debugging
		// this.conditionalLog('📡 WebSocket message (MOVE):', message);
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
		console.log('🧪 Testing audio system...');
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
