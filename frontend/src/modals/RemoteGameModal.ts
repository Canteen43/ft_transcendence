import * as z from 'zod';
import {
	CreateTournamentApiSchema,
	// JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../../shared/schemas/tournament';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { apiCall } from '../utils/apiCall';
import { WaitingModal } from './WaitingModal';

export class RemoteGameModal extends Modal {
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
		new Button('2 players', () => this._2_players(), this.box);
		new Button('tournament', () => this._tournament(), this.box);
	}

	private _2_players() {
		this.joinGame(2);
		this.destroy();
		sessionStorage.setItem('tournament', '0');
		new WaitingModal(this.parent);
	}

	private _tournament() {
		this.joinGame(4);
		this.destroy();
		sessionStorage.setItem('tournament', '1');
		new WaitingModal(this.parent);
	}

	private async joinGame(playerCount: number) {
		// API call to joinn a tournament
		// send 2 or 4, receive the array of players in that tournament

		// const joinData = { size: playerCount }; // overkill - we are sending a nuber
		// const parseInput = JoinTournamentSchema.safeParse(joinData);
		// if (!parseInput.success) {
		// 	alert('Invalid tournament format');
		// 	console.error(
		// 		'Request validation failed:',
		// 		z.treeifyError(parseInput.error)
		// 	);
		// 	return;
		// }
		const playerQueue = await apiCall(
			'POST',
			`/tournaments/join`,
			TournamentQueueSchema,
			{ size: playerCount }
		);
		if (!playerQueue) {
			console.error('No response from tournament creation');
			return;
		}

		// checking if the game / tournament is full
		console.log('Tournament (game) actual players:', playerQueue.queue);
		const currentPlayers = playerQueue.queue.length;
		const isTournamentReady = currentPlayers === playerCount;

		// set up some game spec
		// TODO : move to when we receive the full tournament infos
		sessionStorage.setItem('thisPlayer', currentPlayers.toString());
		sessionStorage.setItem('playerCount', playerCount.toString());
		sessionStorage.setItem('gameMode', 'remote');

		// PLAYERS FULL: last player sending the start tournament request
		// will trigger the 'st' ws message
		// Validation overkill? it has been validated as a return schema already
		if (isTournamentReady) {
			const body = {
				creator: sessionStorage.getItem('id') || '',
				participants: playerQueue.queue,
			};
			const parseInput2 = CreateTournamentApiSchema.safeParse(body);
			console.log('Sending to /tournaments/join:', body);
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
				alert('Tournament started successfully!');
			} else {
				console.error('Failed to create tournament');
				alert('Failed to start tournament');
			}
		}
	}
}
