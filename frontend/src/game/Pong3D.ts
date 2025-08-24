// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
// // Register loaders (glTF, etc.) as a side-effect import
// import '@babylonjs/loaders'; // not needed, imported in main.ts?!
// Optional GUI package (available as BABYLON GUI namespace)
import * as GUI from '@babylonjs/gui';
import { createPong3DUI } from './Pong3DUI';
import type { Pong3DUIHandles } from './Pong3DUI';

export interface Pong3DOptions {
	importedLightScale?: number; // multiply imported light intensities by this
	shadowMapSize?: number; // shadow map resolution
	shadowUseBlur?: boolean;
	shadowBlurKernel?: number;
	shadowBias?: number;
	shadowLightIntensity?: number; // when creating a directional light for shadows
}

interface GameState {
	paddle1_x: number;
	paddle2_x: number;
}

interface KeyState {
	p1Left: boolean;
	p1Right: boolean;
	p2Left: boolean;
	p2Right: boolean;
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

	// Lighting / shadow configuration (can be overridden via constructor options or setters)
	private importedLightScale = 0.001;
	private shadowMapSize = 1024;
	private shadowUseBlur = false;
	private shadowBlurKernel = 16;
	private shadowBias = 0.0005;
	private shadowLightIntensity = 0.9;

	// keep references to created shadow generators so we can add casters later
	private shadowGenerators: BABYLON.ShadowGenerator[] = [];

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

	// Player data
	private player1Name: string = 'Rufus';
	private player2Name: string = 'Karl';
	private player1Score: number = 0;
	private player2Score: number = 0;


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

