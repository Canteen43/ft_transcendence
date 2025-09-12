import { ReadyButton } from '../misc/ReadyButton';
import { WaitingModal } from '../modals/WaitingModal';

// deprecated
export class WaitingModal1v1 extends WaitingModal {
	constructor(parent: HTMLElement) {
		super(parent);
		document.addEventListener('gameReady', () => this.enableReady());
	}

	public enableReady() {
		console.debug('gameReady received');
		this.box.removeChild(this.box.lastChild!);
		new ReadyButton(this.box);
	}
}
