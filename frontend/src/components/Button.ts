export class Button {
	element: HTMLButtonElement;

	constructor(
		label: string,
		onClick: () => void,
		parent?: HTMLElement // optional parent element
	) {
		this.element = document.createElement('button');
		this.element.textContent = label;
		this.element.className =
			'px-6 py-3 bg-green-700 hover:bg-green-900 rounded-lg text-white font-semibold shadow-lg transition-colors';
		this.element.addEventListener('click', onClick);

		if (parent) {
			parent.appendChild(this.element);
		}
	}
}
