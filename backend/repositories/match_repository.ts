import * as db from '../utils/db.js';
import { CreateMatch, Match, MatchSchema } from '../../shared/schemas/match.js';
import type { UUID } from '../../shared/types.js';

export default class ParticipantRepository {
	static table = '"tournament_match"';

	static async createMatch(src: CreateMatch): Promise<Match | null> {
		const result = await db.pool.query<Match>(
			`INSERT INTO ${this.table} (
				tournament_id,
				tournament_round,
				participant_1_id,
				participant_2_id,
				participant_1_score,
				participant_2_score,
				status
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING id,
					  tournament_id,
					  tournament_round,
					  participant_1_id,
					  participant_2_id,
					  participant_1_score,
					  participant_2_score,
					  status`,
			[
				src.tournament_id,
				src.tournament_round,
				src.participant_1_id,
				src.participant_2_id,
				src.participant_1_score,
				src.participant_2_score,
				src.status,
			]
		);
		return MatchSchema.parse(result.rows[0]);
	}
}
