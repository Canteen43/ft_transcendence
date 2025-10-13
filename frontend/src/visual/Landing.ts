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
	private mouseMoveHandler?: (event: MouseEvent) => void;

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

			// added by rufus for background game animation
			await this.loadModel(modelPath);
			await this.loadBackgroundAnimation();

			// Store render loop callback reference
			this.renderLoopCallback = () => {
				if (!this.scene || this.scene.isDisposed) return;
				this.scene.render();
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

			console.log('✅ Scene fully initialized!');
		} catch (err) {
			console.error('Error initializing scene:', err);
			this.callbacks.onLoadComplete?.();
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
		// Listen for modal open/close events to manage camera controls
		this.setupModalListeners();
	}

	private setupModalListeners(): void {
		// Listen for modals opening (when any modal gets created)
		const observer = new MutationObserver(mutations => {
			mutations.forEach(mutation => {
				mutation.addedNodes.forEach(node => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node as HTMLElement;
						// Check if a modal was added (common modal classes/attributes)
						if (
							element.classList.contains('modal') ||
							element.classList.contains('fixed') ||
							element.querySelector('.modal')
						) {
							this.onModalOpen();
						}
					}
				});

				mutation.removedNodes.forEach(node => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						const element = node as HTMLElement;
						// Check if a modal was removed
						if (
							element.classList.contains('modal') ||
							element.classList.contains('fixed') ||
							element.querySelector('.modal')
						) {
							this.onModalClose();
						}
					}
				});
			});
		});

		// Observe changes to document body
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	private onModalOpen(): void {
		if (this.camera) {
			this.camera.detachControl();
		}
	}

	private onModalClose(): void {
		// Small delay to ensure modal cleanup is complete
		setTimeout(() => {
			if (this.camera && this.canvas) {
				this.camera.attachControl(this.canvas, true);
			}
		}, 100);
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
					console.log('Model loaded and ready');
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
					const glbRoot = new BABYLON.TransformNode(
						'background_glb_root',
						this.scene
					);

					// Parent the root mesh to our transform node (preserves hierarchy)
					const rootMesh = meshes[0];
					if (rootMesh) {
						rootMesh.parent = glbRoot;

						// Position and rotate the entire GLB as one unit through the parent
						glbRoot.position.z = 2; // Push behind the main scene
						glbRoot.position.y = 1.6; // Center vertically
						glbRoot.position.x = 1; // Center horizontally
						glbRoot.rotation.y = (145 * Math.PI) / 180; //

						// Optional: Scale if needed
						glbRoot.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);

						// Start animations if they exist
						animationGroups.forEach(animGroup => {
							animGroup.start(true); // Loop animations
						});
					}

					console.log('Background animation loaded');
					resolve();
				},
				undefined, // onProgress
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
		this.camera.beta = Math.PI / 2.2; // Higher angle (more upwards)

		// Attach camera controls after everything is set up
		setTimeout(() => {
			if (this.camera && this.canvas) {
				this.camera.attachControl(this.canvas, true);
				console.log('✅ Camera controls attached after model load');
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
		this.camera.radius = maxSize * 0.2;

		console.debug(
			'Camera fitted:',
			target.toString(),
			'radius:',
			this.camera.radius
		);
	}

	private handleMeshClick(mesh: BABYLON.AbstractMesh): void {
		console.debug(`Clicked mesh: ${mesh.name}`);

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

	public dispose(): void {
		try {
			// Stop render loop
			if (this.engine && !this.engine.isDisposed) {
				this.engine.stopRenderLoop();
			}

			// Stop animations
			if (this.scene && !this.scene.isDisposed) {
				this.scene.stopAllAnimations();
			}

			// Clean up hover glow
			if (this.hoveredMesh) {
				this.stopHoverGlow(this.hoveredMesh);
				this.hoveredMesh = null;
			}
			this.originalMaterials.clear();

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

			if (this.mouseMoveHandler) {
				this.canvas.removeEventListener(
					'mousemove',
					this.mouseMoveHandler
				);
				this.mouseMoveHandler = undefined;
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
				console.log('Engine disposed');
			}

			// Force WebGL context loss if available
			const gl =
				this.canvas.getContext('webgl2') ||
				this.canvas.getContext('webgl');
			if (gl) {
				const loseContext = gl.getExtension('WEBGL_lose_context');
				if (loseContext) {
					loseContext.loseContext();
					console.log('Forced WebGL context loss');
				}
			}

			// Remove canvas
			if (this.canvas && this.canvas.parentNode) {
				this.canvas.parentNode.removeChild(this.canvas);
			}
			if (document.pointerLockElement) {
				document.exitPointerLock();
			}
			this.scene.onPointerObservable.clear();

			this.renderLoopCallback = undefined;

			console.log('✅ Landing scene disposed');
		} catch (err) {
			console.error('Error during disposal:', err);
		}
	}
}
