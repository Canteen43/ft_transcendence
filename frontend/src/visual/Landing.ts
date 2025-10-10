import * as BABYLON from '@babylonjs/core';

export interface LandingCallbacks {
	onLocalGameClick?: () => void;
	onRemoteGameClick?: () => void;
	onStatsClick?: () => void;
}

export class Landing {
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;
	private highlightLayer?: BABYLON.HighlightLayer;
	private resizeHandler?: () => void;
	private shadowGenerator?: BABYLON.ShadowGenerator;
	private envTexture?: BABYLON.HDRCubeTexture;
	private renderLoopCallback?: () => void;

	// Clickable mesh references (groups of meshes)
	private localGameMeshes: BABYLON.AbstractMesh[] = [];
	private remoteGameMeshes: BABYLON.AbstractMesh[] = [];
	private statsMeshes: BABYLON.AbstractMesh[] = [];

	// Animation tracking
	private hoveredMeshGroup: BABYLON.AbstractMesh[] | null = null;
	private animationTargets = new Map<
		BABYLON.AbstractMesh,
		{ originalY: number; animation?: BABYLON.Animation }
	>();

	// Callbacks
	private callbacks: LandingCallbacks;

	constructor(
		container: HTMLElement,
		modelPath: string,
		callbacks: LandingCallbacks = {}
	) {
		this.callbacks = callbacks;
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'w-full h-full absolute top-0 left-0 z-0 block';
		container.appendChild(this.canvas);
		this.init(modelPath);
	}

	private async init(modelPath: string): Promise<void> {
		try {
			this.engine = new BABYLON.Engine(this.canvas, true, {
				preserveDrawingBuffer: true,
				stencil: true,
				antialias: true, // Better quality
			});

			this.scene = new BABYLON.Scene(this.engine);
			this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

			this.setupCamera();
			this.setupLighting();
			this.setupHDR();
			this.highlightLayer = new BABYLON.HighlightLayer(
				'highlight',
				this.scene
			);
			this.setupControls();
			await this.loadModel(modelPath);

			// Store render loop callback reference
			this.renderLoopCallback = () => {
				if (this.scene && !this.scene.isDisposed) {
					this.scene.render();
				}
			};

			// Start render loop
			this.engine.runRenderLoop(this.renderLoopCallback);

			// Setup resize handler
			this.resizeHandler = () => {
				if (this.engine && !this.engine.isDisposed) {
					this.engine.resize();
				}
			};
			window.addEventListener('resize', this.resizeHandler);
		} catch (err) {
			console.error('Error initializing scene:', err);
		}
	}

	private setupCamera(): void {
		this.camera = new BABYLON.ArcRotateCamera(
			'camera',
			-Math.PI / 1.2,
			Math.PI / 2.8,
			1,
			BABYLON.Vector3.Zero(),
			this.scene
		);

		this.camera.attachControl(this.canvas, true);

		this.camera.lowerRadiusLimit = 5;
		this.camera.upperRadiusLimit = 50;
		this.camera.lowerBetaLimit = -1;
		this.camera.upperBetaLimit = Math.PI / 2 - 0.1;
		this.camera.minZ = 0.1;
		this.camera.maxZ = 100;
		this.camera.wheelPrecision = 50;

		console.debug('Camera setup complete');
	}

	private setupLighting(): void {
		const ambientLight = new BABYLON.HemisphericLight(
			'ambientLight',
			new BABYLON.Vector3(0, 1, 0),
			this.scene
		);
		ambientLight.intensity = 0.5;

		const directionalLight = new BABYLON.DirectionalLight(
			'directionalLight',
			new BABYLON.Vector3(0, -2, 1),
			this.scene
		);
		directionalLight.intensity = 3;
		directionalLight.position = new BABYLON.Vector3(0, 20, -20);

		console.debug('Lighting setup complete');
	}

	private setupHDR(): void {
		this.envTexture = new BABYLON.HDRCubeTexture(
			'/psychedelic.hdr',
			this.scene,
			128,
			false,
			true,
			false,
			true
		);
		this.scene.environmentTexture = this.envTexture;
		// this.scene.createDefaultSkybox(this.envTexture, true);
	}

	private setupControls(): void {
		this.scene.onPointerObservable.add(info => {
			if (
				info.type === BABYLON.PointerEventTypes.POINTERDOWN &&
				info.pickInfo?.hit &&
				info.pickInfo.pickedMesh
			) {
				this.handleMeshClick(info.pickInfo.pickedMesh);
			}
		});

		this.canvas.addEventListener('contextmenu', e => e.preventDefault());
	}

	// private async loadModel(modelPath: string): Promise<void> {
	// 	return new Promise((resolve, reject) => {
	// 		BABYLON.SceneLoader.ImportMesh(
	// 			'',
	// 			'',
	// 			modelPath,
	// 			this.scene,
	// 			meshes => {
	// 				this.onModelLoaded(meshes);
	// 				resolve();
	// 			},
	// 			null,
	// 			(_, message) => reject(new Error(message))
	// 		);
	// 	});
	// }

