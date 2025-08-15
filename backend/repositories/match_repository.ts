import * as db from '../utils/db.js';
import { CreateMatch, Match, MatchSchema } from '../../shared/schemas/match.js';
import type { UUID } from '../../shared/types.js';
import { DatabaseError } from '../../shared/exceptions.js';
import { Participant } from '../../shared/schemas/participant.js';
import z from 'zod';

export default class MatchRepository {
	static table = '"tournament_match"';

	static async getTournamentMatches(tournament_id: UUID): Promise<Match[]> {
		const result = await db.pool.query<Match>(
			`SELECT
				id,
				tournament_id,
				tournament_round,
				participant_1_id,
				participant_2_id,
				participant_1_score,
				participant_2_score,
				status
			FROM ${this.table}
			WHERE tournament_id = $1;`,
			[tournament_id]
		);
		return z.array(MatchSchema).parse(result.rows);
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
