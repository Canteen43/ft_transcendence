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
		if (state.currentModal && state.currentModal !== this) {
			state.currentModal.destroy();
		}
		state.currentModal = this;
		this.box.classList.add('remote-alias-modal');

		const defaultValue = this.getDefaultAlias();
		this.aliasField = this.createInput(defaultValue);
		this.box.appendChild(this.aliasField);

		this.keydownHandler = (e: KeyboardEvent) => {
			if (e.key === 'Enter') this.submit(type);
		};
		this.aliasField.addEventListener('keydown', this.keydownHandler);

		new Button('Continue', () => this.submit(type), this.box);

		this.activateFocusTrap();
		this.aliasField.select();
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
			'border border-[var(--color3)] p-2 w-full text-grey text-sm sm:text-base ';
		return input;
	}

	private async submit(type: TournamentType): Promise<void> {
		if (this.isSubmitting) return;
		this.isSubmitting = true;

		const alias = this.aliasField.value.trim() || 'Player1';
		sessionStorage.setItem('alias', alias);

		const result = await joinTournament(state.tournamentSize, type);

		if (!result.success) {
			this.destroy();
			const errorModal = new TextModal(this.parent, result.error);
			errorModal.onClose = () => {
				new RemoteSetupModal(this.parent, type);
			};
			if (result.zodError) {
				console.error(
					'Validation failed:',
					z.treeifyError(result.zodError)
				);
			}
			return;
		}

		this.destroy();
		new WaitingModal(this.parent);
	}

	public destroy(): void {
		if (state.currentModal === this) {
			state.currentModal = null;
		}
		if (this.keydownHandler) {
			this.aliasField.removeEventListener('keydown', this.keydownHandler);
			this.keydownHandler = undefined!;
		}
		super.destroy();
	}
}
