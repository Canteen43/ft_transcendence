import { z } from 'zod';
import { TournamentType } from '../../../shared/enums.js';
import { Button } from '../buttons/Button.js';
import { state } from '../utils/State.js';
import { joinTournament } from '../utils/tournamentJoin.js';
import { Modal } from './Modal.js';
import { TextModal } from './TextModal.js';
import { WaitingModal } from './WaitingModal.js';
import { GameConfig } from '../game/GameConfig.js';


export class AliasModal extends Modal {
	private aliasFields: HTMLInputElement[] = [];
	private dropdownContainers: HTMLDivElement[] = [];
	private openDropdownIndex: number | null = null;
	private readonly aiOptions: { label: string; value: string }[] = [
		{ label: 'Circe', value: '*Circe' },
		{ label: 'Merlin', value: '*Merlin' },
		{ label: 'Morgana', value: '*Morgana' },
		{ label: 'Gandalf', value: '*Gandalf' },
	];
	private powerupCheckboxes: Record<
		'split' | 'stretch' | 'shrink',
		HTMLInputElement
	> | null = null;

	private documentClickHandlers: ((e: Event) => void)[] = [];
	private fieldHandlers: Map<HTMLInputElement, (e: KeyboardEvent) => void> =
		new Map();

	constructor(parent: HTMLElement, n: number, type: TournamentType) {
		super(parent);
		this.box.classList.add('alias-modal');

		const username = sessionStorage.getItem('username') ?? '';
		const alias = sessionStorage.getItem('alias') ?? '';
		const aliases = [
			sessionStorage.getItem('alias1') ?? '',
			sessionStorage.getItem('alias2') ?? '',
			sessionStorage.getItem('alias3') ?? '',
			sessionStorage.getItem('alias4') ?? '',
		];
		const aliasHints = ['↑←↓→', 'wasd', 'ijkl', '8456'];
		const gameMode = sessionStorage.getItem('gameMode');

		for (let i = 0; i < n; i++) {
			const defaultValue =
				n === 1
					? alias || username || `player${i + 1}`
					: aliases[i] || `player${i + 1}`;

			const row = this.createPlayerRow(
				i,
				defaultValue,
				aliasHints[i],
				gameMode === 'local'
			);
			this.box.appendChild(row);
		}

		if (gameMode === 'local') {
			this.powerupCheckboxes = this.createPowerupSection();
		}

		this.addKeyboardListeners(type);
		this.aliasFields[0].focus();
		this.aliasFields[0].select();

		new Button('Continue', () => this.handleAlias(type), this.box);
	}

	private createPowerupSection(): Record<
		'split' | 'stretch' | 'shrink',
		HTMLInputElement
	> {
		const container = document.createElement('div');
		container.className = 'w-full flex flex-col gap-2 mt-4';

		const title = document.createElement('h2');
		title.textContent = 'PowerUps';
		title.className = 'text-2xl font-bold text-[var--(color4)]';
		container.appendChild(title);

		const list = document.createElement('div');
		list.className = 'flex flex-col gap-1 pb-4';
		container.appendChild(list);

		const checkboxMap: Record<
			'split' | 'stretch' | 'shrink',
			HTMLInputElement
		> = {} as Record<'split' | 'stretch' | 'shrink', HTMLInputElement>;

		const powerups: {
			key: 'split' | 'stretch' | 'shrink';
			label: string;
		}[] = [
			{ key: 'split', label: 'Ball Split' },
			{ key: 'stretch', label: 'Paddle Stretch' },
			{ key: 'shrink', label: 'Paddle Shrink' },
		];

		powerups.forEach(({ key, label }) => {
			const row = document.createElement('label');
			row.className =
				'flex items-center gap-3 text-base text-[var--(color4)]';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.checked = sessionStorage.getItem(key) === '1';
			checkbox.className = 'w-5 h-5 accent-[var--(color4)]';

			const span = document.createElement('span');
			span.textContent = label;
			span.className = 'text-lg font-medium text-[var--(color4)]';

			row.appendChild(checkbox);
			row.appendChild(span);
			list.appendChild(row);

			checkboxMap[key] = checkbox;
		});

		this.box.appendChild(container);
		return checkboxMap;
	}

	private createPlayerRow(
		index: number,
		defaultValue: string,
		hint: string,
		showAIButton: boolean
	): HTMLDivElement {
		const row = document.createElement('div');
		row.className = 'flex items-center gap-2 w-full relative';

		const input = this.createInput(
			defaultValue,
			`username${index + 1}`,
			hint
		);
		row.appendChild(input);
		this.aliasFields.push(input);

		if (showAIButton) {
			const { button, dropdown } = this.createAISelector(index, input);
			row.appendChild(button);
			row.appendChild(dropdown);
			this.dropdownContainers.push(dropdown);
		}

		return row;
	}

	private createInput(
		defaultValue: string,
		id: string,
		hint: string
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'text';
		input.id = id;
		input.value = defaultValue;
		input.title = hint;
		input.className =
			'border border-[var(--color3)] p-2 flex-1 text-grey text-lg';
		return input;
	}

