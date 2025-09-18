import { z } from 'zod';
import {
	CreateTournamentApiSchema,
	FullTournamentSchema,
	JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../../shared/schemas/tournament';
import { Button } from '../buttons/Button';
import { ReadyModal } from '../modals/ReadyModal';
import { apiCall } from '../utils/apiCall';
import { state } from '../utils/State';
import { Modal } from './Modal';
import { WaitingModal } from './WaitingModal';

export class AliasModal extends Modal {
	private aliasFields: HTMLInputElement[] = [];

	constructor(parent: HTMLElement, n: number) {
		super(parent);

		const username = sessionStorage.getItem('username') ?? '';
		const alias = sessionStorage.getItem('alias1') ?? '';
		const aliases = [
			sessionStorage.getItem('player1Alias') ?? '',
			sessionStorage.getItem('player2Alias') ?? '',
			sessionStorage.getItem('player3Alias') ?? '',
			sessionStorage.getItem('player4Alias') ?? '',
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
		if (state.gameMode === 'local') {
			location.hash = '#game';
		} else {
			this.joinGame(state.tournamentSize);
			new WaitingModal(this.parent);
		}
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

	// TODO: function to seperate file to separate concerns?
	private async joinGame(targetSize: number) {
		// API call to join a tournament
		// send 2 or 4 + alias, receive the array of players in that tournament

		const joinData = {
			size: targetSize,
			alias: sessionStorage.getItem('alias1'),
		}; // overkill - we are sending a nuber
		const parseInput = JoinTournamentSchema.safeParse(joinData);
		if (!parseInput.success) {
			alert('Invalid tournament format');
			console.error(
				'Request validation failed:',
				z.treeifyError(parseInput.error)
			);
			return;
		}
		console.debug('Sending to /tounaments/join:', joinData);
		const playerQueue = await apiCall(
			'POST',
			`/tournaments/join`,
			TournamentQueueSchema,
			joinData
		);
		if (!playerQueue) {
			console.error('No response from tournament creation');
			return;
		}

		// checking if the game / tournament is full
		console.log('Tournament (game) actual players:', playerQueue.queue);
		const currentPlayers = playerQueue.queue.length;
		const isTournamentReady = currentPlayers === targetSize;

		// set up some game spec
		// TODO : move to when we receive the full tournament infos
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
			console.log('Sending to /tournaments:', body);
			if (!parseInput2.success) {
				alert('Invalid tournament creation data');
				console.error(
					'Tournament creation validation failed:',
					z.treeifyError(parseInput2.error)
				);
				return;
			}
			const tournament = await apiCall(
				'POST',
				`/tournaments`,
				TournamentSchema,
				body
			);
			if (tournament) {
				console.info('Tournament created with ID:', tournament.id);
				// sessionStorage.setItem('tournamentId', tournament.id);
			} else {
				console.error(
					'Failed to create tournament as last player. Leaving queue.'
				);
				apiCall('POST', `/tournaments/leave`);
			}
		}
	}
}