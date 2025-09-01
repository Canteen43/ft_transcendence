// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import * as GUI from '@babylonjs/gui';
// import type { GameOptions } from '../misc/GameOptions';
// import { gameOptions } from '../screens/HomeScreen';
import { Pong3DInput } from './Pong3DInput';
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
export const DEFAULT_PLAYER_COUNT: 2 | 3 | 4 = 2;

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
	modelUrlOverride?: string; // Override automatic model selection
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
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;

	// Paddle meshes - use arrays for uniform handling
	private paddles: (BABYLON.Mesh | null)[] = [null, null, null, null];
	private boundsXMin: number | null = null;
	private boundsXMax: number | null = null;

	// Configurable camera settings
	private DEFAULT_CAMERA_RADIUS = 18;
	private DEFAULT_CAMERA_BETA = Math.PI / 3;
	private DEFAULT_CAMERA_TARGET_Y = -3;

	// Lighting configuration (can be overridden via constructor options or setters)
	private importedLightScale = 0.001; //turn down blender lighting

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

	// // Check if game Options can be read
	// if(gameOptions) {
	// 	alert(
	// 		'Player Count: ' +
	// 			gameOptions.playerCount +
	// 			', This Player: ' +
	// 			gameOptions.thisPlayer +
	// 			', Game Type: ' +
	// 			gameOptions.type
	// 	);
	// }

	// Player data - simplified to arrays for uniform handling
	private playerNames: string[] = ['Rufus', 'Karl', 'Wouter', 'Helen'];
	private playerScores: number[] = [0, 0, 0, 0];
	private activePlayerCount: number = DEFAULT_PLAYER_COUNT; // Can be 2, 3, or 4
	private initialPlayerCount: number = DEFAULT_PLAYER_COUNT; // Set at initialization, cannot be exceeded

	// Configurable paddle settings
	private PADDLE_RANGE = 4.25;
	private PADDLE_SPEED = 6;

	// Debug logging
	private debugPaddleLogging = true;
	private readonly PADDLE_LOG_INTERVAL = 250; // ms
	private lastPaddleLog = 0;

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

	/** Initialize camera */
	private setupCamera(): void {
		this.camera = new BABYLON.ArcRotateCamera(
			'cam',
			Math.PI / 2,
			this.DEFAULT_CAMERA_BETA,
			this.DEFAULT_CAMERA_RADIUS,
			BABYLON.Vector3.Zero(),
			this.scene
		);

		this.camera.attachControl(this.canvas, true);
		this.camera.wheelPrecision = 50;

		// Disable camera keyboard controls so arrow keys can be used for gameplay
		this.camera.keysUp = [];
		this.camera.keysDown = [];
		this.camera.keysLeft = [];
		this.camera.keysRight = [];
	}

	private setupEventListeners(): void {
		// Initialize input handler - it will manage keyboard and canvas events
		this.inputHandler = new Pong3DInput(this.canvas);
		window.addEventListener('resize', () => this.engine.resize());
	}

	constructor(container: HTMLElement, options?: Pong3DOptions) {
		// Set player count and determine model URL
		this.activePlayerCount = options?.playerCount || DEFAULT_PLAYER_COUNT;
		this.initialPlayerCount = this.activePlayerCount; // Store initial count
		const modelUrl =
			options?.modelUrlOverride ||
			this.getModelUrlForPlayerCount(this.activePlayerCount);

		console.log(
			`Initializing Pong3D for ${this.activePlayerCount} players with model: ${modelUrl}`
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

			// Move camera target to center with vertical offset
			const targetWithY = center.clone();
			targetWithY.y += this.DEFAULT_CAMERA_TARGET_Y;
			this.camera.setTarget(targetWithY);

			// Fit camera radius to bounding sphere
			const radius = Math.max(size.length() * 0.6, 1.5);
			const chosen = Math.max(radius, this.DEFAULT_CAMERA_RADIUS);
			this.camera.radius = chosen;

			console.log(
				'Computed radius:',
				radius,
				'Chosen camera radius:',
				chosen,
				'Camera target:',
				this.camera.target
			);
		}

		this.findPaddles(scene);

		// Setup GUI after model is loaded
		try {
			this.setupGui();
		} catch (e) {
			console.warn('GUI setup failed:', e);
		}

		// Reduce intensity of imported lights
		try {
			scene.lights.forEach(light => {
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

		scene.render();
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
				// Store original GLB position for relative movement
				this.originalGLBPositions[i] = {
					x: this.paddles[i]!.position.x,
					z: this.paddles[i]!.position.z,
				};

				// Initialize gameState as displacement from GLB position (starting at 0)
				this.gameState.paddlePositionsX[i] = 0;
				this.gameState.paddlePositionsY[i] = 0;
			} else {
				// Default position for missing paddles
				this.originalGLBPositions[i] = { x: 0, z: 0 };
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
			const dt = this.engine.getDeltaTime() / 1000; // seconds

			this.updateBounds();
			this.updatePaddles(dt);

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
			const dt = this.engine.getDeltaTime() / 1000;
			this.updateBounds();
			this.updatePaddles(dt);
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

		if (this.activePlayerCount === 2) {
			// 2-player mode: Player 1 bottom, Player 2 top
			this.uiMovePlayerTo(0, 'bottom'); // Player 1
			this.uiMovePlayerTo(1, 'top'); // Player 2
			this.uiPlayerStacks[0].isVisible = true;
			this.uiPlayerStacks[1].isVisible = true;
		} else if (this.activePlayerCount === 3) {
			// 3-player mode: Player 1 bottom, Player 2 right, Player 3 left
			this.uiMovePlayerTo(0, 'bottom'); // Player 1
			this.uiMovePlayerTo(1, 'right'); // Player 2
			this.uiMovePlayerTo(2, 'left'); // Player 3
			this.uiPlayerStacks[0].isVisible = true;
			this.uiPlayerStacks[1].isVisible = true;
			this.uiPlayerStacks[2].isVisible = true;
		} else if (this.activePlayerCount === 4) {
			// 4-player mode: Player 1 bottom, Player 2 top, Player 3 right, Player 4 left
			this.uiMovePlayerTo(0, 'bottom'); // Player 1
			this.uiMovePlayerTo(1, 'top'); // Player 2
			this.uiMovePlayerTo(2, 'right'); // Player 3
			this.uiMovePlayerTo(3, 'left'); // Player 4
			this.uiPlayerStacks[0].isVisible = true;
			this.uiPlayerStacks[1].isVisible = true;
			this.uiPlayerStacks[2].isVisible = true;
			this.uiPlayerStacks[3].isVisible = true;
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
		// If extended UI is present, update arrays
		if (this.uiPlayerNameTexts && this.uiPlayerScoreTexts) {
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
			}
			return;
		}

		// Backwards compatibility for single player fields
		if (this.Player1Info) this.Player1Info.text = this.playerNames[0];
		if (this.score1Text)
			this.score1Text.text = String(this.playerScores[0]);
		if (this.Player2Info) this.Player2Info.text = this.playerNames[1];
		if (this.score2Text)
			this.score2Text.text = String(this.playerScores[1]);
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

	/** Set the Player1Info text (backwards compatibility) */
	public setPlayer1Info(text: string): void {
		if (this.Player1Info) this.Player1Info.text = text;
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

	private updatePaddles(dt: number): void {
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

		// Update only active paddles
		for (let i = 0; i < this.activePlayerCount; i++) {
			if (!this.paddles[i]) continue;

			const dir = (rightKeys[i] ? 1 : 0) - (leftKeys[i] ? 1 : 0);
			if (dir !== 0) {
				const movement = dir * this.PADDLE_SPEED * dt;

				if (this.activePlayerCount === 4 && i >= 2) {
					// 4-player mode: Players 3-4 move on Y-axis
					this.gameState.paddlePositionsY[i] += movement;
				} else if (this.activePlayerCount === 3) {
					// 3-player triangular mode: Apply movement along the logical axis
					// Store the logical position along each player's movement axis
					// For 3-player mode, we track the displacement from the original GLB position

					// Get current logical position (displacement along movement axis)
					const angles = [0, (4 * Math.PI) / 3, (2 * Math.PI) / 3]; // 0°, 240°, 120°
					const angle = angles[i];
					const cos = Math.cos(angle);
					const sin = Math.sin(angle);

					// Get the logical position along the movement axis
					// This represents how far the paddle has moved from its GLB position
					let currentLogicalPos =
						this.gameState.paddlePositionsX[i] * cos +
						this.gameState.paddlePositionsY[i] * sin;

					// Apply movement along the logical axis
					currentLogicalPos += movement;

					// Clamp the logical position
					currentLogicalPos = Math.max(
						-this.PADDLE_RANGE,
						Math.min(this.PADDLE_RANGE, currentLogicalPos)
					);

					// Convert back to X,Y displacement from original position
					const deltaX = currentLogicalPos * cos;
					const deltaY = currentLogicalPos * sin;

					// Update gameState to store the displacement
					this.gameState.paddlePositionsX[i] = deltaX;
					this.gameState.paddlePositionsY[i] = deltaY;
				} else {
					// 2-player mode or players 1-2 in 4-player mode: X-axis movement only
					this.gameState.paddlePositionsX[i] += movement;
				}

				// Apply clamping and update mesh positions ONLY when there's movement
				if (this.activePlayerCount === 4 && i >= 2) {
					// Clamp Y position for players 3-4 in 4-player mode
					this.gameState.paddlePositionsY[i] = Math.max(
						-this.PADDLE_RANGE,
						Math.min(
							this.PADDLE_RANGE,
							this.gameState.paddlePositionsY[i]
						)
					);
					// Update mesh Y position relative to original GLB position
					this.paddles[i]!.position.x =
						this.originalGLBPositions[i].x;
					this.paddles[i]!.position.z =
						this.originalGLBPositions[i].z +
						this.gameState.paddlePositionsY[i];
				} else if (this.activePlayerCount === 3) {
					// For 3-player mode, clamp position along the rotated axis
					const angles = [0, (4 * Math.PI) / 3, (2 * Math.PI) / 3]; // 0°, 240°, 120°
					const angle = angles[i];
					const cos = Math.cos(angle);
					const sin = Math.sin(angle);

					// Get current position in 2D
					const x = this.gameState.paddlePositionsX[i];
					const y = this.gameState.paddlePositionsY[i];

					// Project to 1D along the rotated axis
					const projectedPosition = x * cos + y * sin;

					// Clamp the projected position
					const clampedProjection = Math.max(
						-this.PADDLE_RANGE,
						Math.min(this.PADDLE_RANGE, projectedPosition)
					);

					// Convert back to 2D coordinates
					this.gameState.paddlePositionsX[i] =
						clampedProjection * cos;
					this.gameState.paddlePositionsY[i] =
						clampedProjection * sin;

					// Update mesh positions relative to original GLB positions
					this.paddles[i]!.position.x =
						this.originalGLBPositions[i].x +
						this.gameState.paddlePositionsX[i];
					this.paddles[i]!.position.z =
						this.originalGLBPositions[i].z +
						this.gameState.paddlePositionsY[i];
				} else {
					// Clamp X position for 2-player mode or players 1-2 in 4-player mode
					this.gameState.paddlePositionsX[i] = Math.max(
						-this.PADDLE_RANGE,
						Math.min(
							this.PADDLE_RANGE,
							this.gameState.paddlePositionsX[i]
						)
					);
					// Update mesh X position relative to original GLB position
					this.paddles[i]!.position.x =
						this.originalGLBPositions[i].x +
						this.gameState.paddlePositionsX[i];
					this.paddles[i]!.position.z =
						this.originalGLBPositions[i].z;
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

	public setPaddleRange(value: number): void {
		this.PADDLE_RANGE = value;
		console.log('PADDLE_RANGE ->', this.PADDLE_RANGE);
	}

	public setPaddleSpeed(value: number): void {
		this.PADDLE_SPEED = value;
		console.log('PADDLE_SPEED ->', this.PADDLE_SPEED);
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
				const angles = [0, (4 * Math.PI) / 3, (2 * Math.PI) / 3]; // 0°, 240°, 120°
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
			const angles = [0, (4 * Math.PI) / 3, (2 * Math.PI) / 3]; // 0°, 240°, 120°
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
				const angles = [0, (4 * Math.PI) / 3, (2 * Math.PI) / 3]; // 0°, 240°, 120°
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
					const angles = [0, (4 * Math.PI) / 3, (2 * Math.PI) / 3]; // 0°, 240°, 120°
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

	/** Check if a player index is active */
	public isPlayerActive(index: number): boolean {
		return index >= 0 && index < this.activePlayerCount;
	}

	// Cleanup method
	public dispose(): void {
		// Clean up input handler
		if (this.inputHandler) {
			this.inputHandler.cleanup();
			this.inputHandler = null;
		}

		this.engine.dispose();
		if (this.canvas.parentElement) {
			this.canvas.parentElement.removeChild(this.canvas);
		}
	}
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Create a Pong3D instance with the default player count configuration
 * This is a shorthand for: new Pong3D(container, { playerCount: DEFAULT_PLAYER_COUNT })
 */
export function createPong3D(
	container: HTMLElement,
	options?: Omit<Pong3DOptions, 'playerCount'>
): Pong3D {
	return new Pong3D(container, {
		playerCount: DEFAULT_PLAYER_COUNT,
		...options,
	});
}
