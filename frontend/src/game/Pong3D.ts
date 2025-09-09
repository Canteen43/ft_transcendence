// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
import { CannonJSPlugin } from '@babylonjs/core/Physics/Plugins/cannonJSPlugin';
import * as CANNON from 'cannon-es';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import * as GUI from '@babylonjs/gui';
import { state } from '../misc/state';
import { gameOptions } from '../modals/LocalGameModal';
import { Pong3DGameLoop } from './Pong3DGameLoop';
import { Pong3DInput } from './Pong3DInput';
import {
	applyCameraPosition,
	type CameraSettings,
	DEFAULT_CAMERA_SETTINGS,
	getCameraPosition,
} from './Pong3DPOV';
import { createPong3DUI } from './Pong3DUI';

// ============================================================================
// CONFIGURATION - Easily adjustable settings
// ============================================================================

/**
 * Set the number of players for the game (2, 3, or 4)
 * This will automatically load the appropriate model:
 * - 2 players → /pong2p.glb
 * - 3 players → /pong3p.glb
 * - 4 players → /pong4p.glb
 */
// export const PLAYER_COUNT: 2 | 3 | 4 = 2;
export const OVERWRITE_PLAYER_COUNT: 0 | 2 | 3 | 4 = 0;

/**
 * Set the default player POV (perspective) for the camera
 * - 1 = Player 1's perspective (bottom view)
 * - 2 = Player 2's perspective (varies by mode)
 * - 3 = Player 3's perspective (side view)
 * - 4 = Player 4's perspective (side view)
 */
export const THIS_PLAYER: 1 | 2 | 3 | 4 = 1;

/**
 * Set default game mode
 * - true = Local 2-player mode (both players on same screen/keyboard)
 * - false = Network play mode (players on different devices)
 * Note: Local mode only applies when playerCount = 2
 */
