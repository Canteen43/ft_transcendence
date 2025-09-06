// import { Button } from '../components/Button';
// import { Screen } from '../components/Screen';
// import type { GameOptions } from '../misc/GameOptions';
// import { LoginButton } from '../misc/LoginButton';
// import { webSocket } from '../misc/WebSocketWrapper';
// import { PlaceholderModal } from '../modals/PlaceholderModal';
// import { Remote2PlayerModal } from '../modals/Remote2PlayerModal';

// // Import the FIXED particles utility
// import { initParticles } from '../utils/particles';

// export let gameOptions: GameOptions | null = null;

// export class HomeScreen extends Screen {
// 	private particlesContainer: HTMLDivElement | null = null;

// 	constructor() {
// 		super();

// 		console.log("🚀 Creating HomeScreen with modern particles setup");

// 		// // Root layout with dark background
// 		// this.element.className =
// 		// 	'flex flex-col min-h-screen bg-gray-900 text-white relative overflow-hidden';

// 		// // Ensure proper positioning for particles
// 		// this.element.style.position = 'relative';
// 		// this.element.style.width = '100%';
// 		// this.element.style.height = '100vh';

// 		// Create particles container first
// 		this.createParticlesContainer();

// 		// // Create UI elements
// 		// this.createUIElements();

// 		// Initialize particles after DOM is ready
// 		requestAnimationFrame(() => {
// 			console.log("🎨 Initializing particles...");
// 			this.initParticlesAsync();
// 		});
// 	}

// 	private createParticlesContainer() {
// 		this.particlesContainer = document.createElement('div');
// 		this.particlesContainer.id = "tsparticles";

// 		// Essential styling for particles container - LOWER z-index
// 		this.particlesContainer.style.position = 'absolute';
// 		this.particlesContainer.style.top = '0';
// 		this.particlesContainer.style.left = '0';
// 		this.particlesContainer.style.width = '100%';
// 		this.particlesContainer.style.height = '100%';
// 		this.particlesContainer.style.zIndex = '0'; // Lower than UI elements
// 		this.particlesContainer.style.pointerEvents = 'auto';

// 		// Ensure it's the first child (behind everything else)
// 		this.element.insertBefore(this.particlesContainer, this.element.firstChild);

// 		console.log("✨ Particles container created");
// 	}

// 	private createUIElements() {
// 		// Login button - top right with high z-index
// 		const loginContainer = document.createElement('div');
// 		loginContainer.className = 'absolute top-4 right-4 z-50';
// 		void new LoginButton(loginContainer);
// 		this.element.appendChild(loginContainer);

// 		// // Main content wrapper with high z-index
// 		// const contentWrapper = document.createElement('div');
// 		// contentWrapper.className = 'relative z-10 flex flex-col items-center justify-center flex-1';

// 		// // Title
// 		// const heading = document.createElement('h1');
// 		// heading.textContent = 'TRANSCENDANCE';
// 		// heading.className = 'text-6xl font-extrabold text-center font-ps2p mb-12 select-none';
// 		// heading.style.textShadow = `2px 2px 0px #ff4da6, -2px 2px 0px #ff4da6, 2px -2px 0px #ff4da6, -2px -2px 0px #ff4da6`;
// 		// contentWrapper.appendChild(heading);

// 		// // Buttons grid
// 		// const grid = document.createElement('div');
// 		// grid.className = 'grid grid-cols-2 gap-6 justify-center items-start max-w-3xl mx-auto';

// 		// // Local game column
// 		// const localCol = document.createElement('div');
// 		// localCol.className = 'flex flex-col space-y-3';
// 		// localCol.appendChild(this.makeSectionTitle('Local Game'));

