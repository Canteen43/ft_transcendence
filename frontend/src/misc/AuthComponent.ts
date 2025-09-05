import { Button } from '../components/Button';
import { LoginModal } from '../modals/LoginModal';
import { webSocket } from './WebSocketWrapper';

export class AuthComponent {
	private button: Button | undefined;
	private parent: HTMLElement;

	constructor(parent: HTMLElement) {
		this.parent = parent;
		this.render();
	}
	
	private render() {
		this.button?.destroy();
		const isLoggedIn = this.isLoggedIn();

		this.button = new Button(
			isLoggedIn? 'Logout' : 'Login',
			isLoggedIn? () => this.logout() : () => new LoginModal(document.body),
			this.parent
		);
		this.button.element.classList.add('absolute', 'top-4', 'right-4');
	}

	private logout() {
		sessionStorage.removeItem("token");
		webSocket.close();
		alert( 'You have been logged out successfully!');
		this.render();
	}

	private isLoggedIn() {
		const token = sessionStorage.getItem("token");
		return (token != null && token != "");
	}
}
