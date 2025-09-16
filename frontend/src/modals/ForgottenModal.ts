import { Modal } from './Modal';

export class ForgottenModal extends Modal {
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
		message.textContent = 'TOO BAD!';
		message.className =
			'text-[var(--color3)] font-extrabold text-3xl uppercase tracking-wide';
		this.box.appendChild(message);
	}
}
