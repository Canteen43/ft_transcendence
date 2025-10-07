import * as BABYLON from '@babylonjs/core';

export interface LandingCallbacks {
	onLocalGameClick?: () => void;
	onRemoteGameClick?: () => void;
}

//////////////////////
// 3D landing page
//
export class Landing {
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;
	private highlightLayer?: BABYLON.HighlightLayer;

	// Clickable mesh references
	private localGameMesh: BABYLON.AbstractMesh | null = null;
	private remoteGameMesh: BABYLON.AbstractMesh | null = null;

	// Callbacks
	private callbacks: LandingCallbacks;

	constructor(
		container: HTMLElement,
		modelPath: string,
		callbacks: LandingCallbacks = {}
	) {
		this.callbacks = callbacks;
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'w-full h-full absolute top-0 left-0 z-0';
		container.appendChild(this.canvas);
		this.init(modelPath);
	}

	async init(modelPath: string) {
		try {
			this.engine = new BABYLON.Engine(this.canvas, true, {
				preserveDrawingBuffer: true,
				stencil: true,
				alpha: true,
			});

			this.scene = new BABYLON.Scene(this.engine);
			this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

			this.setupCamera();
			this.setupLighting();
			this.setupControls();
			await this.loadModel(modelPath);

			this.engine.runRenderLoop(() => this.scene.render());
			window.addEventListener('resize', () => this.engine.resize());
		} catch (err) {
			console.error('Error initializing scene:', err);
		}
	}

	private setupCamera(): void {
		this.camera = new BABYLON.ArcRotateCamera(
			'camera',
			-Math.PI / 2.5, //looking from the left
			Math.PI / 2.1, // you’re looking down at an angle 60
			3, // distance between the camera and the target
			BABYLON.Vector3.Zero(), // pointed at the origin
			this.scene
		);

		// Enable mouse controls
		// hook the camera to the HTML canvas so the user can control it with mouse/touch
		this.camera.attachControl(this.canvas, true);

		// Set limits
		this.camera.lowerRadiusLimit = 1; //smallest allowed radius (closest to target)
		this.camera.upperRadiusLimit = 150; //largest allowed radius
		this.camera.lowerBetaLimit = -5;
		this.camera.upperBetaLimit = 5;
		this.camera.minZ = 0.1;
		this.camera.maxZ = 100000;
		console.debug('Camera setup complete');
	}

	private setupLighting(): void {
		// Bright ambient light
		const ambientLight = new BABYLON.HemisphericLight(
			'ambientLight',
			new BABYLON.Vector3(0, 1, 0),
			this.scene
		);
		ambientLight.intensity = 0.5;

		// Directional light
		const directionalLight = new BABYLON.DirectionalLight(
			'directionalLight',
			new BABYLON.Vector3(1, 1, 1),
			this.scene
		);
		directionalLight.intensity = 3;

		// Create skybox with your background image
		const skybox = BABYLON.MeshBuilder.CreateSphere(
			'skybox',
			{ diameter: 1000 },
			this.scene
		);
		skybox.isPickable = false;
		const skyboxMaterial = new BABYLON.StandardMaterial(
			'skybox',
			this.scene
		);
		skyboxMaterial.backFaceCulling = false;
		skyboxMaterial.diffuseTexture = new BABYLON.Texture(
			'/nebulae.hdr',
			this.scene
		);
		skybox.material = skyboxMaterial;
		skybox.infiniteDistance = true;

		console.debug('Lighting and skybox setup complete');
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
					resolve();
				},
				null,
				(_, message) => reject(new Error(message))
			);
		});
	}

	private onModelLoaded(meshes: BABYLON.AbstractMesh[]): void {
		const findMesh = (keyword: string) =>
			meshes.find(m => m.name.toLowerCase().includes(keyword)) || null;

		this.localGameMesh = findMesh('local');
		this.remoteGameMesh = findMesh('remote');

		[this.localGameMesh, this.remoteGameMesh].forEach(mesh => {
			if (mesh) mesh.isPickable = true;
		});

		console.group('🔍 Meshes loaded');
		for (const m of meshes) {
			console.log(m.name, '-> parent:', m.parent?.name || 'none');
		}
		console.groupEnd();

		this.fitCameraToScene(meshes);
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
		} else {
			console.debug('Unknown mesh clicked');
		}
	}

	private fitCameraToScene(meshes: BABYLON.AbstractMesh[]): void {
		if (meshes.length === 0) return;

		// if meshes share a parent, use its bounding vectors
		const rootNode = meshes[0].parent || meshes[0];
		const { min, max } = rootNode.getHierarchyBoundingVectors();

		const center = min.add(max).scale(0.5);
		const maxSize = max.subtract(min).length();

		this.camera.alpha = -Math.PI / 3;
		this.camera.beta = Math.PI / 2;
		this.camera.setTarget(center);
		this.camera.radius = maxSize * 1;
		this.camera.minZ = 0.1;
		this.camera.maxZ = 100000;

		console.debug(
			'📹 Camera fitted to scene at',
			center.toString(),
			'radius',
			this.camera.radius
		);
		this.scene.render();

		console.debug('📹 Camera fitted, radius', this.camera.radius);
	}

	public dispose(): void {
		if (this.engine) this.engine.stopRenderLoop();
		if (this.scene) this.scene.dispose();
		if (this.engine) this.engine.dispose();
		if (this.canvas && this.canvas.parentNode)
			this.canvas.parentNode.removeChild(this.canvas);
	}
}
