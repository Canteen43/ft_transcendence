import { StartButton } from '../misc/StartButton';
import { WaitingModal } from '../modals/WaitingModal';

export class WaitingModal1v1 extends WaitingModal {
	constructor(parent: HTMLElement) {
		super(parent);

		const message = document.createElement('p');
		message.textContent = 'Waiting for other player...';
		this.box.appendChild(message);
	}

	public enableStart() {
		this.box.removeChild(this.box.lastChild!);
		new StartButton(this.box);
	}
}
