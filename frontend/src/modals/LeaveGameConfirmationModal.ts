import { Button } from '../buttons/Button';
import { Modal } from './Modal';

export class LeaveGameConfirmationModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		// Text
		const message = document.createElement('p');
		message.textContent =
			'This will quit the game. Are you sure you want to leave?';
		message.className = 'text-xl font-semibold text-center mb-4';
		this.box.appendChild(message);

		// Buttons container
		const buttons = document.createElement('div');
		buttons.className = 'flex gap-6 mt-4';
		this.box.appendChild(buttons);

		// Stay button
		new Button(
			'Stay',
			() => {
				this.destroy();
			},
			buttons
		);

		// Leave button
		new Button(
			'Leave',
			() => {
				location.hash = '#home';
				this.destroy();
			},
			buttons
		);
	}
}
