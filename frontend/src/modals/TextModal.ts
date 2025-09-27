import { Button } from '../buttons/Button';
import { Modal } from '../modals/Modal';

export class TextModal extends Modal {
	private okayButton: Button;

	constructor(
		parent: HTMLElement,
		notification?: string,
		buttonText?: string,
		onClick?: () => void
	) {
		super(parent);

		this.overlay.classList.remove('z-20');
		this.overlay.classList.add('z-30');

		console.debug('TextModal called');
		if (notification) {
			const textElmt = document.createElement('p');
			textElmt.textContent = notification;
			textElmt.className = 'text-center text-lg text-[var(--color3)]';
			this.box.appendChild(textElmt);
		}

		this.okayButton = new Button(
			buttonText ?? 'Okay',
			() => {
				onClick?.(); // action when button is clicked
				this.destroy(); // always close modal after click
			},
			this.box
		);

		this.okayButton.element.focus();
	}

	public destroy(): void {
		super.destroy(); // remove modal from DOM
	}

	// optional callback fired when the modal closes
	public onClose?: () => void;
}
