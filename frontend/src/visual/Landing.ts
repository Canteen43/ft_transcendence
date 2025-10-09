import * as BABYLON from '@babylonjs/core';

export interface LandingCallbacks {
	onLocalGameClick?: () => void;
	onRemoteGameClick?: () => void;
	onStatsClick?: () => void;
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
		this.canvas.className = 'w-full h-full absolute top-0 left-0 z-0  block';
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
			this.setupHDR();
			this.highlightLayer = new BABYLON.HighlightLayer(
				'highlight',
				this.scene
			);
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
			-Math.PI / 1.2, //looking from the left
			Math.PI / 2.8, // you're looking down at an angle 60
			1, // Initial distance - will be adjusted by fitCameraToScene
			BABYLON.Vector3.Zero(), // pointed at the origin
			this.scene
		);

		// Enable mouse controls
		this.camera.attachControl(this.canvas, true);

		// Set limits
		this.camera.lowerRadiusLimit = 5; // Minimum zoom distance
		this.camera.upperRadiusLimit = 50; // Maximum zoom distance
		this.camera.lowerBetaLimit = -1; // Prevent going below horizon
		this.camera.upperBetaLimit = Math.PI / 2 - 0.1; // Prevent going above
		this.camera.minZ = 0.1;
		this.camera.maxZ = 100;

		// Enable zoom with mouse wheel
		this.camera.wheelPrecision = 50; // Lower = faster zoom

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

		// Directional light (adjusted direction for proper shadows)
		const directionalLight = new BABYLON.DirectionalLight(
			'directionalLight',
			new BABYLON.Vector3(0, -2, 1), // Light coming from above and slightly to the side
			this.scene
		);
		directionalLight.intensity = 3;
		directionalLight.position = new BABYLON.Vector3(0, 20, -20);

		console.debug('Lighting setup complete');
	}

	private setupHDR(): void {
		const envTexture = new BABYLON.HDRCubeTexture('/psychedelic.hdr', this.scene, 512, false, true, false, true);
		this.scene.environmentTexture = envTexture;
		this.scene.createDefaultSkybox(envTexture, true);
	}

	private setupControls(): void {
		this.scene.onPointerObservable.add(info => {
			if (info.type === BABYLON.PointerEventTypes.POINTERMOVE) {
				this.handleHover(info.pickInfo);
			} else if (
				info.type === BABYLON.PointerEventTypes.POINTERDOWN &&
				info.pickInfo?.hit &&
				info.pickInfo.pickedMesh
			) {
				this.handleMeshClick(info.pickInfo.pickedMesh);
			}
		});

		// Disable camera rotation on right click to avoid conflicts
		this.canvas.addEventListener('contextmenu', e => e.preventDefault());
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
		const findMeshes = (keyword: string) =>
			meshes.filter(m => m.name.toLowerCase().includes(keyword));

		this.localGameMeshes = findMeshes('local');
		this.remoteGameMeshes = findMeshes('remote');
		this.statsMeshes = findMeshes('stats');
		const titleMeshes = findMeshes('title');

		// Make all interactive meshes pickable and store original positions
		[
			...this.localGameMeshes,
			...this.remoteGameMeshes,
			...this.statsMeshes,
		].forEach(mesh => {
			mesh.isPickable = true;
			this.animationTargets.set(mesh, { originalY: mesh.position.y });
		});

		// Add shadows for objects on the Plane
		const planeMesh = meshes.find(m => m.name.toLowerCase() === 'plane');
		if (planeMesh) {
			const directionalLight = this.scene.lights.find(
				l => l instanceof BABYLON.DirectionalLight
			) as BABYLON.DirectionalLight;

			if (directionalLight) {
				const shadowGenerator = new BABYLON.ShadowGenerator(
					1024,
					directionalLight
				);
				shadowGenerator.useBlurExponentialShadowMap = true;
				shadowGenerator.blurScale = 2;

				// Add all interactive meshes as shadow casters (cast to Mesh type)
				[
					...this.localGameMeshes,
					...this.remoteGameMeshes,
					...this.statsMeshes,
					...titleMeshes,
				].forEach(mesh => {
					if (mesh instanceof BABYLON.Mesh) {
						shadowGenerator.addShadowCaster(mesh);
					}
				});

				planeMesh.receiveShadows = true;
			}
		}
		console.groupEnd();

		console.group('🔍 Meshes loaded');
		for (const m of meshes) {
			console.log(m.name, '-> parent:', m.parent?.name || 'none');
		}
		console.groupEnd();

		this.fitCameraToScene(meshes);
	}

	private fitCameraToScene(meshes: BABYLON.AbstractMesh[]): void {
		if (meshes.length === 0) return;

		// if meshes share a parent, use its bounding vectors
		const rootNode = meshes[0].parent || meshes[0];
		const { min, max } = rootNode.getHierarchyBoundingVectors();

		const center = min.add(max).scale(0.5);
		const maxSize = max.subtract(min).length();

		// Keep the same alpha and beta angles
		// Only adjust the target and radius
		this.camera.setTarget(center);
		this.camera.radius = maxSize * 0.2; // Closer multiplier (was 1)

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

	private handleHover(pickInfo: BABYLON.PickingInfo | null): void {
		const pickedMesh = pickInfo?.hit ? pickInfo.pickedMesh : null;

		// Determine which group the hovered mesh belongs to
		let newHoveredGroup: BABYLON.AbstractMesh[] | null = null;

		if (pickedMesh) {
			const name = pickedMesh.name.toLowerCase();
			if (name.includes('local')) {
				newHoveredGroup = this.localGameMeshes;
			} else if (name.includes('remote')) {
				newHoveredGroup = this.remoteGameMeshes;
			} else if (name.includes('stats')) {
				newHoveredGroup = this.statsMeshes;
			}
		}

		// If hovering over a different group (or none), update
		if (newHoveredGroup !== this.hoveredMeshGroup) {
			// Remove effects from previous group
			if (this.hoveredMeshGroup) {
				this.removeHoverEffect(this.hoveredMeshGroup);
			}

			// Apply effects to new group
			if (newHoveredGroup) {
				this.applyHoverEffect(newHoveredGroup);
				this.canvas.style.cursor = 'pointer';
			} else {
				this.canvas.style.cursor = 'default';
			}

			this.hoveredMeshGroup = newHoveredGroup;
		}
	}
	private applyHoverEffect(meshes: BABYLON.AbstractMesh[]): void {
		meshes.forEach(mesh => {
			console.debug(`✨ Applying hover to: ${mesh.name}`);

			// Add highlight glow
			if (this.highlightLayer && mesh instanceof BABYLON.Mesh) {
				this.highlightLayer.addMesh(
					mesh,
					BABYLON.Color3.FromHexString('#4A90E2')
				);
			}

			// Scale animation instead of position (works better with parented meshes)
			const target = this.animationTargets.get(mesh);
			if (target) {
				this.scene.stopAnimation(mesh);

				// Scale animation
				const scaleAnimation = new BABYLON.Animation(
					`hoverScale_${mesh.name}`,
					'scaling',
					30,
					BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
					BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
				);

				const originalScale = mesh.scaling.clone();
				const targetScale = originalScale.scale(1.15); // 15% larger

				scaleAnimation.setKeys([
					{ frame: 0, value: originalScale },
					{ frame: 15, value: targetScale },
				]);

				// Position animation (try both local and world space)
				const posAnimation = new BABYLON.Animation(
					`hoverPos_${mesh.name}`,
					'position.y',
					30,
					BABYLON.Animation.ANIMATIONTYPE_FLOAT,
					BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
				);

				posAnimation.setKeys([
					{ frame: 0, value: mesh.position.y },
					{ frame: 15, value: mesh.position.y + 0.3 },
				]);

				mesh.animations = [scaleAnimation, posAnimation];
				this.scene.beginAnimation(mesh, 0, 15, false);

				console.debug(`🎬 Animation started for ${mesh.name}`);
			}
		});
	}

	private removeHoverEffect(meshes: BABYLON.AbstractMesh[]): void {
		meshes.forEach(mesh => {
			console.debug(`🔻 Removing hover from: ${mesh.name}`);

			// Remove highlight glow
			if (this.highlightLayer && mesh instanceof BABYLON.Mesh) {
				this.highlightLayer.removeMesh(mesh);
			}

			const target = this.animationTargets.get(mesh);
			if (target) {
				this.scene.stopAnimation(mesh);

				// Scale back
				const scaleAnimation = new BABYLON.Animation(
					`hoverScaleReturn_${mesh.name}`,
					'scaling',
					30,
					BABYLON.Animation.ANIMATIONTYPE_VECTOR3,
					BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
				);

				const currentScale = mesh.scaling.clone();
				const originalScale = new BABYLON.Vector3(1, 1, 1);

				scaleAnimation.setKeys([
					{ frame: 0, value: currentScale },
					{ frame: 15, value: originalScale },
				]);

				// Position back
				const posAnimation = new BABYLON.Animation(
					`hoverPosReturn_${mesh.name}`,
					'position.y',
					30,
					BABYLON.Animation.ANIMATIONTYPE_FLOAT,
					BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
				);

				posAnimation.setKeys([
					{ frame: 0, value: mesh.position.y },
					{ frame: 15, value: target.originalY },
				]);

				mesh.animations = [scaleAnimation, posAnimation];
				this.scene.beginAnimation(mesh, 0, 15, false);

				console.debug(`🎬 Return animation started for ${mesh.name}`);
			}
		});
	}

	public dispose(): void {
		if (this.engine) this.engine.stopRenderLoop();
		if (this.scene) this.scene.dispose();
		if (this.engine) this.engine.dispose();
		if (this.canvas && this.canvas.parentNode)
			this.canvas.parentNode.removeChild(this.canvas);
	}
}