export const LOCAL_MODE: boolean = true;

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

	// Debug helper method
	private debugLog(...args: any[]): void {
		if (Pong3D.DEBUG_ENABLED) {
			console.log(...args);
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

	// Player data - simplified to arrays for uniform handling
	private playerNames: string[] = ['Rufus', 'Karl', 'Wouter', 'Helene'];
	private playerScores: number[] = [0, 0, 0, 0];
	private activePlayerCount: number = state.playerCount; // Can be 2, 3, or 4
	private initialPlayerCount: number = state.playerCount; // Set at initialization, cannot be exceeded
	private thisPlayer: 1 | 2 | 3 | 4 = 1; // Current player's POV (1 = default camera position)
	private local: boolean = false; // Local 2-player mode vs network play (only applies when playerCount = 2)

	// === GAME PHYSICS CONFIGURATION ===

	// Ball settings
	private BALL_VELOCITY_CONSTANT = 12; // Base ball speed
	public RALLY_SPEED_INCREMENT_PERCENT = 10; // Percentage speed increase per paddle hit during rally
	public MAX_BALL_SPEED = 24; // Maximum ball speed to prevent tunneling
	private currentBallSpeed = 12; // Current ball speed (starts at base speed)
	private rallyHitCount = 0; // Number of paddle hits in current rally
	private outOfBoundsDistance: number = 20; // Distance threshold for out-of-bounds detection (±units on X/Z axis)

	// Ball control settings - velocity-based reflection angle modification
	private BALL_ANGLE_MULTIPLIER = 1.0; // Multiplier for angle influence strength (0.0 = no effect, 1.0 = full effect)

	// Safety: maximum allowed angle between outgoing ball vector and paddle normal
	// (in radians). If a computed outgoing direction would exceed this, it will be
	// clamped toward the paddle normal so the ball cannot be returned at an
	// extreme grazing/perpendicular angle which causes excessive wall bounces.
	private ANGULAR_RETURN_LIMIT = Math.PI / 4; // 60 degrees

	// Ball spin physics settings
	private SPIN_TRANSFER_FACTOR = 1.0; // How much paddle velocity becomes spin
	private MAGNUS_COEFFICIENT = 0.15; // Strength of Magnus force effect
	private SPIN_DECAY_FACTOR = 0.98; // Spin decay per frame (0.99 = slow decay)
	private SPIN_DELAY = 200; // Delay in milliseconds before spin effect activates
	private ballSpin: BABYLON.Vector3 = new BABYLON.Vector3(0, 0, 0); // Current ball spin
	private spinActivationTime: number = 0; // Timestamp when spin was applied

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

	// Collision debouncing to prevent rapid-fire collisions
	private lastCollisionTime = 0;
	private readonly COLLISION_DEBOUNCE_MS = 50; // Minimum time between collisions

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

	// Game loop
	private gameLoop: Pong3DGameLoop | null = null;
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
				console.warn(
					`Invalid player count ${playerCount}, defaulting to 2 players`
				);
				return '/pong2p.glb';
		}
	}

	/** Initialize camera based on current player POV */
	private setupCamera(): void {
		const cameraPos = getCameraPosition(
			this.thisPlayer,
			this.activePlayerCount,
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

		console.log(
			`Camera set for Player ${this.thisPlayer} POV: alpha=${cameraPos.alpha.toFixed(2)}, beta=${cameraPos.beta.toFixed(2)}`
		);
	}

	private setupEventListeners(): void {
		// Initialize input handler - it will manage keyboard and canvas events
		this.inputHandler = new Pong3DInput(this.canvas);

		// Store resize handler reference for proper cleanup
		this.resizeHandler = () => this.engine.resize();
		window.addEventListener('resize', this.resizeHandler);
	}

	constructor(container: HTMLElement, options?: Pong3DOptions) {
		// Overwrite player count if specified
		if (OVERWRITE_PLAYER_COUNT) {
			this.activePlayerCount = OVERWRITE_PLAYER_COUNT;
			this.initialPlayerCount = OVERWRITE_PLAYER_COUNT;
		}
		this.thisPlayer = options?.thisPlayer || THIS_PLAYER; // Set POV player (default from constant)
		this.local = options?.local ?? LOCAL_MODE; // Set local mode (default from constant)
		if (options?.outOfBoundsDistance !== undefined) {
			this.outOfBoundsDistance = options.outOfBoundsDistance; // Override default if provided
		}
		const modelUrl =
			options?.modelUrlOverride ||
			this.getModelUrlForPlayerCount(this.activePlayerCount);

		this.debugLog(
			`Initializing Pong3D for ${this.activePlayerCount} players with model: ${modelUrl}, POV: Player ${this.thisPlayer}, Local: ${this.local}`
		);

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

		// Initialize game loop
		this.gameLoop = new Pong3DGameLoop(this.scene);

		this.loadModel(modelUrl);

		// TODO: Remove this block. Its purpose was to showcase that gameOptions are accessible
		if (gameOptions) {
			alert(
				'Player Count: ' +
					gameOptions.playerCount +
					', This Player: ' +
					gameOptions.thisPlayer +
					', Game Type: ' +
					gameOptions.type
			);
		}
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
			(_scene, message) => console.error('Error loading model:', message)
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
				console.log(
					'Using GLB origin mode - POV module controls target:',
					this.camera.target
				);
			} else {
				// Use calculated mesh center with vertical offset
				const targetWithY = center.clone();
				targetWithY.y += this.DEFAULT_CAMERA_TARGET_Y;
				this.camera.setTarget(targetWithY);
				console.log(
					'Using calculated mesh center for camera target:',
					targetWithY
				);
			}

			// Don't override radius - let getCameraPosition control it
			// Fit camera radius to bounding sphere (for reference only)
			const computedRadius = Math.max(size.length() * 0.6, 1.5);
			const chosen = Math.max(computedRadius, this.DEFAULT_CAMERA_RADIUS);
			// this.camera.radius = chosen; // Commented out to allow custom radius per POV

			console.log(
				'Computed radius:',
				computedRadius,
				'Available radius:',
				chosen,
				'Using POV radius from getCameraPosition',
				'Camera target:',
				this.camera.target
			);
		}

		this.findPaddles(scene);
		this.findGoals(scene);
		this.findBall(scene);
		this.setupPhysicsImpostors(scene); // Create physics impostors for meshes

		// Setup GUI after model is loaded
		try {
			this.setupGui();
		} catch (e) {
			console.warn('GUI setup failed:', e);
		}

		// Reduce intensity of imported lights
		try {
			console.log(
				`🔍 Debugging lights in scene: Found ${scene.lights.length} lights total`
			);

			scene.lights.forEach((light, index) => {
				console.log(`Light ${index + 1}:`, {
					name: light.name,
					type: light.getClassName(),
					intensity: (light as any).intensity,
					position:
						light instanceof BABYLON.DirectionalLight ||
						light instanceof BABYLON.SpotLight
							? (light as any).position
							: 'N/A',
					enabled: light.isEnabled(),
				});

				if (light && typeof (light as any).intensity === 'number') {
					(light as any).intensity =
						(light as any).intensity * this.importedLightScale;
				}
			});
			console.log(
				'Adjusted imported light intensities by factor',
				this.importedLightScale
			);
		} catch (e) {
			console.warn('Could not adjust light intensities:', e);
		}

		// Setup shadows after lights are adjusted
		this.setupShadowSystem(scene);

		scene.render();

		// Auto-start the game loop after everything is loaded
		if (this.gameLoop) {
			console.log('🚀 Auto-starting game loop...');
			this.gameLoop.start();
		}
	}

	private setupPhysicsImpostors(scene: BABYLON.Scene): void {
		this.debugLog('Setting up physics impostors...');

		// Enable physics engine with Cannon.js (back to working version)
		const gravityVector = BABYLON.Vector3.Zero(); // No gravity for Pong
		const physicsPlugin = new CannonJSPlugin(true, 10, CANNON);
		this.scene.enablePhysics(gravityVector, physicsPlugin);

		// Ball impostor
		if (this.ballMesh) {
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

			console.log(`Created SphereImpostor for: ${this.ballMesh.name}`);
		}

		// Capture original paddle positions BEFORE any de-parenting operations
		for (let i = 0; i < this.activePlayerCount; i++) {
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
					console.log(
						`  - Is Mesh: true, hasVertexData: ${mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) !== null}`
					);

					// Check if vertices are positioned relative to origin
					const positions = mesh.getVerticesData(
						BABYLON.VertexBuffer.PositionKind
					);
					if (positions && positions.length >= 6) {
						console.log(
							`  - First vertex: (${positions[0]}, ${positions[1]}, ${positions[2]})`
						);
						console.log(
							`  - Second vertex: (${positions[3]}, ${positions[4]}, ${positions[5]})`
						);
					}
				}

				// Check if there are any transforms in the parent hierarchy
				if (paddle.parent) {
					console.log(
						`  - Checking parent hierarchy for transforms...`
					);
					let currentParent: BABYLON.Node | null = paddle.parent;
					let level = 0;
					while (currentParent && level < 3) {
						if (currentParent instanceof BABYLON.TransformNode) {
							const transform =
								currentParent as BABYLON.TransformNode;
							console.log(
								`    Parent ${level} (${currentParent.name}): pos(${transform.position.x}, ${transform.position.y}, ${transform.position.z})`
							);
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
				console.log(
					`  - Stored for game: x=${this.originalGLBPositions[i].x}, z=${this.originalGLBPositions[i].z}`
				);
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

				console.log(`Paddle ${paddleIndex + 1} AFTER positioning:`);
				console.log(
					`  - Game position: x=${paddle.position.x}, y=${paddle.position.y}, z=${paddle.position.z}`
				);

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
						if (this.activePlayerCount === 3) {
							// 3-player mode: All paddles move along rotated axes (X and Z components)
							// Player 1: 0° (X-axis), Player 2: 120° (X,Z), Player 3: 240° (X,Z)
							// Allow movement in the X-Z plane for all 3-player paddles
							paddle.physicsImpostor.physicsBody.linearFactor.set(
								1,
								0,
								1
							); // X and Z axes
						} else if (
							this.activePlayerCount === 4 &&
							paddleIndex >= 2
						) {
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

				console.log(`Created DYNAMIC BoxImpostor for: ${paddle.name}`);
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
				console.log(
					`Creating physics for wall mesh: ${mesh.name} (parent: ${mesh.parent ? mesh.parent.name : 'none'})`
				);
				console.log(
					`  - Position: x=${mesh.position.x}, y=${mesh.position.y}, z=${mesh.position.z}`
				);
				console.log(
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

					console.log(
						`  - De-parented and repositioned to: x=${mesh.position.x}, y=${mesh.position.y}, z=${mesh.position.z}`
					);
				}

				mesh.physicsImpostor = new BABYLON.PhysicsImpostor(
					mesh,
					BABYLON.PhysicsImpostor.MeshImpostor, // Use exact mesh shape instead of box
					{ mass: 0, restitution: 1.0, friction: 0 },
					this.scene
				);
				console.log(
					`Created static MeshImpostor for wall: ${mesh.name}`
				);
			}
		});

		// Set up goal collision detection AFTER all impostors are created
		if (this.ballMesh?.physicsImpostor) {
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
				console.log(
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
				console.log(
					`Set up ball-wall collision detection for ${wallImpostors.length} walls`
				);
			}

			// Set up manual goal detection
			this.setupManualGoalDetection();
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
		// 	console.log(`🚫 Collision debounced - too soon after last collision`);
		// 	return;
		// }
		// this.lastCollisionTime = currentTime;
		if (!this.ballMesh || !ballImpostor.physicsBody) return;

		// Find which paddle was hit
		let paddleIndex = -1;
		for (let i = 0; i < this.activePlayerCount; i++) {
			if (this.paddles[i]?.physicsImpostor === paddleImpostor) {
				paddleIndex = i;
				break;
			}
		}

		if (paddleIndex === -1) return; // Unknown paddle

		// Track which player last hit the ball
		console.log(`🏓 Ball hit by Player ${paddleIndex + 1}`);
		this.lastPlayerToHitBall = paddleIndex;
		console.log(
			`Last player to hit ball updated to: ${this.lastPlayerToHitBall}`
		);

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
				if (this.activePlayerCount === 2) {
					paddleNormal =
						paddleIndex === 0
							? new BABYLON.Vector3(0, 0, 1)
							: new BABYLON.Vector3(0, 0, -1);
				} else if (this.activePlayerCount === 3) {
					const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
					const angle = angles[paddleIndex];
					paddleNormal = new BABYLON.Vector3(
						-Math.cos(angle),
						0,
						-Math.sin(angle)
					).normalize();
				} else if (this.activePlayerCount === 4) {
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

		console.log(
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
			console.log(
				`🔄 Flipped normal to point toward ball: (${paddleNormal.x.toFixed(3)}, ${paddleNormal.y.toFixed(3)}, ${paddleNormal.z.toFixed(3)})`
			);
		}

		// For 2-player mode, check if collision is near the paddle face (not edges)
		if (this.activePlayerCount === 2) {
			// Players 1,2 move on X-axis, paddle faces are on Z-axis
			const maxXOffset =
				(paddleBounds.maximum.x - paddleBounds.minimum.x) * 0.6; // Allow 120% of paddle width (more lenient)
			if (Math.abs(relativePos.x) > maxXOffset) {
				console.log(
					`🚫 Edge collision detected on Player ${paddleIndex + 1} paddle - ignoring (offset: ${relativePos.x.toFixed(3)}, limit: ${maxXOffset.toFixed(3)})`
				);
				return; // Ignore edge collisions
			}
		} else if (this.activePlayerCount === 4) {
			// Players 3,4 move on Z-axis, check Z offset for players 3,4
			if (paddleIndex >= 2) {
				const maxZOffset =
					(paddleBounds.maximum.z - paddleBounds.minimum.z) * 0.4;
				if (Math.abs(relativePos.z) > maxZOffset) {
					console.log(
						`🚫 Edge collision detected on Player ${paddleIndex + 1} paddle - ignoring`
					);
					return; // Ignore edge collisions
				}
			} else {
				// Players 1,2 move on X-axis, check X offset
				const maxXOffset =
					(paddleBounds.maximum.x - paddleBounds.minimum.x) * 0.4;
				if (Math.abs(relativePos.x) > maxXOffset) {
					console.log(
						`🚫 Edge collision detected on Player ${paddleIndex + 1} paddle - ignoring`
					);
					return; // Ignore edge collisions
				}
			}
		}
		// For 3-player mode, we could add similar checks but it's more complex due to rotation

		// Get current velocities
		const ballVelocity = ballImpostor.getLinearVelocity();
		const paddleVelocity = paddle.physicsImpostor.getLinearVelocity();

		if (!ballVelocity || !paddleVelocity) return; // Determine movement axis for this paddle
		let paddleAxis = new BABYLON.Vector3(1, 0, 0); // Default for 2-player
		if (this.activePlayerCount === 2) {
			// Handle paddle 2's 180° rotation in Blender
			// Paddle 2 was rotated 180° to face the opposite direction, so its local X-axis is flipped
			if (paddleIndex === 1) {
				// Paddle 2 (index 1)
				paddleAxis = new BABYLON.Vector3(-1, 0, 0); // Flipped X-axis due to 180° rotation
			}
		} else if (this.activePlayerCount === 3) {
			// Player 1: 0°, Player 2: 120°, Player 3: 240°
			// All paddles are rotated to face center, so their movement axes are adjusted
			const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
			const paddleAngle = angles[paddleIndex];
			// Movement axis is perpendicular to the paddle's facing direction (90° rotated)
			paddleAxis = new BABYLON.Vector3(
				-Math.sin(paddleAngle),
				0,
				Math.cos(paddleAngle)
			);
		} else if (this.activePlayerCount === 4) {
			// All 4 paddles are rotated to face center
			if (paddleIndex === 0) {
				// Bottom paddle (0°)
				paddleAxis = new BABYLON.Vector3(1, 0, 0); // Moves left-right
			} else if (paddleIndex === 1) {
				// Top paddle (180°)
				paddleAxis = new BABYLON.Vector3(-1, 0, 0); // Flipped due to 180° rotation
			} else if (paddleIndex === 2) {
				// Right paddle (270°)
				paddleAxis = new BABYLON.Vector3(0, 0, -1); // Moves up-down in Z
			} else if (paddleIndex === 3) {
				// Left paddle (90°)
				paddleAxis = new BABYLON.Vector3(0, 0, 1); // Moves up-down in Z
			}
		}
		paddleAxis = paddleAxis.normalize();

		// Get paddle velocity along its movement axis
		const paddleVelAlongAxis = BABYLON.Vector3.Dot(
			paddleVelocity,
			paddleAxis
		);

		// Define a threshold for "significant" paddle velocity
		const VELOCITY_THRESHOLD = 0.1; // Minimum velocity to apply angle/spin modifications
		const hasPaddleVelocity =
			Math.abs(paddleVelAlongAxis) > VELOCITY_THRESHOLD;

		console.log(
			`🏓 Player ${paddleIndex + 1} - ${hasPaddleVelocity ? 'Moving' : 'Stationary'} paddle (${paddleVelAlongAxis.toFixed(2)})`
		);
		console.log(
			`🔍 Paddle velocity: (${paddleVelocity.x.toFixed(3)}, ${paddleVelocity.y.toFixed(3)}, ${paddleVelocity.z.toFixed(3)})`
		);

		let axisNote = '';
		if (this.activePlayerCount === 2 && paddleIndex === 1)
			axisNote = '[180° rotation]';
		else if (this.activePlayerCount === 3) axisNote = '[Facing center]';
		else if (this.activePlayerCount === 4) axisNote = '[Facing center]';

		console.log(
			`🔍 Paddle movement axis: (${paddleAxis.x.toFixed(3)}, ${paddleAxis.y.toFixed(3)}, ${paddleAxis.z.toFixed(3)}) ${axisNote}`
		);
		console.log(
			`🔍 Velocity threshold: ${VELOCITY_THRESHOLD}, actual abs velocity: ${Math.abs(paddleVelAlongAxis).toFixed(3)}`
		);

		// Calculate velocity ratio (0.0 = stationary, ±1.0 = max velocity)
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

			console.log(`🎯 MOVING PADDLE ANGULAR EFFECT:`);
			console.log(
				`  - Paddle velocity: ${paddleVelAlongAxis.toFixed(2)} (${velocityRatio.toFixed(3)} of max)`
			);
			console.log(
				`  - Ball deflects IN SAME DIRECTION as paddle movement`
			);
			console.log(
				`  - Return angle: ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}° from normal [CORRECTED DIRECTION]`
			);
			console.log(
				`  - Angular return limit: ±${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
			);

			// Determine rotation axis for applying velocity-based angle
			let rotationAxis = BABYLON.Vector3.Up(); // Default Y-axis rotation
			if (this.activePlayerCount === 3) {
				// For 3-player mode, rotate around axis perpendicular to paddle normal and Y-axis
				rotationAxis = BABYLON.Vector3.Cross(
					paddleNormal,
					BABYLON.Vector3.Up()
				).normalize();
				if (rotationAxis.length() < 0.001) {
					rotationAxis = BABYLON.Vector3.Up();
				}
			}

			// Individual player control: physics should now be consistent across players
			let actualAngle = velocityBasedAngle;
			// Note: No player-specific flipping needed since we fixed the base physics direction

			console.log(
				`  - Final applied angle: ${((actualAngle * 180) / Math.PI).toFixed(1)}°`
			);

			// Create return direction by rotating paddle normal by the velocity-based angle
			const rotationMatrix = BABYLON.Matrix.RotationAxis(
				rotationAxis,
				actualAngle
			);
			finalDirection = BABYLON.Vector3.TransformCoordinates(
				paddleNormal,
				rotationMatrix
			).normalize();
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

			console.log(`🎯 STATIONARY PADDLE REFLECTION:`);
			console.log(
				`  - Ball velocity: (${ballVelNormalized.x.toFixed(3)}, ${ballVelNormalized.y.toFixed(3)}, ${ballVelNormalized.z.toFixed(3)})`
			);
			console.log(
				`  - Paddle normal: (${paddleNormal.x.toFixed(3)}, ${paddleNormal.y.toFixed(3)}, ${paddleNormal.z.toFixed(3)})`
			);
			console.log(
				`  - Dot product (ball·normal): ${dotProduct.toFixed(3)}`
			);
			console.log(
				`  - Perfect reflection: (${perfectReflection.x.toFixed(3)}, ${perfectReflection.y.toFixed(3)}, ${perfectReflection.z.toFixed(3)})`
			);
			// Check the OUTGOING angle (reflection angle from normal)
			const reflectionDot = BABYLON.Vector3.Dot(
				perfectReflection,
				paddleNormal
			);
			const outgoingAngleFromNormal = Math.acos(Math.abs(reflectionDot));

			console.log(
				`  - Perfect reflection angle from normal: ${((outgoingAngleFromNormal * 180) / Math.PI).toFixed(1)}°`
			);
			console.log(
				`  - Angular return limit: ${((this.ANGULAR_RETURN_LIMIT * 180) / Math.PI).toFixed(1)}°`
			);

			if (outgoingAngleFromNormal <= this.ANGULAR_RETURN_LIMIT) {
				// Perfect reflection is within angular limits - use it
				console.log(`✅ Using perfect reflection (within limits)`);
				finalDirection = perfectReflection.normalize();
			} else {
				// Perfect reflection exceeds angular limit - clamp it
				console.log(
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
				console.log(
					`🔒 Actual clamped angle: ${((clampedAngle * 180) / Math.PI).toFixed(1)}°`
				);
			}
		}

		console.log(
			`🎯 Final direction: (${finalDirection.x.toFixed(3)}, ${finalDirection.y.toFixed(3)}, ${finalDirection.z.toFixed(3)})`
		);
		console.log(
			`🎯 Final angle from normal: ${((Math.acos(Math.abs(BABYLON.Vector3.Dot(finalDirection, paddleNormal))) * 180) / Math.PI).toFixed(1)}°`
		);

		// Increment rally speed - ball gets faster with each paddle hit during rally
		this.rallyHitCount++;
		this.currentBallSpeed =
			this.BALL_VELOCITY_CONSTANT *
			(1 +
				((this.rallyHitCount - 1) *
					this.RALLY_SPEED_INCREMENT_PERCENT) /
					100);

		// Apply maximum speed limit to prevent tunneling
		this.currentBallSpeed = Math.min(
			this.currentBallSpeed,
			this.MAX_BALL_SPEED
		);

		console.log(
			`🚀 Rally hit #${this.rallyHitCount}: Speed ${this.currentBallSpeed === this.MAX_BALL_SPEED ? 'capped at' : 'increased to'} ${this.currentBallSpeed.toFixed(1)} (${((this.currentBallSpeed / this.BALL_VELOCITY_CONSTANT - 1) * 100).toFixed(1)}% faster)`
		);

		// Apply the new velocity with rally-adjusted speed
		const newVelocity = finalDirection.scale(this.currentBallSpeed);

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

			console.log(
				`🔧 Position correction applied: ${correctionDistance.toFixed(3)} units along normal`
			);
			console.log(
				`🔧 Ball moved from (${ballPosition.x.toFixed(3)}, ${ballPosition.y.toFixed(3)}, ${ballPosition.z.toFixed(3)}) to (${this.ballMesh.position.x.toFixed(3)}, ${this.ballMesh.position.y.toFixed(3)}, ${this.ballMesh.position.z.toFixed(3)})`
			);
		} else {
			console.log(
				`🔧 No position correction needed - current distance: ${currentDistance.toFixed(3)}, minimum: ${minSeparation.toFixed(3)}`
			);
		}
		if (hasPaddleVelocity) {
			// Spin is proportional to paddle velocity, just like the angle influence
			const spinInfluence =
				paddleVelAlongAxis * this.SPIN_TRANSFER_FACTOR;

			// For spin, we use the paddle's movement axis to determine spin direction
			// Paddle moving right (+) = clockwise spin, paddle moving left (-) = counterclockwise spin
			// Apply spin around Y-axis (vertical) for side-to-side paddle movement
			const spinAxis = new BABYLON.Vector3(0, 1, 0); // Y-axis for vertical spin
			const newSpin = spinAxis.scale(spinInfluence);

			// No additional player-specific flipping needed since paddle axes are already corrected

			// Set the new spin (replace any existing spin)
			this.ballSpin = newSpin.clone();
			this.spinActivationTime = Date.now(); // Record when spin was applied
			console.log(
				`🌪️ Ball spin applied: ${this.ballSpin.y.toFixed(2)} (from paddle velocity: ${paddleVelAlongAxis.toFixed(2)}) - delayed ${this.SPIN_DELAY}ms`
			);
		} else {
			// Stationary paddle - no new spin added, but preserve existing spin
			console.log(
				`🌪️ Stationary paddle - preserving existing spin: ${this.ballSpin.y.toFixed(2)}`
			);
		}

		if (this.debugPaddleLogging || this.activePlayerCount === 3) {
			console.log(
				`Ball-Paddle Collision: Player ${paddleIndex + 1} (${hasPaddleVelocity ? 'Moving' : 'Stationary'} paddle)`
			);
			if (this.activePlayerCount === 3) {
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				console.log(
					`  - Paddle angle: ${((angles[paddleIndex] * 180) / Math.PI).toFixed(1)}°`
				);
				console.log(
					`  - Paddle normal: (${paddleNormal.x.toFixed(2)}, ${paddleNormal.z.toFixed(2)})`
				);
			}
			console.log(
				`  - Paddle velocity: ${paddleVelAlongAxis.toFixed(2)} (ratio: ${velocityRatio.toFixed(2)})`
			);
			if (hasPaddleVelocity) {
				const velocityBasedAngle =
					velocityRatio * this.ANGULAR_RETURN_LIMIT;
				console.log(
					`  - Velocity-based angle: ${((velocityBasedAngle * 180) / Math.PI).toFixed(1)}°`
				);
			} else {
				console.log(`  - Using reflection with angular limit`);
			}
			console.log(
				`  - Final direction: (${finalDirection.x.toFixed(2)}, ${finalDirection.z.toFixed(2)})`
			);
			console.log(
				`  - New velocity: (${newVelocity.x.toFixed(2)}, ${newVelocity.z.toFixed(2)})`
			);
		}
	}

	private handleBallWallCollision(
		_ballImpostor: BABYLON.PhysicsImpostor,
		_wallImpostor: BABYLON.PhysicsImpostor
	): void {
		console.log(`🧱 Ball-Wall Collision detected`);

		// When ball hits wall, spin is preserved but may be modified by friction
		// For realistic physics, some spin energy is lost
		const spinFrictionFactor = 0.8; // 20% spin loss on wall collision
		this.ballSpin.scaleInPlace(spinFrictionFactor);

		console.log(
			`🌪️ Wall collision: Spin reduced by friction, new spin: ${this.ballSpin.y.toFixed(2)}`
		);
	}

	private handleGoalCollision(goalIndex: number): void {
		console.log(`🏆 GOAL COLLISION DETECTED! Goal index: ${goalIndex}`);

		// Check cooldown to prevent multiple triggers
		const currentTime = performance.now();
		if (currentTime - this.lastGoalTime < this.GOAL_COOLDOWN_MS) {
			console.log(`Goal on cooldown, ignoring collision`);
			return;
		}

		// goalIndex is the player whose goal was hit (they conceded)
		// The scoring player is the one who last hit the ball
		const scoringPlayer = this.lastPlayerToHitBall;
		const goalPlayer = goalIndex;

		console.log(`Last player to hit ball: ${scoringPlayer}`);
		console.log(`Goal player (conceding): ${goalPlayer}`);
		console.log(`Current scores before goal:`, this.playerScores);

		if (scoringPlayer === -1) {
			console.warn('Goal detected but no player has hit the ball yet');
			return;
		} // Prevent scoring against yourself (in case of weird physics)
		if (scoringPlayer === goalPlayer) {
			console.warn(
				`Player ${scoringPlayer + 1} hit their own goal - no score`
			);
			return;
		}

		// Award point to the scoring player
		console.log(`Awarding point to player ${scoringPlayer}...`);
		this.playerScores[scoringPlayer]++;
		console.log(`New scores after goal:`, this.playerScores);

		console.log(
			`🎯 GOAL! Player ${scoringPlayer + 1} scored against Player ${goalPlayer + 1}`
		);
		console.log(
			`Score: ${this.playerScores.map((score, i) => `P${i + 1}: ${score}`).join(', ')}`
		);

		// Update the UI
		console.log(`Updating UI display...`);
		this.updatePlayerInfoDisplay();
		console.log(`UI update completed`);

		// Call the goal callback if set
		if (this.onGoalCallback) {
			console.log(`Calling goal callback...`);
			this.onGoalCallback(scoringPlayer, goalPlayer);
		} else {
			console.log(`No goal callback set`);
		}

		// Instead of immediately resetting the ball, let it continue to the boundary
		// Store the goal data for later processing when the ball reaches the boundary
		this.goalScored = true;
		this.pendingGoalData = { scoringPlayer, goalPlayer };

		console.log(
			`🚀 Goal scored! Ball will continue to boundary before reset...`
		);

		// Reset the last player tracker and set cooldown
		this.lastPlayerToHitBall = -1;
		this.lastGoalTime = performance.now();
	}

	private setupManualGoalDetection(): void {
		console.log(`🔧 Setting up manual goal detection as backup...`);

		// This will be called every frame to check for goal collisions manually
		this.scene.registerBeforeRender(() => {
			this.checkManualGoalCollisions();
		});
	}

	private checkManualGoalCollisions(): void {
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
			if (activeGoals.length !== this.activePlayerCount) {
				console.warn(
					`🚨 Goal count mismatch: Expected ${this.activePlayerCount} goals, but have ${activeGoals.length} active goals`
				);
			}

			this.goalMeshes.forEach((goal, index) => {
				if (!goal) {
					// Debug: Show missing goals
					if (index < this.activePlayerCount) {
						console.warn(
							`🚨 Goal ${index + 1} is missing for ${this.activePlayerCount}-player mode`
						);
					}
					return;
				}

				// Debug: Periodically log goal checking (every 60 frames ~ 1 second)
				if (Math.random() < 0.016) {
					// ~1/60 chance
					console.log(
						`🔍 Checking goal ${index + 1} (${goal.name}) for ball collision...`
					);
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
					console.log(
						`🎯 Manual goal detection: Ball inside Goal ${index + 1} (${goal.name})!`
					);
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
			console.log(
				`🏓 Ball went out of bounds! Position: ${ballPosition.toString()}, Threshold: ±${this.outOfBoundsDistance}`
			);

			// Reset ball immediately for general out of bounds
			if (this.gameLoop) {
				this.gameLoop.resetBall();
			}

			// Reset rally speed system - new rally starts
			this.resetRallySpeed();

			// Clear any pending goal state if ball went truly out of bounds
			this.goalScored = false;
			this.pendingGoalData = null;
			this.ballSpin.set(0, 0, 0);

			console.log(`⚡ Ball reset due to out of bounds`);
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
			console.log(
				`🎯 Ball reached boundary after goal! Resetting ball...`
			);

			// Now reset the ball
			if (this.gameLoop) {
				this.gameLoop.resetBall();
			}

			// Reset rally speed system - new rally starts
			this.resetRallySpeed();

			// Clear the goal state and reset spin
			this.goalScored = false;
			this.pendingGoalData = null;
			this.ballSpin.set(0, 0, 0); // Reset spin to zero
			this.spinActivationTime = 0; // Reset spin activation timer
			this.spinDelayActive = false; // Reset delay flag

			console.log(`⚡ Ball reset completed after boundary collision`);
		}
	}

	private setupShadowSystem(scene: BABYLON.Scene): void {
		console.log('🌟 Setting up shadow system...');

		try {
			console.log(
				`🔍 Shadow Debug: Total lights in scene: ${scene.lights.length}`
			);

			// Debug: Show all lights and their names
			scene.lights.forEach((light, index) => {
				console.log(
					`Light ${index + 1}: "${light.name}" (${light.getClassName()})`
				);
			});

			// Find lights with "light" in their name (Light, Light.001, Light.002, etc.)
			const shadowCastingLights = scene.lights.filter(light => {
				const name = light.name.toLowerCase();
				const hasLight = name.includes('light');
				const isValidType =
					light instanceof BABYLON.DirectionalLight ||
					light instanceof BABYLON.SpotLight;

				console.log(
					`🔍 Checking light "${light.name}": hasLight=${hasLight}, isValidType=${isValidType} (${light.getClassName()})`
				);

				return hasLight && isValidType;
			});

			console.log(
				`🔍 Found ${shadowCastingLights.length} suitable lights for shadows`
			);

			if (shadowCastingLights.length === 0) {
				console.warn('❌ No suitable lights found for shadow casting');
				console.log(
					'💡 Make sure your GLB has lights with "light" in the name and they are SpotLight or DirectionalLight type'
				);
				return;
			}

			// Setup shadow generators for each light
			shadowCastingLights.forEach(light => {
				console.log(
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
					console.log(
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

			console.log(
				`🔍 Found ${shadowReceivers.length} shadow receiver meshes:`
			);
			shadowReceivers.forEach(mesh => {
				mesh.receiveShadows = true;
				console.log(`✅ Enabled shadow receiving for: ${mesh.name}`);
			});

			console.log(
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
		for (let i = 0; i < this.activePlayerCount; i++) {
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
		for (let i = this.activePlayerCount; i < 4; i++) {
			this.paddles[i] = null;
		}

		// Log what we found
		const foundPaddles = this.paddles.filter(p => p !== null);
		console.log(
			`Found ${foundPaddles.length}/${this.activePlayerCount} expected paddles:`,
			foundPaddles.map(p => p?.name)
		);

		if (foundPaddles.length === 0) {
			console.warn('No paddle meshes found in the scene!');
			return;
		}

		if (foundPaddles.length < this.activePlayerCount) {
			console.warn(
				`Expected ${this.activePlayerCount} paddles but only found ${foundPaddles.length}`
			);
		}

		// Initialize paddle positions from their mesh positions
		for (let i = 0; i < this.activePlayerCount; i++) {
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
		for (let i = 0; i < this.activePlayerCount; i++) {
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
			console.log(`Found ball mesh: ${this.ballMesh.name}`);
			// Set the ball mesh in the game loop
			if (this.gameLoop) {
				this.gameLoop.setBallMesh(this.ballMesh);
			}
		} else {
			console.warn('No ball mesh found in the scene!');
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

		console.log('Created default ball mesh');

		// Set the ball mesh in the game loop
		if (this.gameLoop) {
			this.gameLoop.setBallMesh(this.ballMesh);
		}
	}

	private findGoals(scene: BABYLON.Scene): void {
		const meshes = scene.meshes;

		console.log(
			`🔍 Looking for goals in ${this.activePlayerCount}-player mode...`
		);
		console.log(`🔍 Initial/Max player count: ${this.initialPlayerCount}`);
		console.log(`🔍 Active player count: ${this.activePlayerCount}`);

		// Find goal meshes using case-insensitive name search
		const goalMeshes = meshes.filter(
			m => m && m.name && /goal/i.test(m.name)
		);

		console.log(
			`🔍 Found ${goalMeshes.length} meshes with "goal" in name:`,
			goalMeshes.map(m => m.name)
		);

		// Try to identify goals by numbered names for the expected number of players
		for (let i = 0; i < this.activePlayerCount; i++) {
			const goalNumber = i + 1;
			console.log(`🔍 Looking for goal${goalNumber}...`);

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
				console.log(`✅ Found goal${goalNumber}: ${goal.name}`);
			} else {
				console.log(`❌ Could not find goal${goalNumber}`);
				// If no specific numbered goal found, take the next available goal
				if (i < goalMeshes.length) {
					goal = goalMeshes[i] as BABYLON.Mesh;
					console.log(
						`📋 Fallback: Using ${goal?.name} as goal${goalNumber}`
					);
				}
			}

			this.goalMeshes[i] = goal || null;
		}

		// Clear unused goal slots
		for (let i = this.activePlayerCount; i < 4; i++) {
			this.goalMeshes[i] = null;
		}

		// Log what we found
		const foundGoals = this.goalMeshes.filter(g => g !== null);
		console.log(
			`Found ${foundGoals.length}/${this.activePlayerCount} expected goals:`,
			foundGoals.map(g => g?.name)
		);

		if (foundGoals.length === 0) {
			console.warn(
				'No goal meshes found in the scene! Add meshes named "goal1", "goal2", etc. for score detection'
			);
			return;
		}

		if (foundGoals.length < this.activePlayerCount) {
			console.warn(
				`Expected ${this.activePlayerCount} goals but only found ${foundGoals.length}`
			);
		}

		// Make goal meshes invisible and collision-only
		this.goalMeshes.forEach((goal, index) => {
			if (goal) {
				goal.isVisible = false; // Make completely invisible
				goal.checkCollisions = true; // Enable collision detection
				console.log(
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
				console.log('Hidden duplicate paddle meshes:', hidden);
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
		for (let i = 0; i < this.activePlayerCount; i++) {
			// Special-case mappings for certain 4-player POVs
			// - when thisPlayer === 2 => P1=top, P2=bottom, P3=left, P4=right
			// - when thisPlayer === 4 => P1=right, P2=left, P3=top,  P4=bottom (viewer)
			let position: 'top' | 'bottom' | 'left' | 'right' = 'bottom';
			if (this.activePlayerCount === 4 && this.thisPlayer === 2) {
				const specialMap: ('top' | 'bottom' | 'left' | 'right')[] = [
					'top',
					'bottom',
					'left',
					'right',
				];
				position = specialMap[i] || 'bottom';
			} else if (this.activePlayerCount === 4 && this.thisPlayer === 4) {
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
					(i - povOffset + this.activePlayerCount) %
					this.activePlayerCount;
				if (this.activePlayerCount === 2) {
					position = rel === 0 ? 'bottom' : 'top';
				} else if (this.activePlayerCount === 3) {
					position =
						rel === 0 ? 'bottom' : rel === 1 ? 'right' : 'left';
				} else if (this.activePlayerCount === 4) {
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
			if (this.activePlayerCount === 4 && this.thisPlayer === 3) {
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
		console.log(`📊 Updating UI with scores:`, this.playerScores);

		// If extended UI is present, update arrays
		if (this.uiPlayerNameTexts && this.uiPlayerScoreTexts) {
			console.log(`Using extended UI arrays`);
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
				console.log(
					`Set Player ${i + 1}: ${this.playerNames[i]} - ${this.playerScores[i]}`
				);
			}
			return;
		}

		// Backwards compatibility for single player fields
		console.log(`Using backwards compatibility UI`);
		if (this.Player1Info) {
			this.Player1Info.text = this.playerNames[0];
			console.log(`Set Player1Info to: ${this.playerNames[0]}`);
		}
		if (this.score1Text) {
			this.score1Text.text = String(this.playerScores[0]);
			console.log(`Set score1Text to: ${this.playerScores[0]}`);
		}
		if (this.Player2Info) {
			this.Player2Info.text = this.playerNames[1];
			console.log(`Set Player2Info to: ${this.playerNames[1]}`);
		}
		if (this.score2Text) {
			this.score2Text.text = String(this.playerScores[1]);
			console.log(`Set score2Text to: ${this.playerScores[1]}`);
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
	public setActivePlayerCount(count: number): void {
		const newCount = Math.max(2, Math.min(4, count));

		// Don't allow increasing beyond what was initialized
		if (newCount > this.initialPlayerCount) {
			console.warn(
				`Cannot set active player count to ${newCount}, initialized for ${this.initialPlayerCount} players only`
			);
			return;
		}

		this.activePlayerCount = newCount;
		console.log('Active player count set to:', this.activePlayerCount);

		// Update UI positioning and visibility for new player count
		this.positionPlayerInfoBlocks();
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
				this.activePlayerCount,
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
		this.rallyHitCount = 0;
		this.currentBallSpeed = this.BALL_VELOCITY_CONSTANT;
		console.log(
			`🔄 Rally reset: Speed back to base ${this.currentBallSpeed}`
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
		this.ballSpin.scaleInPlace(this.SPIN_DECAY_FACTOR);

		// Calculate current speed (magnitude) in X-Z plane only
		const currentSpeed = Math.sqrt(
			currentVelocity.x * currentVelocity.x +
				currentVelocity.z * currentVelocity.z
		);

		// Only adjust if ball is moving and speed differs significantly from target
		if (
			currentSpeed > 0.1 &&
			Math.abs(currentSpeed - this.currentBallSpeed) > 0.5
		) {
			// Normalize the X-Z velocity and scale to current rally speed
			const scale = this.currentBallSpeed / currentSpeed;
			const correctedVelocity = new BABYLON.Vector3(
				currentVelocity.x * scale,
				0, // Keep Y locked to 0
				currentVelocity.z * scale
			);
			this.ballMesh.physicsImpostor.setLinearVelocity(correctedVelocity);
		}
	}

	private spinDelayActive: boolean = false; // Track if we're still in delay period

	private applyMagnusForce(): void {
		if (!this.ballMesh || !this.ballMesh.physicsImpostor) return;

		// Check if spin delay has elapsed
		const currentTime = Date.now();
		const timeSinceSpinApplied = currentTime - this.spinActivationTime;

		if (timeSinceSpinApplied < this.SPIN_DELAY) {
			// Spin delay period - no Magnus force yet
			if (!this.spinDelayActive && this.spinActivationTime > 0) {
				this.spinDelayActive = true;
				console.log(
					`🕐 Spin delay active - Magnus effect starts in ${this.SPIN_DELAY}ms`
				);
			}
			return;
		}

		// Check if there's any spin to apply
		if (this.ballSpin.length() < 0.001) return;

		// Log when spin delay period ends (one-time)
		if (this.spinDelayActive) {
			this.spinDelayActive = false;
			console.log(`🌪️ Spin delay ended - Magnus effect now active!`);
		}

		// Get current ball velocity
		const velocity = this.ballMesh.physicsImpostor.getLinearVelocity();
		if (!velocity) return;

		// Magnus force = spin × velocity (cross product)
		// This creates a force perpendicular to both spin and velocity
		const magnusForce = BABYLON.Vector3.Cross(this.ballSpin, velocity);

		// Scale the Magnus force by coefficient
		magnusForce.scaleInPlace(this.MAGNUS_COEFFICIENT);

		// Apply Magnus force as impulse (small continuous force)
		// Scale down the impulse to make it smooth
		const impulseScale = 0.016; // Approximate frame time for 60fps
		magnusForce.scaleInPlace(impulseScale);

		// Apply the impulse to curve the ball's path
		this.ballMesh.physicsImpostor.applyImpulse(
			magnusForce,
			this.ballMesh.position
		);
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
		for (let i = 0; i < this.activePlayerCount; i++) {
			const paddle = this.paddles[i];
			if (!paddle || !paddle.physicsImpostor) continue;

			// Determine movement axis
			let axis = new BABYLON.Vector3(1, 0, 0);
			if (this.activePlayerCount === 3) {
				// Player 1: 0°, Player 2: 120°, Player 3: 240°
				const angles = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
				axis = new BABYLON.Vector3(
					Math.cos(angles[i]),
					0,
					Math.sin(angles[i])
				);
			} else if (this.activePlayerCount === 4) {
				axis =
					i >= 2
						? new BABYLON.Vector3(0, 0, 1)
						: new BABYLON.Vector3(1, 0, 0);
			}
			const axisNorm = axis.normalize();

			// --- AXIS CONSTRAINT: Snap to axis before any movement or rendering ---
			if (
				this.activePlayerCount === 3 &&
				paddle &&
				paddle.physicsImpostor
			) {
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
				if (this.activePlayerCount === 3) {
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
			this.activePlayerCount
		);
		const activePositionsY = this.gameState.paddlePositionsY.slice(
			0,
			this.activePlayerCount
		);
		console.log(
			'Active paddle positions X:',
			activePositionsX,
			'Y:',
			activePositionsY
		);
	}

	// Public configuration methods
	public setDefaultCameraRadius(value: number): void {
		this.DEFAULT_CAMERA_RADIUS = value;
		console.log('DEFAULT_CAMERA_RADIUS ->', this.DEFAULT_CAMERA_RADIUS);
	}

	public setDefaultCameraBeta(value: number): void {
		this.DEFAULT_CAMERA_BETA = value;
		console.log('DEFAULT_CAMERA_BETA ->', this.DEFAULT_CAMERA_BETA);
	}

	public setDefaultCameraTargetY(value: number): void {
		this.DEFAULT_CAMERA_TARGET_Y = value;
		console.log('DEFAULT_CAMERA_TARGET_Y ->', this.DEFAULT_CAMERA_TARGET_Y);
	}

	public setUseGLBOrigin(value: boolean): void {
		this.useGLBOrigin = value;
		console.log('useGLBOrigin ->', this.useGLBOrigin);
		// Immediately apply the new setting by refreshing the camera POV
		this.setPlayerPOV(this.thisPlayer);
	}

	public setPaddleRange(value: number): void {
		this.PADDLE_RANGE = value;
		console.log('PADDLE_RANGE ->', this.PADDLE_RANGE);
	}

	public setPaddleSpeed(value: number): void {
		this.PADDLE_FORCE = value;
		console.log('PADDLE_FORCE (speed) ->', this.PADDLE_FORCE);
	}

	public setBallAngleMultiplier(multiplier: number): void {
		this.BALL_ANGLE_MULTIPLIER = Math.max(0, Math.min(2, multiplier)); // Clamp between 0-2
		console.log('BALL_ANGLE_MULTIPLIER ->', this.BALL_ANGLE_MULTIPLIER);
	}

	public setBallVelocityConstant(speed: number): void {
		this.BALL_VELOCITY_CONSTANT = Math.max(1, speed); // Minimum speed of 1
		console.log('BALL_VELOCITY_CONSTANT ->', this.BALL_VELOCITY_CONSTANT);
	}

	public setOnGoalCallback(
		callback: (scoringPlayer: number, goalPlayer: number) => void
	): void {
		this.onGoalCallback = callback;
		console.log('Goal callback set');
	}

	public togglePaddleLogging(enabled?: boolean): void {
		if (typeof enabled === 'boolean') {
			this.debugPaddleLogging = enabled;
		} else {
			this.debugPaddleLogging = !this.debugPaddleLogging;
		}
		console.log('debugPaddleLogging ->', this.debugPaddleLogging);
	}

	/** Set individual paddle position */
	public setPaddlePosition(index: number, position: number): void {
		if (index >= 0 && index < 4) {
			const clampedPosition = Math.max(
				-this.PADDLE_RANGE,
				Math.min(this.PADDLE_RANGE, position)
			);

			if (this.activePlayerCount === 4 && index >= 2) {
				// 4-player mode: Players 3-4 move on Y-axis
				this.gameState.paddlePositionsY[index] = clampedPosition;
				if (this.paddles[index]) {
					this.paddles[index]!.position.z = clampedPosition;
				}
			} else if (this.activePlayerCount === 3) {
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
		if (this.activePlayerCount === 4 && index >= 2) {
			return this.gameState.paddlePositionsY[index] || 0;
		} else if (this.activePlayerCount === 3) {
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
			if (this.activePlayerCount === 4 && i >= 2) {
				positions[i] = this.gameState.paddlePositionsY[i];
			} else if (this.activePlayerCount === 3) {
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
				i < Math.min(positions.length, this.activePlayerCount);
				i++
			) {
				if (this.activePlayerCount === 4 && i >= 2) {
					this.gameState.paddlePositionsY[i] = positions[i];
				} else if (this.activePlayerCount === 3) {
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
			for (let i = 0; i < this.activePlayerCount; i++) {
				this.gameState.paddlePositionsX[i] = 0;
				this.gameState.paddlePositionsY[i] = 0;
			}
		}

		// Update mesh positions for active players
		for (let i = 0; i < this.activePlayerCount; i++) {
			if (this.paddles[i]) {
				if (this.activePlayerCount === 4 && i >= 2) {
					this.paddles[i]!.position.z =
						this.gameState.paddlePositionsY[i];
				} else if (this.activePlayerCount === 3) {
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
			console.log('importedLightScale ->', this.importedLightScale);
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
		return this.activePlayerCount;
	}

	/** Get initial player count (max possible) */
	public getInitialPlayerCount(): number {
		return this.initialPlayerCount;
	}

	/** Check if game is in local 2-player mode */
	public isLocal(): boolean {
		return this.local;
	}

	/** Check if a player index is active */
	public isPlayerActive(index: number): boolean {
		return index >= 0 && index < this.activePlayerCount;
	}

	// ============================================================================
	// GAME LOOP CONTROL METHODS
	// ============================================================================

	/** Start the game loop */
	public startGame(): void {
		if (this.gameLoop) {
			this.gameLoop.start();
		}
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
	}

	/** Set rally speed increment percentage */
	public setRallySpeedIncrement(percentage: number): void {
		this.RALLY_SPEED_INCREMENT_PERCENT = Math.max(
			0,
			Math.min(50, percentage)
		); // Clamp between 0-50%
		console.log(
			`🚀 Rally speed increment set to ${this.RALLY_SPEED_INCREMENT_PERCENT}%`
		);
	}

	/** Set maximum ball speed to prevent tunneling */
	public setMaxBallSpeed(maxSpeed: number): void {
		this.MAX_BALL_SPEED = Math.max(
			this.BALL_VELOCITY_CONSTANT,
			Math.min(100, maxSpeed)
		); // Clamp between base speed and 100
		console.log(`🏎️ Maximum ball speed set to ${this.MAX_BALL_SPEED}`);
	}

	/** Get current rally information */
	public getRallyInfo(): {
		hitCount: number;
		currentSpeed: number;
		baseSpeed: number;
		speedIncrease: number;
		maxSpeed: number;
	} {
		return {
			hitCount: this.rallyHitCount,
			currentSpeed: this.currentBallSpeed,
			baseSpeed: this.BALL_VELOCITY_CONSTANT,
			speedIncrease:
				(this.currentBallSpeed / this.BALL_VELOCITY_CONSTANT - 1) * 100,
			maxSpeed: this.MAX_BALL_SPEED,
		};
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

			console.log(
				`🔧 Raw Cannon.js contact normal: (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`
			);
			console.log(
				`🔧 Contact: body i = ${contact.bi === ballBody ? 'ball' : 'paddle'}, body j = ${contact.bj === ballBody ? 'ball' : 'paddle'}`
			);

			// If ball is body j, we need to flip the normal to point from paddle to ball
			if (contact.bj === ballBody) {
				normal.negate();
				console.log(
					`🔧 Flipped normal (ball is body j): (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`
				);
			}

			// Convert from Cannon Vector3 to Babylon Vector3
			const babylonNormal = new BABYLON.Vector3(
				normal.x,
				normal.y,
				normal.z
			);

			console.log(
				`🔧 Final collision normal: (${babylonNormal.x.toFixed(3)}, ${babylonNormal.y.toFixed(3)}, ${babylonNormal.z.toFixed(3)})`
			);

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

			console.log(
				`🔧 Ball velocity direction: (${normalizedVelocity.x.toFixed(3)}, ${normalizedVelocity.y.toFixed(3)}, ${normalizedVelocity.z.toFixed(3)})`
			);
			console.log(
				`🔧 Dot product (velocity·normal): ${dotProduct.toFixed(3)}`
			);

			let correctedNormal = normalizedNormal;
			if (dotProduct > 0.1) {
				// Ball moving toward normal means normal points AWAY from surface - this is CORRECT for reflection
				console.log(
					'🔧 Normal correctly points away from paddle surface'
				);
			} else if (dotProduct < -0.1) {
				// Ball moving away from normal means normal points wrong way - flip it
				correctedNormal = normalizedNormal.negate();
				console.log(
					'🔧 CORRECTED: Flipped normal to point away from paddle surface'
				);
				console.log(
					`🔧 Corrected normal: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
				);
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
				console.log(
					`� Projected normal to X-Z plane: (${correctedNormal.x.toFixed(3)}, ${correctedNormal.y.toFixed(3)}, ${correctedNormal.z.toFixed(3)})`
				);
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

			console.log(
				`🎯 Paddle ${paddleIndex + 1} calculated normal: (${normal.x.toFixed(3)}, ${normal.y.toFixed(3)}, ${normal.z.toFixed(3)})`
			);
			console.log(
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
		console.log('🧹 Disposing Pong3D instance...');

		// Stop the render loop first
		if (this.engine) {
			this.engine.stopRenderLoop();
			console.log('✅ Stopped render loop');
		}

		// Clean up game loop
		if (this.gameLoop) {
			this.gameLoop.stop();
			this.gameLoop = null;
			console.log('✅ Cleaned up game loop');
		}

		// Clean up input handler
		if (this.inputHandler) {
			this.inputHandler.cleanup();
			this.inputHandler = null;
			console.log('✅ Cleaned up input handler');
		}

		// Remove window resize listener
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
			console.log('✅ Removed resize event listener');
		}

		// Dispose of Babylon scene (this also disposes meshes, materials, textures, etc.)
		if (this.scene) {
			this.scene.dispose();
			console.log('✅ Disposed Babylon scene');
		}

		// Dispose of Babylon engine
		if (this.engine) {
			this.engine.dispose();
			console.log('✅ Disposed Babylon engine');
		}

		// Remove canvas from DOM
		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
			console.log('✅ Removed canvas from DOM');
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

		console.log('🎉 Pong3D disposal complete');
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
		playerCount: state.playerCount,
		thisPlayer: state.thisPlayer,
		...options,
	});
}
