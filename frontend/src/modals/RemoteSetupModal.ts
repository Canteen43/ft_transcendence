import { z } from 'zod';
import { TournamentType } from '../../../shared/enums.js';
import { Button } from '../buttons/Button';
import { GameConfig } from '../game/GameConfig';
import { state } from '../utils/State';
import { joinTournament } from '../utils/tournamentJoin';
import { Modal } from './Modal';
import { TextModal } from './TextModal';
import { WaitingModal } from './WaitingModal';

export class RemoteSetupModal extends Modal {
	private aliasField: HTMLInputElement;

	constructor(parent: HTMLElement, type: TournamentType) {
		super(parent);
		this.box.classList.add('remote-alias-modal');

		const defaultValue = this.getDefaultAlias();
		this.aliasField = this.createInput(defaultValue);
		this.box.appendChild(this.aliasField);

		this.aliasField.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter') this.submit(type);
		});

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
		const alias = this.aliasField.value.trim() || 'Player1';
		sessionStorage.setItem('alias', alias);

		this.clearSessionData();

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
		new WaitingModal(this.parent);
	}

	private clearSessionData(): void {
		['alias1', 'alias2', 'alias3', 'alias4'].forEach(key =>
			sessionStorage.removeItem(key)
		);
		[
			'alias1controls',
			'alias2controls',
			'alias3controls',
			'alias4controls',
		].forEach(key => sessionStorage.removeItem(key));
		GameConfig.clearTournamentSeedAliases();
	}
}
