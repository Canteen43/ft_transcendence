import { ERROR_FAILED_TO_CREATE_TOURNAMENT } from '../../shared/constants.js';
import { TournamentStatus } from '../../shared/enums.js';
import { DatabaseError } from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import { CreateMatch } from '../../shared/schemas/match.js';
import {
	CreateParticipant,
	Participant,
} from '../../shared/schemas/participant.js';
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
	static fields = 'id, size, current_round, settings_id, status';

	static getTournament(id: UUID): Tournament | null {
		const result = db.queryOne<Tournament>(
			`SELECT id, size, settings_id, status
		 FROM ${this.table}
		 WHERE id = ?`,
			[id]
		);

		if (!result) return null;
		return TournamentSchema.parse(result);
	}

	static getPendingTournament(userId: UUID): Tournament | null {
		const result = db.queryOne<Tournament>(
			`SELECT ${this.table}.id,
				${this.table}.size,
				${this.table}.settings_id,
				${this.table}.status
			FROM ${this.table}
			INNER JOIN ${ParticipantRepository.table}
			ON ${this.table}.id = ${ParticipantRepository.table}.tournament_id
			WHERE ${this.table}.status = ?
			AND   ${ParticipantRepository.table}.user_id = ?`,
			[TournamentStatus.Pending, userId]
		);

		if (!result) return null;
		return TournamentSchema.parse(result);
	}

	static createTournament(src: CreateTournament): Tournament {
		const result = db.queryOne<Tournament>(
			`INSERT INTO ${this.table} (size, settings_id, status)
			VALUES (?, ?, ?)
			RETURNING id, size, settings_id, status`,
			[src.size, src.settings_id, src.status]
		);

		if (!result) throw new DatabaseError(ERROR_FAILED_TO_CREATE_TOURNAMENT);
		return TournamentSchema.parse(result);
	}

	static createFullTournament(
		tournament: CreateTournament,
		participants: CreateParticipant[],
		matches: CreateMatch[]
	): { tournament: Tournament; participants: Participant[] } {
		return db.executeInTransaction(() => {
			logger.info('Creating tournament');
			const tournamentResult = this.createTournament(tournament);
			logger.debug(`Created tournament ${tournamentResult.id}`);

			const participantsResult = participants.map(p =>
				ParticipantRepository.createParticipant(tournamentResult.id, p)
			);
			logger.debug(`Created ${participantsResult.length} participants`);

			const matchesResult = MatchRepository.createMatches(
				tournamentResult.id,
				participantsResult,
				matches
			);
			logger.debug(`Created ${matchesResult.length} matches`);

			return {
				tournament: tournamentResult,
				participants: participantsResult,
			};
		});
	}

	static updateTournament(
		tournament_id: UUID,
		upd: UpdateTournament
	): Tournament | null {
		const row = db.queryOne<Tournament>(
			`UPDATE ${this.table}
		 SET status = ?
		 WHERE id = ?
		 RETURNING id, size, settings_id, status`,
			[upd.status, tournament_id]
		);

		if (!row) return null;
		return TournamentSchema.parse(row);
	}
}
