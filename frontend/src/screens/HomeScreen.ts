import { isLoggedIn } from '../buttons/AuthButton';
import { AliasModal } from '../modals/AliasModal';
import { LocalGameModal } from '../modals/LocalGameModal';
import { RemoteGameModal } from '../modals/RemoteGameModal';
import { Screen } from './Screen';

export class HomeScreen extends Screen {
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
	}

	private remoteLogic() {
		if (!isLoggedIn()) {
			alert('You must be logged-in to access the remote game');
			return;
		}
		new RemoteGameModal(this.element);
	}

	private localLogic() {
		new LocalGameModal(this.element);
	}
}



// import { isLoggedIn } from '../buttons/AuthButton';
// import { AliasModal } from '../modals/AliasModal';
// import { LocalGameModal } from '../modals/LocalGameModal';
// import { RemoteGameModal } from '../modals/RemoteGameModal';
// import { Screen } from './Screen';

// export class HomeScreen extends Screen {
// 	private onlinePlayersContainer: HTMLElement | null = null;

// 	constructor() {
// 		super();

// 		this.element.className =
// 			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

// 		// Online players banner at the top
// 		this.createOnlinePlayersBanner();

// 		// Main title
// 		const heading = document.createElement('h1');
// 		heading.textContent = 'Space Pong';
// 		heading.className =
// 			'font-rubik text-[150px] text-[var(--color2)] text-center floating-title select-none';
// 		this.element.appendChild(heading);

// 		// Container for the main 2 buttons
// 		const mainButtonContainer = document.createElement('div');
// 		mainButtonContainer.className = 'flex gap-8 mt-8';
// 		this.element.appendChild(mainButtonContainer);

// 		// LOCAL Play button
// 		const localBtn = document.createElement('button');
// 		localBtn.textContent = 'LOCAL GAME';
// 		localBtn.className =
// 			'font-sigmar px-10 py-6 text-3xl font-bold rounded-lg border-4 ' +
// 			'text-[var(--color1)] border-[var(--color1)] bg-transparent ' +
// 			'hover:bg-[var(--color1)] hover:text-[var(--color3)] hover:border-[var(--color1)] ' +
// 			'transition-all duration-300 shadow-lg';
// 		localBtn.onclick = () => this.localLogic();

// 		mainButtonContainer.appendChild(localBtn);

// 		// REMOTE Play button
// 		const remoteBtn = document.createElement('button');
// 		remoteBtn.textContent = 'REMOTE GAME';
// 		remoteBtn.className =
// 			'font-sigmar px-10 py-6 text-3xl font-bold rounded-lg border-4 ' +
// 			'text-[var(--color1)] border-[var(--color1)] bg-transparent ' +
// 			'hover:bg-[var(--color1)] hover:text-[var(--color3)] hover:border-[var(--color1)] ' +
// 			'transition-all duration-300 shadow-lg';
// 		remoteBtn.onclick = () => this.remoteLogic();
// 		mainButtonContainer.appendChild(remoteBtn);

// 		// Load online players initially
// 		this.loadOnlinePlayers();

// 		// Refresh online players every 30 seconds
// 		setInterval(() => {
// 			this.loadOnlinePlayers();
// 		}, 30000);
// 	}

// 	private createOnlinePlayersBanner() {
// 		// Banner container
// 		const bannerContainer = document.createElement('div');
// 		bannerContainer.className = 
// 			'fixed bottom-0 left-0 w-full bg-[var(--color1)] bg-opacity-90 backdrop-blur-sm ' +
// 			'border-t-2 border-[var(--color2)] py-3 z-50 overflow-hidden';
		
// 		// Scrolling content wrapper
// 		const scrollWrapper = document.createElement('div');
// 		scrollWrapper.className = 'flex animate-scroll whitespace-nowrap';
		
// 		// Online players container
// 		this.onlinePlayersContainer = document.createElement('div');
// 		this.onlinePlayersContainer.className = 'flex items-center space-x-8 px-4';
		
// 		// Add title
// 		const title = document.createElement('span');
// 		title.textContent = '🟢 ONLINE PLAYERS:';
// 		title.className = 'font-sigmar text-[var(--color3)] text-lg font-bold mr-8';
// 		this.onlinePlayersContainer.appendChild(title);

// 		scrollWrapper.appendChild(this.onlinePlayersContainer);
// 		bannerContainer.appendChild(scrollWrapper);
		
// 		// Append to the body
// 		document.body.appendChild(bannerContainer);
		
// 		// Add custom CSS for scrolling animation
// 		this.addScrollingStyles();
		
// 		// Adjust main content to account for banner
// 		this.element.style.paddingBottom = '80px';
// 	}

// 	private addScrollingStyles() {
// 		const style = document.createElement('style');
// 		style.textContent = `
// 			@keyframes scroll {
// 				0% { transform: translateX(100%); }
// 				100% { transform: translateX(-100%); }
// 			}
			
// 			.animate-scroll {
// 				animation: scroll 30s linear infinite;
// 			}
			