	// Key state tracking
	private keyState: KeyState = {
		p1Left: false,
		p1Right: false,
		p2Left: false,
		p2Right: false,
	};

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
		window.addEventListener('keydown', e => this.handleKeyDown(e));
		window.addEventListener('keyup', e => this.handleKeyUp(e));
		window.addEventListener('resize', () => this.engine.resize());
		this.canvas.addEventListener('dblclick', () => this.toggleFullscreen());
	}

	private handleKeyDown(e: KeyboardEvent): void {
		const k = e.key;
		if (k === 'a' || k === 'A' || k === 'w' || k === 'W') this.keyState.p1Left = true;
		if (k === 'd' || k === 'D' || k === 's' || k === 'S') this.keyState.p1Right = true;

		if (k === 'ArrowLeft' || k === 'ArrowUp') this.keyState.p2Left = true;
		if (k === 'ArrowRight' || k === 'ArrowDown') this.keyState.p2Right = true;
	}

	private handleKeyUp(e: KeyboardEvent): void {
		const k = e.key;
		if (k === 'a' || k === 'A' || k === 'w' || k === 'W') this.keyState.p1Left = false;
		if (k === 'd' || k === 'D' || k === 's' || k === 'S') this.keyState.p1Right = false;

		if (k === 'ArrowLeft' || k === 'ArrowUp') this.keyState.p2Left = false;
		if (k === 'ArrowRight' || k === 'ArrowDown') this.keyState.p2Right = false;
	}

	private toggleFullscreen(): void {
		if (!document.fullscreenElement) {
			this.canvas.requestFullscreen().catch(err => console.warn('Fullscreen failed:', err));
		} else {
			document.exitFullscreen();
		}
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
			if (typeof options.shadowMapSize === 'number') this.shadowMapSize = options.shadowMapSize;
			if (typeof options.shadowUseBlur === 'boolean') this.shadowUseBlur = options.shadowUseBlur;
			if (typeof options.shadowBlurKernel === 'number') this.shadowBlurKernel = options.shadowBlurKernel;
			if (typeof options.shadowBias === 'number') this.shadowBias = options.shadowBias;
			if (typeof options.shadowLightIntensity === 'number') this.shadowLightIntensity = options.shadowLightIntensity;
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


		// --- Shadow setup: ensure objects can cast and receive shadows ---
		try {
			// Prefer to create per-spotlight shadow generators if the scene contains SpotLights
			const spotLights = scene.lights.filter(l => l instanceof BABYLON.SpotLight) as BABYLON.SpotLight[];

			// helper to detect meshes that should cast/receive shadows (include small objects)
			const shouldBeCaster = (m: BABYLON.AbstractMesh) => {
				if (!m) return false;
				if (m.name && /paddle|ball|player|cube|box|board|table|small|prop/i.test(m.name)) return true;
				if (typeof (m as any).getTotalVertices === 'function') {
					try { return (m as any).getTotalVertices() > 0; } catch (e) { return false; }
				}
				return false;
			};

			const allMeshes = scene.meshes.slice();

			if (spotLights.length > 0) {
				// For each spotlight, create a shadow generator tuned for hard shadows
				spotLights.forEach((sl, idx) => {
					try {
						const size = Math.max(this.shadowMapSize, 2048);
						const sg = new BABYLON.ShadowGenerator(size, sl);
						// Hard shadows: disable blur/poisson/VSM
						sg.usePoissonSampling = false;
						sg.useBlurExponentialShadowMap = false;
						sg.useExponentialShadowMap = false;
						// minimal kernel for sharp edges
						sg.blurKernel = 1;
						sg.bias = this.shadowBias;
						// Add casters and enable receivers on scene meshes
						allMeshes.forEach(m => {
							try {
								if (shouldBeCaster(m)) {
									sg.addShadowCaster(m as BABYLON.AbstractMesh, true);
								}
								try { (m as any).receiveShadows = true; } catch (e) {}
							} catch (e) {}
						});
						// ensure known game objects (paddles/ball) are registered as casters too
						if (this.paddle1) { try { sg.addShadowCaster(this.paddle1, true); (this.paddle1 as any).receiveShadows = true; } catch (e) {} }
						if (this.paddle2) { try { sg.addShadowCaster(this.paddle2, true); (this.paddle2 as any).receiveShadows = true; } catch (e) {} }
						const ball = scene.getMeshByName('ball') || scene.getMeshByName('Ball');
						if (ball) { try { sg.addShadowCaster(ball as BABYLON.AbstractMesh, true); (ball as any).receiveShadows = true; } catch (e) {} }
						this.shadowGenerators.push(sg);
						console.log('Created spot shadow generator', idx, 'size', size);
					} catch (e) {
						console.warn('Failed to create spot shadow generator for', sl.name, e);
					}
				});
			} else {
				// Fallback: use or create a directional light as before, but tune for harder shadows
				let shadowLight: BABYLON.DirectionalLight | null = null;
				const existingDir = scene.lights.find(l => l instanceof BABYLON.DirectionalLight) as BABYLON.DirectionalLight | undefined;
				if (existingDir) {
					shadowLight = existingDir;
					if (!shadowLight.position) shadowLight.position = new BABYLON.Vector3(0, 10, 0);
				} else {
					shadowLight = new BABYLON.DirectionalLight('shadowLight', new BABYLON.Vector3(-0.5, -1, -0.5), scene);
					shadowLight.position = new BABYLON.Vector3(0, 10, 0);
					shadowLight.intensity = this.shadowLightIntensity;
				}

				const shadowGen = new BABYLON.ShadowGenerator(this.shadowMapSize, shadowLight);
				shadowGen.usePoissonSampling = false;
				shadowGen.useBlurExponentialShadowMap = !!this.shadowUseBlur;
				if (this.shadowUseBlur) shadowGen.blurKernel = this.shadowBlurKernel;
				shadowGen.bias = this.shadowBias;
				allMeshes.forEach(m => {
					try {
						if (shouldBeCaster(m)) shadowGen.addShadowCaster(m as BABYLON.AbstractMesh, true);
						try { (m as any).receiveShadows = true; } catch (e) {}
					} catch (e) {}
				});
				// register known objects
				if (this.paddle1) { try { shadowGen.addShadowCaster(this.paddle1, true); (this.paddle1 as any).receiveShadows = true; } catch (e) {} }
				if (this.paddle2) { try { shadowGen.addShadowCaster(this.paddle2, true); (this.paddle2 as any).receiveShadows = true; } catch (e) {} }
				const ball = scene.getMeshByName('ball') || scene.getMeshByName('Ball');
				if (ball) { try { shadowGen.addShadowCaster(ball as BABYLON.AbstractMesh, true); (ball as any).receiveShadows = true; } catch (e) {} }
				this.shadowGenerators.push(shadowGen);
				console.log('Directional shadow generator created, casters registered');
			}
		} catch (e) {
			console.warn('Shadow setup failed:', e);
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
			player1Name: this.player1Name,
			player2Name: this.player2Name,
			player1Score: this.player1Score,
			player2Score: this.player2Score,
		});

		this.guiTexture = handles.guiTexture;
		this.player1Container = handles.player1Container;
		this.Player1Info = handles.Player1Info;
		this.score1Text = handles.score1Text;
		this.player2Container = handles.player2Container;
		this.Player2Info = handles.Player2Info;
		this.score2Text = handles.score2Text;

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

	/** Set player scores and update display */
	public setPlayerScores(s1: number, s2: number): void {
		this.player1Score = s1;
		this.player2Score = s2;
		this.updatePlayerInfoDisplay();
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
		// Update paddle1
		if (this.paddle1) {
			const dir =
				(this.keyState.p1Right ? 1 : 0) -
				(this.keyState.p1Left ? 1 : 0);
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
				(this.keyState.p2Right ? 1 : 0) -
				(this.keyState.p2Left ? 1 : 0);
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

	// Lighting / shadow setters

	public setImportedLightScale(factor: number): void {
		if (typeof factor === 'number' && factor >= 0) {
			this.importedLightScale = factor;
			console.log('importedLightScale ->', this.importedLightScale);
		}
	}

	public setShadowMapSize(size: number): void {
		if (typeof size === 'number' && size > 0) {
			this.shadowMapSize = Math.floor(size);
			console.log('shadowMapSize ->', this.shadowMapSize);
		}
	}

	public setShadowUseBlur(enabled: boolean): void {
		this.shadowUseBlur = !!enabled;
		console.log('shadowUseBlur ->', this.shadowUseBlur);
	}

	public setShadowBlurKernel(kernel: number): void {
		if (typeof kernel === 'number' && kernel >= 0) {
			this.shadowBlurKernel = Math.floor(kernel);
			console.log('shadowBlurKernel ->', this.shadowBlurKernel);
		}
	}

	public setShadowBias(bias: number): void {
		if (typeof bias === 'number') {
			this.shadowBias = bias;
			console.log('shadowBias ->', this.shadowBias);
		}
	}

	public setShadowLightIntensity(i: number): void {
		if (typeof i === 'number') {
			this.shadowLightIntensity = i;
			console.log('shadowLightIntensity ->', this.shadowLightIntensity);
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
		this.engine.dispose();
		if (this.canvas.parentElement) {
			this.canvas.parentElement.removeChild(this.canvas);
		}
	}
}
