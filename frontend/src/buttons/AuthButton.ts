import { LoginModal } from '../modals/LoginModal';
import { webSocket } from '../utils/WebSocketWrapper';
import { Button } from './Button';

export function isLoggedIn(): boolean {
	const token = sessionStorage.getItem('token');
	return token != null && token != '';
}

export class AuthComponent {
	private button?: Button;
	private button?: Button;
	private parent: HTMLElement;

	constructor(parent: HTMLElement) {
		this.parent = parent;
		this.render();
		document.addEventListener('login-success', this.renderHandler);
		document.addEventListener('logout-success', this.renderHandler);
		document.addEventListener('login-failed', this.renderHandler);
		document.addEventListener('login-success', this.renderHandler);
		document.addEventListener('logout-success', this.renderHandler);
		document.addEventListener('login-failed', this.renderHandler);
	}

	private renderHandler = () => this.render();

	private renderHandler = () => this.render();

	private render() {
		this.destroyButton();
		this.destroyButton();
		const userIsLoggedIn = isLoggedIn();
		const username = sessionStorage.getItem('username') ?? '';

		this.button = new Button(
			userIsLoggedIn ? username : 'sign in',
			userIsLoggedIn ? () => this.logout() : () => this.showLoginModal(),
			this.parent
		);

		this.button.element.classList.add(
			'absolute',
			'top-4',
			'right-4',
			'fixed',
			'w-51',
			'z-10',
			'text-center',
			'truncate'
		);

		if (userIsLoggedIn) {
			this.button.element.addEventListener('mouseenter', this.onEnter);
			this.button.element.addEventListener('mouseleave', this.onLeave);
		}
	}

	private showLoginModal() {
		new LoginModal(document.body);
	}

	private onEnter = () => {
		this.button!.element.textContent = 'sign out';
	};

	private onLeave = () => {
		const username = sessionStorage.getItem('username') ?? '';
		this.button!.element.textContent = username;
	};
			this.button.element.addEventListener('mouseenter', this.onEnter);
			this.button.element.addEventListener('mouseleave', this.onLeave);
		}
	}

	private showLoginModal() {
		new LoginModal(document.body);
	}

	private onEnter = () => {
		this.button!.element.textContent = 'sign out';
	};

	private onLeave = () => {
		const username = sessionStorage.getItem('username') ?? '';
		this.button!.element.textContent = username;
	};

	private logout() {
		sessionStorage.clear();
		webSocket.close();
		document.dispatchEvent(new CustomEvent('logout-success'));
		console.info('Logout successful');
	}

	private destroyButton() {
		if (!this.button) return;
		this.button.element.removeEventListener('mouseenter', this.onEnter);
		this.button.element.removeEventListener('mouseleave', this.onLeave);
		this.button.destroy();
		this.button = undefined;
	}

	public destroy() {
		this.destroyButton();
		document.removeEventListener('login-success', this.renderHandler);
		document.removeEventListener('logout-success', this.renderHandler);
		document.removeEventListener('login-failed', this.renderHandler);
	private destroyButton() {
		if (!this.button) return;
		this.button.element.removeEventListener('mouseenter', this.onEnter);
		this.button.element.removeEventListener('mouseleave', this.onLeave);
		this.button.destroy();
		this.button = undefined;
	}

	public destroy() {
		this.destroyButton();
		document.removeEventListener('login-success', this.renderHandler);
		document.removeEventListener('logout-success', this.renderHandler);
		document.removeEventListener('login-failed', this.renderHandler);
	}
}
