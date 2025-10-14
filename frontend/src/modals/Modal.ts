export class Modal {
	protected parent: HTMLElement;
	protected overlay: HTMLDivElement;
	protected box: HTMLDivElement;

	private escHandler: (e: KeyboardEvent) => void;
	private clickOutside: (e: MouseEvent) => void;
	private stopPropagationHandler: (e: MouseEvent) => void;
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
			'bg-white/70 shadow-lg p-10 relative flex flex-col items-center justify-center gap-4 rounded-sm';

		this.overlay.appendChild(this.box);
		parent.appendChild(this.overlay);

		this.escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.quit();
		};
		this.clickOutside = (e: MouseEvent) => {
			// Only close if the click target is the overlay AND the mousedown also happened on the overlay
			// This prevents closing when dragging/selecting text that ends outside the box
			if (e.target === this.overlay && !this.mouseDownInside) this.quit();
		};
		this.stopPropagationHandler = (e: MouseEvent) => e.stopPropagation();

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
		this.box.addEventListener('click', this.stopPropagationHandler);
		this.overlay.addEventListener('mousedown', this.mouseDownHandler);
		document.addEventListener('mouseup', this.mouseUpHandler);
	}

	public quit() {
		this.destroy();
	}

	public destroy(): void {
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.removeEventListener('click', this.clickOutside);
		this.box.removeEventListener('click', this.stopPropagationHandler);
		this.overlay.removeEventListener('mousedown', this.mouseDownHandler);
		document.removeEventListener('mouseup', this.mouseUpHandler);

		this.overlay.remove();
		this.onClose?.();
	}
}
