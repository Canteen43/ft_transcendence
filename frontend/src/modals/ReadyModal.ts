import { MESSAGE_QUIT } from '../../../shared/constants';
import { ReadyButton } from '../buttons/ReadyButton';
import { webSocket } from '../utils/WebSocketWrapper';
import { Modal } from './Modal';

export class ReadyModal extends Modal {

	constructor(parent: HTMLElement) {
		super(parent);
		this.box.classList.add('ready-modal'); // for removal of the modal on Quit
		
		const readyButton = new ReadyButton(this.box);
		readyButton.element.focus();
	}

	public quit(): void {
		console.info('ReadyModal: quit. Sending WS:MESSAGE_QUIT.');
		webSocket.send({ t: MESSAGE_QUIT });
		super.quit();
	}
}
