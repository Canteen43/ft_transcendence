import { TournamentSchema } from '../../../shared/schemas/tournament';
import { UserSchema } from '../../../shared/schemas/user';
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
		new WaitingModal1v1(this.box);
	}

	private _tournament() {
		this.joinGame(4);
		new WaitingModal(this.box);
	}

	private async joinGame(playerCount: number) {
		// GetUser is a placeholder. The real API will provide a list of players waiting
		const ret = await apiCall(
			'GET',
			`/users/login/${sessionStorage.getItem('username')}`,
			UserSchema
		);
		// if (ret) is a placeholder. The real API will check if enough players are waiting
		if (ret) {
			console.info('Placeholder condition met');
			const body = {
				creator: '550e8400-e29b-41d4-a716-446655440001',
				participants: [
					'550e8400-e29b-41d4-a716-446655440001',
					'550e8400-e29b-41d4-a716-446655440002',
				],
			};
			const ret2 = await apiCall(
				'POST',
				`/tournaments`,
				TournamentSchema,
				body
			);
			if (ret2) console.info('Tournament created with ID:', ret2.id);
			else console.error('Failed to create tournament');
		}
	}
}
