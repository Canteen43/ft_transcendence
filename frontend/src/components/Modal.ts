export class Modal {
	protected overlay: HTMLDivElement;
	protected box: HTMLDivElement;
	private escHandler: (e: KeyboardEvent) => void;

	constructor(parent: HTMLElement) {
		// outer overlay
		this.overlay = document.createElement('div');
		this.overlay.className =
			'fixed inset-0 flex items-center justify-center backdrop-blur-sm';

		// inner modal box
		this.box = document.createElement('div');
		this.box.className = 'bg-white w-1/2 h-1/2 rounded-lg shadow-lg p-6';

		this.overlay.appendChild(this.box);
		parent.appendChild(this.overlay);

		// Escape listener
		this.escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.destroy();
		};
		document.addEventListener('keydown', this.escHandler);
	}

	public destroy() {
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.remove();
		// optional: null references
		this.box = null!;
		this.overlay = null!;
		this.escHandler = null!;
	}
}
