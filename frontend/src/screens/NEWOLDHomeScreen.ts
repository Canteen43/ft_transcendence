import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { GameOptions } from '../misc/GameOptions';
import { LoginButton } from '../misc/AuthComponent';
import { webSocket } from '../misc/WebSocketWrapper';
import { PlaceholderModal } from '../modals/PlaceholderModal';
import { Remote2PlayerModal } from '../modals/Remote2PlayerModal';

// Import the FIXED particles utility
import { initParticles } from '../utils/particles';

export let gameOptions: GameOptions | null = null;

export class HomeScreen extends Screen {
	private particlesContainer: HTMLDivElement | null = null;

	constructor() {
		super();

		console.log("🚀 Creating HomeScreen with modern particles setup");

		// Root layout with dark background
		this.element.className =
			'flex flex-col min-h-screen bg-gray-900 text-white relative overflow-hidden';
		
		// Ensure proper positioning for particles
		this.element.style.position = 'relative';
		this.element.style.width = '100%';
		this.element.style.height = '100vh';

		// Create particles container first
		this.createParticlesContainer();

		// Create UI elements
		this.createUIElements();

		// Initialize particles after DOM is ready
		requestAnimationFrame(() => {
			console.log("🎨 Initializing particles...");
			this.initParticlesAsync();
		});
	}

	private createParticlesContainer() {
		this.particlesContainer = document.createElement('div');
		this.particlesContainer.id = "tsparticles";
		
		// Essential styling for particles container - LOWER z-index
		this.particlesContainer.style.position = 'absolute';
		this.particlesContainer.style.top = '0';
		this.particlesContainer.style.left = '0';
		this.particlesContainer.style.width = '100%';
		this.particlesContainer.style.height = '100%';
		this.particlesContainer.style.zIndex = '0'; // Lower than UI elements
		this.particlesContainer.style.pointerEvents = 'auto';
		
		// Ensure it's the first child (behind everything else)
		this.element.insertBefore(this.particlesContainer, this.element.firstChild);
		
		console.log("✨ Particles container created");
	}

	private createUIElements() {
		// Login button - top right with high z-index
		const loginContainer = document.createElement('div');
		loginContainer.className = 'absolute top-4 right-4 z-50';
		void new LoginButton(loginContainer);
		this.element.appendChild(loginContainer);

		// Main content wrapper with high z-index
		const contentWrapper = document.createElement('div');
		contentWrapper.className = 'relative z-10 flex flex-col items-center justify-center flex-1';
		
		// Title
		const heading = document.createElement('h1');
		heading.textContent = 'TRANSCENDANCE';
		heading.className = 'text-6xl font-extrabold text-center font-ps2p mb-12 select-none';
		heading.style.textShadow = `2px 2px 0px #ff4da6, -2px 2px 0px #ff4da6, 2px -2px 0px #ff4da6, -2px -2px 0px #ff4da6`;
		contentWrapper.appendChild(heading);

		// Buttons grid
		const grid = document.createElement('div');
		grid.className = 'grid grid-cols-2 gap-6 justify-center items-start max-w-3xl mx-auto';

		// Local game column
		const localCol = document.createElement('div');
		localCol.className = 'flex flex-col space-y-3';
		localCol.appendChild(this.makeSectionTitle('Local Game'));
		
		void new Button('1 player', () => {
			gameOptions = { type: 'local', playerCount: 1, thisPlayer: 1 };
			location.hash = '#game';
		}, localCol);
		void new Button('2 players', () => {
			gameOptions = { type: 'local', playerCount: 2, thisPlayer: 1 };
			location.hash = '#game';
		}, localCol);
		void new Button('3 players', () => {
			gameOptions = { type: 'local', playerCount: 3, thisPlayer: 1 };
			location.hash = '#game';
		}, localCol);
		void new Button('4 players', () => {
			gameOptions = { type: 'local', playerCount: 4, thisPlayer: 1 };
			location.hash = '#game';
		}, localCol);

		// Remote game column
		const remoteCol = document.createElement('div');
		remoteCol.className = 'flex flex-col space-y-3';
		remoteCol.appendChild(this.makeSectionTitle('Remote Game'));
		
		void new Button('Tournament', () => {
			void new PlaceholderModal(this.element);
		}, remoteCol);
		void new Button('2 players', () => {
			void new Remote2PlayerModal(this.element);
		}, remoteCol);
		void new Button('3 players', () => {
			void new PlaceholderModal(this.element);
		}, remoteCol);
		void new Button('4 players', () => {
			void new PlaceholderModal(this.element);
		}, remoteCol);

		grid.appendChild(localCol);
		grid.appendChild(remoteCol);
		contentWrapper.appendChild(grid);
		this.element.appendChild(contentWrapper);
	}

	private makeSectionTitle(title: string): HTMLElement {
		const h = document.createElement('h2');
		h.textContent = title;
		h.className = 'text-2xl font-bold mb-2 text-pink-400';
		return h;
	}

	private async initParticlesAsync() {
		try {
			console.log('🎯 Starting particles initialization...');
			await initParticles();
			console.log('✅ Particles initialized successfully');
			
		} catch (error) {
			console.error('❌ Failed to initialize particles:', error);
		}
	}

	destroy() {
		// Clean up particles if needed
		if (this.particlesContainer) {
			this.particlesContainer.remove();
		}
		super.destroy?.();
		console.log('🧽 HomeScreen destroyed');
	}
}