import { z } from 'zod';
import { TournamentType } from '../../../shared/enums.js';
import { Button } from '../buttons/Button';
import { state } from '../utils/State';
import { joinTournament } from '../utils/tournamentJoin';
import { Modal } from './Modal';
import { TextModal } from './TextModal';
import { WaitingModal } from './WaitingModal';

export class RemoteSetupModal extends Modal {
	private aliasField: HTMLInputElement;
	private isSubmitting = false;
	private keydownHandler: (e: KeyboardEvent) => void;

	constructor(parent: HTMLElement, type: TournamentType) {
		super(parent);
		this.box.classList.add('remote-alias-modal');

		const defaultValue = this.getDefaultAlias();
		this.aliasField = this.createInput(defaultValue);
		this.box.appendChild(this.aliasField);

		this.keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'Enter') this.submit(type);
		};
		this.aliasField.addEventListener('keydown', this.keydownHandler);

		this.aliasField.focus();
		new Button('Continue', () => this.submit(type), this.box);
	}

	private getDefaultAlias(): string {
		return (
			sessionStorage.getItem('alias') ||
			sessionStorage.getItem('username') ||
			'player1'
		);
	}

	private createInput(value: string): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'text';
		input.value = value;
		input.className =
			'border border-[var(--color3)] p-2 w-full text-grey text-lg';
		return input;
	}

	private async submit(type: TournamentType): Promise<void> {
		if (this.isSubmitting) return;
		this.isSubmitting = true;

		const alias = this.aliasField.value.trim() || 'Player1';
		sessionStorage.setItem('alias', alias);

		const result = await joinTournament(state.tournamentSize, type);

		if (!result.success) {
			new TextModal(this.parent, result.error);
			if (result.zodError) {
				console.error(
					'Validation failed:',
					z.treeifyError(result.zodError)
				);
			}
			return;
		}

		this.destroy();
		const waitingModal = new WaitingModal(this.parent);
		state.currentModal = waitingModal;
	}

	public destroy(): void {
		if (this.keydownHandler) {
			this.aliasField.removeEventListener('keydown', this.keydownHandler);
			this.keydownHandler = undefined!;
		}
		super.destroy();
	}
}
