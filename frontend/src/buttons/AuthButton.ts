import { LoginModal } from '../modals/LoginModal';
import { StatModal } from '../modals/StatModal';
import { webSocket } from '../utils/WebSocketWrapper';
import { Button } from './Button';

export function isLoggedIn(): boolean {
	const token = sessionStorage.getItem('token');
	return token != null && token != '';
}

export class AuthComponent {
	private button?: Button;
	private dropdown?: HTMLDivElement;
	private closeTimeout?: number;
	private loginModal?: LoginModal;
	private parent: HTMLElement;

	constructor(parent: HTMLElement) {
		this.parent = parent;
		this.render();
		document.addEventListener('login-success', this.renderHandler);
		document.addEventListener('logout-success', this.renderHandler);
		document.addEventListener('login-failed', this.renderHandler);
	}

	private renderHandler = () => this.render();

	private render() {
		this.destroyButton();
		const userIsLoggedIn = isLoggedIn();
		const username = sessionStorage.getItem('username') ?? '';

		this.button = new Button(
			userIsLoggedIn ? username : 'sign in',
			userIsLoggedIn ? () => {} : () => this.showLoginModal(),
			this.parent
		);

		if (userIsLoggedIn) {
			// Create a wrapper with fixed positioning
			const wrapper = document.createElement('div');
			wrapper.className = 'fixed top-4 right-4 z-10 w-32 sm:w-48 md:w-60';

			// Update button to be relative within the wrapper
			this.button.element.className +=
				' relative w-full text-center truncate';

			// Move button into wrapper
			const parent = this.button.element.parentElement!;
			parent.removeChild(this.button.element);
			wrapper.appendChild(this.button.element);
			parent.appendChild(wrapper);

			this.createDropdown();
			wrapper.addEventListener('mouseenter', this.onEnter);
			wrapper.addEventListener('mouseleave', this.onLeave);
		} else {
			this.button.element.className +=
				' top-4 right-4 fixed w-32 sm:w-48 md:w-60 z-10 text-center truncate group';
		}
	}

	private showLoginModal() {
		this.loginModal = new LoginModal(this.parent);
	}

	private onEnter = () => {
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}
		console.log('onEnter triggered', this.dropdown);
		if (this.dropdown) {
			console.log('Classes before:', this.dropdown.className);
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
			console.log('Classes after:', this.dropdown.className);
		}
	};

	private createDropdown() {
		this.dropdown = document.createElement('div');
		this.dropdown.className =
			'absolute top-full right-0 mt-1 ' +
			' bg-white divide-y divide-[var(--color1)] text-gray-800 shadow-lg  ' +
			' opacity-0 pointer-events-none transition-all duration-200 ease-in-out ' +
			' transform z-30 flex flex-col w-full scale-95 shadow-lg';
		this.dropdown.addEventListener('mouseenter', this.onEnter);
		this.dropdown.addEventListener('mouseleave', this.onLeave);

		// Stats button
		const statsBtn = document.createElement('button');
		statsBtn.textContent = 'Stats';
		statsBtn.className =
			"font-outfit [font-variation-settings:'wght'_900] text-lg sm:text-2xl " +
			'px-6 sm:px-12 py-3 sm:py-4 transition-colors ' +
			'bg-[var(--color1)] text-[var(--color3)] ' +
			'hover:bg-[var(--color5)]';
		statsBtn.addEventListener('click', () => {
			new StatModal(this.parent);
		});
		this.dropdown.appendChild(statsBtn);

		// Sign out button
		const logoutBtn = document.createElement('button');
		logoutBtn.textContent = 'Sign out';
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
		this.closeTimeout = window.setTimeout(() => {
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
		document.dispatchEvent(new CustomEvent('logout-success'));
		console.info('Logout successful');
	}

	private destroyButton() {
		if (!this.button) return;
		const wrapper = this.button.element.parentElement;
		if (wrapper && wrapper !== this.parent) {
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
		this.destroyButton();
		this.loginModal?.destroy();
		if (this.closeTimeout) {
			clearTimeout(this.closeTimeout);
			this.closeTimeout = undefined;
		}
		document.removeEventListener('login-success', this.renderHandler);
		document.removeEventListener('logout-success', this.renderHandler);
		document.removeEventListener('login-failed', this.renderHandler);
	}
}
