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

	constructor() {
		super();
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
		if (this.landing) {
			this.landing.dispose();
			this.landing = null;
		}

		super.destroy();
	}
}
