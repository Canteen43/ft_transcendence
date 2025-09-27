// Use modular Babylon packages for better tree-shaking and smaller bundles
import * as BABYLON from '@babylonjs/core';
import earcut from 'earcut';
import { GameConfig } from '../game/GameConfig';

// Make earcut globally available for Babylon.js CreateText
(window as any).earcut = earcut;

export interface TrophyOptions {
	importedLightScale?: number; // multiply imported light intensities by this as blender lighting comes in way too strong
	modelUrlOverride?: string; // Override automatic model selection
	winner?: string; // Winner's name to display on trophy
}

// ============================================================================

/**
 * Trophy - A 3D trophy display system
 *
 * Features:
 * - Loads and displays 3D trophy models
 * - Configurable lighting and camera settings
 * - Automatic model loading with fallback
 * - Proper cleanup and disposal
 */

export class Trophy {
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

	// Lighting configuration (can be overridden via constructor options or setters)
	private importedLightScale = 0.001; //turn down blender lighting: 10 kwatts = 10 babylon units

	// Resize handler reference for cleanup
	private resizeHandler: (() => void) | null = null;

	// Winner text properties
	private winnerText: string;
	private winnerTextMesh: BABYLON.Mesh | null = null;

	// Trophy rotation root node
	private trophyRoot: BABYLON.TransformNode | null = null;

	/** Get the appropriate trophy model URL */
	private getTrophyModelUrl(): string {
		return '/trophy.glb';
	}

	/** Initialize camera for trophy display */
	private setupCamera(): void {
		this.camera = new BABYLON.ArcRotateCamera(
			'trophyCam',
			-Math.PI / 2, // alpha (horizontal rotation)
			Math.PI / 3, // beta (vertical rotation)
			5, // radius
			BABYLON.Vector3.Zero(), // target
			this.scene
		);
		this.camera.attachControl(this.canvas, true);
		this.camera.wheelPrecision = 50;

		// Disable camera keyboard controls for trophy display
		this.camera.keysUp = [];
		this.camera.keysDown = [];
		this.camera.keysLeft = [];
		this.camera.keysRight = [];

		// Set camera limits for trophy viewing
		this.camera.lowerRadiusLimit = 3;
		this.camera.upperRadiusLimit = 10;
		this.camera.lowerBetaLimit = Math.PI / 6;
		this.camera.upperBetaLimit = Math.PI / 2;

		if (GameConfig.isDebugLoggingEnabled()) {
			this.conditionalLog('Trophy camera set up for display');
		}
	}

	private setupEventListeners(): void {
		// Store resize handler reference for proper cleanup
		this.resizeHandler = () => this.engine.resize();
		window.addEventListener('resize', this.resizeHandler);
	}

	constructor(container: HTMLElement, options?: TrophyOptions) {
		this.debugLog('Initializing Trophy display...');

		// Set winner text with default value
		this.winnerText = options?.winner || 'Player1';

		// Create canvas inside container
		this.canvas = document.createElement('canvas');
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.zIndex = '9';
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

		const modelUrl = options?.modelUrlOverride || this.getTrophyModelUrl();
		this.loadModel(modelUrl);
	}

	private loadModel(modelUrl: string): void {
		BABYLON.SceneLoader.Append(
			'',
			modelUrl,
			this.scene,
			async scene => {
				await this.onModelLoaded(scene);
				this.startRenderLoop();
			},
			null,
			async () => {
				await this.createFallbackTrophy();
				this.startRenderLoop();
			}
		);
	}

	private async onModelLoaded(scene: BABYLON.Scene): Promise<void> {
		const loadedMeshes = scene.meshes.filter(
			m => m && m.getTotalVertices && m.getTotalVertices() > 0
		);
		const bounds = this.computeSceneBoundingInfo(
			loadedMeshes.length ? loadedMeshes : scene.meshes
		);

		if (bounds) {
			const size = bounds.max.subtract(bounds.min);
			const center = bounds.min.add(size.scale(0.5));

			// Set camera to orbit around point (0, 1, 0) - 1 unit above origin
			this.camera.setTarget(new BABYLON.Vector3(0, 2.5, 0));
			this.camera.radius = Math.max(size.length() * 1, 4);

			// Add slow camera rotation around origin
			this.scene.registerBeforeRender(() => {
				if (this.camera) {
					(this.camera as any).alpha += 0.01; // Slow horizontal rotation
				}
			});
		}

		// Adjust imported lights intensity
		scene.lights.forEach(light => {
			if (light && typeof (light as any).intensity === 'number') {
				(light as any).intensity *= this.importedLightScale;
			}
		});

		if (scene.lights.length === 0) {
			this.addDefaultLighting();
		}

		this.addTrophyRotation();
		await this.createWinnerText();
	}

