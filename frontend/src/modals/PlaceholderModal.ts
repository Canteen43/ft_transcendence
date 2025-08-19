import { Modal } from '../components/Modal';

export class PlaceholderModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		// Add placeholder content
		const text = document.createElement('p');
		text.textContent = 'This is a placeholder. Cool stuff coming soon...';
		text.className =
			'text-gray-800 text-center text-xl font-bold flex items-center justify-center h-full';

		this.box.appendChild(text);
	}
}
