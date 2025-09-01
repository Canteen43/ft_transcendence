import { FIELD_HEIGTH, FIELD_WIDTH } from '../../shared/constants.js';
import { MatchStatus, ParticipantStatus } from '../../shared/enums.js';
import { UUID, Vect2 } from '../../shared/types.js';
import { Player } from '../types/interfaces.js';

export interface Participant {
	userId: UUID;
	participantId: UUID;
}

export class Match {
	matchId: UUID;
	players: Player[];
	score: Vect2;
	ballCoordinate: Vect2;
	ballDirection: Vect2;
	status: MatchStatus;

	constructor(match_id: UUID, users: UUID[], creator: UUID) {
		this.matchId = match_id;
		this.score = { x: 0, y: 0 };
		this.ballCoordinate = { x: FIELD_WIDTH / 2, y: FIELD_HEIGTH / 2 };
		this.ballDirection = this.normalize({ x: 1, y: Math.random() * 2 });
		this.status = MatchStatus.Pending;
		this.players = users.map(userId => ({
			userId: userId,
			score: 0,
			paddlePos: 0,
			status:
				userId == creator
					? ParticipantStatus.Accepted
					: ParticipantStatus.Pending,
		}));
	}

	getUsers(): UUID[] {
		return this.players.map(p => p.userId);
	}

	accept(userId: UUID) {
		const player = this.players.find(p => p.userId === userId);
		if (player) player.status = ParticipantStatus.Accepted;
	}

	allAccepted(): boolean {
		return this.players.every(p => p.status === ParticipantStatus.Accepted);
	}

	private normalize(dir: Vect2): Vect2 {
		const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y);

		if (length === 0) return { x: 0, y: 0 };

		return {
			x: dir.x / length,
			y: dir.y / length,
		};
	}
}
