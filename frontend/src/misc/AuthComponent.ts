import { Button } from '../components/Button';
import { LoginModal } from '../modals/LoginModal';
import { webSocket } from '../utils/WebSocketWrapper';

export function isLoggedIn(): boolean {
	const token = sessionStorage.getItem('token');
	return token != null && token != '';
}

export class AuthComponent {
	private button: Button | undefined;
	private parent: HTMLElement;

	constructor(parent: HTMLElement) {
		this.parent = parent;
		this.render();
		document.addEventListener('login-success', () => this.render());
		document.addEventListener('logout-success', () => this.render());
	}

	private render() {
		this.button?.destroy();
		const userIsLoggedIn = isLoggedIn();

		this.button = new Button(
			userIsLoggedIn ? 'Logout' : 'Login',
			userIsLoggedIn ? () => this.logout() : () => this.showLoginModal(),
			this.parent
		);
		this.button.element.classList.add(
			'absolute',
			'top-4',
			'right-4',
			'fixed'
		);
	}

	private logout() {
		sessionStorage.removeItem('token');
		sessionStorage.removeItem('username');
		webSocket.close();
		document.dispatchEvent(new CustomEvent('logout-success'));
		console.info('Logout successful');
	}

	private showLoginModal() {
		new LoginModal(document.body);
	}
}
