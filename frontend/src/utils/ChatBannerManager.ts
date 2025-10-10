import { isLoggedIn } from '../buttons/AuthButton';
import { Banner } from './Banner';
import { Chat } from './Chat';

export class ChatBannerManager {
	// private chat: Chat | null = null;
	// private banner: Banner | null = null;
	// private parent: HTMLElement;
	// private bndInitChatBanner = () => this.initChatBanner();
	// private bndDestroyChatBanner = () => this.destroyChatBanner();

	// constructor(parent: HTMLElement) {
	// 	this.parent = parent;

	// 	// Listen for login state changes
	// 	document.addEventListener('login-success', this.bndInitChatBanner);
	// 	document.addEventListener('login-failed', this.bndDestroyChatBanner);
	// 	document.addEventListener('logout-success', this.bndDestroyChatBanner);

	// 	// Initialize on load if already logged in
	// 	if (isLoggedIn()) {
	// 		this.initChatBanner();
	// 	}
	// }

	// private initChatBanner() {
	// 	if (!isLoggedIn() || !this.parent) return;
	// 	console.debug('Initializing chat and banner');

	// 	if (!this.chat) {
	// 		this.chat = new Chat(this.parent);
	// 	}

	// 	if (!this.banner) {
	// 		this.banner = new Banner(this.parent);
	// 	}
	// }

	// private destroyChatBanner() {
	// 	console.debug('Destroy Chat banner called');
	// 	if (this.chat) {
	// 		this.chat.destroy();
	// 		this.chat = null;
	// 	}
	// 	if (this.banner) {
	// 		this.banner.destroy();
	// 		this.banner = null;
	// 	}
	// }

	// destroy() {
	// 	this.destroyChatBanner();
	// 	document.removeEventListener('login-success', this.bndInitChatBanner);
	// 	document.removeEventListener('login-fail', this.bndDestroyChatBanner);
	// 	document.removeEventListener(
	// 		'logout-success',
	// 		this.bndDestroyChatBanner
	// 	);
	// }
}
