import * as BABYLON from '@babylonjs/core';

class BabylonEngineManager {
	private static _instance: BabylonEngineManager;
	private engine: BABYLON.Engine | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private currentScene: BABYLON.Scene | null = null;

	private constructor() {}

	public static getInstance(): BabylonEngineManager {
		if (!this._instance) this._instance = new BabylonEngineManager();
		return this._instance;
	}

	private resizeHandler = () => this.engine?.resize();

	public getEngine(canvas: HTMLCanvasElement): BABYLON.Engine {
		// First time initialization
		if (!this.engine) {
			this.engine = new BABYLON.Engine(canvas, true, {
				preserveDrawingBuffer: true,
				stencil: true,
				alpha: true,
			});
			this.canvas = canvas;

			window.addEventListener('resize', this.resizeHandler);

			console.log('✅ Babylon Engine created');
			return this.engine;
		}

		// If same canvas, just return engine
		if (canvas === this.canvas) {
			console.log('♻️ Reusing engine with same canvas');
			return this.engine;
		}

		// Different canvas - need to recreate engine
		console.warn('⚠️ Different canvas detected - disposing old engine');
		this.dispose();
		return this.getEngine(canvas); // Recursive call to create new engine
	}

	public setActiveScene(scene: BABYLON.Scene): void {
		if (this.currentScene !== scene) {
			console.log('🔄 Switching active scene');
			this.currentScene = scene;
		}
	}

	public startRenderLoop(scene: BABYLON.Scene): void {
		if (!this.engine) return;

		// Stop any existing render loop
		this.engine.stopRenderLoop();

		// Start new render loop for this scene
		this.currentScene = scene;
		this.engine.runRenderLoop(() => {
			if (this.currentScene) {
				this.currentScene.render();
			}
		});

		console.log('▶️ Render loop started');
	}

	public stopRenderLoop(): void {
		this.engine?.stopRenderLoop();
		console.log('⏸️ Render loop stopped');
	}

	public dispose(): void {
		if (this.resizeHandler) {
			window.removeEventListener('resize', this.resizeHandler);
		}
		if (this.currentScene) {
			this.currentScene.dispose();
			this.currentScene = null;
		}
		if (this.engine) {
			this.engine.stopRenderLoop();
			this.engine.dispose();
			this.engine = null;
			this.canvas = null;
			console.log('🗑️ Babylon Engine fully disposed');
		}
	}
}

export const EngineManager = BabylonEngineManager.getInstance();
