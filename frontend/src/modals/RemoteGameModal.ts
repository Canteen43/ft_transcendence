import * as z from 'zod';
import {
	JoinTournamentSchema,
	TournamentQueueSchema,
	TournamentSchema,
	CreateTournamentApiSchema,
} from '../../../shared/schemas/tournament';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { apiCall } from '../utils/apiCall';
import { WaitingModal } from './WaitingModal';
import { WaitingModal1v1 } from './WaitingModal1v1';

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
		this.destroy;
		sessionStorage.setItem('tournament', '0');
		new WaitingModal1v1(this.box);
	}

	private _tournament() {
		this.joinGame(4);
		this.destroy;
		sessionStorage.setItem('tournament', '1');
		new WaitingModal(this.box);
	}

	private async joinGame(playerCount: number) {

		// trying to join a tournament: send 2 or 4, get the array of players in that tournament
		const joinData = { size: playerCount };
		const parseInput = JoinTournamentSchema.safeParse(joinData);
		if (!parseInput.success) {
			alert('Invalid tournament format');
			console.error(
				'Request validation failed:',
				z.treeifyError(parseInput.error)
			);
			return;
		}
		const playerQueue = await apiCall(
			'POST',
			`/tournaments/join`,
			TournamentQueueSchema,
			joinData
		);
		if (!playerQueue) {
			// alert('Joining the game was unsuccessful');
			return;
		}

		// checking if the game / tournament is full
		console.log('Tournament actual players:', playerQueue.queue);
		const currentPlayers = playerQueue.queue.length;
		const isTournamentReady = currentPlayers === playerCount;

		// set up some game spec
		sessionStorage.setItem('thisPlayer', currentPlayers.toString());
		sessionStorage.setItem('playerCount', '2');
		sessionStorage.setItem('gameMode', 'remote');

		// sending the start tournament request
		if (isTournamentReady) {
			const body = {
				creator: sessionStorage.getItem("id") || "",
				participants: playerQueue.queue };
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


