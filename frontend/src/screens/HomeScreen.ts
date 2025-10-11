// import { isLoggedIn } from '../buttons/AuthButton';
// import { LocalGameModal } from '../modals/LocalGameModal';
// import { LoginModal } from '../modals/LoginModal';
// import { RemoteGameModal } from '../modals/RemoteGameModal';
// import { StatModal } from '../modals/StatModal';
// import { router } from '../utils/Router';
// import { Landing } from '../visual/Landing';
// import { Screen } from './Screen';

// export class HomeScreen extends Screen {
// 	private landing: Landing | null = null;

// 	constructor() {
// 		super();
// 		this.element.className = 'flex flex-row min-h-screen bg-transparent';
// 		try {
// 			this.initThreeD();
// 		} catch (err) {
// 			console.error('Error initializing HomeScreen:', err);
// 		}
// 	}

// 	private initThreeD() {
// 		const threeDContainer = document.createElement('div');
// 		threeDContainer.className = 'w-full h-full';
// 		this.element.appendChild(threeDContainer);

// 		this.landing = new Landing(threeDContainer, '/landingpageTEST.glb', {
// 			onLocalGameClick: () => this.localLogic(),
// 			onRemoteGameClick: () => this.remoteLogic(),
// 			onStatsClick: () => this.statLogic(),
// 		});
// 	}

// 	private remoteLogic() {
// 		if (!isLoggedIn()) {
// 			new LoginModal(router.currentScreen!.element);
// 			return;
// 		}
// 		new RemoteGameModal(this.element);
// 	}

// 	private localLogic() {
// 		new LocalGameModal(this.element);
// 	}

// 	private statLogic() {
// 		if (!isLoggedIn()) {
// 			new LoginModal(router.currentScreen!.element);
// 			return;
// 		}
// 		new StatModal(this.element);
// 	}

// 	public destroy(): void {
// 		if (this.landing) {
// 			this.landing.dispose();
// 			this.landing = null;
// 		}

// 		super.destroy();
// 	}
// }
import { isLoggedIn } from '../buttons/AuthButton';
import { LocalGameModal } from '../modals/LocalGameModal';
import { LoginModal } from '../modals/LoginModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { StatModal } from '../modals/StatModal';
import { router } from '../utils/Router';
import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	private landing: Landing | null = null;
	private loadingOverlay: HTMLDivElement | null = null;

	constructor() {
		super(false);
		this.element.className = 'flex flex-row min-h-screen bg-transparent';
		
		// Show immediate content first
		this.showLoadingState();
		
		// Initialize 3D immediately (not deferred!)
		// Use setTimeout 0 just to let the loading UI render first
		setTimeout(() => {
			this.initThreeD();
		}, 0);
	}

	private showLoadingState() {
		// Create a loading overlay with your hero content
		this.loadingOverlay = document.createElement('div');
		this.loadingOverlay.className = 'w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800';
		
		// Add hero content that loads instantly
		this.loadingOverlay.innerHTML = `
			<div class="text-center space-y-8 px-4">
				<h1 class="text-6xl md:text-8xl font-bold text-white">
					Game Title
				</h1>
				<p class="text-xl md:text-2xl text-gray-300 max-w-2xl">
					Loading your immersive 3D experience...
				</p>
				<div class="flex gap-4 justify-center mt-8">
					<button id="quick-local" class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
						Quick Play (Local)
					</button>
					<button id="quick-remote" class="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors">
						Online Game
					</button>
					<button id="quick-stats" class="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors">
						Stats
					</button>
				</div>
				<div class="mt-8">
					<div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-600 border-t-white"></div>
					<p class="mt-4 text-sm text-gray-400" id="progress-text">Initializing...</p>
				</div>
			</div>
		`;
		
		this.element.appendChild(this.loadingOverlay);
		
		// Add event listeners for quick actions
		this.loadingOverlay.querySelector('#quick-local')?.addEventListener('click', () => this.localLogic());
		this.loadingOverlay.querySelector('#quick-remote')?.addEventListener('click', () => this.remoteLogic());
		this.loadingOverlay.querySelector('#quick-stats')?.addEventListener('click', () => this.statLogic());
	}

	private async initThreeD() {
		try {
			const threeDContainer = document.createElement('div');
			threeDContainer.className = 'w-full h-full absolute inset-0 opacity-0 transition-opacity duration-1000';
			this.element.appendChild(threeDContainer);

			// Create Landing instance with progress tracking
			this.landing = new Landing(threeDContainer, '/landingpageTEST.glb', {
				onLocalGameClick: () => this.localLogic(),
				onRemoteGameClick: () => this.remoteLogic(),
				onStatsClick: () => this.statLogic(),
				onLoadProgress: (progress) => {
					// Update loading indicator
					const progressText = this.loadingOverlay?.querySelector('#progress-text');
					if (progressText) {
						progressText.textContent = `Loading: ${Math.round(progress)}%`;
					}
				},
				onLoadComplete: () => {
					console.log('✅ 3D scene fully loaded, fading in');
					// Scene is fully loaded, fade in
					threeDContainer.style.opacity = '1';
					
					// Fade out and remove loading overlay
					if (this.loadingOverlay) {
						this.loadingOverlay.style.transition = 'opacity 1s';
						this.loadingOverlay.style.opacity = '0';
						
						setTimeout(() => {
							if (this.loadingOverlay) {
								this.loadingOverlay.remove();
								this.loadingOverlay = null;
							}
						}, 1000);
					}
				}
			});
		} catch (err) {
			console.error('Error initializing HomeScreen:', err);
			
			// Show error state
			if (this.loadingOverlay) {
				this.loadingOverlay.innerHTML = `
					<div class="text-center space-y-4 px-4">
						<h2 class="text-3xl font-bold text-red-400">Failed to load 3D scene</h2>
						<p class="text-gray-300">But you can still play!</p>
						<div class="flex gap-4 justify-center mt-8">
							<button id="error-local" class="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors">
								Play Local
							</button>
							<button id="error-remote" class="px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors">
								Play Online
							</button>
						</div>
					</div>
				`;
				
				this.loadingOverlay.querySelector('#error-local')?.addEventListener('click', () => this.localLogic());
				this.loadingOverlay.querySelector('#error-remote')?.addEventListener('click', () => this.remoteLogic());
			}
		}
	}

	private remoteLogic() {
		if (!isLoggedIn()) {
			new LoginModal(router.currentScreen!.element);
			return;
		}
		new RemoteGameModal(this.element);
	}

	private localLogic() {
		new LocalGameModal(this.element);
	}

	private statLogic() {
		if (!isLoggedIn()) {
			new LoginModal(router.currentScreen!.element);
			return;
		}
		new StatModal(this.element);
	}

	public destroy(): void {
		// Clean up loading overlay if still present
		if (this.loadingOverlay) {
			this.loadingOverlay.remove();
			this.loadingOverlay = null;
		}

		if (this.landing) {
			this.landing.dispose();
			this.landing = null;
		}

		super.destroy();
	}
}