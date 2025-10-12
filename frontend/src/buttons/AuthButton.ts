import { LoginModal } from '../modals/LoginModal';
import { TwoFactorAuthModal } from '../modals/TwoFactorAuthModal';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { Button } from './Button';

export function isLoggedIn(): boolean {
	const token = sessionStorage.getItem('token');
	return token != null && token != '';
}

export class AuthComponent {
	private button?: Button;
	private wrapper?: HTMLDivElement;
	private dropdown?: HTMLDivElement;
	private twoFABtn?: HTMLButtonElement;
	private logoutBtn?: HTMLButtonElement;
	private closeTimeout?: ReturnType<typeof setTimeout>;
	private loginModal?: LoginModal;
	private parent: HTMLElement;

	// Bound event handlers
	private renderHandler = () => this.render();
	private onEnter = () => this.handleEnter();
	private onLeave = () => this.handleLeave();
	private handle2FA = () => this.show2FAModal();
	private handleLogout = () => this.logout();

	constructor(parent: HTMLElement) {
		this.parent = parent;
		console.debug('Rendering the Auth button');
		this.render();

		// Add document event listeners
		document.addEventListener('login-success', this.renderHandler);
		document.addEventListener('logout-success', this.renderHandler);
		document.addEventListener('login-failed', this.renderHandler);
		document.addEventListener('chat-toggled', this.renderHandler);
	}

	private render() {
		// Clean up old UI before creating new
		this.destroyUI();

		const userIsLoggedIn = isLoggedIn();
		const username = sessionStorage.getItem('username') ?? '';
		const moveButtonLeft = userIsLoggedIn && state.chatExpanded;
		
		console.debug('Rendering auth button, moveButtonLeft:', moveButtonLeft);

		// Create wrapper with fixed positioning
		this.wrapper = document.createElement('div');
		this.wrapper.className =
			`fixed top-4 z-10 w-32 sm:w-48 md:w-60 transition-all duration-300` +
			` ${moveButtonLeft ? 'right-[21rem]' : 'right-4'}`;

		this.button = new Button(
			userIsLoggedIn ? username : 'sign in',
			userIsLoggedIn ? () => {} : () => this.showLoginModal(),
			this.wrapper
		);

		// Update button to be relative within the wrapper
		this.button.element.className += ' relative w-full text-center truncate';
		this.parent.appendChild(this.wrapper);

		if (userIsLoggedIn) {
			this.createDropdown();
		}

		// Add event listeners to wrapper
		this.wrapper.addEventListener('mouseenter', this.onEnter);
		this.wrapper.addEventListener('mouseleave', this.onLeave);
	}

	private showLoginModal() {
		// Clean up existing modal if any
		if (this.loginModal) {
			this.loginModal.destroy();
			this.loginModal = undefined;
		}
		this.loginModal = new LoginModal(this.parent);
	}

	private show2FAModal() {
		new TwoFactorAuthModal(this.parent);
	}

	private handleEnter() {
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}
		if (this.dropdown) {
			this.dropdown.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
			this.dropdown.classList.add('opacity-100', 'pointer-events-auto', 'scale-100');
		}
	}

	private createDropdown() {
		this.dropdown = document.createElement('div');
		this.dropdown.className =
			'absolute top-full right-0 mt-1 ' +
			'bg-white divide-y divide-[var(--color1)] text-gray-800 ' +
			'opacity-0 pointer-events-none transition-all duration-200 ease-in-out ' +
			'transform z-10 flex flex-col w-full scale-95';

		this.dropdown.addEventListener('mouseenter', this.onEnter);
		this.dropdown.addEventListener('mouseleave', this.onLeave);

		// 2FA button
		this.twoFABtn = document.createElement('button');
		this.twoFABtn.textContent = '2-FA';
		this.twoFABtn.className =
			"font-outfit [font-variation-settings:'wght'_900] text-lg sm:text-2xl " +
			'px-6 sm:px-12 py-3 sm:py-4 transition-colors ' +
			'bg-[var(--color1)] text-[var(--color3)] ' +
			'hover:bg-[var(--color5)]';
		this.twoFABtn.addEventListener('click', this.handle2FA);
		this.dropdown.appendChild(this.twoFABtn);

		// Sign out button
		this.logoutBtn = document.createElement('button');
		this.logoutBtn.textContent = 'sign out';
		this.logoutBtn.className =
			"font-outfit [font-variation-settings:'wght'_900] text-lg sm:text-2xl " +
			'px-6 sm:px-12 py-3 sm:py-4 transition-colors ' +
			'bg-[var(--color1)] text-[var(--color3)] ' +
			'hover:bg-[var(--color5)]';
		this.logoutBtn.addEventListener('click', this.handleLogout);
		this.dropdown.appendChild(this.logoutBtn);

		// Append dropdown to wrapper
		if (this.wrapper) {
			this.wrapper.appendChild(this.dropdown);
		}
	}

	private handleLeave() {
		this.closeTimeout = setTimeout(() => {
			if (this.dropdown) {
				this.dropdown.classList.remove('opacity-100', 'pointer-events-auto', 'scale-100');
				this.dropdown.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
			}
		}, 150);
	}

	private logout() {
		sessionStorage.clear();
		webSocket.close();
		console.debug('Dispatching logout-success event');
		document.dispatchEvent(new CustomEvent('logout-success'));
		console.info('Logout successful');
	}

	private destroyUI(): void {
		// Clear any pending timeouts
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}

		// Clean up dropdown and its buttons
		if (this.dropdown) {
			this.dropdown.removeEventListener('mouseenter', this.onEnter);
			this.dropdown.removeEventListener('mouseleave', this.onLeave);
		}

		if (this.twoFABtn) {
			this.twoFABtn.removeEventListener('click', this.handle2FA);
			this.twoFABtn = undefined;
		}

		if (this.logoutBtn) {
			this.logoutBtn.removeEventListener('click', this.handleLogout);
			this.logoutBtn = undefined;
		}

		if (this.dropdown) {
			this.dropdown.remove();
			this.dropdown = undefined;
		}

		// Clean up wrapper
		if (this.wrapper) {
			this.wrapper.removeEventListener('mouseenter', this.onEnter);
			this.wrapper.removeEventListener('mouseleave', this.onLeave);
			this.wrapper.remove();
			this.wrapper = undefined;
		}

		// Clean up button
		if (this.button) {
			this.button.destroy();
			this.button = undefined;
		}
	}

	public destroy(): void {
		// Clean up all UI elements
		this.destroyUI();

		// Clean up login modal if exists
		if (this.loginModal) {
			this.loginModal.destroy();
			this.loginModal = undefined;
		}

		// Remove document event listeners
		document.removeEventListener('login-success', this.renderHandler);
		document.removeEventListener('logout-success', this.renderHandler);
		document.removeEventListener('login-failed', this.renderHandler);
		document.removeEventListener('chat-toggled', this.renderHandler);
	}
}