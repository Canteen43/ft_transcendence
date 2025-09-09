import { Modal } from '../components/Modal';
import { StartButton } from '../misc/StartButton';

export class WaitingModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'gap-2', 'p-4');

		const message = document.createElement('p');
		message.textContent = 'Waiting for other player(s) ...';
		this.box.appendChild(message);
		new StartButton(this.box);
	}
}