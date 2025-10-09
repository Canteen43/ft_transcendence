import { LoginModal } from '../modals/LoginModal';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { Button } from './Button';
import { TwoFactorAuthModal } from '../modals/TwoFactorAuthModal';


export function isLoggedIn(): boolean {
	const token = sessionStorage.getItem('token');
	return token != null && token != '';
}

export class AuthComponent {
	private button?: Button;
	private dropdown?: HTMLDivElement;
	private closeTimeout?: ReturnType<typeof setTimeout>;
	private loginModal?: LoginModal;
	private dropdown?: HTMLDivElement;
	private closeTimeout?: ReturnType<typeof setTimeout>;
	private loginModal?: LoginModal;
	private parent: HTMLElement;

	constructor(parent: HTMLElement) {
		this.parent = parent;
		console.debug('Rendering the Auth button');
		console.debug('Rendering the Auth button');
		this.render();
		document.addEventListener('login-success', this.renderHandler);
		document.addEventListener('logout-success', this.renderHandler);
		document.addEventListener('login-failed', this.renderHandler);
		document.addEventListener('chat-toggled', this.renderHandler);
		document.addEventListener('chat-toggled', this.renderHandler);
	}

	private renderHandler = () => this.render();

	private render() {
		this.destroyButton();
		const userIsLoggedIn = isLoggedIn();
		const username = sessionStorage.getItem('username') ?? '';
		const moveButtonLeft = userIsLoggedIn && state.chatExpanded;
		console.debug(
			'RErendering auth Button, moveButtonLeft: ' + moveButtonLeft
		);

		// Create a wrapper with fixed positioning
		const wrapper = document.createElement('div');
		wrapper.className =
			`fixed top-4 z-10 w-32 sm:w-48 md:w-60 transition-all duration-300` +
			` ${moveButtonLeft ? 'right-[21rem]' : 'right-4'}`;
		const moveButtonLeft = userIsLoggedIn && state.chatExpanded;
		console.debug(
			'RErendering auth Button, moveButtonLeft: ' + moveButtonLeft
		);

		// Create a wrapper with fixed positioning
		const wrapper = document.createElement('div');
		wrapper.className =
			`fixed top-4 z-10 w-32 sm:w-48 md:w-60 transition-all duration-300` +
			` ${moveButtonLeft ? 'right-[21rem]' : 'right-4'}`;

		this.button = new Button(
			userIsLoggedIn ? username : 'sign in',
			userIsLoggedIn ? () => {} : () => this.showLoginModal(),
			wrapper
			userIsLoggedIn ? () => {} : () => this.showLoginModal(),
			wrapper
		);
		// Update button to be relative within the wrapper
		this.button.element.className += 'relative w-full text-center truncate';
		this.parent.appendChild(wrapper);
		// Update button to be relative within the wrapper
		this.button.element.className += 'relative w-full text-center truncate';
		this.parent.appendChild(wrapper);

		if (userIsLoggedIn) {
			this.createDropdown();
			this.createDropdown();
		}

		wrapper.addEventListener('mouseenter', this.onEnter);
		wrapper.addEventListener('mouseleave', this.onLeave);

		wrapper.addEventListener('mouseenter', this.onEnter);
		wrapper.addEventListener('mouseleave', this.onLeave);
	}

	private showLoginModal() {
		if (this.loginModal) {
			this.loginModal.destroy();
		}
		this.loginModal = new LoginModal(this.parent);
		if (this.loginModal) {
			this.loginModal.destroy();
		}
		this.loginModal = new LoginModal(this.parent);
	}

