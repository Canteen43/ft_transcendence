// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import * as GUI from '@babylonjs/gui';
import { createPong3DUI } from './Pong3DUI';
import { Pong3DInput } from './Pong3DInput';

export interface Pong3DOptions {
	importedLightScale?: number; // multiply imported light intensities by this
}

interface GameState {
	paddle1_x: number;
	paddle2_x: number;
}

interface BoundingInfo {
	min: BABYLON.Vector3;
	max: BABYLON.Vector3;
}

export class Pong3D {
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;
	private paddle1: BABYLON.Mesh | null = null;
	private paddle2: BABYLON.Mesh | null = null;
	private boundsXMin: number | null = null;
	private boundsXMax: number | null = null;

	// Configurable camera settings
	private DEFAULT_CAMERA_RADIUS = 18;
	private DEFAULT_CAMERA_BETA = Math.PI / 3;
	private DEFAULT_CAMERA_TARGET_Y = -3;

	// Lighting configuration (can be overridden via constructor options or setters)
	private importedLightScale = 0.001;

	// GUI
	private guiTexture: GUI.AdvancedDynamicTexture | null = null;
	private score1Text: GUI.TextBlock | null = null;
	private score2Text: GUI.TextBlock | null = null;
	// Player1 info UI
	private player1Container: GUI.Rectangle | null = null;
	private Player1Info: GUI.TextBlock | null = null;
	// Player2 info UI
	private player2Container: GUI.Rectangle | null = null;
	private Player2Info: GUI.TextBlock | null = null;

	// Extended multi-player UI handles (when UI module is used)
	private uiPlayerStacks: GUI.StackPanel[] | null = null;
	private uiPlayerNameTexts: GUI.TextBlock[] | null = null;
	private uiPlayerScoreTexts: GUI.TextBlock[] | null = null;
	private uiMovePlayerTo: ((i: number, pos: 'top'|'bottom'|'left'|'right') => void) | null = null;

	// Player data
	private player1Name: string = 'Rufus';
	private player2Name: string = 'Karl';
	private player1Score: number = 0;
	private player2Score: number = 0;

	// Optional players 3 and 4 for 4-player UI
	private player3Name: string = 'Wouter';
	private player4Name: string = 'Helen';
	private player3Score: number = 0;
	private player4Score: number= 0;


	// Configurable paddle settings
	private PADDLE_RANGE = 4.25;
	private PADDLE_SPEED = 6;

	// Debug logging
	private debugPaddleLogging = true;
	private readonly PADDLE_LOG_INTERVAL = 250; // ms
	private lastPaddleLog = 0;

	// Game state
	private gameState: GameState = {
		paddle1_x: 0,
		paddle2_x: 0,
	};

	// Input handler
	private inputHandler: Pong3DInput | null = null;

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

