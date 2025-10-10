import { z } from 'zod';
import { TournamentType } from '../../../shared/enums.js';
import { Button } from '../buttons/Button';
import { GameConfig } from '../game/GameConfig';
import { state } from '../utils/State';
import { joinTournament } from '../utils/tournamentJoin';
import { Modal } from './Modal';
import { TextModal } from './TextModal';
import { WaitingModal } from './WaitingModal';

export class AliasModal extends Modal {
	private aliasField: HTMLInputElement;
	private documentClickHandlers: ((e: Event) => void)[] = [];

	constructor(parent: HTMLElement, n: number, type: TournamentType) {
		super(parent);
		this.box.classList.add('remote-alias-modal');

		const username = sessionStorage.getItem('username') ?? '';
		const alias = sessionStorage.getItem('alias') ?? '';

		const defaultValue = alias || username || `player1`;

		const row = this.createPlayerRow(defaultValue);
		this.box.appendChild(row);
		this.addKeyboardListeners(type);
		this.aliasField.focus();
		new Button('Continue', () => this.handleAlias(type), this.box);
	}

	private createPlayerRow(defaultValue: string): HTMLDivElement {
		const row = document.createElement('div');
		row.className = 'flex items-center gap-2 w-full relative';
		const input = this.createInput(defaultValue, `username`);
		row.appendChild(input);
		this.aliasField = input;
		return row;
	}

	private createInput(defaultValue: string, id: string): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'text';
		input.id = id;
		input.value = defaultValue;
		input.className =
			'border border-[var(--color3)] p-2 flex-1 text-grey text-lg';
		return input;
	}

	private addKeyboardListeners(type: TournamentType): void {
		this.aliasField(field => {
			const handler = (e: KeyboardEvent) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					this.handleAlias(type);
				}
				if (e.key === 'Escape') {
					this.closeAllDropdowns();
				}
			};
			this.fieldHandlers.set(field, handler);
			field.addEventListener('keydown', handler);
		});
	}

	private async handleAlias(type: TournamentType) {
		await this.handleRemoteGame(type);

		this.destroy();
	}

	private async handleRemoteGame(type: TournamentType): Promise<void> {
		const alias = this.aliasFields.value.trim() || 'Player1';
		sessionStorage.setItem('alias', alias);

		// Clean up old aliases
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

		const result = await joinTournament(state.tournamentSize, type);
		if (!result.success) {
			this.showError(result.error, result.zodError);
			return;
		}
		new WaitingModal(this.parent);
	}

	private showError(message: string, zodError?: z.ZodError): void {
		new TextModal(this.parent, message);
		if (zodError) {
			console.error('Validation failed:', z.treeifyError(zodError));
		}
		console.error(message);
	}

	public destroy(): void {
		this.closeAllDropdowns();

		// Clean up all document click handlers
		this.documentClickHandlers.forEach(handler => {
			document.removeEventListener('click', handler);
		});
		this.documentClickHandlers = [];

		// Clean up field listeners
		this.fieldHandlers.forEach((handler, field) => {
			field.removeEventListener('keydown', handler);
		});
		this.fieldHandlers.clear();

		super.destroy();
	}
}
