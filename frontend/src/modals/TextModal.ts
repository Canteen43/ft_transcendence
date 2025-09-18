import { Button } from '../buttons/Button';
import { Modal } from '../modals/Modal';

export class TextModal extends Modal {
	private notification: string;
	private textEl: HTMLParagraphElement;

	constructor(parent: HTMLElement, notification: string) {
		super(parent);

		this.notification = notification;

		// Create text element
		this.textEl = document.createElement('p');
		this.textEl.textContent = this.notification;
		this.textEl.className = 'text-center text-lg text-gray-800';
		this.box.appendChild(this.textEl);

		// Create OK button using a class method
		void new Button('Okay', this.onClick.bind(this), this.box);
	}

	private onClick(): void {
		this.destroy();
	}
}
