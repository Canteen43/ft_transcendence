export class Modal {
	protected overlay: HTMLDivElement;
	protected box: HTMLDivElement;
	private escHandler: (e: KeyboardEvent) => void;
	private clickOutside: (e: MouseEvent) => void;
	private closeButton: HTMLButtonElement;

	constructor(parent: HTMLElement) {
		// outer overlay
		this.overlay = document.createElement('div');
		this.overlay.className =
			'fixed inset-0 flex items-center justify-center backdrop-blur-sm';

		// inner modal box
		this.box = document.createElement('div');
		this.box.className = 'bg-white w-1/2 h-1/2 rounded-lg shadow-lg p-6 relative';

		// Create close button (X) in top right corner
		this.closeButton = document.createElement('button');
		this.closeButton.innerHTML = '×'; // You can also use '✕' or an icon
		this.closeButton.className = 
			'absolute top-2 right-2 w-8 h-8 flex items-center justify-center ' +
			'text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full ' +
			'text-xl font-bold cursor-pointer transition-colors duration-200';
		this.closeButton.addEventListener('click', () => {
			this.destroy();
		});
		this.box.appendChild(this.closeButton);

		this.overlay.appendChild(this.box);
		parent.appendChild(this.overlay);

		// Escape listener
		this.escHandler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') this.destroy();
		};
		document.addEventListener('keydown', this.escHandler);

		// Click outside to close listener
		this.clickOutside = (e: MouseEvent) => {
			if (e.target === this.overlay) this.destroy();
		};
		this.overlay.addEventListener('click', this.clickOutside);

		// Prevent modal box clicks from bubbling up to overlay
		// This ensures clicking inside the modal doesn't close it
		this.box.addEventListener('click', (e: MouseEvent) => {
			e.stopPropagation();
		});
	}

	public destroy() {
		
		// Clean up event listeners
		document.removeEventListener('keydown', this.escHandler);
		this.overlay.removeEventListener('click', this.clickOutside);

		// Remove from DOM
		this.overlay.remove();
		// optional: null references
		this.box = null!;
		this.overlay = null!;
		this.escHandler = null!;
		this.clickOutside = null!;
		this.closeButton = null!;
	}
}

