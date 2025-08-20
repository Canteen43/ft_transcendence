'use strict';

import z from 'zod';
import { MatchStatus } from '../../shared/enums.js';
import { DatabaseError } from '../../shared/exceptions.js';
import { CreateMatch, Match, MatchSchema } from '../../shared/schemas/match.js';
import { Participant } from '../../shared/schemas/participant.js';
import type { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';

export default class MatchRepository {
	static table = '"tournament_match"';

	static async getTournamentMatches(
		tournament_id: UUID,
		tournament_round?: number
	): Promise<Match[]> {
		var query = `
		SELECT
			id,
			tournament_id,
			tournament_round,
			participant_1_id,
			participant_2_id,
			participant_1_score,
			participant_2_score,
			status
		FROM ${this.table}
		WHERE tournament_id = $1`;

		const params: any[] = [tournament_id];

		if (tournament_round !== undefined) {
			query += ` AND tournament_round = $2`;
			params.push(tournament_round);
		}

		const result = await db.pool.query<Match>(query, params);
		return z.array(MatchSchema).parse(result.rows);
	}

	static async getNumberOfUnfinishedMatches(
		tournament_id: UUID,
		tournament_round?: number
	): Promise<number> {
		var query = `
		SELECT COUNT(*) as count
		FROM ${this.table}
		WHERE tournament_id = $1 AND status != $2`;

		const params: any[] = [tournament_id, MatchStatus.Finished];

		if (tournament_round !== undefined) {
			query += ` AND tournament_round = $3`;
			params.push(tournament_round);
		}

		const result = await db.pool.query(query, params);
		return parseInt(result.rows[0].count);
	}

	static async getWinners(
		tournament_id: UUID,
		round: number
	): Promise<UUID[]> {
		const result = await db.pool.query(
			`SELECT
				CASE
					WHEN participant_1_score > participant_2_score THEN participant_1_id
					ELSE participant_2_id
				END as winner_id
			FROM ${this.table}
			WHERE tournament_id = $1
				AND tournament_round = $2
				AND status = $3
				AND (participant_1_score IS NOT NULL AND participant_2_score IS NOT NULL)`,
			[tournament_id, round]
		);

		return result.rows.map(row => row.winner_id);
	}

	static async createMatch(
		tournament_id: UUID,
		participant_1_id: UUID | null,
		participant_2_id: UUID | null,
		src: CreateMatch
	): Promise<Match> {
		const result = await db.getClient().query<Match>(
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
				status;`,
			[
				tournament_id,
				src.tournament_round,
				participant_1_id,
				participant_2_id,
				src.participant_1_score,
				src.participant_2_score,
				src.status,
			]
		);
		if (result.rowCount == 0)
			throw new DatabaseError('Failed to create match');
		return MatchSchema.parse(result.rows[0]);
	}

	static async createMatches(
		tournament_id: UUID,
		participants: Participant[],
		matches: CreateMatch[]
	): Promise<Array<Match>> {
		const result: Array<Match> = [];
		for (const m of matches) {
			const participant_1_id = this.getParticipantId(
				participants,
				m.participant_1_id
			);
			const participant_2_id = this.getParticipantId(
				participants,
				m.participant_2_id
			);
			const match = await this.createMatch(
				tournament_id,
				participant_1_id,
				participant_2_id,
				m
			);
			result.push(match);
		}
		return result;
	}

	static async updateParticipants(
		match_id: UUID,
		participant_1_id: UUID,
		participant_2_id: UUID
	) {
		await db.pool.query(
			`UPDATE ${this.table}
			SET participant_1_id = $1,
				participant_2_id = $2
			WHERE id = $3`,
			[participant_1_id, participant_2_id, match_id]
		);
	}

	private static getParticipantId(
		participants: Participant[],
		user_id: UUID | null
	): UUID | null {
		if (user_id === null) return null;

		const participant = participants.find(p => p.user_id === user_id);
		if (!participant)
			throw new DatabaseError(
				'Participant not found while creating match'
			);
		return participant.id;
	}
}
