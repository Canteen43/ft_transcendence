import { Button } from '../buttons/Button';
import { Modal } from '../modals/Modal';

export class TextModal extends Modal {
	private notification: string;
	private textEl?: HTMLParagraphElement;
	private okayButton: Button;

	constructor(
		parent: HTMLElement, 
		notification: string, 
		buttonText: string = 'Okay',
		options?: {
			useGameStyling?: boolean;
			textClassName?: string;
		}
	) {
		super(parent);

		this.notification = notification;

		// Apply game-specific styling if requested (similar to NextRoundModal/ReplayModal)
		if (options?.useGameStyling) {
			// Remove the overlay background and override positioning for replay modal
			this.overlay.className = this.overlay.className
				.replace('bg-black/50', 'bg-transparent')
				.replace('items-center', 'items-center mt-80');

			// Reduce padding and gap within the modal box
			this.box.className = this.box.className
				.replace('p-10', 'p-6')
				.replace('gap-4', 'gap-2');
		}

		// Create text element only if message is not empty
		if (this.notification && this.notification.trim()) {
			this.textEl = document.createElement('p');
			this.textEl.textContent = this.notification;
			this.textEl.className = options?.textClassName || 'text-center text-lg text-[var(--color3)]';
			this.box.appendChild(this.textEl);
		}

		// Create OK button using a class method
		this.okayButton = new Button(buttonText, this.onClick.bind(this), this.box);
		// Focus the button so that enter works
		this.okayButton.element.focus();
	}

	private onClick(): void {
		this.destroy();
		// call external callback if provided
		if (this.onClose) this.onClose();
	}

	// optional callback fired when the modal closes
	public onClose?: () => void;
}
