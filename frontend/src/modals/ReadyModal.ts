import { ReadyButton } from '../buttons/ReadyButton';
import { Modal } from './Modal';

export class ReadyModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		new ReadyButton(this.box);
	}
}
