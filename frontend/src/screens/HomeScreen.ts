import z from 'zod';
import { UserSchema } from '../../../shared/schemas/user';
import { isLoggedIn } from '../buttons/AuthButton';
import { AliasModal } from '../modals/AliasModal';
import { LocalGameModal } from '../modals/LocalGameModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { TextModal } from '../modals/TextModal';
import { apiCall } from '../utils/apiCall';
import { router } from '../utils/Router';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
	private onlinePlayersContainer: HTMLElement | null = null;
	constructor() {
		super();

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		// Main title
		const heading = document.createElement('h1');
		heading.textContent = 'Space Pong';
		heading.className =
			'font-rubik text-[150px] text-[var(--color2)] text-center floating-title select-none';
		this.element.appendChild(heading);

		// Container for the main 2 buttons
		const mainButtonContainer = document.createElement('div');
		mainButtonContainer.className = 'flex gap-8 mt-8';
		this.element.appendChild(mainButtonContainer);

		// LOCAL Play button
		const localBtn = document.createElement('button');
		localBtn.textContent = 'LOCAL GAME';
		localBtn.className = localBtn.className =
			'font-sigmar px-10 py-6 text-3xl font-bold rounded-lg border-4 ' +
			'text-[var(--color1)] border-[var(--color1)] bg-transparent ' +
			'hover:bg-[var(--color1)] hover:text-[var(--color3)] hover:border-[var(--color1)] ' +
			'transition-all duration-300 shadow-lg';
		localBtn.onclick = () => this.localLogic();

		mainButtonContainer.appendChild(localBtn);

		// REMOTE Play button
		const remoteBtn = document.createElement('button');
		remoteBtn.textContent = 'REMOTE GAME';
		remoteBtn.className =
			'font-sigmar px-10 py-6 text-3xl font-bold rounded-lg border-4 ' +
			'text-[var(--color1)] border-[var(--color1)] bg-transparent ' +
			'hover:bg-[var(--color1)] hover:text-[var(--color3)] hover:border-[var(--color1)] ' +
			'transition-all duration-300 shadow-lg';
		remoteBtn.onclick = () => this.remoteLogic();
		mainButtonContainer.appendChild(remoteBtn);

		// BANNER online players
		this.createOnlinePlayersBanner();
		this.loadOnlinePlayers();
		setInterval(() => {
			this.loadOnlinePlayers();
		}, 30000);
	}

	private remoteLogic() {
		if (!isLoggedIn()) {
			new TextModal(
				router.currentScreen!.element,
				'You must be logged-in to access the remote game'
			);
			return;
		}
		new RemoteGameModal(this.element);
	}

	private localLogic() {
		new LocalGameModal(this.element);
	}

	private createOnlinePlayersBanner() {
		const bannerContainer = document.createElement('div');
		bannerContainer.className =
			'fixed bottom-0 left-0 w-full bg-[var(--color1)] bg-opacity-90 backdrop-blur-sm ' +
			'border-t-2 border-[var(--color2)] py-3 z-50 overflow-hidden';

		const scrollWrapper = document.createElement('div');
		scrollWrapper.className = 'flex animate-scroll whitespace-nowrap';

		this.onlinePlayersContainer = document.createElement('div');
		this.onlinePlayersContainer.className =
			'flex items-center space-x-8 px-4';

		// Add title
		const title = document.createElement('span');
		title.textContent = 'ONLINE PLAYERS:';
		title.className =
			'font-sigmar text-[var(--color3)] text-lg font-bold mr-8';
		this.onlinePlayersContainer.appendChild(title);

		scrollWrapper.appendChild(this.onlinePlayersContainer);
		bannerContainer.appendChild(scrollWrapper);
		document.body.appendChild(bannerContainer);

		// Add scrolling animation styles
		const style = document.createElement('style');
		style.textContent = `
		@keyframes scroll {
			0% { transform: translateX(100%); }
			100% { transform: translateX(-100%); }
		}
		.animate-scroll {
			animation: scroll 30s linear infinite;
		}
		.animate-scroll:hover {
			animation-play-state: paused;
		}
	`;
		document.head.appendChild(style);

		this.element.style.paddingBottom = '80px';
	}

	private async loadOnlinePlayers() {
		const token = sessionStorage.getItem('token');
		if (!token) {
			this.updateOnlinePlayersDisplay([]);
			return;
		}

		const UsersArraySchema = z.array(UserSchema);
		const { data: response, error } = await apiCall(
			'GET',
			'/users/online',
			UsersArraySchema
		);
		if (error) {
			console.error('Error loading online players:', error);
			this.updateOnlinePlayersDisplay([]);
			return;
		}
		this.updateOnlinePlayersDisplay(
			response ? (Array.isArray(response) ? response : [response]) : []
		);
	}

	private updateOnlinePlayersDisplay(users: any[]) {
		if (!this.onlinePlayersContainer) return;

		// Clear and recreate title
		this.onlinePlayersContainer.innerHTML = '';
		const title = document.createElement('span');
		title.textContent = 'ONLINE PLAYERS:';
		title.className = 'font-sigmar text-[var(--color3)] text-lg mr-8';
		this.onlinePlayersContainer.appendChild(title);

		if (users.length === 0) {
			const noPlayers = document.createElement('span');
			noPlayers.textContent = 'No players online';
			noPlayers.className =
				'font-sigmar text-[var(--color3)] text-base opacity-75';
			this.onlinePlayersContainer.appendChild(noPlayers);
			return;
		}

		// Add each player (alias or username)
		users.forEach((user, index) => {
			const displayName = user.alias || user.login;

			const playerElement = document.createElement('span');
			playerElement.textContent = displayName;
			playerElement.className =
				'font-sigmar text-[var(--color3)] text-base px-3 py-1';

			this.onlinePlayersContainer?.appendChild(playerElement);
		});

		// Clone content for seamless scrolling
		const clone = this.onlinePlayersContainer.cloneNode(
			true
		) as HTMLElement;
		clone.className = 'flex items-center space-x-8 px-4 ml-8';
		this.onlinePlayersContainer.parentElement?.appendChild(clone);
	}
}
