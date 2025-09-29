import { initParticleNumericAnimationValue } from '@tsparticles/engine';
import { isLoggedIn } from '../buttons/AuthButton';
import { LocalGameModal } from '../modals/LocalGameModal';
import { LoginModal } from '../modals/LoginModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { StatModal } from '../modals/StatModal';
import { createOnlinePlayersBanner, loadOnlinePlayers } from '../utils/banner';
import { router } from '../utils/Router';
import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	private banner: HTMLElement | null = null;
	private landing: Landing | null = null;
	private onlinePlayersInterval: number | null = null;

	constructor() {
		super();
		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		try {
			this.initThreeD();
			this.initBanner();
		} catch (err) {
			console.error('Error initializing HomeScreen:', err);
		}
	}

	private initThreeD() {
		const threeDContainer = document.createElement('div');
		threeDContainer.className = 'w-full h-full';
		this.element.appendChild(threeDContainer);

		this.landing = new Landing(threeDContainer, '/landingpage.glb', {
			onLocalGameClick: () => this.localLogic(),
			onRemoteGameClick: () => this.remoteLogic(),
			onStatClick: () => this.statLogic(),
		});
	}

	private initBanner() {
		createOnlinePlayersBanner();
		this.banner = document.getElementById('online-players-banner');
		if (this.banner) this.banner.style.display = '';

		loadOnlinePlayers();
		this.onlinePlayersInterval = window.setInterval(() => {
			loadOnlinePlayers();
		}, 30000);
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
		new StatModal(this.element);
	}

	public destroy(): void {
		
		if (this.onlinePlayersInterval !== null) {
			clearInterval(this.onlinePlayersInterval);
			this.onlinePlayersInterval = null;
		}

		if (this.landing) {
			this.landing.dispose();
			this.landing = null;
		}

		if (this.banner) {
			this.banner.style.display = 'none';
			this.banner = null;
		}

		// Call parent destroy
		super.destroy();
	}
}