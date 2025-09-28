import { isLoggedIn } from '../buttons/AuthButton';
import { LocalGameModal } from '../modals/LocalGameModal';
import { LoginModal } from '../modals/LoginModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { createOnlinePlayersBanner, loadOnlinePlayers } from '../utils/banner';
import { router } from '../utils/Router';
import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	constructor() {
		super();

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		const threeDContainer = document.createElement('div');
		threeDContainer.className = 'w-full h-full'; // h-64?
		this.element.appendChild(threeDContainer);

		new Landing(threeDContainer, '/landingpage.glb', {
			onLocalGameClick: () => this.localLogic(),
			onRemoteGameClick: () => this.remoteLogic(),
		});

		// BANNER online players
		createOnlinePlayersBanner();
		loadOnlinePlayers();
		setInterval(() => {
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
}