// 			.animate-scroll:hover {
// 				animation-play-state: paused;
// 			}
// 		`;
// 		document.head.appendChild(style);
// 	}

// 	private async loadOnlinePlayers() {
// 		console.debug('🔍 Loading online players...');
		
// 		try {
// 			const token = sessionStorage.getItem('token');
// 			console.debug('🔑 Token found:', !!token);
			
// 			if (!token) {
// 				console.debug('❌ No token found, showing empty list');
// 				this.updateOnlinePlayersDisplay([]);
// 				return;
// 			}

// 			console.debug('🌐 Making API request to /api/users/online');
// 			const response = await fetch('/api/users/online', {
// 				method: 'GET',
// 				headers: {
// 					'Authorization': `Bearer ${token}`,
// 					'Content-Type': 'application/json',
// 				},
// 			});

// 			console.debug('📡 API Response status:', response.status);
// 			console.debug('📡 API Response ok:', response.ok);
// 			console.debug('📡 API Response headers:', Object.fromEntries(response.headers.entries()));

// 			if (response.ok) {
// 				const responseText = await response.text();
// 				console.debug('📄 Raw response text:', responseText.substring(0, 200) + '...');
				
// 				try {
// 					const onlineUsers = JSON.parse(responseText);
// 					console.debug('✅ Parsed online users:', onlineUsers);
// 					console.debug('👥 Number of online users:', onlineUsers.length);
// 					this.updateOnlinePlayersDisplay(onlineUsers);
// 				} catch (parseError) {
// 					console.error('❌ JSON Parse Error:', parseError);
// 					console.error('📄 Response text that failed to parse:', responseText);
// 					this.updateOnlinePlayersDisplay([]);
// 				}
// 			} else {
// 				console.error('❌ API request failed with status:', response.status);
// 				const errorText = await response.text();
// 				console.error('📄 Error response text:', errorText);
// 				this.updateOnlinePlayersDisplay([]);
// 			}
// 		} catch (error) {
// 			console.error('❌ Error fetching online users:', error);
// 			if (error instanceof TypeError && error.message.includes('fetch')) {
// 				console.error('🌐 Network error - check if the API server is running');
// 			}
// 			this.updateOnlinePlayersDisplay([]);
// 		}
// 	}

// 	private updateOnlinePlayersDisplay(users: any[]) {
// 		if (!this.onlinePlayersContainer) return;

// 		// Clear existing players (keep the title)
// 		const title = this.onlinePlayersContainer.querySelector('span');
// 		this.onlinePlayersContainer.innerHTML = '';
// 		if (title) {
// 			this.onlinePlayersContainer.appendChild(title);
// 		} else {
// 			// Recreate title if it doesn't exist
// 			const newTitle = document.createElement('span');
// 			newTitle.textContent = '🟢 ONLINE PLAYERS:';
// 			newTitle.className = 'font-sigmar text-[var(--color3)] text-lg font-bold mr-8';
// 			this.onlinePlayersContainer.appendChild(newTitle);
// 		}

// 		if (users.length === 0) {
// 			const noPlayers = document.createElement('span');
// 			noPlayers.textContent = 'No players online';
// 			noPlayers.className = 'font-sigmar text-[var(--color3)] text-base opacity-75';
// 			this.onlinePlayersContainer.appendChild(noPlayers);
// 			return;
// 		}

// 		// Add each online player
// 		users.forEach((user, index) => {
// 			if (!this.onlinePlayersContainer) return; // Additional null check
			
// 			const playerElement = document.createElement('span');
// 			playerElement.textContent = user.login;
// 			playerElement.className = 
// 				'font-sigmar text-[var(--color3)] text-base font-semibold ' +
// 				'px-3 py-1 bg-[var(--color2)] bg-opacity-20 rounded-full ' +
// 				'border border-[var(--color2)] border-opacity-50';
			
// 			this.onlinePlayersContainer.appendChild(playerElement);
			
// 			// Add separator dot (except for last item)
// 			if (index < users.length - 1 && this.onlinePlayersContainer) {
// 				const separator = document.createElement('span');
// 				separator.textContent = '•';
// 				separator.className = 'text-[var(--color2)] text-lg font-bold';
// 				this.onlinePlayersContainer.appendChild(separator);
// 			}
// 		});

// 		// Duplicate content for seamless scrolling
// 		if (this.onlinePlayersContainer && this.onlinePlayersContainer.parentElement) {
// 			const clone = this.onlinePlayersContainer.cloneNode(true) as HTMLElement;
// 			clone.className = 'flex items-center space-x-8 px-4 ml-8';
// 			this.onlinePlayersContainer.parentElement.appendChild(clone);
// 		}
// 	}

// 	private remoteLogic() {
// 		if (!isLoggedIn()) {
// 			alert('You must be logged-in to access the remote game');
// 			return;
// 		}
// 		new RemoteGameModal(this.element);
// 	}

// 	private localLogic() {
// 		new LocalGameModal(this.element);
// 	}
// }