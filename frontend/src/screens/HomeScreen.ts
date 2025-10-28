import { isConnected, isLoggedIn } from '../buttons/AuthButton';
import { Button } from '../buttons/Button';
import { LocalGameModal } from '../modals/LocalGameModal';
import { LoginModal } from '../modals/LoginModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { StatModal } from '../modals/StatModal';
import { TextModal } from '../modals/TextModal';
import { router } from '../utils/Router';
import { state } from '../utils/State';

import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	private landing: Landing | null = null;
	private fallbackHero: HTMLElement | null = null;

	constructor() {
		super(false);
		this.element.className = 'flex flex-row min-h-screen bg-transparent';
		if (state.isMobile == true) this.showFallbackHero();
		else this.initThreeD();
	}

	private showFallbackHero() {
		if (this.fallbackHero) return;

		this.fallbackHero = document.createElement('div');
		this.fallbackHero.className =
			'absolute inset-0 flex items-center justify-center z-10';

		this.element.style.backgroundImage = 'url(tournBG.png)';
		this.element.classList.add(
			'bg-cover',
			'bg-center',
			'bg-no-repeat',
			'bg-fixed',
			'relative',
			'overflow-hidden'
		);

		const overlay = document.createElement('div');
		overlay.className = 'absolute inset-0 bg-black/40';
		this.fallbackHero.appendChild(overlay);

		const content = document.createElement('div');
		content.className = 'relative z-10 text-center px-4';

		const title = document.createElement('h1');
		title.className =
			"font-outfit [font-variation-settings:'wght'_900] text-6xl mb-12 text-[var(--color1)]";
		title.textContent = 'NO PONG INTENDED';
		content.appendChild(title);

		const buttonContainer = document.createElement('div');
		buttonContainer.className =
			'flex flex-col md:flex-row gap-4 justify-center items-center mt-12';

		new Button('Local Game', () => this.localLogic(), buttonContainer);
		new Button('Remote Game', () => this.remoteLogic(), buttonContainer);
		new Button('Statistics', () => this.statLogic(), buttonContainer);

		content.appendChild(buttonContainer);
		this.fallbackHero.appendChild(content);
		this.element.appendChild(this.fallbackHero);
	}

	private initThreeD() {
		const threeDContainer = document.createElement('div');
		threeDContainer.className = 'w-full h-full';
		this.element.appendChild(threeDContainer);

		this.landing = new Landing(threeDContainer, '/landingpageTEST.glb', {
			onLocalGameClick: () => this.localLogic(),
			onRemoteGameClick: () => this.remoteLogic(),
			onStatsClick: () => this.statLogic(),
		});
	}

	private remoteLogic() {
		// Disable camera controls before opening modal
		if (this.landing) {
			this.landing.disableCameraControls();
		}

		if (!isLoggedIn()) {
			const modal = new LoginModal(router.currentScreen!.element);
			this.setupModalCloseHandler(modal);
			return;
		}
		if (!isConnected()) {
			const modal = new TextModal(
				this.element,
				'WebSocket is not connected. Please refresh the page or try again later.',
				undefined
			);
			this.setupModalCloseHandler(modal);
			return;
		}
		const modal = new RemoteGameModal(this.element);
		this.setupModalCloseHandler(modal);
	}

	private localLogic() {
		// Disable camera controls before opening modal
		if (this.landing) {
			this.landing.disableCameraControls();
		}

		const modal = new LocalGameModal(this.element);
		this.setupModalCloseHandler(modal);
	}

	private statLogic() {
		// Disable camera controls before opening modal
		if (this.landing) {
			this.landing.disableCameraControls();
		}

		if (!isLoggedIn()) {
			const modal = new LoginModal(router.currentScreen!.element);
			this.setupModalCloseHandler(modal);
			return;
		}
		if (!isConnected()) {
			const modal = new TextModal(
				this.element,
				'WebSocket is not connected. Please refresh the page or try again later.',
				undefined
			);
			this.setupModalCloseHandler(modal);
			return;
		}
		const modal = new StatModal(this.element);
		this.setupModalCloseHandler(modal);
	}

	private setupModalCloseHandler(modal: any): void {
		// Set up onClose callback to re-enable camera controls
		modal.onClose = () => {
			// Small delay to ensure modal DOM cleanup is complete
			setTimeout(() => {
				if (this.landing) {
					this.landing.enableCameraControls();
				}
			}, 50);
		};
	}

	public destroy(): void {
	if (this.fallbackHero) {
			this.fallbackHero.remove();
			this.fallbackHero = null;
		}
		if (this.landing) {
			this.landing.dispose();
			this.landing = null;
		}

		super.destroy();
	}
}
