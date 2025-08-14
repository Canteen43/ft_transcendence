import * as db from '../utils/db.js';
import {
	CreateDbTournament,
	Tournament,
	TournamentSchema,
} from '../../shared/schemas/tournament.js';
import * as user from '../../shared/schemas/user.js';

export default class TournamentRepository {
	static table = 'tournament';

	static async createTournament(
		src: CreateDbTournament
	): Promise<Tournament | null> {
		const result = await db.pool.query<Tournament>(
			`INSERT INTO ${this.table} (
				size,
				current_round,
				settings,
				status
			) VALUES ($1, $2, $3, $4)
			RETURNING id,
				size,
				current_round,
				settings,
				status`,
			[src.size, src.current_round, src.settings, src.status]
		);
		return TournamentSchema.parse(result.rows[0]);
	}
}
