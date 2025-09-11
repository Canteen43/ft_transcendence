import { Button } from '../components/Button';
import { Modal } from '../components/Modal';

export class AliasModal extends Modal {
	private aliasField: HTMLInputElement;

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
		this.aliasField = this.myCreateInput(
			'text',
			'username',
			'Enter your alias'
		);
		

		new Button('To tournament', () => this.handleAlias(), this.box);
	}

	private async handleAlias() {
		const Alias = this.aliasField.value.trim();
		sessionStorage.setItem("Alias", Alias);
		this.destroy();
		location.hash = '#home';
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
		input.className = 'border border-[var(--color1)] rounded p-2';
		this.box.appendChild(input);
		return input;
	}

}