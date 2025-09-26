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
	private documentClickHandler: (event: MouseEvent) => void;

	constructor(parent: HTMLElement, n: number) {
		super(parent);

		this.documentClickHandler = this.handleDocumentClick.bind(this);
		document.addEventListener('click', this.documentClickHandler);

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
			let defaultValue = '';

			if (n === 1) {
				defaultValue = alias || username || `player${i + 1}`;
			} else {
				defaultValue = aliases[i] || `player${i + 1}`;
			}

			const row = document.createElement('div');
			row.className = 'flex items-center gap-2 w-full relative';
			this.box.appendChild(row);

			const input = this.myCreateInput(
				'text',
				`username${i + 1}`,
				defaultValue,
				row
			);
			input.title = aliasHints[i] || '';
			this.aliasFields.push(input);

			if (gameMode === 'local') {
				const aiButton = document.createElement('button');
				aiButton.type = 'button';
				aiButton.className =
					'flex items-center gap-2 border border-[var(--color3)] rounded px-2 py-0 text-sm text-[var(--color3)] hover:bg-[var(--color3)]/10 transition-colors';
				const aiIcon = document.createElement('img');
				aiIcon.src = '/ai.png';
				aiIcon.alt = 'AI options';
				aiIcon.className = 'w-10 h-10';
				const arrow = document.createElement('span');
				arrow.textContent = '▾';
				aiButton.appendChild(aiIcon);
				aiButton.appendChild(arrow);
				row.appendChild(aiButton);

				const dropdown = document.createElement('div');
				dropdown.className =
					'hidden absolute right-0 top-full mt-1 min-w-[8rem] ' +
					'bg-white border border-[var(--color3)] rounded shadow-md' +
					'z-50 flex flex-col';
				row.appendChild(dropdown);
				this.dropdownContainers.push(dropdown);

				this.aiOptions.forEach(option => {
					const optionButton = document.createElement('button');
					optionButton.type = 'button';
					optionButton.innerText = option.label;
					optionButton.className =
						'px-3 py-2 text-left text-sm hover:bg-[var(--color3)]/10 transition-colors';
					optionButton.addEventListener('click', () => {
						input.value = option.value;
						this.closeAllDropdowns();
						input.focus();
					});
					dropdown.appendChild(optionButton);
				});

				aiButton.addEventListener('click', event => {
					event.preventDefault();
					event.stopPropagation();
					this.toggleDropdown(i);
				});
			}
		}

		this.aliasFields[0].focus();
		this.aliasFields[0].select();
		new Button('Continue', () => this.handleAlias(), this.box);
	}

	private async handleAlias() {
		const tournament = sessionStorage.getItem('tournament') ?? '';
		const gameMode = sessionStorage.getItem('gameMode') ?? '';

		if (state.gameMode === 'local') {
			this.aliasFields.forEach((field, index) => {
				const alias = field.value.trim() || `Player${index + 1}`;
				sessionStorage.setItem(`alias${index + 1}`, alias);
			});
			location.hash = '#game';
		} else {
			const alias = this.aliasFields[0].value.trim() || `Player${0 + 1}`;
			sessionStorage.setItem('alias', alias);
			sessionStorage.removeItem('alias1');
			sessionStorage.removeItem('alias2');
			sessionStorage.removeItem('alias3');
			sessionStorage.removeItem('alias4');

			this.joinGame(state.tournamentSize);
			new WaitingModal(this.parent);
		}
		this.destroy();
	}

	private addEnterListener() {
		const handleEnter = (e: KeyboardEvent) => {
			if (e.key == 'Enter') {
				e.preventDefault();
				this.handleAlias();
			}
		};
		this.aliasFields.forEach(field => {
			field.addEventListener('keydown', handleEnter);
		});
	}

	public destroy(): void {
		document.removeEventListener('click', this.documentClickHandler);
		this.closeAllDropdowns();
		super.destroy();
	}

	private myCreateInput(
		type: string,
		id: string,
		defaultValue: string,
		parent: HTMLElement = this.box
	): HTMLInputElement {
		const input = document.createElement('input');
		input.type = type;
		input.id = id;
		input.value = defaultValue;
		input.className = 'border border-[var(--color3)] rounded p-2 flex-1';
		parent.appendChild(input);
		return input;
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

	private closeAllDropdowns(): void {
		this.dropdownContainers.forEach(container => {
			container.classList.add('hidden');
		});
		this.openDropdownIndex = null;
	}

	private handleDocumentClick(event: MouseEvent): void {
		if (!this.box.contains(event.target as Node)) {
			this.closeAllDropdowns();
		}
	}

	// TODO: function to seperate file to separate concerns?
	// API call to join a tournament
	// send 2 or 4 + alias, receive the array of players in that tournament
	private async joinGame(targetSize: number) {
		const joinData = {
			size: targetSize,
			alias: sessionStorage.getItem('alias'),
		}; // overkill - we are sending a nuber
		const parseInput = JoinTournamentSchema.safeParse(joinData);
		if (!parseInput.success) {
			new TextModal(this.parent, 'Invalid tournament format');
			console.error(
				'Request validation failed:',
				z.treeifyError(parseInput.error)
			);
			return;
		}
		console.debug('Sending to /tounaments/join:', joinData);
		const { data: playerQueue, error } = await apiCall(
			'POST',
			`/tournaments/join`,
			TournamentQueueSchema,
			joinData
		);
		if (error) {
			console.error('Tournament join error:', error);
			const message = `Error ${error.status}: ${error.statusText}, ${error.message}`;
			new TextModal(this.parent, message);
			return;
		}
		if (!playerQueue) {
			new TextModal(this.parent, 'No response from tournament creation');
			return;
		}

		// checking if the game / tournament is full
		console.log('Tournament (game) actual players:', playerQueue.queue);
		const currentPlayers = playerQueue.queue.length;
		const isTournamentReady = currentPlayers === targetSize;

		// set up some game spec
		sessionStorage.setItem('thisPlayer', currentPlayers.toString());
		sessionStorage.setItem('targetSize', targetSize.toString());
		sessionStorage.setItem('gameMode', 'remote');

		// PLAYERS FULL: last player sending the start tournament request
		// will trigger the 'st' ws message
		// Validation overkill? it has been validated as a return schema already
		if (isTournamentReady) {
			const body = {
				creator: sessionStorage.getItem('userID') || '',
				participants: playerQueue.queue,
			};
			const parseInput2 = CreateTournamentApiSchema.safeParse(body);
			if (!parseInput2.success) {
				new TextModal(this.parent, 'Invalid tournament creation data');
				console.error(
					'Tournament creation validation failed:',
					z.treeifyError(parseInput2.error)
				);
				return;
			}
			console.log('Sending to /tournaments:', body);
			const { data: tournament, error: tournamentError } = await apiCall(
				'POST',
				`/tournaments`,
				TournamentSchema,
				body
			);
			if (tournamentError) {
				console.error('Tournament creation error:', tournamentError);
				const message = `Error ${tournamentError.status}: ${tournamentError.statusText}, ${tournamentError.message}`;
				new TextModal(this.parent, message);
				// Leave queue on error
				const { error } = await apiCall('POST', `/tournaments/leave`);
				if (error) {
					console.error('Error leaving tournament:', error);
					new TextModal(
						this.parent,
						`Failed to leave tournament: ${error.message}`
					);
				}
				return;
			}
			if (tournament) {
				console.info('Tournament created with ID:', tournament.id);
				sessionStorage.setItem('tournamentID', tournament.id);
			} else {
				new TextModal(
					this.parent,
					'Failed to create tournament. Leaving queue.'
				);
				console.error(
					'Failed to create tournament as last player. Leaving queue.'
				);
				const { error } = await apiCall('POST', `/tournaments/leave`);
				if (error) {
					console.error('Error leaving tournament:', error);
					new TextModal(
						this.parent,
						`Failed to leave tournament: ${error.message}`
					);
				}
			}
		}
	}
}
