import { jelly, newtonsCradle, hourglass } from 'ldrs';
import { apiCall } from '../utils/apiCall';
import { AliasModal } from './AliasModal';
import { Modal } from './Modal';
import { ReadyModal } from './ReadyModal';

newtonsCradle.register();
jelly.register();
hourglass.register();

// Waiting for players, event listener for game Ready
export class WaitingModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		this.printMessageLoader();
		document.addEventListener('gameReady', () => this.nextStep());
	}

	public quit() {
		apiCall('POST', `/tournaments/leave`);
		document.removeEventListener('gameReady', () => this.nextStep());
		super.quit();
	}

	public destroy() {
		document.removeEventListener('gameReady', () => this.nextStep());
		super.destroy();
	}

	private async printMessageLoader() {
		const container = document.createElement('div');
		container.className = 'flex flex-col items-center';

		const message = document.createElement('p');
		message.textContent = 'Waiting for other player(s)...';
		message.className =
			'font-sigmar text-3xl font-bold text-center mb-5 text-[var(--color3)]';
		container.appendChild(message);

		const loader = document.createElement('l-jelly');
		loader.setAttribute('size', '60');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color3)');
		container.appendChild(loader);

		this.box.appendChild(container);
	}

	private async nextStep() {
		new ReadyModal(this.parent);
		this.destroy();
	}
}
