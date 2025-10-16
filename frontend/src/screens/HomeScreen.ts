import { isLoggedIn, isConnected } from '../buttons/AuthButton';
import { LocalGameModal } from '../modals/LocalGameModal';
import { LoginModal } from '../modals/LoginModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { StatModal } from '../modals/StatModal';
import { TextModal } from '../modals/TextModal';
import { router } from '../utils/Router';
import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	private landing: Landing | null = null;

	constructor() {
		super(false);
		this.element.className = 'flex flex-row min-h-screen bg-transparent';
		try {
			this.initThreeD();
		} catch (err) {
			console.error('Error initializing HomeScreen:', err);
		}
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
		if (this.landing) {
			this.landing.dispose();
			this.landing = null;
		}

		super.destroy();
	}
}
