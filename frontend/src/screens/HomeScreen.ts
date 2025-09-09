import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import type { GameOptions } from '../misc/GameOptions';
import { AuthComponent } from '../misc/AuthComponent';
import { Remote2PlayerModal} from '../modals/Remote2PlayerModal';
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
		const heading = this.createElement('h1', 'font-rubik text-[100px] text-[var(--color1)] text-center floating-title');
		heading.textContent = 'TRANSCENDANCE';
		homeScreen.appendChild(heading);

		// Play button
		const playBtn = this.createElement('button', 
			'z-10 font-sigmar mt-8 px-16 py-6 text-5xl text-[var(--color1)] font-bold rounded-lg border-4 border-[var(--color1)]  hover:bg-[var(--color3)] transition-all duration-300 shadow-lg'
		);
		playBtn.textContent = 'PLAY';
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
			'font-sigmar flex flex-col items-center justify-center bg-[var(--color1)] rounded-2xl shadow-lg p-8 hover:scale-105 transition-transform'
		);
		
		const title = this.createElement('h3', 'text-3xl text-[var(--color2)] font-bold mb-6');
		title.textContent = 'REMOTE';
		panel.appendChild(title);

		// Remote game buttons
		new Button('2 players', () => new Remote2PlayerModal(this.element), panel);
		new Button('Tournament', () => new Remote2PlayerModal(this.element), panel);


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