	// In Landing.ts, add loading progress
	private async loadModel(modelPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			BABYLON.SceneLoader.ImportMesh(
				'',
				'',
				modelPath,
				this.scene,
				meshes => {
					this.onModelLoaded(meshes);
					resolve();
				},
				// Progress callback
				event => {
					if (event.lengthComputable) {
						const progress = (event.loaded / event.total) * 100;
						console.log(`Loading: ${progress.toFixed(0)}%`);
					}
				},
				(_, message) => reject(new Error(message))
			);
		});
	}

	private onModelLoaded(meshes: BABYLON.AbstractMesh[]): void {
		const findMeshes = (keyword: string) =>
			meshes.filter(m => m.name.toLowerCase().includes(keyword));

		this.localGameMeshes = findMeshes('local');
		this.remoteGameMeshes = findMeshes('remote');
		this.statsMeshes = findMeshes('stats');
		const titleMeshes = findMeshes('title');

		[
			...this.localGameMeshes,
			...this.remoteGameMeshes,
			...this.statsMeshes,
		].forEach(mesh => {
			mesh.isPickable = true;
			this.animationTargets.set(mesh, { originalY: mesh.position.y });
		});

		const planeMesh = meshes.find(m => m.name.toLowerCase() === 'plane');
		if (planeMesh) {
			const directionalLight = this.scene.lights.find(
				l => l instanceof BABYLON.DirectionalLight
			) as BABYLON.DirectionalLight;

			if (directionalLight) {
				// Store shadow generator for proper disposal
				this.shadowGenerator = new BABYLON.ShadowGenerator(
					1024,
					directionalLight
				);
				this.shadowGenerator.useBlurExponentialShadowMap = true;
				this.shadowGenerator.blurScale = 2;

				[
					...this.localGameMeshes,
					...this.remoteGameMeshes,
					...this.statsMeshes,
					...titleMeshes,
				].forEach(mesh => {
					if (mesh instanceof BABYLON.Mesh) {
						this.shadowGenerator!.addShadowCaster(mesh);
					}
				});

				planeMesh.receiveShadows = true;
			}
		}

		console.group('🔍 Meshes loaded');
		for (const m of meshes) {
			console.log(m.name, '-> parent:', m.parent?.name || 'none');
		}
		console.groupEnd();

		this.fitCameraToScene(meshes);
	}

	private fitCameraToScene(meshes: BABYLON.AbstractMesh[]): void {
		if (meshes.length === 0) return;

		const rootNode = meshes[0].parent || meshes[0];
		const { min, max } = rootNode.getHierarchyBoundingVectors();

		const center = min.add(max).scale(0.5);
		const maxSize = max.subtract(min).length();

		this.camera.setTarget(center);
		this.camera.radius = maxSize * 0.2;

		console.debug(
			'📹 Camera fitted to scene at',
			center.toString(),
			'radius',
			this.camera.radius
		);
	}

	private handleMeshClick(mesh: BABYLON.AbstractMesh): void {
		console.debug(`🖱️ Clicked mesh: ${mesh.name}`);

		const name = mesh.name.toLowerCase();

		if (name.includes('local')) {
			console.debug('Local Game selected');
			this.callbacks.onLocalGameClick?.();
		} else if (name.includes('remote')) {
			console.debug('Remote Game selected');
			this.callbacks.onRemoteGameClick?.();
		} else if (name.includes('stats')) {
			console.debug('Stats selected');
			this.callbacks.onStatsClick?.();
		} else {
			console.debug('Unknown mesh clicked');
		}
	}

	public dispose(): void {
		console.log('🧹 Disposing Landing scene');

		try {
			// Stop render loop FIRST
			if (this.engine && !this.engine.isDisposed) {
				this.engine.stopRenderLoop();
			}

			// Stop all animations
			if (this.scene && !this.scene.isDisposed) {
				this.scene.stopAllAnimations();
			}

			// Clear animation targets map
			this.animationTargets.clear();
			this.hoveredMeshGroup = null;

			// Clear mesh arrays
			this.localGameMeshes = [];
			this.remoteGameMeshes = [];
			this.statsMeshes = [];

			// Dispose shadow generator
			if (this.shadowGenerator) {
				this.shadowGenerator.dispose();
				this.shadowGenerator = undefined;
			}

			// Dispose highlight layer
			if (this.highlightLayer) {
				this.highlightLayer.dispose();
				this.highlightLayer = undefined;
			}

			// Dispose HDR texture explicitly
			if (this.envTexture) {
				this.envTexture.dispose();
				this.envTexture = undefined;
			}

			// Remove event listener
			if (this.resizeHandler) {
				window.removeEventListener('resize', this.resizeHandler);
				this.resizeHandler = undefined;
			}

			// Detach camera controls
			if (this.camera) {
				this.camera.detachControl();
			}

			// Dispose scene (this disposes all scene objects)
			if (this.scene && !this.scene.isDisposed) {
				this.scene.dispose();
			}

			// Dispose engine
			if (this.engine && !this.engine.isDisposed) {
				this.engine.dispose();
			}

			// Remove canvas from DOM
			if (this.canvas && this.canvas.parentNode) {
				this.canvas.parentNode.removeChild(this.canvas);
			}

			// Clear callback reference
			this.renderLoopCallback = undefined;

			console.log('✅ Landing scene fully disposed');
		} catch (err) {
			console.error('Error during disposal:', err);
		}
	}
}
