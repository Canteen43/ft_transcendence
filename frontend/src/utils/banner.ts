import { z } from 'zod';
import { UserSchema } from '../../../shared/schemas/user';
import { apiCall } from '../utils/apiCall';
import { isLoggedIn } from '../buttons/AuthButton';

export interface OnlinePlayersBanner {
	bannerElement: HTMLElement;
	styleElement: HTMLStyleElement;
	onlinePlayersContainer: HTMLElement;
}

export function createOnlinePlayersBanner(): OnlinePlayersBanner {
	// banner container
	const bannerContainer = document.createElement('div');
	bannerContainer.className =
		'fixed bottom-0 left-0 w-full bg-[var(--color1)] bg-opacity-90 backdrop-blur-sm ' +
		'border-t-2 border-[var(--color5)] py-2 z-20 overflow-hidden';

	const scrollWrapper = document.createElement('div');
	scrollWrapper.className = 'flex animate-scroll whitespace-nowrap';

	const onlinePlayersContainer = document.createElement('div');
	onlinePlayersContainer.className = 'flex items-center space-x-8 px-4';

	// Add title
	const title = document.createElement('span');
	title.textContent = 'ONLINE PLAYERS:';
	title.className =
		"font-outfit [font-variation-settings:'wght'_900] text-[var(--color3)] text-lg font-bold mr-8";
	onlinePlayersContainer.appendChild(title);

	// ASSEMBLE THE DOM STRUCTURE
	scrollWrapper.appendChild(onlinePlayersContainer);
	bannerContainer.appendChild(scrollWrapper);

	// Add scrolling animation styles with slower speed and better spacing
	const styleElement = document.createElement('style');
	styleElement.textContent = `
	@keyframes scroll {
		0% { transform: translateX(100%); }
		100% { transform: translateX(-100%); }
	}
	.animate-scroll {
		animation: scroll 40s linear infinite;
	}
	.animate-scroll:hover {
		animation-play-state: paused;
	}
	`;
	document.head.appendChild(styleElement);

	return {
		bannerElement: bannerContainer,
		styleElement: styleElement,
		onlinePlayersContainer,
	};
}

export async function loadOnlinePlayers(banner: OnlinePlayersBanner) {
	if (!banner.onlinePlayersContainer) return;

	if (!isLoggedIn()) {
		updateOnlinePlayersDisplay(banner, []);
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
		updateOnlinePlayersDisplay(banner, []);
		return;
	}
	updateOnlinePlayersDisplay(
		banner,
		response ? (Array.isArray(response) ? response : [response]) : []
	);
}

function updateOnlinePlayersDisplay(banner: OnlinePlayersBanner, users: any[]) {
	const container = banner.onlinePlayersContainer;
	if (!container) return;

	// Clear container completely first
	const scrollWrapper = container.parentElement;
	if (!scrollWrapper) return;

	scrollWrapper.innerHTML = '';

	// Recreate main container
	const newContainer = document.createElement('div');
	newContainer.className = 'flex items-center space-x-8 px-4';

	const title = document.createElement('span');
	title.textContent = 'ONLINE PLAYERS:';
	title.className =
		"font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-lg mr-8";
	newContainer.appendChild(title);

	if (users.length === 0) {
		const noPlayers = document.createElement('span');
		noPlayers.textContent = 'No players online';
		noPlayers.className =
			"font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-base opacity-75";
		newContainer.appendChild(noPlayers);
	} else {
		users.forEach((user: any) => {
			const displayName = user.alias || user.login;
			const playerElement = document.createElement('span');
			playerElement.textContent = displayName;
			playerElement.className =
				"inline-flex items-center font-azeret [font-variation-settings:'wght'_900] text-[var(--color3)] text-base px-1 py-0.5 mr-1";
			newContainer.appendChild(playerElement);
		});
	}

	scrollWrapper.appendChild(newContainer);

	// clones for seamless scrolling
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

	// update reference
	banner.onlinePlayersContainer = newContainer;
}

export function destroyOnlinePlayersBanner(banner: OnlinePlayersBanner) {
	banner.bannerElement.remove();
	banner.styleElement.remove();
	banner.onlinePlayersContainer?.remove();
}