	private createAISelector(
		index: number,
		input: HTMLInputElement
	): { button: HTMLButtonElement; dropdown: HTMLDivElement } {
		// AI Button with corners
		const button = document.createElement('button');
		button.type = 'button';
		button.className =
			'flex items-center gap-2 border border-[var(--color3)]-lg px-2 py-2 text-sm text-[var(--color3)] hover:bg-[var(--color3)]/10 transition-colors';

		const aiIcon = document.createElement('img');
		aiIcon.src = '/ai.png';
		aiIcon.alt = 'AI options';
		aiIcon.className = 'w-6 h-6';

		const arrow = document.createElement('span');
		arrow.textContent = '▾';
		arrow.className = 'text-xs';

		button.appendChild(aiIcon);
		button.appendChild(arrow);

		// Dropdown with proper white background
		const dropdown = document.createElement('div');
		dropdown.className =
			'hidden absolute right-0 top-full mt-1 min-w-[8rem] ' +
			'bg-white border border-[var(--color3)]-lg shadow-lg ' +
			'z-10 overflow-hidden';

		this.aiOptions.forEach((option, i) => {
			const optionButton = document.createElement('button');
			optionButton.type = 'button';
			optionButton.textContent = option.label;
			optionButton.className =
				'w-full px-3 py-2 text-left text-sm bg-white hover:bg-[var(--color3)]/10 ' +
				'transition-colors border-none';

			optionButton.addEventListener('click', e => {
				e.stopPropagation();
				input.value = option.value;
				this.closeAllDropdowns();
				input.focus();
			});

			dropdown.appendChild(optionButton);
		});

		button.addEventListener('click', e => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleDropdown(index);
		});

		// Store handler reference for cleanup
		const clickHandler = (e: Event) => {
			if (
				!button.contains(e.target as Node) &&
				!dropdown.contains(e.target as Node)
			) {
				this.closeDropdown(index);
			}
		};
		this.documentClickHandlers.push(clickHandler);
		document.addEventListener('click', clickHandler);

		return { button, dropdown };
	}

	private addKeyboardListeners(type : TournamentType): void {
		this.aliasFields.forEach(field => {
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

	private toggleDropdown(index: number): void {
		const dropdown = this.dropdownContainers[index];
		if (!dropdown) return;

		const isOpen = this.openDropdownIndex === index;
		this.closeAllDropdowns();

		if (!isOpen) {
			dropdown.classList.remove('hidden');
			this.openDropdownIndex = index;
		}
	}

	private closeDropdown(index: number): void {
		const dropdown = this.dropdownContainers[index];
		if (dropdown && this.openDropdownIndex === index) {
			dropdown.classList.add('hidden');
			this.openDropdownIndex = null;
		}
	}

	private closeAllDropdowns(): void {
		this.dropdownContainers.forEach(container => {
			container.classList.add('hidden');
		});
		this.openDropdownIndex = null;
	}

	private async handleAlias(type: TournamentType) {
		if (state.gameMode === 'local') {
			this.handleLocalGame();
		} else {
			await this.handleRemoteGame(type);
		}
		this.destroy();
	}

	private handleLocalGame(): void {
		const isTournament = sessionStorage.getItem('tournament') === '1';
		this.aliasFields.forEach((field, index) => {
			const alias = field.value.trim() || `Player${index + 1}`;
			sessionStorage.setItem(`alias${index + 1}`, alias);
			if (isTournament) {
				const controlScheme = GameConfig.getDefaultControlScheme(
					(index + 1) as 1 | 2 | 3 | 4
				);
				GameConfig.setPlayerControlScheme(
					(index + 1) as 1 | 2 | 3 | 4,
					controlScheme
				);
				GameConfig.setTournamentSeedAlias(
					(index + 1) as 1 | 2 | 3 | 4,
					alias
				);
			}
		});
		if (!isTournament) {
			for (let i = 1; i <= 4; i++) {
				sessionStorage.removeItem(`alias${i}controls`);
			}
			GameConfig.clearTournamentSeedAliases();
		}
		if (this.powerupCheckboxes) {
			sessionStorage.setItem(
				'split',
				this.powerupCheckboxes.split.checked ? '1' : '0'
			);
			sessionStorage.setItem(
				'stretch',
				this.powerupCheckboxes.stretch.checked ? '1' : '0'
			);
			sessionStorage.setItem(
				'shrink',
				this.powerupCheckboxes.shrink.checked ? '1' : '0'
			);
		}
		location.hash = '#game';
	}

	private async handleRemoteGame(type: TournamentType): Promise<void> {
		const alias = this.aliasFields[0].value.trim() || 'Player1';
		sessionStorage.setItem('alias', alias);

		// Clean up old aliases
		['alias1', 'alias2', 'alias3', 'alias4'].forEach(key =>
			sessionStorage.removeItem(key)
		);
		['alias1controls', 'alias2controls', 'alias3controls', 'alias4controls'].forEach(
			key => sessionStorage.removeItem(key)
		);
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
