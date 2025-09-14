import { jelly, newtonsCradle } from 'ldrs';
import { Modal } from '../components/Modal';
import { AliasModal } from './AliasModal';


newtonsCradle.register();
jelly.register();


// Waiting for players, event listener for game Ready
export class WaitingModal extends Modal {
	
	constructor(parent: HTMLElement) {
		super(parent);
		this.printMessage();
		this.printLoader();
		document.addEventListener('gameReady', () => this.nextStep());
	}

	destroy() {
		document.removeEventListener('gameReady', () => this.nextStep());
		super.destroy();
	}

	private async printMessage() {
		const message = document.createElement('p');
		message.textContent = 'Waiting for other player(s)...';
		message.className =
			'font-sigmar text-3xl font-bold text-center mb-12 text-[var(--color3)]';
		this.box.appendChild(message);
	}

	private async printLoader() {
		const loader = document.createElement('l-jelly');
		loader.setAttribute('size', '80');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color3)');
		this.box.appendChild(loader);
	}

	private async nextStep() {
		new AliasModal(this.parent, 1);
	}
}
