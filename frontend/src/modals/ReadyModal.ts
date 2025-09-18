import { MESSAGE_QUIT } from '../../../shared/constants';
import { ReadyButton } from '../buttons/ReadyButton';
import { webSocket } from '../utils/WebSocketWrapper';
import { Modal } from './Modal';

export class ReadyModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		new ReadyButton(this.box);
	}

	public quit() {
		console.info('ReadyModal: quit. Sending WS:MESSAGE_QUIT.');
		webSocket.send({ t: MESSAGE_QUIT });
		super.quit();
	}
}
