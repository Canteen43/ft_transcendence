import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

export class AliasModal extends Modal {
	private aliasFields: HTMLInputElement[] = [];

	constructor(parent: HTMLElement, n: number) {
		super(parent);

		const username = sessionStorage.getItem('username') ?? '';

		for (let i = 0; i < n; i++) {
			const input = this.myCreateInput(
				'text',
				`username${i + 1}`,
				username ? username : `player${i + 1}`
			);
			this.aliasFields.push(input);
		}

		new Button('Continue', () => this.handleAlias(), this.box);
	}

	private async handleAlias() {
		const gameMode = sessionStorage.getItem('gameMode');

		this.aliasFields.forEach((field, index) => {
			const alias = field.value.trim() || `Player${index + 1}`;
			sessionStorage.setItem(`alias${index + 1}`, alias);
		});
		this.destroy();
		if (gameMode == 'local') location.hash = '#game';
		else location.hash = '#tournament';
	}

	private myCreateInput(
		type: string,
		id: string,
		placeholder: string
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.placeholder = placeholder;
		input.className = 'border border-[var(--color3)] rounded p-2';
		this.box.appendChild(input);
		return input;
	}
}
