import { Screen } from '../components/Screen';
import { RemoteGameModal} from '../modals/RemoteGameModal';
import { LocalGameModal} from '../modals/LocalGameModal';
import { initParticles } from '../misc/Particles';
import { isLoggedIn } from '../misc/AuthComponent';

export class HomeScreen extends Screen {
	private particlesContainer: HTMLDivElement | null = null;

	constructor() {
		super();

		// Create particles background
		this.createParticlesBackground();
		requestAnimationFrame(() => {void this.initParticlesAsync();});

		this.element.className =
			'flex flex-col items-center justify-center min-h-screen bg-transparent p-4 space-y-6';

		// Main title
		const heading = document.createElement('h1');
		heading.textContent = 'TRANSCENDANCE';
		heading.className = 'font-rubik text-[100px] text-[var(--color1)] text-center floating-title select-none';
		this.element.appendChild(heading);

		// Container for the main 2 buttons
		const mainButtonContainer = document.createElement('div');
		mainButtonContainer.className = 'flex gap-8 mt-8';
		this.element.appendChild(mainButtonContainer);

		// LOCAL Play button
		const localBtn = document.createElement('button');
		localBtn.textContent = 'LOCAL GAME';
		localBtn.className = 'font-sigmar px-16 py-6 text-5xl text-[var(--color1)] font-bold rounded-lg border-4 border-[var(--color1)] hover:text-[var(--color1bis)]  hover:border-[var(--color1bis)] transition-all duration-300 shadow-lg';
		localBtn.onclick = () => new LocalGameModal(this.element);
		mainButtonContainer.appendChild(localBtn);

		// REMOTE Play button 
		const remoteBtn = document.createElement('button');
		remoteBtn.textContent = 'REMOTE GAME';
		remoteBtn.className = 'font-sigmar px-16 py-6 text-5xl text-[var(--color1)] font-bold rounded-lg border-4 border-[var(--color1)] hover:text-[var(--color1bis)] hover:border-[var(--color1bis)] transition-all duration-300 shadow-lg';
		remoteBtn.onclick = () => this.remoteLogic();
		mainButtonContainer.appendChild(remoteBtn);
	}

	private remoteLogic() {
		if (!isLoggedIn()) {
			alert("You must be logged-in to access the remote game");
			return;
		}
		new RemoteGameModal(this.element);
	}

	private createParticlesBackground() {
		this.particlesContainer = document.createElement('div');
		this.particlesContainer.id = "tsparticles";

		Object.assign(this.particlesContainer.style, {
			position: 'fixed',
			top: '0',
			left: '0',
			width: '100vw',
			height: '100vh',
			zIndex: '-10', 
			pointerEvents: 'none'
		});

		this.element.appendChild(this.particlesContainer);
	}

	private async initParticlesAsync() {
		try {
			await initParticles();
		} catch (error) {
			console.error('Failed to initialize particles:', error);
		}
	}

	destroy() {
		this.particlesContainer?.remove();
		super.destroy?.();
	}
}