import { PlayerStatus } from '../../shared/enums.js';
import { UUID } from '../../shared/types.js';
import { Player } from '../types/interfaces.js';

export class Match {
	matchId: UUID;
	tournamentId: UUID;
	players: Player[];

	constructor(matchId: UUID, tournamentId: UUID, users: UUID[]) {
		this.matchId = matchId;
		this.tournamentId = tournamentId;
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

	getWinner(): Player {
		return this.players.reduce((winner, player) =>
			player.score > winner.score ? player : winner
		);
	}
}
