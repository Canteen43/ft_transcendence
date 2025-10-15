import { Button } from '../buttons/Button';
import { Modal } from '../modals/Modal';
import { state } from '../utils/State';

export class TextModal extends Modal {
	private okayButton: Button;

	constructor(
		parent: HTMLElement,
		notification?: string,
		buttonText?: string,
		onClick?: () => void,
		low?: boolean
	) {
		super(parent);

		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;

		this.overlay.classList.remove('z-20');
		this.overlay.classList.add('z-30');

		console.debug('TextModal called');
		if (notification) {
			const textElmt = document.createElement('p');
			textElmt.textContent = notification;
			textElmt.className =
				'text-center text-sm sm:text-base  text-[var(--color3)]';
			this.box.appendChild(textElmt);
		}

		if (low) {
			this.overlay.className =
				'fixed inset-0 flex items-center justify-end flex-col pb-[25vh] bg-black/40 z-20';
		}

		this.okayButton = new Button(
			buttonText ?? 'Okay',
			() => {
				onClick?.();
				this.destroy();
			},
			this.box
		);

		this.okayButton.element.focus();

	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		super.destroy();
	}
}
