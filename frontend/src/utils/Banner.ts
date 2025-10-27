import { z } from 'zod';
import { UserSchema } from '../../../shared/schemas/user';
import { isConnected } from '../buttons/AuthButton';
import { apiCall } from './apiCall';

export class Banner {
	private bannerContainer: HTMLElement;
	private onlinePlayersContainer: HTMLElement;
	private updateInterval: number | null = null;
	private isWebSocketConnected: boolean = false;

	// Bound methods for event listeners
	private bndShowPlayer = () => {
		this.isWebSocketConnected = true;
		this.loadOnlinePlayers();
	};

	private bndShowError = () => {
		this.isWebSocketConnected = false;
		this.updateDisplay([], true);
	};

	constructor(parent: HTMLElement) {
		// Listen for WebSocket state changes
		document.addEventListener('ws-open', this.bndShowPlayer);
		document.addEventListener('ws-close', this.bndShowError);
		// banner container
		this.bannerContainer = document.createElement('div');
		this.bannerContainer.className =
			'fixed bottom-0 left-0 w-full bg-[var(--color1)] bg-opacity-90 backdrop-blur-sm ' +
			'border-t-2 border-[var(--color5)] py-1 h-8 z-20 overflow-hidden text-xs sm:text-sm';
		// online players container
		this.onlinePlayersContainer = document.createElement('div');
		this.onlinePlayersContainer.className =
			'flex items-center space-x-4 px-2';

		// Add title to onlinePlayersContainer
		const title = document.createElement('span');
		title.textContent = 'ONLINE PLAYERS:';
		title.className =
			"font-outfit [font-variation-settings:'wght'_900] text-[var(--color3)] text-sm sm:text-base  font-bold mr-8";
		this.onlinePlayersContainer.appendChild(title);

		// scrollWrapper
		const scrollWrapper = document.createElement('div');
		scrollWrapper.className = 'flex animate-scroll whitespace-nowrap';

		// add onlinePlayersContainer to scrollWrapper
		scrollWrapper.appendChild(this.onlinePlayersContainer);
		// add scrollWrapper to bannerContainer
		this.bannerContainer.appendChild(scrollWrapper);
		// Attach to parent
		parent.appendChild(this.bannerContainer);

		// Initial load
		this.loadOnlinePlayers();

		// updates every 30 seconds
		this.updateInterval = window.setInterval(() => {
			this.loadOnlinePlayers();
		}, 5000);
	}

	private async loadOnlinePlayers(): Promise<void> {
		if (!this.isWebSocketConnected) {
			this.updateDisplay([], true);
			return;
		}

		const UsersArraySchema = z.array(UserSchema);
		const { data: userArray, error } = await apiCall(
			'GET',
			'/users/online',
			UsersArraySchema
		);
		if (error) {
			console.error('Error loading online players:', error);
			this.updateDisplay([], true);
			return;
		}
		if (!userArray) {
			console.error('Empty online players array');
			this.updateDisplay([], false);
			return;
		}

		this.updateDisplay(userArray, false);
	}

	private updateDisplay(users: any[], error: boolean): void {
		const scrollWrapper = this.onlinePlayersContainer.parentElement;
		if (!scrollWrapper) return;

		scrollWrapper.replaceChildren();

		// Recreate main container
		const newContainer = document.createElement('div');
		newContainer.className = 'flex items-center space-x-8 px-4';

		const title = document.createElement('span');
		title.textContent = 'ONLINE PLAYERS:';
		title.className =
			"font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-sm sm:text-base  mr-8";
		newContainer.appendChild(title);

		if (error === true) {
			const noPlayers = document.createElement('span');
			noPlayers.textContent = 'CONNEXION ERROR';
			noPlayers.className =
				"font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-sm sm:text-base opacity-75";
			newContainer.appendChild(noPlayers);
		} else if (users.length === 0) {
			const noPlayers = document.createElement('span');
			noPlayers.textContent = 'CONNEXION ERROR';
			noPlayers.className =
				"font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-sm sm:text-base opacity-75";
			newContainer.appendChild(noPlayers);
		} else {
			users.forEach((user: any) => {
				const displayName = user.alias || user.login;
				const playerElement = document.createElement('span');
				playerElement.textContent = displayName;
				playerElement.className =
					"inline-flex items-center font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-sm sm:text-base px-1 py-0.5 mr-1";
				newContainer.appendChild(playerElement);
			});
		}

		scrollWrapper.appendChild(newContainer);

		// Create clones for seamless scrolling
		const screenWidth = window.innerWidth;
		const containerWidth = newContainer.scrollWidth;
		const copiesNeeded = Math.max(
			3,
			Math.ceil(screenWidth / containerWidth) + 1
		);

		for (let i = 0; i < copiesNeeded; i++) {
			const clone = newContainer.cloneNode(true) as HTMLElement;
			clone.className = 'flex items-center space-x-8 px-4';
			clone.style.marginLeft = '400px';
			scrollWrapper.appendChild(clone);
		}

		// Update reference
		this.onlinePlayersContainer = newContainer;
	}
	public destroy(): void {
		if (this.updateInterval !== null) {
			clearInterval(this.updateInterval);
			this.updateInterval = null;
		}

		// Remove event listeners
		document.removeEventListener('ws-open', this.bndShowPlayer);
		document.removeEventListener('ws-close', this.bndShowError);

		// Remove from DOM
		this.bannerContainer.remove();
	}
}