// 		// void new Button('1 player', () => {
// 		// 	gameOptions = { type: 'local', playerCount: 1, thisPlayer: 1 };
// 		// 	location.hash = '#game';
// 		// }, localCol);
// 		// void new Button('2 players', () => {
// 		// 	gameOptions = { type: 'local', playerCount: 2, thisPlayer: 1 };
// 		// 	location.hash = '#game';
// 		// }, localCol);
// 		// void new Button('3 players', () => {
// 		// 	gameOptions = { type: 'local', playerCount: 3, thisPlayer: 1 };
// 		// 	location.hash = '#game';
// 		// }, localCol);
// 		// void new Button('4 players', () => {
// 		// 	gameOptions = { type: 'local', playerCount: 4, thisPlayer: 1 };
// 		// 	location.hash = '#game';
// 		// }, localCol);

// 		// // Remote game column
// 		// const remoteCol = document.createElement('div');
// 		// remoteCol.className = 'flex flex-col space-y-3';
// 		// remoteCol.appendChild(this.makeSectionTitle('Remote Game'));

// 		// void new Button('Tournament', () => {
// 		// 	void new PlaceholderModal(this.element);
// 		// }, remoteCol);
// 		// void new Button('2 players', () => {
// 		// 	void new Remote2PlayerModal(this.element);
// 		// }, remoteCol);
// 		// void new Button('3 players', () => {
// 		// 	void new PlaceholderModal(this.element);
// 		// }, remoteCol);
// 		// void new Button('4 players', () => {
// 		// 	void new PlaceholderModal(this.element);
// 		// }, remoteCol);

// 		// grid.appendChild(localCol);
// 		// grid.appendChild(remoteCol);
// 		// contentWrapper.appendChild(grid);
// 		// this.element.appendChild(contentWrapper);
// 	}

// 	// private makeSectionTitle(title: string): HTMLElement {
// 	// 	const h = document.createElement('h2');
// 	// 	h.textContent = title;
// 	// 	h.className = 'text-2xl font-bold mb-2 text-pink-400';
// 	// 	return h;
// 	// }

// 	private async initParticlesAsync() {
// 		try {
// 			console.log('🎯 Starting particles initialization...');
// 			await initParticles();
// 			console.log('✅ Particles initialized successfully');

// 		} catch (error) {
// 			console.error('❌ Failed to initialize particles:', error);
// 		}
// 	}

// 	destroy() {
// 		// Clean up particles if needed
// 		if (this.particlesContainer) {
// 			this.particlesContainer.remove();
// 		}
// 		super.destroy?.();
// 		console.log('🧽 HomeScreen destroyed');
// 	}
// }



import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { GameOptions } from '../misc/GameOptions';
import { AuthComponent } from '../misc/AuthComponent';
import { Remote2PlayerModal, Remote3PlayerModal, Remote4PlayerModal } from '../modals/RemotePlayerModal';
import { initParticles } from '../utils/particles';

export let gameOptions: GameOptions | null = null;

export class HomeScreen extends Screen {
	private particlesContainer: HTMLDivElement | null = null;

	constructor() {
		super();
		this.setupAppContainer();
		this.createAuthComponent();
		this.createHomeSection();
		this.createOptionsSection();
		requestAnimationFrame(() => {void this.initParticlesAsync();});
	}

	// Hide scrollbar but allow scrolling : not working
	private setupAppContainer() {
		this.element.className = 'relative w-screen overflow-x-hidden scrollbar-hide';
		this.element.style.scrollBehavior = 'smooth';
	}

	////////////////////////////
	// LOGIN BUTTON
	private createAuthComponent() {
		const authContainer = this.createElement('div', 'fixed top-4 right-4 z-50');
		new AuthComponent(authContainer);
		this.element.appendChild(authContainer);
	}

	////////////////////////////
	// HOME ECRAN
	private createHomeSection() {
		const homeScreen = this.createElement('div', 
			'relative z-10 flex flex-col items-center justify-center h-screen select-none'
		);
		
		this.createParticlesContainer(homeScreen);
		
		// Title
		const heading = this.createElement('h1', 'font-rubik text-[100px] text-center floating-title');
		heading.textContent = 'TRANSCENDANCE';
		heading.style.color = 'var(--pink-dark)';
		homeScreen.appendChild(heading);

		// Play button
		const playBtn = this.createElement('button', 
			'font-sigmar mt-8 px-16 py-6 text-5xl font-bold rounded-lg border-4 border-pink-dark bg-pink-dark hover:bg-pink-light transition-all duration-300 shadow-lg'
		);
		playBtn.textContent = 'PLAY';
		playBtn.style.color = 'var(--pink-dark)';
		playBtn.onclick = () => this.scrollToOptions();
		homeScreen.appendChild(playBtn);

		this.element.appendChild(homeScreen);
	}


