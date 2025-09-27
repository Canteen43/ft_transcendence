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
			'fixed inset-0 flex items-center justify-center bg-black/50 z-20';

		this.box = document.createElement('div');
		this.box.className =
			'bg-white rounded-lg shadow-lg p-10 relative flex flex-col items-center justify-center gap-4';

		if (showCloseButton) {
			this.closeButton = document.createElement('button');
			this.closeButton.innerHTML = '×';
			this.closeButton.className =
				'absolute top-2 right-2 w-8 h-8 flex items-center justify-center ' +
				'text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full ' +
				'text-xl font-bold cursor-pointer transition-colors duration-200';
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

	public destroy() {
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.removeEventListener('click', this.clickOutside);
		this.overlay.remove();
		this.onClose?.();
	}
}
