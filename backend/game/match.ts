import { FIELD_HEIGTH, FIELD_WIDTH } from '../../shared/constants.js';
import { MatchStatus } from '../../shared/enums.js';
import { UUID, Vector } from '../../shared/types.js';

export interface Participant {
	userId: UUID;
	participantId: UUID;
}

export class Match {
	matchId: UUID;
	users: UUID[];
	score: Vector;
	ballCoordinate: Vector;
	ballDirection: Vector;
	status: MatchStatus;
	paddlePos: number[];

	constructor(match_id: UUID, users: UUID[]) {
		this.matchId = match_id;
		this.users = users;
		this.score = { x: 0, y: 0 };
		this.ballCoordinate = { x: FIELD_WIDTH / 2, y: FIELD_HEIGTH / 2 };
		this.ballDirection = this.normalize({ x: 1, y: Math.random() * 2 });
		this.status = MatchStatus.Pending;
		this.paddlePos = new Array(users.length).fill(0);
	}

	private normalize(dir: Vector): Vector {
		const length = Math.sqrt(dir.x * dir.x + dir.y * dir.y);

		if (length === 0) return { x: 0, y: 0 };

		return {
			x: dir.x / length,
			y: dir.y / length,
		};
	}
}
