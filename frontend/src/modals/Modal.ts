export class Modal {
	protected parent: HTMLElement;
	protected overlay: HTMLDivElement;
	protected box: HTMLDivElement;
	private escHandler: (e: KeyboardEvent) => void;
	private clickOutside: (e: MouseEvent) => void;
	public onClose?: () => void;
	private closeButton?: HTMLButtonElement;

	constructor(parent: HTMLElement, showCloseButton = false) {
		this.parent = parent;

		this.overlay = document.createElement('div');
		this.overlay.className =
			'fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-20';

		this.box = document.createElement('div');
		this.box.className =
			'bg-white/70 shadow-lg p-10 relative flex flex-col items-center justify-center gap-4';


		if (showCloseButton) {
			this.closeButton = document.createElement('button');
			this.closeButton.textContent = '×';
			this.closeButton.className =
				'bg-white shadow-lg p-4 sm:p-6 md:p-10' +
				' relative flex flex-col items-center justify-center' +
				' gap-3 sm:gap-4' +
				' w-full max-w-[90vw] sm:max-w-[500px] md:max-w-[600px]';
			this.closeButton.addEventListener('click', () => this.quit());
			this.box.appendChild(this.closeButton);
		}

		this.overlay.appendChild(this.box);
		parent.appendChild(this.overlay);

		this.escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.quit();
		};
		document.addEventListener('keydown', this.escHandler);

		this.clickOutside = (e: MouseEvent) => {
			if (e.target === this.overlay) this.quit();
		};
		this.overlay.addEventListener('click', this.clickOutside);

		this.box.addEventListener('click', e => e.stopPropagation());
	}

	public quit() {
		this.destroy();
	}

	public destroy(): void {
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.removeEventListener('click', this.clickOutside);
		this.overlay.remove();
		this.onClose?.();
	}
}
