import z from 'zod';
import {
	ERROR_FAILED_TO_CREATE_MATCH,
	ERROR_FAILED_TO_UPDATE_MATCH,
} from '../../shared/constants.js';
import { MatchStatus, TournamentStatus } from '../../shared/enums.js';
import {
	DatabaseError,
	MatchNotFoundError,
	ParticipantNotFoundError,
	TournamentNotFoundError,
} from '../../shared/exceptions.js';
import {
	CreateMatch,
	Match,
	MatchSchema,
	MatchSchemaWithUserId,
	MatchWithUserId,
	UpdateMatch,
} from '../../shared/schemas/match.js';
import { Participant } from '../../shared/schemas/participant.js';
import { UpdateTournamentSchema } from '../../shared/schemas/tournament.js';
import type { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';
import ParticipantRepository from './participant_repository.js';
import TournamentRepository from './tournament_repository.js';

export default class MatchRepository {
	static table = 'tournament_match';
	static fields =
		'id, tournament_id, tournament_round, participant_1_id, participant_2_id, participant_1_score, participant_2_score, status';

	static matchPlusUserIdQuery = `
		SELECT tournament_match.id,
				tournament_match.tournament_id,
				tournament_match.tournament_round,
				tournament_match.participant_1_id,
				tournament_match.participant_2_id,
				tournament_match.participant_1_score,
				tournament_match.participant_2_score,
				tournament_match.status,
				p1.user_id as participant_1_user_id,
				p2.user_id as participant_2_user_id
		FROM ${this.table}
		LEFT JOIN ${ParticipantRepository.table} p1
			ON ${this.table}.participant_1_id = p1.id
		LEFT JOIN ${ParticipantRepository.table} p2
			ON ${this.table}.participant_2_id = p2.id`;

	static getMatch(
		match_id: UUID,
		status?: MatchStatus
	): MatchWithUserId | null {
		const result = db.queryOne(
			this.matchPlusUserIdQuery +
				`
			WHERE tournament_match.id = ?
			${status ? ' AND tournament_match.status = ?' : ''}`,
			status ? [match_id, status] : [match_id]
		);

		if (!result) return null;
		return MatchSchemaWithUserId.parse(result);
	}

	static getTournamentMatches(
		tournament_id: UUID,
		tournament_round?: number,
		user_id?: UUID
	): MatchWithUserId[] {
		let query =
			this.matchPlusUserIdQuery +
			`
			WHERE ${this.table}.tournament_id = ?`;

		const params: any[] = [tournament_id];

		if (tournament_round !== undefined) {
			query += ` AND tournament_round = ?`;
			params.push(tournament_round);
		}
		if (user_id !== undefined) {
			query += ` AND user_id = ?`;
			params.push(user_id);
		}

		const result = db.queryAll<MatchWithUserId>(query, params);
		return z.array(MatchSchemaWithUserId).parse(result);
	}

	static getWinners(tournament_id: UUID, round: number): UUID[] {
		const result = db.queryAll<{ winner_id: UUID }>(
			`SELECT
				CASE
					WHEN participant_1_score > participant_2_score THEN participant_1_id
					ELSE participant_2_id
				END as winner_id
			FROM ${this.table}
			WHERE tournament_id = ?
				AND tournament_round = ?
				AND status IN (?, ?)`,
			[tournament_id, round, MatchStatus.Finished, MatchStatus.InProgress]
		) as { winner_id: UUID }[];
		return result.map(row => row.winner_id);
	}

	static createMatch(tournament_id: UUID, src: CreateMatch): Match {
		const createdMatch = db.queryOne<Match>(
			`INSERT INTO ${this.table} (
				tournament_id,
				tournament_round,
				participant_1_id,
				participant_2_id,
				participant_1_score,
				participant_2_score,
				status
			) VALUES (?, ?, ?, ?, ?, ?, ?)
			RETURNING ${this.fields}`,
			[
				tournament_id,
				src.tournament_round,
				src.participant_1_id,
				src.participant_2_id,
				src.participant_1_score,
				src.participant_2_score,
				src.status,
			]
		);

		if (!createdMatch) {
			throw new DatabaseError(ERROR_FAILED_TO_CREATE_MATCH);
		}

		return MatchSchema.parse(createdMatch);
	}

	static updateMatch(match_id: UUID, upd: UpdateMatch): Match {
		const updatedMatch = db.queryOne<Match>(
			`UPDATE ${this.table}
		 SET participant_1_id = ?,
			 participant_2_id = ?,
			 participant_1_score = ?,
			 participant_2_score = ?,
			 status = ?
		 WHERE id = ?
		 RETURNING ${this.fields}`,
			[
				upd.participant_1_id,
				upd.participant_2_id,
				upd.participant_1_score,
				upd.participant_2_score,
				upd.status,
				match_id,
			]
		);

		if (!updatedMatch)
			throw new DatabaseError(ERROR_FAILED_TO_UPDATE_MATCH);

		return MatchSchema.parse(updatedMatch);
	}

	static createMatches(
		tournament_id: UUID,
		participants: Participant[],
		matches: CreateMatch[]
	): Array<Match> {
		const result: Array<Match> = [];
		for (const m of matches) {
			// Matches contain userIds, because participants are
			// not yet available when the schemas are created
			m.participant_1_id = this.getParticipantId(
				participants,
				m.participant_1_id
			);
			m.participant_2_id = this.getParticipantId(
				participants,
				m.participant_2_id
			);
			const match = this.createMatch(tournament_id, m);
			result.push(match);
		}
		return result;
	}

	static updateMatchesAfterPointScored(
		tournament_id: UUID,
		matches: { id: UUID; updateMatch: UpdateMatch }[],
		tournamentFinished: boolean
	): void {
		db.executeInTransaction(() => {
			for (const { id, updateMatch } of matches) {
				const match = this.updateMatch(id, updateMatch);
				if (!match) throw new MatchNotFoundError(id);
			}
			if (tournamentFinished) {
				const tournament = TournamentRepository.updateTournament(
					tournament_id,
					UpdateTournamentSchema.parse({
						status: TournamentStatus.Finished,
					})
				);
				if (!tournament)
					throw new TournamentNotFoundError(
						'tournament id',
						tournament_id
					);
			}
		});
	}

	private static getParticipantId(
		participants: Participant[],
		user_id: UUID | null
	): UUID | null {
		if (user_id === null) return null;

		const participant = participants.find(p => p.user_id === user_id);
		if (!participant)
			throw new ParticipantNotFoundError('user_id', user_id);
		return participant.id;
	}
}
