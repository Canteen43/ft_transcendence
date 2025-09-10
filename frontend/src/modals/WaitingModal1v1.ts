import { StartButton } from '../misc/StartButton';
import { WaitingModal } from '../modals/WaitingModal';

export class WaitingModal1v1 extends WaitingModal {
	constructor(parent: HTMLElement) {
		super(parent);
		document.addEventListener('gameReady', () => this.enableStart());
	}

	public enableStart() {
		this.box.removeChild(this.box.lastChild!);
		new StartButton(this.box);
	}
}
