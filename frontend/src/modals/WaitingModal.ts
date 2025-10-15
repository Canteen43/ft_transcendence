import { hourglass, jelly, newtonsCradle } from 'ldrs';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';
import { Modal } from './Modal';
import { ReadyModal } from './ReadyModal';
import { TextModal } from './TextModal';

newtonsCradle.register();
jelly.register();
hourglass.register();

// Waiting for players, eventListener for game Ready
export class WaitingModal extends Modal {
	private gameReadyHandler = () => this.nextStep();

	constructor(parent: HTMLElement) {
		super(parent);
		if (state.currentModal) {
			state.currentModal.destroy();
		}

		document.addEventListener('2plyrsGameReady', this.gameReadyHandler);
		this.printMessageLoader();
		state.currentModal = this;
	}

	private async nextStep(): Promise<void> {
		const readyModal = new ReadyModal(this.parent);

		this.destroy();
	}

	public async quit(): Promise<void> {
		const { error } = await apiCall('POST', `/tournaments/leave`);
		if (error) {
			console.error('Error leaving tournament:', error);
			new TextModal(
				this.parent,
				`Failed to leave tournament: ${error.message}`
			);
		}
		this.destroy();
	}

	private async printMessageLoader(): Promise<void> {
		const container = document.createElement('div');
		container.className = 'flex flex-col items-center';

		const message = document.createElement('p');
		message.textContent = 'Waiting for other player(s)...';
		message.className =
			"font-outfit [font-variation-settings:'wght'_900] text-3xl font-bold text-center mb-5 text-[var(--color3)]";
		container.appendChild(message);

		const loader = document.createElement('l-jelly');
		loader.setAttribute('size', '60');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color3)');
		container.appendChild(loader);

		this.box.appendChild(container);
	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		document.removeEventListener('2plyrsGameReady', this.gameReadyHandler);
		super.destroy();
	}
}