	constructor(container: HTMLElement, modelUrl = '/pong4p.glb', options?: Pong3DOptions) {
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
			if (typeof options.importedLightScale === 'number') this.importedLightScale = options.importedLightScale;
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

		// Reduce intensity of imported lights (Blender lights are often much brighter in Babylon)
		try {
			scene.lights.forEach(light => {
				if (light && typeof (light as any).intensity === 'number') {
					(light as any).intensity = (light as any).intensity * this.importedLightScale;
				}
			});
			console.log('Adjusted imported light intensities by factor', this.importedLightScale);
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

		// Case-insensitive name search for 'paddle'
		const paddleMeshes = meshes.filter(
			m => m && m.name && /paddle/i.test(m.name)
		);

		if (paddleMeshes.length >= 2) {
			this.paddle1 = paddleMeshes[0] as BABYLON.Mesh;
			this.paddle2 = paddleMeshes[1] as BABYLON.Mesh;
		} else if (paddleMeshes.length === 1) {
			this.paddle1 = paddleMeshes[0] as BABYLON.Mesh;
			// Try to pick another common name
			this.paddle2 =
				(meshes.find(
					m => m && m.name && /paddle2|player2|p2/i.test(m.name)
				) as BABYLON.Mesh) || null;
		} else {
			// Fallback: look for common names
			this.paddle1 =
				(meshes.find(
					m => m && m.name && /paddle1|player1|p1/i.test(m.name)
				) as BABYLON.Mesh) || null;
			this.paddle2 =
				(meshes.find(
					m => m && m.name && /paddle2|player2|p2/i.test(m.name)
				) as BABYLON.Mesh) || null;
		}

		if (!this.paddle1 || !this.paddle2) {
			console.warn(
				'Could not find two paddle meshes by name. Found:',
				this.paddle1?.name,
				this.paddle2?.name
			);
		} else {
			console.log('Paddles found:', this.paddle1.name, this.paddle2.name);

			// Initialize authoritative positions
			this.gameState.paddle1_x = this.paddle1.position.x;
			this.gameState.paddle2_x = this.paddle2.position.x;

			// Clamp initial positions to configured symmetric range
			this.gameState.paddle1_x = Math.max(
				-this.PADDLE_RANGE,
				Math.min(this.PADDLE_RANGE, this.gameState.paddle1_x)
			);
			this.gameState.paddle2_x = Math.max(
				-this.PADDLE_RANGE,
				Math.min(this.PADDLE_RANGE, this.gameState.paddle2_x)
			);

			// Hide duplicate paddle meshes
			this.hideDuplicatePaddles(meshes);
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
				if (!m || m === this.paddle1 || m === this.paddle2) return;
				if (!m.position) return;

				// Compare distance to paddle1 and paddle2
				const d1 =
					this.paddle1 && this.paddle1.position
						? BABYLON.Vector3.Distance(
								m.position,
								this.paddle1.position
							)
						: Number.POSITIVE_INFINITY;
				const d2 =
					this.paddle2 && this.paddle2.position
						? BABYLON.Vector3.Distance(
								m.position,
								this.paddle2.position
							)
						: Number.POSITIVE_INFINITY;

				if (d1 < EPS || d2 < EPS) {
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
			playerNames: [this.player1Name, this.player2Name, this.player3Name ?? '', this.player4Name ?? ''],
			playerScores: [this.player1Score, this.player2Score, this.player3Score ?? 0, this.player4Score ?? 0],
		});

		this.guiTexture = handles.guiTexture;
		// store array handles for multi-player updates
		this.uiPlayerStacks = handles.playerStacks;
		this.uiPlayerNameTexts = handles.playerNameTexts;
		this.uiPlayerScoreTexts = handles.playerScoreTexts;
		this.uiMovePlayerTo = handles.movePlayerTo;

		// Backwards-compat convenience: point single-player fields to first two players if available
		if (this.uiPlayerNameTexts && this.uiPlayerNameTexts.length > 0) this.Player1Info = this.uiPlayerNameTexts[0];
		if (this.uiPlayerScoreTexts && this.uiPlayerScoreTexts.length > 0) this.score1Text = this.uiPlayerScoreTexts[0];
		if (this.uiPlayerNameTexts && this.uiPlayerNameTexts.length > 1) this.Player2Info = this.uiPlayerNameTexts[1];
		if (this.uiPlayerScoreTexts && this.uiPlayerScoreTexts.length > 1) this.score2Text = this.uiPlayerScoreTexts[1];

		// Keep a simple render loop that updates the scene
		this.engine.runRenderLoop(() => {
			const dt = this.engine.getDeltaTime() / 1000;
			this.updateBounds();
			this.updatePaddles(dt);
			this.scene.render();
			this.maybeLogPaddles();
		});
	}

	/** Update displayed scores */
	public setScores(p1: number, p2: number): void {
		if (this.score1Text) this.score1Text.text = String(p1);
		if (this.score2Text) this.score2Text.text = String(p2);
	}

	/** Update the on-screen Player1Info using current name/score fields */
	private updatePlayerInfoDisplay(): void {
		// If extended UI is present, update arrays
		if (this.uiPlayerNameTexts && this.uiPlayerScoreTexts) {
			const names = [this.player1Name, this.player2Name, /* p3 */ this.player3Name ?? 'Player3', /* p4 */ this.player4Name ?? 'Player4'];
			const scores = [this.player1Score, this.player2Score, this.player3Score ?? 0, this.player4Score ?? 0];
			for (let i = 0; i < Math.min(this.uiPlayerNameTexts.length, names.length); i++) {
				this.uiPlayerNameTexts[i].text = names[i];
				this.uiPlayerScoreTexts[i].text = String(scores[i]);
			}
			return;
		}

		if (this.Player1Info) this.Player1Info.text = this.player1Name;
		if (this.score1Text) this.score1Text.text = String(this.player1Score);
		if (this.Player2Info) this.Player2Info.text = this.player2Name;
		if (this.score2Text) this.score2Text.text = String(this.player2Score);
	}

	/** Set player names and update display */
	public setPlayerNames(p1: string, p2: string): void {
		this.player1Name = p1;
		this.player2Name = p2;
		this.updatePlayerInfoDisplay();
	}

	/** Set player 3 and 4 names (optional) */
	public setAdditionalPlayerNames(p3?: string, p4?: string): void {
		if (typeof p3 === 'string') this.player3Name = p3;
		if (typeof p4 === 'string') this.player4Name = p4;
		this.updatePlayerInfoDisplay();
	}

	/** Set player scores and update display */
	public setPlayerScores(s1: number, s2: number): void {
		this.player1Score = s1;
		this.player2Score = s2;
		this.updatePlayerInfoDisplay();
	}

	/** Set player 3 and 4 scores */
	public setAdditionalPlayerScores(s3?: number, s4?: number): void {
		if (typeof s3 === 'number') this.player3Score = s3;
		if (typeof s4 === 'number') this.player4Score = s4;
		this.updatePlayerInfoDisplay();
	}

	/** Move a player's UI block to a named position: 'top'|'bottom'|'left'|'right' */
	public setPlayerUIPosition(playerIndex: number, position: 'top'|'bottom'|'left'|'right') {
		if (this.uiMovePlayerTo) this.uiMovePlayerTo(playerIndex, position);
	}

	/** Set the Player1Info text */
	public setPlayer1Info(text: string): void {
		if (this.Player1Info) this.Player1Info.text = text;
	}

	/** Position the Player1Info container by pixel coordinates from top-left */
	public setPlayer1Position(xPx: number, yPx: number): void {
		if (!this.player1Container) return;
		this.player1Container.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
		this.player1Container.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
		this.player1Container.left = xPx;
		this.player1Container.top = yPx;
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
		};

		// Update paddle1
		if (this.paddle1) {
			const dir =
				(keyState.p1Right ? 1 : 0) -
				(keyState.p1Left ? 1 : 0);
			if (dir !== 0) {
				this.gameState.paddle1_x += dir * this.PADDLE_SPEED * dt;
			}

			// Clamp to symmetric paddle range
			this.gameState.paddle1_x = Math.max(
				-this.PADDLE_RANGE,
				Math.min(this.PADDLE_RANGE, this.gameState.paddle1_x)
			);
			this.paddle1.position.x = this.gameState.paddle1_x;
		}

		// Update paddle2
		if (this.paddle2) {
			const dir =
				(keyState.p2Right ? 1 : 0) -
				(keyState.p2Left ? 1 : 0);
			if (dir !== 0) {
				this.gameState.paddle2_x += dir * this.PADDLE_SPEED * dt;
			}

			// Clamp to symmetric paddle range
			this.gameState.paddle2_x = Math.max(
				-this.PADDLE_RANGE,
				Math.min(this.PADDLE_RANGE, this.gameState.paddle2_x)
			);
			this.paddle2.position.x = this.gameState.paddle2_x;
		}
	}

	private maybeLogPaddles(): void {
		if (!this.debugPaddleLogging) return;

		const now = performance.now();
		if (now - this.lastPaddleLog < this.PADDLE_LOG_INTERVAL) return;

		this.lastPaddleLog = now;
		console.log(
			'paddle1_x=',
			this.gameState.paddle1_x,
			'paddle2_x=',
			this.gameState.paddle2_x
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

	public resetPaddles(p1x?: number, p2x?: number): void {
		if (typeof p1x === 'number') this.gameState.paddle1_x = p1x;
		if (typeof p2x === 'number') this.gameState.paddle2_x = p2x;

		if (this.paddle1 && typeof this.gameState.paddle1_x === 'number') {
			this.paddle1.position.x = this.gameState.paddle1_x;
		}
		if (this.paddle2 && typeof this.gameState.paddle2_x === 'number') {
			this.paddle2.position.x = this.gameState.paddle2_x;
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
	public getPaddle1(): BABYLON.Mesh | null {
		return this.paddle1;
	}

	public getPaddle2(): BABYLON.Mesh | null {
		return this.paddle2;
	}

	public getGameState(): GameState {
		return { ...this.gameState };
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
