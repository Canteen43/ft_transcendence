export class Button {
	element: HTMLButtonElement;
	private onClick: () => void;

	constructor(
		content: string | HTMLElement,
		onClick: () => void,
		parent?: HTMLElement // optional parent element
	) {
		this.element = document.createElement('button');
		this.element.className =
			"font-outfit [font-variation-settings:'wght'_900] text-lg sm:text-2xl " +
			'px-6 sm:px-12 py-3 sm:py-4  transition-colors ' +
			'bg-[var(--color3)] text-[var(--color1)] border-3 border-[var(--color3)] ' +
			'hover:bg-[var(--color1)] hover:text-[var(--color3)] hover:border-[var(--color3)] ';
		if (typeof content === 'string') {
			this.element.textContent = content;
		} else {
			this.element.appendChild(content);
		}

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
