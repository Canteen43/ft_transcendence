import { Modal } from '../components/Modal';
import { ReadyButton } from '../misc/ReadyButton';

export class ReadyModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);
		this.box.classList.add(
			'flex',
			'flex-col',
			'items-center',
			'justify-center',
			'gap-2',
			'p-4'
		);
		new ReadyButton(this.box);

	}
}
