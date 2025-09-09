export class Button {
	element: HTMLButtonElement;
	private onClick: () => void;

	constructor(
		label: string,
		onClick: () => void,
		parent?: HTMLElement // optional parent element
	) {
		this.element = document.createElement('button');
		this.element.textContent = label;
		this.element.className =
			//'px-6 py-3 bg-green-700 hover:bg-green-900 rounded-lg text-white font-semibold shadow-lg transition-colors';
			  'px-6 py-3 bg-[var(--color1)] hover:bg-[var(--color1bis)] rounded-lg text-white font-semibold shadow-lg transition-colors';

		this.onClick = onClick;
		this.element.addEventListener('click', onClick);
		
		if (parent) {
			parent.appendChild(this.element);
		}
	}

	destroy(): void {
		// Remove event listener to prevent memory leaks
		this.element.removeEventListener('click', this.onClick);
		
		// Remove from parent if it exists
		if (this.element.parentElement) {
			this.element.parentElement.removeChild(this.element);
		}
	}
}