	private onEnter = () => {
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}
		if (this.dropdown) {
			this.dropdown.classList.remove(
				'opacity-0',
				'pointer-events-none',
				'scale-95'
			);
			this.dropdown.classList.add(
				'opacity-100',
				'pointer-events-auto',
				'scale-100'
			);
		}
	};

	private createDropdown() {
		this.dropdown = document.createElement('div');
		this.dropdown.className =
			'absolute top-full right-0 mt-1 ' +
			' bg-white divide-y divide-[var(--color1)] text-gray-800 ' +
			' opacity-0 pointer-events-none transition-all duration-200 ease-in-out ' +
			' transform z-10 flex flex-col w-full scale-95 ';
		this.dropdown.addEventListener('mouseenter', this.onEnter);
		this.dropdown.addEventListener('mouseleave', this.onLeave);

		// twoFABtn button
		const twoFABtn = document.createElement('button');
		twoFABtn.textContent = '2-FA';
		twoFABtn.className =
			"font-outfit [font-variation-settings:'wght'_900] text-lg sm:text-2xl " +
			'px-6 sm:px-12 py-3 sm:py-4 transition-colors ' +
			'bg-[var(--color1)] text-[var(--color3)] ' +
			'hover:bg-[var(--color5)]';
		twoFABtn.addEventListener('click', () => {
			new TwoFactorAuthModal(this.parent);
		});
		this.dropdown.appendChild(twoFABtn);

		// Sign out button
		const logoutBtn = document.createElement('button');
		logoutBtn.textContent = 'sign out';
		logoutBtn.className =
			"font-outfit [font-variation-settings:'wght'_900] text-lg sm:text-2xl " +
			'px-6 sm:px-12 py-3 sm:py-4 transition-colors ' +
			'bg-[var(--color1)] text-[var(--color3)] ' +
			'hover:bg-[var(--color5)]';
		logoutBtn.addEventListener('click', () => this.logout());
		this.dropdown.appendChild(logoutBtn);

		this.button!.element.parentElement!.appendChild(this.dropdown);
	}

	private onLeave = () => {
		this.closeTimeout = setTimeout(() => {
			if (this.dropdown) {
				this.dropdown.classList.remove(
					'opacity-100',
					'pointer-events-auto',
					'scale-100'
				);
				this.dropdown.classList.add(
					'opacity-0',
					'pointer-events-none',
					'scale-95'
				);
			}
		}, 150);
		this.closeTimeout = setTimeout(() => {
			if (this.dropdown) {
				this.dropdown.classList.remove(
					'opacity-100',
					'pointer-events-auto',
					'scale-100'
				);
				this.dropdown.classList.add(
					'opacity-0',
					'pointer-events-none',
					'scale-95'
				);
			}
		}, 150);
	};

	private logout() {
		sessionStorage.clear();
		webSocket.close();
		console.debug('Dispatching LOGOUT SUCCESS');
		console.debug('Dispatching LOGOUT SUCCESS');
		document.dispatchEvent(new CustomEvent('logout-success'));
		console.info('Logout successful');
	}

	private destroyButton(): void {
	private destroyButton(): void {
		if (!this.button) return;
		const wrapper = this.button.element.parentElement;
		if (wrapper) {
			wrapper.removeEventListener('mouseenter', this.onEnter);
			wrapper.removeEventListener('mouseleave', this.onLeave);
		}
		if (this.dropdown) {
			this.dropdown.removeEventListener('mouseenter', this.onEnter);
			this.dropdown.removeEventListener('mouseleave', this.onLeave);
			this.dropdown.remove();
			this.dropdown = undefined;
		}
		const wrapper = this.button.element.parentElement;
		if (wrapper) {
			wrapper.removeEventListener('mouseenter', this.onEnter);
			wrapper.removeEventListener('mouseleave', this.onLeave);
		}
		if (this.dropdown) {
			this.dropdown.removeEventListener('mouseenter', this.onEnter);
			this.dropdown.removeEventListener('mouseleave', this.onLeave);
			this.dropdown.remove();
			this.dropdown = undefined;
		}
		this.button.destroy();
		this.button = undefined;
	}

	public destroy(): void {
	public destroy(): void {
		this.destroyButton();
		this.loginModal?.destroy();
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}
		this.loginModal?.destroy();
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}
		document.removeEventListener('login-success', this.renderHandler);
		document.removeEventListener('logout-success', this.renderHandler);
		document.removeEventListener('login-failed', this.renderHandler);
		document.removeEventListener('chat-toggled', this.renderHandler);
		document.removeEventListener('chat-toggled', this.renderHandler);
	}
}
