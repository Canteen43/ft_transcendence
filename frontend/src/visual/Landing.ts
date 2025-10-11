import * as BABYLON from '@babylonjs/core';

export interface LandingCallbacks {
	onLocalGameClick?: () => void;
	onRemoteGameClick?: () => void;
	onStatsClick?: () => void;
	onLoadProgress?: (progress: number) => void;
	onLoadComplete?: () => void;
}

export class Landing {
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;
	private resizeHandler?: () => void;
	private shadowGenerator?: BABYLON.ShadowGenerator;
	private envTexture?: BABYLON.HDRCubeTexture;
	private renderLoopCallback?: () => void;
	private contextMenuHandler = (e: MouseEvent) => e.preventDefault();

	// Clickable mesh references
	private localGameMeshes: BABYLON.AbstractMesh[] = [];
	private remoteGameMeshes: BABYLON.AbstractMesh[] = [];
	private statsMeshes: BABYLON.AbstractMesh[] = [];

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
				antialias: true,
			});

			this.scene = new BABYLON.Scene(this.engine);
			this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

			this.setupCamera();
			this.setupLighting();
			this.setupHDR();
			this.setupControls();
			await this.loadModel(modelPath);

			// Start render loop
			this.renderLoopCallback = () => {
				if (this.scene && !this.scene.isDisposed) {
					this.scene.render();
				}
			};
			this.engine.runRenderLoop(this.renderLoopCallback);

			// Setup resize handler
			this.resizeHandler = () => {
				if (this.engine && !this.engine.isDisposed) {
					this.engine.resize();
				}
			};
			window.addEventListener('resize', this.resizeHandler);

			console.log('✅ Scene initialized');
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
		this.scene.createDefaultSkybox(this.envTexture, true);
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

		this.canvas.addEventListener('contextmenu', this.contextMenuHandler);
	}

	private async loadModel(modelPath: string): Promise<void> {
		return new Promise((resolve, reject) => {
			BABYLON.SceneLoader.ImportMesh(
				'',
				'',
				modelPath,
				this.scene,
				meshes => {
					this.onModelLoaded(meshes);
					this.callbacks.onLoadComplete?.();
					console.log('✅ Model loaded and ready');
					resolve();
				},
				event => {
					if (event.lengthComputable) {
						const progress = (event.loaded / event.total) * 100;
						this.callbacks.onLoadProgress?.(progress);
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

		// Make meshes clickable
		[
			...this.localGameMeshes,
			...this.remoteGameMeshes,
			...this.statsMeshes,
		].forEach(mesh => {
			mesh.isPickable = true;
		});

		// Setup shadows
		const planeMesh = meshes.find(m => m.name.toLowerCase() === 'plane');
		if (planeMesh) {
			const directionalLight = this.scene.lights.find(
				l => l instanceof BABYLON.DirectionalLight
			) as BABYLON.DirectionalLight;

			if (directionalLight) {
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
			'📹 Camera fitted:',
			center.toString(),
			'radius:',
			this.camera.radius
		);
	}

	private handleMeshClick(mesh: BABYLON.AbstractMesh): void {
		console.debug(`🖱️ Clicked mesh: ${mesh.name}`);

		const name = mesh.name.toLowerCase();

		if (name.includes('local')) {
			this.callbacks.onLocalGameClick?.();
		} else if (name.includes('remote')) {
			this.callbacks.onRemoteGameClick?.();
		} else if (name.includes('stats')) {
			this.callbacks.onStatsClick?.();
		}
	}

	public dispose(): void {
		console.log('🧹 Disposing Landing scene');

		try {
			// Stop render loop
			if (this.engine && !this.engine.isDisposed) {
				this.engine.stopRenderLoop();
			}

			// Stop animations
			if (this.scene && !this.scene.isDisposed) {
				this.scene.stopAllAnimations();
			}

			// Clear mesh arrays
			this.localGameMeshes = [];
			this.remoteGameMeshes = [];
			this.statsMeshes = [];

			// Dispose shadow generator
			if (this.shadowGenerator) {
				this.shadowGenerator.dispose();
				this.shadowGenerator = undefined;
			}

			// Dispose HDR texture
			if (this.envTexture) {
				this.envTexture.dispose();
				this.envTexture = undefined;
			}

			// Remove event listener
			if (this.resizeHandler) {
				window.removeEventListener('resize', this.resizeHandler);
				this.resizeHandler = undefined;
			}

			if (this.contextMenuHandler) {
				this.canvas.removeEventListener(
					'contextmenu',
					this.contextMenuHandler
				);
			}

			// Detach camera controls
			if (this.camera) {
				this.camera.detachControl();
			}

			// Dispose scene
			if (this.scene && !this.scene.isDisposed) {
				this.scene.dispose();
			}

			// Dispose engine
			if (this.engine && !this.engine.isDisposed) {
				this.engine.dispose();
			}

			// Remove canvas
			if (this.canvas && this.canvas.parentNode) {
				this.canvas.parentNode.removeChild(this.canvas);
			}
			this.scene.onPointerObservable.clear();
			
			this.renderLoopCallback = undefined;

			console.log('✅ Landing scene disposed');
		} catch (err) {
			console.error('Error during disposal:', err);
		}
	}
}
