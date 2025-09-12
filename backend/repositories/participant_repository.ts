import z from 'zod';
import {
	ERROR_FAILED_TO_CREATE_PARTICIPANT,
	ERROR_FAILED_TO_UPDATE_PARTICIPANT,
} from '../../shared/constants.js';
import {
	DatabaseError,
	ParticipantNotFoundError,
} from '../../shared/exceptions.js';
import {
	CreateParticipant,
	Participant,
	ParticipantSchema,
} from '../../shared/schemas/participant.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';

export default class ParticipantRepository {
	static table = 'tournament_participant';
	static fields = 'id, tournament_id, user_id';

	// Overloaded function for get participant
	// Takes a participant_id or
	// a tournament_id plus user_id
	static getParticipant(participant_id: UUID): Participant | null;
	static getParticipant(
		tournament_id: UUID,
		user_id: UUID
	): Participant | null;
	static getParticipant(arg1: UUID, arg2?: UUID): Participant | null {
		let query: string;
		let params: any[];

		if (arg2 === undefined) {
			query = `SELECT ${this.fields} FROM ${this.table} WHERE id = ?`;
			params = [arg1];
		} else {
			query = `SELECT ${this.fields} FROM ${this.table} WHERE tournament_id = ? AND user_id = ?`;
			params = [arg1, arg2];
		}

		const result = db.queryOne<Participant>(query, params);
		if (!result) return null;
		return ParticipantSchema.parse(result);
	}

	static getMatchParticipantUserId(participant_id: UUID | null): UUID {
		let participant: Participant | null = null;
		if (participant_id)
			participant = ParticipantRepository.getParticipant(participant_id);
		if (!participant || !participant.user_id)
			throw new ParticipantNotFoundError(
				'participant id',
				participant_id || 'empty'
			);
		return participant.user_id;
	}

	static getTournamentParticipants(tournament_id: UUID): Participant[] {
		const results = db.queryAll<Participant>(
			`SELECT ${this.fields} FROM ${this.table} WHERE tournament_id = ?`,
			[tournament_id]
		);
		return z.array(ParticipantSchema).parse(results);
	}

	static createParticipant(
		tournament_id: UUID,
		participant: CreateParticipant
	): Participant {
		const createdParticipant = db.queryOne<Participant>(
			`INSERT INTO ${this.table} (tournament_id, user_id)
			VALUES (?, ?)
			RETURNING ${this.fields}`,
			[tournament_id, participant.user_id]
		);

		if (!createdParticipant)
			throw new DatabaseError(ERROR_FAILED_TO_CREATE_PARTICIPANT);

		return ParticipantSchema.parse(createdParticipant);
	}
}
