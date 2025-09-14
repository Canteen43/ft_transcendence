import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { ReadyModal } from '../modals/ReadyModal';

export class AliasModal extends Modal {
	private aliasFields: HTMLInputElement[] = [];

	constructor(parent: HTMLElement, n: number) {
		super(parent);

				const username = sessionStorage.getItem('username') ?? '';
		const alias = sessionStorage.getItem('alias') ?? '';
		const aliases = [
			sessionStorage.getItem('alias1') ?? '',
			sessionStorage.getItem('alias2') ?? '',
			sessionStorage.getItem('alias3') ?? '',
			sessionStorage.getItem('alias4') ?? '',
		];

		for (let i = 0; i < n; i++) {
			let defaultValue = '';

			if (n === 1) {
				defaultValue = alias || username || `player${i + 1}`;
			} else {
				defaultValue = aliases[i] || `player${i + 1}`;
			}
			const input = this.myCreateInput(
				'text',
				`username${i + 1}`,
				defaultValue
			);
			this.aliasFields.push(input);
		}

		new Button('Continue', () => this.handleAlias(), this.box);
	}

	private async handleAlias() {
		const tournament = sessionStorage.getItem('tournament') ?? '';
		const gameMode = sessionStorage.getItem('gameMode') ?? '';

		this.aliasFields.forEach((field, index) => {
			const alias = field.value.trim() || `Player${index + 1}`;
			sessionStorage.setItem(`alias${index + 1}`, alias);
		});
		this.destroy();
		if (tournament == '1') location.hash = '#tournament';
		else if (gameMode == 'local') location.hash = '#game';
		else new ReadyModal(this.parent);
		this.destroy();
	}

	private myCreateInput(
		type: string,
		id: string,
		defaultValue: string
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.value = defaultValue;
		input.className = 'border border-[var(--color3)] rounded p-2';
		this.box.appendChild(input);
		return input;
	}
}
