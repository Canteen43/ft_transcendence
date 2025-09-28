import { z } from 'zod';
import {
	CreateTournamentApiSchema,
	FullTournamentSchema,
	JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../../shared/schemas/tournament';
import { Button } from '../buttons/Button';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';
import { Modal } from './Modal';
import { TextModal } from './TextModal';
import { WaitingModal } from './WaitingModal';

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


	constructor(parent: HTMLElement, n: number) {
		super(parent);
		this.box.classList.add('alias-modal');
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
			const defaultValue = n === 1 
				? alias || username || `player${i + 1}`
				: aliases[i] || `player${i + 1}`;

			const row = this.createPlayerRow(i, defaultValue, aliasHints[i], gameMode === 'local');
			this.box.appendChild(row);
		}

		this.addKeyboardListeners();
		this.aliasFields[0].focus();
		this.aliasFields[0].select();
			
		new Button('Continue', () => this.handleAlias(), this.box);
	}

	private createPlayerRow(index: number, defaultValue: string, hint: string, showAIButton: boolean): HTMLDivElement {
		const row = document.createElement('div');
		row.className = 'flex items-center gap-2 w-full relative';

		const input = this.createInput(defaultValue, `username${index + 1}`, hint);
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

	private createInput(defaultValue: string, id: string, hint: string): HTMLInputElement {
		const input = document.createElement('input');
		input.type = 'text';
		input.id = id;
		input.value = defaultValue;
		input.title = hint;
		input.className = 'border border-[var(--color3)] rounded p-2 flex-1';
		return input;
	}

	private createAISelector(index: number, input: HTMLInputElement): { button: HTMLButtonElement; dropdown: HTMLDivElement } {
		// AI Button with rounded corners
		const button = document.createElement('button');
		button.type = 'button';
		button.className = 'flex items-center gap-2 border border-[var(--color3)] rounded-lg px-2 py-2 text-sm text-[var(--color3)] hover:bg-[var(--color3)]/10 transition-colors';
		
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
			'bg-white border border-[var(--color3)] rounded-lg shadow-lg ' +
			'z-10 overflow-hidden';

		this.aiOptions.forEach((option, i) => {
			const optionButton = document.createElement('button');
			optionButton.type = 'button';
			optionButton.textContent = option.label;
			optionButton.className = 
				'w-full px-3 py-2 text-left text-sm bg-white hover:bg-[var(--color3)]/10 ' +
				'transition-colors border-none';
			
			optionButton.addEventListener('click', (e) => {
				e.stopPropagation();
				input.value = option.value;
				this.closeAllDropdowns();
				input.focus();
			});
			
			dropdown.appendChild(optionButton);
		});

		button.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleDropdown(index);
		});

		// Close dropdown when clicking outside
		document.addEventListener('click', (e) => {
			if (!button.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
				this.closeDropdown(index);
			}
		});

		return { button, dropdown };
	}

	private addKeyboardListeners(): void {
		this.aliasFields.forEach(field => {
			field.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					this.handleAlias();
				}
				if (e.key === 'Escape') {
					this.closeAllDropdowns();
				}
			});
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

	private async handleAlias() {
		if (state.gameMode === 'local') {
			this.handleLocalGame();
		} else {
			await this.handleRemoteGame();
		}
		this.destroy();
	}

	private handleLocalGame(): void {
		this.aliasFields.forEach((field, index) => {
			const alias = field.value.trim() || `Player${index + 1}`;
			sessionStorage.setItem(`alias${index + 1}`, alias);
		});
		location.hash = '#game';
	}

	private async handleRemoteGame(): Promise<void> {
		const alias = this.aliasFields[0].value.trim() || 'Player1';
		sessionStorage.setItem('alias', alias);
		
		// Clean up old aliases
		['alias1', 'alias2', 'alias3', 'alias4'].forEach(key => 
			sessionStorage.removeItem(key)
		);

		await this.joinGame(state.tournamentSize);
		new WaitingModal(this.parent);
	}

	private async joinGame(targetSize: number): Promise<void> {
		const joinData = {
			size: targetSize,
			alias: sessionStorage.getItem('alias'),
		};

		const parseInput = JoinTournamentSchema.safeParse(joinData);
		if (!parseInput.success) {
			this.showError('Invalid tournament format', parseInput.error);
			return;
		}

		console.debug('Sending to /tournaments/join:', joinData);
		const { data: playerQueue, error } = await apiCall(
			'POST',
			'/tournaments/join',
			TournamentQueueSchema,
			joinData
		);

		if (error) {
			this.showError(`Error ${error.status}: ${error.statusText}, ${error.message}`);
			return;
		}

		if (!playerQueue) {
			this.showError('No response from tournament creation');
			this.showError('No response from tournament creation');
			return;
		}

		await this.handlePlayerQueue(playerQueue, targetSize);
	}

	private async handlePlayerQueue(playerQueue: any, targetSize: number): Promise<void> {
		console.log('Tournament (game) actual players:', playerQueue.queue);
		const currentPlayers = playerQueue.queue.length;
		const isTournamentReady = currentPlayers === targetSize;

		// Set up game spec

		sessionStorage.setItem('thisPlayer', currentPlayers.toString());
		sessionStorage.setItem('targetSize', targetSize.toString());
		sessionStorage.setItem('gameMode', 'remote');

		if (isTournamentReady) {
			await this.createTournament(playerQueue);
		}
	}

	private async createTournament(playerQueue: any): Promise<void> {
		const body = {
			creator: sessionStorage.getItem('userID') || '',
			participants: playerQueue.queue,
		};

		const parseInput = CreateTournamentApiSchema.safeParse(body);
		if (!parseInput.success) {
			this.showError('Invalid tournament creation data', parseInput.error);
			return;
		}

		console.log('Sending to /tournaments:', body);
		const { data: tournament, error } = await apiCall(
			'POST',
			'/tournaments',
			TournamentSchema,
			body
		);

		if (error) {
			this.showError(`Error ${error.status}: ${error.statusText}, ${error.message}`);
			await this.leaveTournament();
			return;
		}

		if (tournament) {
			console.info('Tournament created with ID:', tournament.id);
			sessionStorage.setItem('tournamentID', tournament.id);
		} else {
			this.showError('Failed to create tournament. Leaving queue.');
			await this.leaveTournament();
		}
	}

	private async leaveTournament(): Promise<void> {
		const { error } = await apiCall('POST', '/tournaments/leave');
		if (error) {
			console.error('Error leaving tournament:', error);
			this.showError(`Failed to leave tournament: ${error.message}`);
		}
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
		super.destroy();
		}
	}
