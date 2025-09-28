import z from 'zod';
import { UserSchema } from '../../../shared/schemas/user';
import { isLoggedIn } from '../buttons/AuthButton';
import { AliasModal } from '../modals/AliasModal';
import { LocalGameModal } from '../modals/LocalGameModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { TextModal } from '../modals/TextModal';
import { apiCall } from '../utils/apiCall';
import { router } from '../utils/Router';
import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

import { createOnlinePlayersBanner, loadOnlinePlayers } from '../utils/banner';

export class HomeScreen extends Screen {
	private onlinePlayersContainer: HTMLElement | null = null;
	private title3D: Landing | null = null;
	private localBtn: HTMLButtonElement | null = null;
	private remoteBtn: HTMLButtonElement | null = null;

	constructor() {
		super();

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		const threeDContainer = document.createElement('div');
		threeDContainer.className = 'w-full h-64'; // 3D title area - why 64
		this.element.appendChild(threeDContainer);
		this.title3D = new Landing(threeDContainer, '/landingpage.glb', {
			onLocalGameClick: () => this.localLogic(),
			onRemoteGameClick: () => this.remoteLogic(),
		});

		// BANNER online players
		createOnlinePlayersBanner();
		// Ensure it's visible on non-game screens
		const banner = document.getElementById('online-players-banner');
		if (banner) banner.style.display = '';
		loadOnlinePlayers();
		setInterval(() => {
			loadOnlinePlayers();
		}, 30000);
	}

	private remoteLogic() {
		if (!isLoggedIn()) {
			new TextModal(
				router.currentScreen!.element,
				'You must be logged-in to access the remote game'
			);
			return;
		}
		new RemoteGameModal(this.element);
	}

	private localLogic() {
		new LocalGameModal(this.element);
	}
}
