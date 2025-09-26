import { Button } from '../buttons/Button';
import { Modal } from './Modal';

export class LeaveGameConfirmationModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		const leaveButton = new Button(
			'Leave',
			() => {
				location.hash = '#home';
				this.destroy();
			},
			this.box
		);

		leaveButton.element.focus();
	}
}
