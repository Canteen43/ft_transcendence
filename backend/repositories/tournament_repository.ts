import * as db from '../utils/db.js';

import {
	CreateTournament,
	Tournament,
	TournamentSchema,
} from '../../shared/schemas/tournament.js';
import { CreateParticipant } from '../../shared/schemas/participant.js';
import { CreateMatch } from '../../shared/schemas/match.js';
import MatchRepository from './match_repository.js';
import ParticipantRepository from './participant_repository.js';
import { DatabaseError } from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';

export default class TournamentRepository {
	static table = 'tournament';

	static async createTournament(src: CreateTournament): Promise<Tournament> {
		const result = await db.getClient().query<Tournament>(
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
		if (result.rowCount == 0)
			throw new DatabaseError('Failed to create match');
		return TournamentSchema.parse(result.rows[0]);
	}

	static async createFullTournament(
		tournament: CreateTournament,
		participants: CreateParticipant[],
		matches: CreateMatch[]
	): Promise<Tournament> {
		return await db.executeInTransaction(async () => {
			logger.info('Creating tournament');
			const tournamentResult = await this.createTournament(tournament);
			logger.debug(`Created tournament ${tournamentResult.id}`);

			const participsResult =
				await ParticipantRepository.createParticipants(
					tournamentResult.id,
					participants
				);
			logger.debug(`Created ${participsResult.length} participants`);

			const matchesResult = await MatchRepository.createMatches(
				tournamentResult.id,
				participsResult,
				matches
			);
			logger.debug(`Created ${matchesResult.length} matches`);

			return tournamentResult;
		});
	}
}
