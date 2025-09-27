import * as BABYLON from '@babylonjs/core';

export interface LandingCallbacks {
	onLocalGameClick?: () => void;
	onRemoteGameClick?: () => void;
}

/**
 * 3D landing page
 */
export class Landing {
	private engine!: BABYLON.Engine;
	private scene!: BABYLON.Scene;
	private camera!: BABYLON.ArcRotateCamera;
	private canvas!: HTMLCanvasElement;

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

		// Create fullscreen canvas
		this.canvas = document.createElement('canvas');
		this.canvas.style.width = '100%';
		this.canvas.style.height = '100%';
		this.canvas.style.position = 'absolute';
		this.canvas.style.top = '0';
		this.canvas.style.left = '0';
		this.canvas.style.zIndex = '1';

		container.appendChild(this.canvas);

		// Initialize Babylon
		this.engine = new BABYLON.Engine(this.canvas, true, {
			preserveDrawingBuffer: true,
			stencil: true,
			alpha: true,
		});

		this.scene = new BABYLON.Scene(this.engine);
		this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent background

		this.setupCamera();
		this.setupLighting();
		this.setupControls();
		this.loadModel(modelPath);

		// Start rendering
		this.engine.runRenderLoop(() => this.scene.render());

		// Handle resize
		window.addEventListener('resize', () => this.engine.resize());
	}

	private setupLighting(): void {
		// Bright ambient light
		const ambientLight = new BABYLON.HemisphericLight(
			'ambientLight',
			new BABYLON.Vector3(0, 1, 0),
			this.scene
		);
		ambientLight.intensity = 1.0;

		// Directional light
		const directionalLight = new BABYLON.DirectionalLight(
			'directionalLight',
			new BABYLON.Vector3(-1, -1, -1),
			this.scene
		);
		directionalLight.intensity = 1.5;

		// Create skybox with your background image
		const skybox = BABYLON.MeshBuilder.CreateSphere(
			'skybox',
			{ diameter: 100 },
			this.scene
		);
		skybox.isPickable = false;
		const skyboxMaterial = new BABYLON.StandardMaterial(
			'skybox',
			this.scene
		);
		skyboxMaterial.backFaceCulling = false;
		// skyboxMaterial.diffuseTexture = new BABYLON.Texture(
		// 	'/wasteland.hdr',
		// 	this.scene
		// );
		skyboxMaterial.diffuseTexture = new BABYLON.Texture(
			'/wasteland.hdr',
			this.scene
		);
		skybox.material = skyboxMaterial;
		skybox.infiniteDistance = true;

		console.log('✅ Lighting and skybox setup complete');
	}

	private setupCamera(): void {
		this.camera = new BABYLON.ArcRotateCamera(
			'camera',
			-Math.PI / 3, //looking from the left
			Math.PI / 2, // you’re looking down at an angle 60
			7, // distance between the camera and the target
			BABYLON.Vector3.Zero(), // pointed at the origin
			this.scene
		);

		// Enable mouse controls
		// hook the camera to the HTML canvas so the user can control it with mouse/touch
		this.camera.attachControl(this.canvas, true);

		// Set limits
		this.camera.lowerRadiusLimit = 5; //smallest allowed radius (closest to target)
		this.camera.upperRadiusLimit = 150; //largest allowed radius
		this.camera.lowerBetaLimit = -5;
		this.camera.upperBetaLimit = 5;
		this.camera.minZ = 0.1;
		this.camera.maxZ = 100000;
		console.log('✅ Camera setup complete');
	}
	private setupControls(): void {
		// Debug any pointer events
		this.scene.onPointerObservable.add(pointerInfo => {
			if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
				console.log('🖱️ CLICK DETECTED!');

				if (
					pointerInfo.pickInfo?.hit &&
					pointerInfo.pickInfo.pickedMesh
				) {
					const pickedMesh = pointerInfo.pickInfo.pickedMesh;
					console.log('🎯 Clicked mesh:', pickedMesh.name);
					this.handleMeshClick(pickedMesh);
				} else {
					console.log('❌ No mesh hit');
				}
			}
		});

		console.log('✅ Click controls setup complete');
	}

	private loadModel(modelPath: string): void {
		console.log('📦 Loading model from:', modelPath);

		BABYLON.SceneLoader.ImportMesh(
			'',
			'',
			modelPath,
			this.scene,
			meshes => {
				console.log('✅ Model loaded successfully!');
				this.onModelLoaded(meshes);
			},
			null,
			(scene, message, exception) => {
				console.error('❌ Failed to load 3D model:', message);
				console.log('🔄 Creating fallback scene...');
				this.createFallbackScene();
			}
		);
		// this.fitCameraToScene([this.localGameMesh!, this.remoteGameMesh!]);
	}

	private onModelLoaded(meshes: BABYLON.AbstractMesh[]): void {
		console.log('📋 ALL MESHES FOUND:');
		meshes.forEach((mesh, index) => {
			console.log(
				`  ${index + 1}. "${mesh.name}" (vertices: ${mesh.getTotalVertices()})`
			);
		});

		// Look for "local" mesh
		this.localGameMesh =
			meshes.find(mesh => mesh.name.toLowerCase().includes('local')) ||
			null;

		// Look for "remote" or "global" mesh
		this.remoteGameMesh =
			meshes.find(
				mesh =>
					mesh.name.toLowerCase().includes('remote') ||
					mesh.name.toLowerCase().includes('global')
			) || null;

		console.log('🎯 CLICKABLE MESHES:');
		if (this.localGameMesh) {
			console.log(`  ✅ Local: "${this.localGameMesh.name}"`);
			this.localGameMesh.isPickable = true;
		} else {
			console.log('  ❌ No "local" mesh found');
		}

		if (this.remoteGameMesh) {
			console.log(`  ✅ Remote/Global: "${this.remoteGameMesh.name}"`);
			this.remoteGameMesh.isPickable = true;
		} else {
			console.log('  ❌ No "remote" or "global" mesh found');
		}

		// If no clickable meshes found, try first two meshes
		if (!this.localGameMesh && !this.remoteGameMesh && meshes.length >= 2) {
			console.log('🔄 Using first two meshes as clickable elements');
			this.localGameMesh = meshes[0];
			this.remoteGameMesh = meshes[1];
			this.localGameMesh.isPickable = true;
			this.remoteGameMesh.isPickable = true;
			console.log(`  📍 Local (fallback): "${this.localGameMesh.name}"`);
			console.log(
				`  📍 Remote (fallback): "${this.remoteGameMesh.name}"`
			);
		}

		// Fit camera to scene
		this.fitCameraToScene(meshes);
		console.log('✅ Model setup complete');
	}

	private handleMeshClick(mesh: BABYLON.AbstractMesh): void {
		console.log('🔥 MESH CLICKED:', mesh.name);

		if (mesh === this.localGameMesh) {
			console.log('🏠 LOCAL GAME TRIGGERED!');
			this.callbacks.onLocalGameClick?.();
		} else if (mesh === this.remoteGameMesh) {
			console.log('🌐 REMOTE/GLOBAL GAME TRIGGERED!');
			this.callbacks.onRemoteGameClick?.();
		} else {
			console.log('❓ Unknown mesh clicked');
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

		console.log(
			'📹 Camera fitted to scene at',
			center.toString(),
			'radius',
			this.camera.radius
		);
		this.scene.render();

		console.log('📹 Camera fitted, radius', this.camera.radius);
	}


	private createFallbackScene(): void {
		console.log('🔧 Creating fallback cubes...');

		// Green cube for local
		this.localGameMesh = BABYLON.MeshBuilder.CreateBox(
			'LOCAL_FALLBACK',
			{ size: 2 },
			this.scene
		);
		this.localGameMesh.position.set(-3, 0, 0);
		this.localGameMesh.isPickable = true;

		const localMaterial = new BABYLON.StandardMaterial(
			'localMat',
			this.scene
		);
		localMaterial.diffuseColor = new BABYLON.Color3(0, 1, 0); // Green
		this.localGameMesh.material = localMaterial;

		// Blue cube for remote
		this.remoteGameMesh = BABYLON.MeshBuilder.CreateBox(
			'REMOTE_FALLBACK',
			{ size: 2 },
			this.scene
		);
		this.remoteGameMesh.position.set(3, 0, 0);
		this.remoteGameMesh.isPickable = true;

		const remoteMaterial = new BABYLON.StandardMaterial(
			'remoteMat',
			this.scene
		);
		remoteMaterial.diffuseColor = new BABYLON.Color3(0, 0, 1); // Blue
		this.remoteGameMesh.material = remoteMaterial;
	}

	public dispose(): void {
		if (this.engine) {
			this.engine.stopRenderLoop();
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
}
