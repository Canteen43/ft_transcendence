export class Modal {
	protected parent: HTMLElement;
	protected overlay: HTMLDivElement;
	protected box: HTMLDivElement;

	private escHandler: (e: KeyboardEvent) => void;
	private clickOutside: (e: MouseEvent) => void;
	private stopPropagationHandler: (e: MouseEvent) => void;

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
			if (e.key === 'Escape') this.destroy();
		};
		this.clickOutside = (e: MouseEvent) => {
			if (e.target === this.overlay) this.destroy();
		};
		this.stopPropagationHandler = (e: MouseEvent) => e.stopPropagation();

		document.addEventListener('keydown', this.escHandler);
		this.overlay.addEventListener('click', this.clickOutside);
		this.box.addEventListener('click', this.stopPropagationHandler);
	}

	public destroy(): void {
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.removeEventListener('click', this.clickOutside);
		this.box.removeEventListener('click', this.stopPropagationHandler);
	
		this.overlay.remove();
		this.onClose?.();
	}
}
