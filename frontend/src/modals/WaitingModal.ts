import { jelly, newtonsCradle } from 'ldrs';
import { Modal } from '../components/Modal';
import { ReadyModal } from '../modals/ReadyModal';

newtonsCradle.register();
jelly.register();


// Waiting for players, event listener for game Ready
export class WaitingModal extends Modal {
	private gameReadyHandler = () => {
		this.nextStep();
	};

	constructor(parent: HTMLElement) {
		super(parent);
		this.printMessage();
		this.printLoader();
		document.addEventListener('gameReady', this.gameReadyHandler);
	}

	destroy() {
		document.removeEventListener('gameReady', this.gameReadyHandler);
		super.destroy();
	}

	private async printMessage() {
		const message = document.createElement('p');
		message.textContent = 'Waiting for other player(s)...';
		message.className =
			'font-sigmar text-3xl font-bold text-center mb-12 text-[var(--color1)]';
		this.box.appendChild(message);
	}

	private async printLoader() {
		this.box.classList.add(
			'flex',
			'flex-col',
			'items-center',
			'justify-center',
			'gap-2',
			'p-4'
		);
		const loader = document.createElement('l-jelly');
		loader.setAttribute('size', '80');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color1)');
		this.box.appendChild(loader);
	}

	private async nextStep() {

		if (sessionStorage.getItem('tournament') == '1') {
			location.hash = '#tournament';
			this.destroy();
		} else {
			new ReadyModal(this.parent);
			this.destroy();
		}
	}
}
