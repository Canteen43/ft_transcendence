'use strict';

import { TournamentStatus } from '../../shared/enums.js';
import { DatabaseError } from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import { CreateMatch } from '../../shared/schemas/match.js';
import { CreateParticipant } from '../../shared/schemas/participant.js';
import {
	CreateTournament,
	Tournament,
	TournamentSchema,
	UpdateTournament,
} from '../../shared/schemas/tournament.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';
import MatchRepository from './match_repository.js';
import ParticipantRepository from './participant_repository.js';

export default class TournamentRepository {
	static table = 'tournament';
	static fields = 'id, size, current_round, settings, status';

	static async getTournament(id: UUID): Promise<Tournament | null> {
		const result = await db.pool.query<Tournament>(
			`SELECT id,
					size,
					settings,
					status
			FROM ${this.table}
			WHERE id = $1 ;`,
			[id]
		);
		if (result.rowCount == 0) return null;
		return TournamentSchema.parse(result.rows[0]);
	}

	static async getPendingTournament(
		userId: UUID
	): Promise<Tournament | null> {
		const result = await db.pool.query<Tournament>(
			`SELECT id,
					size,
					settings,
					status
			FROM ${this.table}
			INNER JOIN ${ParticipantRepository.table}
				ON ${this.table}.id = ${ParticipantRepository.table}.tournament_id
			WHERE ${this.table}.status = $1
			AND ${ParticipantRepository.table}.user_id = $2;`,
			[TournamentStatus.Pending, userId]
		);
		if (result.rowCount == 0) return null;
		return TournamentSchema.parse(result.rows[0]);
	}

	static async createTournament(src: CreateTournament): Promise<Tournament> {
		const result = await db.getClient().query<Tournament>(
			`INSERT INTO ${this.table} (
				size,
				settings,
				status
			) VALUES ($1, $2, $3)
			RETURNING id,
				size,
				settings,
				status`,
			[src.size, src.settings, src.status]
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

	static async updateTournament(tournament_id: UUID, upd: UpdateTournament) {
		await db.pool.query(
			`UPDATE ${this.table}
			SET status = $1,
			WHERE id = $2
			RETURNING ${this.fields}`,
			[upd.status, tournament_id]
		);
	}
}
