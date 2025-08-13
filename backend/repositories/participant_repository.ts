import * as db from '../utils/db.js';
import {
	CreateParticipant,
	Participant,
	ParticipantSchema,
} from '../../shared/schemas/participant.js';

export default class ParticipantRepository {
	static table = 'tournament_participant';

	static async createParticipant(
		src: CreateParticipant
	): Promise<Participant | null> {
		const result = await db.pool.query<Participant>(
			`INSERT INTO ${this.table} (
				tournament_id,
				user_id,
				status
			) VALUES ($1, $2, $3)
			RETURNING id,
				tournament_id,
				user_id,
				status`,
			[src.tournament_id, src.user_id, src.status]
		);
		return ParticipantSchema.parse(result.rows[0]);
	}
}
