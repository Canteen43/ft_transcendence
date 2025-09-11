import { Modal } from '../components/Modal';
import { newtonsCradle } from 'ldrs';
import { jelly } from 'ldrs';

newtonsCradle.register();
jelly.register();

export class WaitingModal extends Modal {
	constructor(parent: HTMLElement) {
		super(parent);

		this.box.classList.add(
			'flex',
			'flex-col',
			'items-center',
			'justify-center',
			'gap-2',
			'p-4'
		);

		const message = document.createElement('p');
		message.textContent = 'Waiting for other player(s)...';
		message.className = 'font-sigmar text-3xl font-bold text-center mb-12 text-[var(--color1)]';

		const loader = document.createElement('l-jelly');
		loader.setAttribute('size', '100');
		loader.setAttribute('speed', '1.5');
		loader.setAttribute('color', 'var(--color1)');

		this.box.appendChild(message);
		this.box.appendChild(loader);
	}
}