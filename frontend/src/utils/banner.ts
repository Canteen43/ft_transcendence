import { z } from 'zod';
import { UserSchema } from '../../../shared/schemas/user';
import { apiCall } from '../utils/apiCall';

let onlinePlayersContainer: HTMLElement | null = null;

export function createOnlinePlayersBanner() {
    if (onlinePlayersContainer) return;

    const bannerContainer = document.createElement('div');
    // Give the banner a stable id so screens can toggle visibility
    bannerContainer.id = 'online-players-banner';
    bannerContainer.className =
            'fixed bottom-0 left-0 w-full bg-[var(--color1)] bg-opacity-90 backdrop-blur-sm ' +
            'border-t-2 border-[var(--color2)] py-3 z-50 overflow-hidden';

	const scrollWrapper = document.createElement('div');
	scrollWrapper.className = 'flex animate-scroll whitespace-nowrap';

	onlinePlayersContainer = document.createElement('div');
	onlinePlayersContainer.className = 'flex items-center space-x-8 px-4';

	// Add title
	const title = document.createElement('span');
	title.textContent = 'ONLINE PLAYERS:';
	title.className = 'font-sigmar text-[var(--color3)] text-lg font-bold mr-8';
	onlinePlayersContainer.appendChild(title);

	scrollWrapper.appendChild(onlinePlayersContainer);
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
}

export async function loadOnlinePlayers() {
	if (!onlinePlayersContainer) return;

	const token = sessionStorage.getItem('token');
	if (!token) {
		updateOnlinePlayersDisplay([]);
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
		updateOnlinePlayersDisplay([]);
		return;
	}
	updateOnlinePlayersDisplay(
		response ? (Array.isArray(response) ? response : [response]) : []
	);
}

function updateOnlinePlayersDisplay(users: any[]) {
	if (!onlinePlayersContainer) return;

	// Clear and recreate title
	onlinePlayersContainer.innerHTML = '';
	const title = document.createElement('span');
	title.textContent = 'ONLINE PLAYERS:';
	title.className = 'font-sigmar text-[var(--color3)] text-lg mr-8';
	onlinePlayersContainer.appendChild(title);

	if (users.length === 0) {
		const noPlayers = document.createElement('span');
		noPlayers.textContent = 'No players online';
		noPlayers.className =
			'font-sigmar text-[var(--color3)] text-base opacity-75';
		onlinePlayersContainer.appendChild(noPlayers);
		return;
	}

	// Add each player (alias or username)
	users.forEach((user, index) => {
		const displayName = user.alias || user.login;

		const playerElement = document.createElement('span');
		playerElement.textContent = displayName;
		playerElement.className =
			'font-sigmar text-[var(--color3)] text-base px-3 py-1';

		onlinePlayersContainer?.appendChild(playerElement);
	});

	// Clone content for seamless scrolling
	const clone = onlinePlayersContainer.cloneNode(true) as HTMLElement;
	clone.className = 'flex items-center space-x-8 px-4 ml-8';
	onlinePlayersContainer.parentElement?.appendChild(clone);
}
