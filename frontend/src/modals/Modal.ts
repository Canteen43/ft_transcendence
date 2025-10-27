import { createFocusTrap, FocusTrap } from 'focus-trap';

export class Modal {
	protected parent: HTMLElement;
	protected overlay: HTMLDivElement;
	protected box: HTMLDivElement;
	protected focusTrap: FocusTrap | null = null;

	private escHandler: (e: KeyboardEvent) => void;
	private clickOutside: (e: MouseEvent) => void;
	private mouseDownInside: boolean = false;
	private mouseDownHandler: (e: MouseEvent) => void;
	private mouseUpHandler: (e: MouseEvent) => void;

	public onClose?: () => void;

	constructor(parent: HTMLElement) {
		this.parent = parent;

		this.overlay = document.createElement('div');
		this.overlay.className =
			'fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-20 ';

		this.box = document.createElement('div');
		this.box.className =
			'bg-white/70 shadow-lg p-4 sm:p-6 md:p-10 relative flex flex-col items-center justify-center gap-2 sm:gap-4 rounded-sm';
		this.box.tabIndex = -1; // make focusable

		this.overlay.appendChild(this.box);
		parent.appendChild(this.overlay);

		setTimeout(() => {
			if (!this.focusTrap) {
				this.activateFocusTrap();
			}
		}, 0);

		// not handled by focus-trap because of the ws QUIT custom behavior
		this.escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.quit();
		};
		this.clickOutside = (e: MouseEvent) => {
			// Only close if the click target is the overlay AND the mousedown also happened on the overlay
			// This prevents closing when dragging/selecting text that ends outside the box
			if (e.target === this.overlay && !this.mouseDownInside) this.quit();
		};
		// Track where mousedown events occur
		this.mouseDownHandler = (e: MouseEvent) => {
			this.mouseDownInside = this.box.contains(e.target as Node);
		};
		// Reset tracking on mouseup (defer to allow click event to process first)
		this.mouseUpHandler = () => {
			// Use setTimeout to ensure the click event handler runs before we reset
			setTimeout(() => {
				this.mouseDownInside = false;
			}, 0);
		};

		document.addEventListener('keydown', this.escHandler);
		this.overlay.addEventListener('click', this.clickOutside);
		this.overlay.addEventListener('mousedown', this.mouseDownHandler);
		document.addEventListener('mouseup', this.mouseUpHandler);
	}

	//  Activate the focus trap after content has been added to the modal.
	//  called by subclasses after they've finished adding their content.
	protected activateFocusTrap() {
		if (this.focusTrap) return;

		this.focusTrap = createFocusTrap(this.box, {
			escapeDeactivates: false, // we handle ESC manually
			clickOutsideDeactivates: false, // we handle that too
			allowOutsideClick: true, // allow clicks but handled manually
			returnFocusOnDeactivate: true,
			fallbackFocus: this.box,
		});
		this.focusTrap.activate();
	}

	public quit() {
		this.destroy();
	}

	public destroy(): void {
		if (this.focusTrap) {
			this.focusTrap.deactivate();
		}
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.removeEventListener('click', this.clickOutside);
		this.overlay.removeEventListener('mousedown', this.mouseDownHandler);
		document.removeEventListener('mouseup', this.mouseUpHandler);

		this.overlay.remove();
		this.onClose?.();
	}
}
