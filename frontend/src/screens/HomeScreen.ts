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
import { PlaceholderModal } from '../modals/PlaceholderModal';
import { Remote2PlayerModal } from '../modals/Remote2PlayerModal';
import { initParticles } from '../utils/particles';

export let gameOptions: GameOptions | null = null;

export class HomeScreen extends Screen {
	private particlesContainer: HTMLDivElement | null = null;

	constructor() {
		super();

		
		this.createUIElements();

		requestAnimationFrame(() => {
			void this.initParticlesAsync();
		});
	}

	private createParticlesContainer(homeScreen: HTMLDivElement) {
		this.particlesContainer = document.createElement('div');
		this.particlesContainer.id = "tsparticles";
		this.particlesContainer.style.position = 'absolute';
		this.particlesContainer.style.top = '0';
		this.particlesContainer.style.left = '0';
		this.particlesContainer.style.width = '100%';
		this.particlesContainer.style.height = '100%';
		this.particlesContainer.style.zIndex = '0';
		this.particlesContainer.style.pointerEvents = 'none'; // prevent blocking clicks
		homeScreen.insertBefore(this.particlesContainer, homeScreen.firstChild);
	}


private createUIElements() {

	const app = this.element;
	app.className = 'relative w-screen';

	
	////////////////////////////
	// LOGIN BUTTON
	////////////////////////////
	const authContainer = document.createElement('div');
	authContainer.className = 'fixed top-4 right-4 z-50';
	void new AuthComponent(authContainer);
	app.appendChild(authContainer);


	////////////////////////////
	// HOME ECRAN
	////////////////////////////
	const homeScreen = document.createElement('div');
	homeScreen.className = 'relative z-10 flex flex-col items-center justify-start h-screen select-none';
	this.createParticlesContainer(homeScreen);
	app.appendChild(homeScreen);

	const heading = document.createElement('h1');
	heading.textContent = 'TRANSCENDANCE';
	heading.className = 'font-rubik text-[100px] text-center mt-80  floating-title';
	heading.style.color = 'var(--pink-dark)'; 
	homeScreen.appendChild(heading);

	const playBtn = document.createElement('button');
	playBtn.textContent = 'PLAY';
	playBtn.className = 'font-sigmar mt-5 px-16 py-6 relative z-20 text-5xl font-bold rounded-lg border-4 border-pink-dark bg-pink-dark hover:bg-pink-light transition-all duration-300 shadow-lg';
	playBtn.style.color = 'var(--pink-dark)'; // text color
	homeScreen.appendChild(playBtn);


	////////////////////////////
	// OPTIONS
	////////////////////////////
	const optionsScreen = document.createElement('div');
	optionsScreen.className = 'relative z-10 flex flex-col items-center justify-start h-screen w-full bg-pink-600 select-none';
	app.appendChild(optionsScreen);

	// Title
	const optionsHeading = document.createElement('h2');
	optionsHeading.textContent = 'CHOOSE YOUR MODE';
	optionsHeading.className = 'text-4xl font-bold mt-12 mb-8 font-sigmar ';
	optionsHeading.style.color = 'var(--off-white)'; 
	optionsScreen.appendChild(optionsHeading);

	// Two big panels side by side
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-2 gap-12 w-4/5 max-w-5xl h-3/4';
	optionsScreen.appendChild(grid);

	// Left panel: LOCAL
	const localPanel = document.createElement('div');
	localPanel.className = 'flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg p-8 hover:scale-105 transition-transform cursor-pointer';
	const localTitle = document.createElement('h3');
	localTitle.textContent = 'LOCAL';
	localTitle.style.color = 'var(--pink-dark)'; 
	localTitle.className = 'text-3xl font-bold mb-6 text-pink-600 font-sigmar';
	localPanel.appendChild(localTitle);
	void new Button('1 player', () => {
		gameOptions = { type: 'local', playerCount: 1, thisPlayer: 1 };
		location.hash = '#game';
	}, localPanel);
	void new Button('2 players', () => {
		gameOptions = { type: 'local', playerCount: 2, thisPlayer: 1 };
		location.hash = '#game';
	}, localPanel);
	grid.appendChild(localPanel);

	// Right panel: REMOTE
	const remotePanel = document.createElement('div');
	remotePanel.className = 'font-sigmar flex flex-col items-center justify-center bg-white rounded-2xl shadow-lg p-8 hover:scale-105 transition-transform cursor-pointer';
	const remoteTitle = document.createElement('h3');
	remoteTitle.textContent = 'REMOTE';
	remoteTitle.style.color = 'var(--pink-dark)'; 
	remoteTitle.className = 'text-3xl font-bold mb-6 text-pink-600';
	remotePanel.appendChild(remoteTitle);
	void new Button('2 players', () => {
		void new Remote2PlayerModal(this.element);
	}, remotePanel);
	void new Button('Tournament', () => {
		void new PlaceholderModal(this.element);
	}, remotePanel);
	grid.appendChild(remotePanel);



	////////////////////////////
	// Slide logic
	////////////////////////////
	playBtn.addEventListener('click', () => {
		window.scrollTo({
			top: window.innerHeight, // scroll exactly one viewport
			behavior: 'smooth',
		});
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
		if (this.particlesContainer) {
			this.particlesContainer.remove();
		}
		super.destroy?.();
	}
}