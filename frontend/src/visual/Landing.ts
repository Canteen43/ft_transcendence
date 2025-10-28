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

	private shadowGenerator?: BABYLON.ShadowGenerator;
	private envTexture?: BABYLON.HDRCubeTexture;
	private backgroundRoot?: BABYLON.TransformNode;

	private resizeHandler?: () => void;
	private renderLoopCallback?: () => void;
	private contextMenuHandler = (e: MouseEvent) => e.preventDefault();
	private mouseMoveHandler?: (e: MouseEvent) => void;

	// Clickable mesh references
	private localGameMeshes: BABYLON.AbstractMesh[] = [];
	private remoteGameMeshes: BABYLON.AbstractMesh[] = [];
	private statsMeshes: BABYLON.AbstractMesh[] = [];

	// Hover properties
	private hoveredMesh: BABYLON.AbstractMesh | null = null;
	private originalMaterials: Map<
		BABYLON.AbstractMesh,
		BABYLON.Material | null
	> = new Map();

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
			console.log('Starting scene initialization...');

			this.engine = new BABYLON.Engine(this.canvas, true, {
				preserveDrawingBuffer: true,
				stencil: true,
				antialias: true,
				failIfMajorPerformanceCaveat: false, // Don't fail on slow GPU
			});

			this.scene = new BABYLON.Scene(this.engine);
			this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

			this.setupCamera();
			this.setupLighting();
			this.setupHDR();
			this.setupControls();

			// Start render loop early for faster visual feedback
			this.renderLoopCallback = () => {
				if (!this.scene || this.scene.isDisposed) return;
				this.scene.render();
			};
			this.engine.runRenderLoop(this.renderLoopCallback);

			// Setup resize handler early
			this.resizeHandler = () => {
				if (this.engine && !this.engine.isDisposed) {
					this.engine.resize();
				}
			};
			window.addEventListener('resize', this.resizeHandler);

			// Load assets after render loop is running
			await this.loadModel(modelPath);
			await this.loadBackgroundAnimation();

		} catch (err) {
			console.error('Error initializing scene:', err);
			this.callbacks.onLoadComplete?.();
		}
	}

	private setupCamera(): void {
		this.camera = new BABYLON.ArcRotateCamera(
			'camera',
			-Math.PI / 1.2, // Distance from camera to target - overwritten by fitcamera to scene
			Math.PI / 2.8, // Vertical rotation angle
			2, //Distance from camera to target -
			BABYLON.Vector3.Zero(),
			this.scene
		);

		this.camera.lowerRadiusLimit = 3;
		this.camera.upperRadiusLimit = 15;
		this.camera.lowerBetaLimit = -1.5;
		this.camera.upperBetaLimit = Math.PI / 2;
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
			512,
			false,
			true,
			false,
			true
		);
		this.scene.environmentTexture = this.envTexture;
		this.scene.createDefaultSkybox(this.envTexture, true);
	}

	private setupControls(): void {
		let lastHoveredMesh: string | null = null;
		let hoverCount = 0;

		// Handle clicks with pointer observable (this works)
		this.scene.onPointerObservable.add(info => {
			if (
				info.type === BABYLON.PointerEventTypes.POINTERDOWN &&
				info.pickInfo?.hit &&
				info.pickInfo.pickedMesh
			) {
				this.handleMeshClick(info.pickInfo.pickedMesh);
			}
		});

		// Handle hover detection with manual canvas events (alternative approach)
		let throttleTimer: ReturnType<typeof setTimeout> | null = null;

		this.mouseMoveHandler = (event: MouseEvent) => {
			// Throttle hover detection to avoid performance issues
			if (throttleTimer) return;

			throttleTimer = setTimeout(() => {
				throttleTimer = null;
			}, 16); // ~60fps throttling

			hoverCount++;

			// Use Babylon.js built-in picking method (same as pointer observables)
			const pickInfo = this.scene.pick(
				event.offsetX,
				event.offsetY,
				undefined, // predicate (check all meshes)
				false, // fastCheck
				this.camera
			);

			if (pickInfo?.hit && pickInfo.pickedMesh) {
				const meshName = pickInfo.pickedMesh.name;
				// Only update when hovering a different mesh (avoid spam)
				if (meshName !== lastHoveredMesh) {
					// Stop glow on previous mesh
					if (this.hoveredMesh) {
						this.stopHoverGlow(this.hoveredMesh);
					}
					// Start glow on new mesh
					if (this.isClickableMesh(pickInfo.pickedMesh)) {
						this.startHoverGlow(pickInfo.pickedMesh);
						this.hoveredMesh = pickInfo.pickedMesh;
					} else {
						this.hoveredMesh = null;
					}
					lastHoveredMesh = meshName;
				}
			} else {
				// Reset when not hovering over anything
				if (lastHoveredMesh !== null) {
					// Stop glow on current hovered mesh
					if (this.hoveredMesh) {
						this.stopHoverGlow(this.hoveredMesh);
						this.hoveredMesh = null;
					}
					lastHoveredMesh = null;
				}
			}
		};

		this.canvas.addEventListener('mousemove', this.mouseMoveHandler);
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
					console.log('Main model loaded');
					resolve();
				},
				event => {
					if (event.lengthComputable) {
						const progress = (event.loaded / event.total) * 50; // First 50% for main model
						this.callbacks.onLoadProgress?.(progress);
						console.log(`Loading model: ${progress.toFixed(0)}%`);
					}
				},
				(_, message) => reject(new Error(message))
			);
		});
	}

	//added by Rufus for background game animation

	private async loadBackgroundAnimation(): Promise<void> {
		return new Promise((resolve, reject) => {
			BABYLON.SceneLoader.ImportMesh(
				'', // meshNames: empty string = load all meshes from the file
				'', // rootUrl: empty string = use current directory (public folder)
				'background-game.glb', // sceneFilename: the GLB file to load
				this.scene, // scene: Babylon.js scene to add meshes to
				(meshes, particleSystems, skeletons, animationGroups) => {
					// Create a parent transform node for the entire GLB
					this.backgroundRoot = new BABYLON.TransformNode(
						'background_glb_root',
						this.scene
					);

					// Parent the root mesh to our transform node (preserves hierarchy)
					const rootMesh = meshes[0];
					if (rootMesh) {
						rootMesh.parent = this.backgroundRoot;

						// Position and rotate the entire GLB as one unit through the parent
						this.backgroundRoot.position.z = -2.2; // Push behind the main scene
						this.backgroundRoot.position.y = 4; // Center vertically
						this.backgroundRoot.position.x = -4; // Center horizontally
						this.backgroundRoot.rotation.x = Math.PI;
						this.backgroundRoot.rotation.y = (330 * Math.PI) / 180;

						// Optional: Scale if needed
						this.backgroundRoot.scaling = new BABYLON.Vector3(
							0.5,
							0.5,
							0.5
						);

						// Start animations if they exist
						animationGroups.forEach(animGroup => {
							animGroup.start(true); // Loop animations
						});
					}

					console.log('Background animation loaded');
					this.callbacks.onLoadProgress?.(100); // Complete loading
					this.callbacks.onLoadComplete?.(); // All assets loaded
					resolve();
				},
				event => {
					if (event && event.lengthComputable) {
						const progress = 50 + (event.loaded / event.total) * 50; // Second 50% for background
						this.callbacks.onLoadProgress?.(progress);
						console.log(
							`Loading background: ${(progress - 50).toFixed(0)}%`
						);
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
		this.fitCameraToScene(meshes);

		// Set camera angles after fitting to scene (adjust beta for vertical angle)
		this.camera.alpha = -Math.PI / 1.18;
		this.camera.beta = Math.PI / 2; // Higher angle (more upwards)

		// Attach camera controls after everything is set up
		setTimeout(() => {
			if (this.camera && this.canvas) {
				this.camera.attachControl(this.canvas, true);
			}
		}, 100);
	}

	private fitCameraToScene(meshes: BABYLON.AbstractMesh[]): void {
		if (meshes.length === 0) return;

		const rootNode = meshes[0].parent || meshes[0];
		const { min, max } = rootNode.getHierarchyBoundingVectors();

		const center = min.add(max).scale(0.5);
		const maxSize = max.subtract(min).length();

		// Offset the target slightly higher so everything appears lower in the view
		const target = center.clone();
		target.y += 0.6;

		this.camera.setTarget(target);
		this.camera.radius = maxSize * 0.25;
	}

	private handleMeshClick(mesh: BABYLON.AbstractMesh): void {
		const name = mesh.name.toLowerCase();

		if (name.includes('local')) {
			this.callbacks.onLocalGameClick?.();
		} else if (name.includes('remote')) {
			this.callbacks.onRemoteGameClick?.();
		} else if (name.includes('stats')) {
			this.callbacks.onStatsClick?.();
		}
	}

	private isClickableMesh(mesh: BABYLON.AbstractMesh): boolean {
		const name = mesh.name.toLowerCase();
		return (
			name.includes('local') ||
			name.includes('remote') ||
			name.includes('stats')
		);
	}

	// Public methods to manually control camera for modal interactions
	public disableCameraControls(): void {
		if (this.camera) {
			this.camera.detachControl();
		}
	}

	public enableCameraControls(): void {
		if (this.camera && this.canvas) {
			// Firefox-specific fix: Ensure pointer lock is properly released
			if (document.pointerLockElement) {
				document.exitPointerLock();
			}
			// Re-attach camera controls with a small delay to ensure clean state
			setTimeout(() => {
				if (this.camera && this.canvas) {
					this.camera.attachControl(this.canvas, true);
				}
			}, 10);
		}
	}

	private startHoverGlow(mesh: BABYLON.AbstractMesh): void {
		if (!this.isClickableMesh(mesh)) return;

		// Determine which group this mesh belongs to and get all related meshes
		const meshName = mesh.name.toLowerCase();
		let targetMeshes: BABYLON.AbstractMesh[] = [];
		let glowColor: { diffuse: BABYLON.Color3; emissive: BABYLON.Color3 };

		if (meshName.includes('local')) {
			targetMeshes = this.localGameMeshes;
			// Darker yellow/orange glow
			glowColor = {
				diffuse: new BABYLON.Color3(0.9, 0.8, 0.2),
				emissive: new BABYLON.Color3(0.5, 0.45, 0.1),
			};
		} else if (meshName.includes('remote')) {
			targetMeshes = this.remoteGameMeshes;
			// Darker green glow
			glowColor = {
				diffuse: new BABYLON.Color3(0.1, 0.5, 0.1),
				emissive: new BABYLON.Color3(0.05, 0.3, 0.05),
			};
		} else if (meshName.includes('stats')) {
			targetMeshes = this.statsMeshes;
			// Blue glow
			glowColor = {
				diffuse: new BABYLON.Color3(0.3, 0.3, 1.0),
				emissive: new BABYLON.Color3(0.15, 0.15, 0.6),
			};
		}

		// Apply glow to all meshes in the group
		targetMeshes.forEach(targetMesh => {
			// Store original material if not already stored
			if (!this.originalMaterials.has(targetMesh)) {
				this.originalMaterials.set(targetMesh, targetMesh.material);
			}

			// Create glow material
			const glowMaterial = new BABYLON.StandardMaterial(
				`${targetMesh.name}_glow`,
				this.scene
			);
			glowMaterial.diffuseColor = glowColor.diffuse;
			glowMaterial.emissiveColor = glowColor.emissive;
			glowMaterial.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
			glowMaterial.specularPower = 64;
			glowMaterial.backFaceCulling = false;

			// Apply glow material
			targetMesh.material = glowMaterial;
		});
	}

	private stopHoverGlow(mesh: BABYLON.AbstractMesh): void {
		// Determine which group this mesh belongs to and get all related meshes
		const meshName = mesh.name.toLowerCase();
		let targetMeshes: BABYLON.AbstractMesh[] = [];

		if (meshName.includes('local')) {
			targetMeshes = this.localGameMeshes;
		} else if (meshName.includes('remote')) {
			targetMeshes = this.remoteGameMeshes;
		} else if (meshName.includes('stats')) {
			targetMeshes = this.statsMeshes;
		}

		// Restore original materials for all meshes in the group
		targetMeshes.forEach(targetMesh => {
			const originalMaterial = this.originalMaterials.get(targetMesh);
			if (originalMaterial !== undefined) {
				targetMesh.material = originalMaterial;
			}
		});
	}

	// Improved dispose method:
	public dispose(): void {
		// Clear observables BEFORE disposing scene
		if (this.scene && !this.scene.isDisposed) {
			this.scene.onPointerObservable.clear();
		}
		if (this.engine && !this.engine.isDisposed) {
			this.engine.stopRenderLoop(this.renderLoopCallback);
		}
		// Stop all animations
		if (this.scene && !this.scene.isDisposed) {
			this.scene.stopAllAnimations();
		}
		// Clean up hover glow
		if (this.hoveredMesh) {
			this.stopHoverGlow(this.hoveredMesh);
			this.hoveredMesh = null;
		}
		this.originalMaterials.clear();

		this.localGameMeshes = [];
		this.remoteGameMeshes = [];
		this.statsMeshes = [];

		if (this.backgroundRoot) {
			this.backgroundRoot.dispose();
			this.backgroundRoot = undefined;
		}
		if (this.shadowGenerator) {
			this.shadowGenerator.dispose();
			this.shadowGenerator = undefined;
		}
		if (this.envTexture) {
			this.envTexture.dispose();
			this.envTexture = undefined;
		}
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
		if (this.mouseMoveHandler) {
			this.canvas.removeEventListener('mousemove', this.mouseMoveHandler);
			this.mouseMoveHandler = undefined;
		}
		if (this.camera) {
			this.camera.detachControl();
		}

		if (document.pointerLockElement) {
			document.exitPointerLock();
		}
		if (this.scene && !this.scene.isDisposed) {
			this.scene.dispose();
		}
		if (this.engine && !this.engine.isDisposed) {
			this.engine.dispose();		}
		if (this.canvas && this.canvas.parentNode) {
			this.canvas.parentNode.removeChild(this.canvas);
		}
		this.renderLoopCallback = undefined;
		console.log('Landing scene disposed');
	}
}