	private async createFallbackTrophy(): Promise<void> {
		const trophyBase = BABYLON.MeshBuilder.CreateCylinder(
			'trophyBase',
			{ height: 0.5, diameterTop: 0.8, diameterBottom: 1.0 },
			this.scene
		);
		trophyBase.position.y = 0.25;

		const trophyStem = BABYLON.MeshBuilder.CreateCylinder(
			'trophyStem',
			{ height: 1.5, diameter: 0.1 },
			this.scene
		);
		trophyStem.position.y = 1.0;

		const trophyCup = BABYLON.MeshBuilder.CreateCylinder(
			'trophyCup',
			{ height: 0.8, diameterTop: 0.6, diameterBottom: 0.4 },
			this.scene
		);
		trophyCup.position.y = 1.8;

		const goldMaterial = new BABYLON.PBRMaterial(
			'goldMaterial',
			this.scene
		);
		goldMaterial.albedoColor = new BABYLON.Color3(1, 0.8, 0);
		goldMaterial.metallic = 1.0;
		goldMaterial.roughness = 0.2;

		trophyBase.material = goldMaterial;
		trophyStem.material = goldMaterial;
		trophyCup.material = goldMaterial;

		this.addDefaultLighting();
		this.addTrophyRotation();
		await this.createWinnerText();
	}

	private addDefaultLighting(): void {
		// General ambient light for the entire scene
		this.scene.ambientColor = new BABYLON.Color3(1, 1, 1);

		const ambientLight = new BABYLON.HemisphericLight(
			'ambientLight',
			new BABYLON.Vector3(0, 1, 0),
			this.scene
		);
		ambientLight.intensity = 0.3;

		const directionalLight = new BABYLON.DirectionalLight(
			'directionalLight',
			new BABYLON.Vector3(-1, -1, -1),
			this.scene
		);
		directionalLight.intensity = 0.7;
	}

	private addTrophyRotation(): void {
		this.trophyRoot = new BABYLON.TransformNode('trophyRoot', this.scene);

		this.scene.meshes.forEach(mesh => {
			if (mesh.name.includes('trophy') || mesh.name.includes('Trophy')) {
				mesh.parent = this.trophyRoot;
			}
		});

		this.scene.registerBeforeRender(() => {
			if (this.trophyRoot) {
				this.trophyRoot.rotation.y += 0.02;
			}
		});
	}

	private async createWinnerText(): Promise<void> {
		try {
			// Load font data from Babylon assets (Droid Sans)
			const response = await fetch(
				'https://assets.babylonjs.com/fonts/Droid Sans_Regular.json'
			);
			const fontData = await response.json();

			// Create 3D text mesh
			const text = this.winnerText || 'Winner';
			this.winnerTextMesh = BABYLON.MeshBuilder.CreateText(
				'winnerText',
				text,
				fontData,
				{
					size: 6,
					resolution: 64,
					depth: 2,
				},
				this.scene
			);

			if (this.winnerTextMesh) {
				// Position and style the 3D text
				this.winnerTextMesh.position.set(0, 0.56, -1.0);
				this.winnerTextMesh.scaling.scaleInPlace(0.03);

				const textMaterial = new BABYLON.StandardMaterial(
					'winnerTextMaterial',
					this.scene
				);
				textMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0); // Silver/grey text
				textMaterial.emissiveColor = new BABYLON.Color3(0.7, 0.7, 0.7); // Subtle silver glow
				this.winnerTextMesh.material = textMaterial;

				this.winnerTextMesh.rotation.set(0, 0, 0);
				this.winnerTextMesh.billboardMode =
					BABYLON.Mesh.BILLBOARDMODE_NONE;
			} else {
				this.createFallbackText();
			}
		} catch (error) {
			this.createFallbackText();
		}
	}

	private createFallbackText(): void {
		const textMaterial = new BABYLON.StandardMaterial(
			'fallbackTextMaterial',
			this.scene
		);
		textMaterial.diffuseColor = new BABYLON.Color3(1, 0, 0);
		textMaterial.emissiveColor = new BABYLON.Color3(0.5, 0, 0);

		this.winnerTextMesh = BABYLON.MeshBuilder.CreatePlane(
			'fallbackTextPlane',
			{ width: 2, height: 0.5 },
			this.scene
		);

		this.winnerTextMesh.position.set(0, 2.0, 1.0);
		this.winnerTextMesh.material = textMaterial;
		this.winnerTextMesh.rotation.set(0, 0, 0);
		this.winnerTextMesh.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;
	}
	private computeSceneBoundingInfo(
		meshes: BABYLON.AbstractMesh[]
	): { min: BABYLON.Vector3; max: BABYLON.Vector3 } | null {
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

	private startRenderLoop(): void {
		this.engine.runRenderLoop(() => {
			this.scene.render();
		});
	}

	public dispose(): void {
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
			this.resizeHandler = null;
		}

		if (this.scene) {
			this.scene.dispose();
		}

		if (this.engine) {
			this.engine.dispose();
		}

		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}
	}

	/** Set the trophy model URL and reload */
	public setModelUrl(modelUrl: string): void {
		// Stop current render loop
		this.engine.stopRenderLoop();

		// Clear current scene
		this.scene.dispose();

		// Create new scene
		this.scene = new BABYLON.Scene(this.engine);
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

		// Re-setup camera
		this.setupCamera();

		// Load new model
		this.loadModel(modelUrl);
	}
}