	////////////////////////////
	// PLAY OPTIONS
	private createOptionsSection() {
		const optionsScreen = this.createElement('div', 
			'relative z-10 flex flex-col items-center justify-start h-screen w-full bg-pink-600 select-none'
		);

		// Title
		const heading = this.createElement('h2', 'text-4xl font-bold mt-12 mb-8 font-sigmar');
		heading.textContent = 'CHOOSE YOUR MODE';
		heading.style.color = 'var(--off-white)';
		optionsScreen.appendChild(heading);

		// Game modes grid
		const grid = this.createElement('div', 'grid grid-cols-2 gap-12 w-4/5 max-w-5xl h-3/4');
		
		grid.appendChild(this.createLocalPanel());
		grid.appendChild(this.createRemotePanel());
		
		optionsScreen.appendChild(grid);
		this.element.appendChild(optionsScreen);
	}

	////////////////////////////
	// PLAY LOCAL
	private createLocalPanel(): HTMLElement {
		const panel = this.createElement('div', 
			'flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg p-8 hover:scale-105 transition-transform'
		);
		
		const title = this.createElement('h3', 'text-3xl font-bold mb-6 font-sigmar');
		title.textContent = 'LOCAL';
		title.style.color = 'var(--pink-dark)';
		panel.appendChild(title);

		// Local game buttons
		this.createGameButton('1 player', { type: 'local', playerCount: 1, thisPlayer: 1 }, panel);
		this.createGameButton('2 players', { type: 'local', playerCount: 2, thisPlayer: 1 }, panel);

		return panel;
	}

	////////////////////////////
	// PLAY REMOTE
	private createRemotePanel(): HTMLElement {
		const panel = this.createElement('div', 
			'font-sigmar flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg p-8 hover:scale-105 transition-transform'
		);
		
		const title = this.createElement('h3', 'text-3xl font-bold mb-6');
		title.textContent = 'REMOTE';
		title.style.color = 'var(--pink-dark)';
		panel.appendChild(title);

		// Remote game buttons
		new Button('2 players', () => new Remote2PlayerModal(this.element), panel);
		new Button('3 players', () => new Remote3PlayerModal(this.element), panel);
		new Button('4 players', () => new Remote4PlayerModal(this.element), panel);
		new Button('Tournament', () => new PlaceholderModal(this.element), panel);

		return panel;
	}

	private createGameButton(text: string, options: GameOptions, parent: HTMLElement) {
		new Button(text, () => {
			gameOptions = options;
			location.hash = '#game';
		}, parent);
	}


	private createParticlesContainer(parent: HTMLElement) {
		this.particlesContainer = this.createElement('div', '');
		this.particlesContainer.id = "tsparticles";
		
		// Optimized particles styling
		Object.assign(this.particlesContainer.style, {
			position: 'absolute',
			top: '0',
			left: '0',
			width: '100%',
			height: '100%',
			zIndex: '0',
			pointerEvents: 'none'
		});

		parent.insertBefore(this.particlesContainer, parent.firstChild);
	}

	private createElement(tag: string, className: string): HTMLElement {
		const element = document.createElement(tag);
		element.className = className;
		return element;
	}

	private scrollToOptions() {
		window.scrollTo({
			top: window.innerHeight,
			behavior: 'smooth',
		});
	}

	private async initParticlesAsync() {
		try {
			await initParticles();
		} catch (error) {
			console.error('❌ Failed to initialize particles:', error);
		}
	}

	destroy() {
		this.particlesContainer?.remove();
		super.destroy?.();
	}
}