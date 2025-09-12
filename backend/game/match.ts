import { PlayerStatus } from '../../shared/enums.js';
import { UUID, Vect2 } from '../../shared/types.js';
import { Player } from '../types/interfaces.js';

export class Match {
	matchId: UUID;
	players: Player[];

	constructor(match_id: UUID, users: UUID[], creator: UUID) {
		this.matchId = match_id;
		this.players = users.map(userId => ({
			userId: userId,
			score: 0,
			paddlePos: 0,
			status: PlayerStatus.Pending,
		}));
	}

	getUsers(): UUID[] {
		return this.players.map(p => p.userId);
	}

	accept(userId: UUID) {
		const player = this.players.find(p => p.userId === userId);
		if (player) player.status = PlayerStatus.Accepted;
	}

	allAccepted(): boolean {
		return this.players.every(p => p.status === PlayerStatus.Accepted);
	}
}
