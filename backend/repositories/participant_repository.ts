import * as db from '../utils/db.js';
import {
	CreateParticipant,
	Participant,
	ParticipantSchema,
} from '../../shared/schemas/participant.js';
import { UUID } from '../../shared/types.js';
import { DatabaseError } from '../../shared/exceptions.js';

export default class ParticipantRepository {
	static table = 'tournament_participant';

	static async createParticipant(
		tournament_id: UUID,
		participant: CreateParticipant
	): Promise<Participant> {
		const result = await db.getClient().query<Participant>(
			`INSERT INTO ${this.table} (
				tournament_id,
				user_id,
				status
			) VALUES ($1, $2, $3)
			RETURNING id,
				tournament_id,
				user_id,
				status`,
			[tournament_id, participant.user_id, participant.status]
		);
		if (result.rowCount == 0)
			throw new DatabaseError('Failed to create participant');
		return ParticipantSchema.parse(result.rows[0]);
	}

	static async createParticipants(
		tournament_id: UUID,
		participants: CreateParticipant[]
	): Promise<Array<Participant>> {
		const result = await Promise.all(
			participants.map(p => this.createParticipant(tournament_id, p))
		);
		return result;
	}
}
