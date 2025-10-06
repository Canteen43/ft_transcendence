import { isLoggedIn } from '../buttons/AuthButton';
import { LocalGameModal } from '../modals/LocalGameModal';
import { LoginModal } from '../modals/LoginModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import {
	createOnlinePlayersBanner,
	destroyOnlinePlayersBanner,
	loadOnlinePlayers,
	OnlinePlayersBanner,
} from '../utils/banner';
import { Chat } from '../utils/Chat';
import { router } from '../utils/Router';
import { Landing } from '../visual/Landing';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	private banner?: OnlinePlayersBanner | null = null;
	private chat?: Chat | null = null;
	private landing: Landing | null = null;
	private onlinePlayersInterval: number | null = null;

	constructor() {
		super();
		this.element.className = 'flex flex-row min-h-screen bg-transparent';

		try {
			this.initThreeD();
			if (isLoggedIn()) {
				this.toggleBanner(true);
				this.toggleChat(true);
			}
			document.addEventListener('login-success', this.onLoginChange);
			document.addEventListener('logout-success', this.onLoginChange);
			document.addEventListener('login-failed', this.onLoginChange);
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
		});
	}

	public toggleBanner(show: boolean): void {
		if (show) {
			if (!this.banner && isLoggedIn()) {
				this.initBanner();
			} else if (this.banner) {
				this.banner.bannerElement.style.display = '';
			}
		} else {
			this.destroyBanner();
		}
	}

	public toggleChat(show: boolean): void {
		console.debug("toggling the chat" + show);
		if (show) {
			if (!this.chat && isLoggedIn()) {
				this.chat = new Chat(document.body);
			}
		} else {
			this.destroyChat();
		}
	}

	private initBanner() {
		if (this.onlinePlayersInterval !== null)
			clearInterval(this.onlinePlayersInterval);
		this.banner = createOnlinePlayersBanner();
		this.element.appendChild(this.banner.bannerElement);
		loadOnlinePlayers(this.banner);
		this.onlinePlayersInterval = window.setInterval(() => {
			if (this.banner) {
				loadOnlinePlayers(this.banner);
			}
		}, 30000);
	}


	private destroyChat() {
		if (this.chat) {
			this.chat.destroy();
			this.chat = null;
		}
	}

	private destroyBanner() {
		if (this.onlinePlayersInterval !== null) {
			clearInterval(this.onlinePlayersInterval);
			this.onlinePlayersInterval = null;
		}
		if (this.banner) {
			destroyOnlinePlayersBanner(this.banner);
			this.banner = undefined;
		}
	}

	private onLoginChange = () => {
		this.toggleBanner(isLoggedIn());
		this.toggleChat(isLoggedIn());
	};

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

	public destroy(): void {
		if (this.landing) {
			this.landing.dispose();
			this.landing = null;
		}
		this.destroyBanner();
		this.destroyChat();

		document.removeEventListener('login-success', this.onLoginChange);
		document.removeEventListener('logout-success', this.onLoginChange);

		super.destroy();
	}
}
