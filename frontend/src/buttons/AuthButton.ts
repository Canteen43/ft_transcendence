import { LoginModal } from '../modals/LoginModal';
import { TwoFactorAuthModal } from '../modals/TwoFactorAuthModal';
import { state } from '../utils/State';
import { webSocket } from '../utils/WebSocketWrapper';
import { Button } from './Button';

export function isLoggedIn(): boolean {
	const token = sessionStorage.getItem('token');
	return token != null && token != '';
}

export function isConnected(): boolean {
	return isLoggedIn() && webSocket.isOpen();
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
	private selectedIndex: number = -1; // -1 = button, 0 = 2FA, 1 = logout
	private dropdownOpen: boolean = false;

	// Bound event handlers
	private renderHandler = () => this.render();
	private onEnter = () => this.handleEnter();
	private onLeave = () => this.handleLeave();
	private handle2FA = () => this.show2FAModal();
	private handleLogout = () => this.logout();
	private handleKeyDown = (e: KeyboardEvent) => this.onKeyDown(e);

	constructor(parent: HTMLElement) {
		this.parent = parent;
		console.debug('Rendering the Auth button');
		this.render();

		// Add document event listeners
		document.addEventListener('login-success ws-open', this.renderHandler);
		document.addEventListener('logout-success', this.renderHandler);
		document.addEventListener('login-failed', this.renderHandler);
		document.addEventListener('chat-toggled', this.renderHandler);
		document.addEventListener('keydown', this.handleKeyDown);
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
			`fixed top-4 z-10 w-24 sm:w-36 md:w-48 transition-all duration-300` +
			` ${moveButtonLeft ? 'right-[21rem]' : 'right-4'}`;

		this.button = new Button(
			userIsLoggedIn ? username : 'sign in',
			userIsLoggedIn ? () => {} : () => this.showLoginModal(),
			this.wrapper
		);

		// Update button to be relative within the wrapper
		this.button.element.className +=
			' relative w-full text-center truncate text-sm sm:text-base';
		this.parent.appendChild(this.wrapper);

		if (userIsLoggedIn) {
			this.createDropdown();
		}

		// Add event listeners to wrapper
		this.wrapper.addEventListener('mouseenter', this.onEnter);
		this.wrapper.addEventListener('mouseleave', this.onLeave);
	}

	private onKeyDown(e: KeyboardEvent) {
		const userIsLoggedIn = isLoggedIn();

		// Only handle if button/wrapper is in focus context
		if (!this.wrapper || !document.activeElement) return;

		const isAuthFocused =
			this.wrapper.contains(document.activeElement) ||
			document.activeElement === this.button?.element ||
			document.activeElement === this.twoFABtn ||
			document.activeElement === this.logoutBtn;

		if (!isAuthFocused && this.selectedIndex === -1) return;

		switch (e.key) {
			case 'Enter':
				e.preventDefault();
				if (!userIsLoggedIn) {
					// Not logged in - open login modal
					this.showLoginModal();
				} else if (!this.dropdownOpen) {
					// Logged in, dropdown closed - open it
					this.openDropdown();
					this.selectedIndex = 0;
					this.updateSelection();
				} else if (this.selectedIndex === 0) {
					// 2FA selected
					this.handle2FA();
					this.closeDropdown();
				} else if (this.selectedIndex === 1) {
					// Logout selected
					this.handleLogout();
					this.closeDropdown();
				}
				break;

			case 'ArrowDown':
				if (userIsLoggedIn && this.dropdownOpen) {
					e.preventDefault();
					this.selectedIndex = Math.min(1, this.selectedIndex + 1);
					this.updateSelection();
				} else if (userIsLoggedIn && !this.dropdownOpen) {
					e.preventDefault();
					this.openDropdown();
					this.selectedIndex = 0;
					this.updateSelection();
				}
				break;

			case 'ArrowUp':
				if (userIsLoggedIn && this.dropdownOpen) {
					e.preventDefault();
					if (this.selectedIndex === 0) {
						// Close dropdown and return to button
						this.closeDropdown();
						this.selectedIndex = -1;
						this.button?.element.focus();
					} else {
						this.selectedIndex = Math.max(
							0,
							this.selectedIndex - 1
						);
						this.updateSelection();
					}
				}
				break;

			case 'Escape':
				if (this.dropdownOpen) {
					e.preventDefault();
					this.closeDropdown();
					this.selectedIndex = -1;
					this.button?.element.focus();
				}
				break;
		}
	}

	private updateSelection() {
		if (!this.twoFABtn || !this.logoutBtn) return;

		// Remove highlight from both
		this.twoFABtn.classList.remove('ring-2', 'ring-[var(--color3)]');
		this.logoutBtn.classList.remove('ring-2', 'ring-[var(--color3)]');

		// Add highlight to selected
		if (this.selectedIndex === 0) {
			this.twoFABtn.classList.add('ring-2', 'ring-[var(--color3)]');
			this.twoFABtn.focus();
		} else if (this.selectedIndex === 1) {
			this.logoutBtn.classList.add('ring-2', 'ring-[var(--color3)]');
			this.logoutBtn.focus();
		}
	}

	private openDropdown() {
		if (!this.dropdown) return;
		this.dropdownOpen = true;
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

	private closeDropdown() {
		if (!this.dropdown) return;
		this.dropdownOpen = false;
		this.selectedIndex = -1;
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
			this.openDropdown();
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
			"font-outfit [font-variation-settings:'wght'_900] text-sm sm:text-base " +
			'px-3 sm:px-6 py-1.5 sm:py-2 transition-colors ' +
			'bg-[var(--color1)] text-[var(--color3)] ' +
			'hover:bg-[var(--color5)]';
		this.twoFABtn.addEventListener('click', this.handle2FA);
		this.dropdown.appendChild(this.twoFABtn);

		// Sign out button
		this.logoutBtn = document.createElement('button');
		this.logoutBtn.textContent = 'sign out';
		this.logoutBtn.className =
			"font-outfit [font-variation-settings:'wght'_900] text-sm sm:text-base " +
			'px-3 sm:px-6 py-1.5 sm:py-2 transition-colors ' +
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
				this.closeDropdown();
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
		// Reset state
		this.selectedIndex = -1;
		this.dropdownOpen = false;

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
		document.removeEventListener('login-success ws-open', this.renderHandler);
		document.removeEventListener('logout-success', this.renderHandler);
		document.removeEventListener('login-failed', this.renderHandler);
		document.removeEventListener('chat-toggled', this.renderHandler);
		document.removeEventListener('keydown', this.handleKeyDown);
	}
}
