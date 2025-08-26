'use strict';

import z from 'zod';
import { DatabaseError } from '../../shared/exceptions.js';
import {
	CreateParticipant,
	Participant,
	ParticipantSchema,
	UpdateParticipant,
} from '../../shared/schemas/participant.js';
import { UUID } from '../../shared/types.js';
import * as db from '../utils/db.js';

export default class ParticipantRepository {
	static table = 'tournament_participant';
	static fields = 'id, tournament_id, user_id, status';

	// Overloaded function for get participant
	// Takes a participant_id or a tournament_id
	// plus user_id
	static async getParticipant(
		participant_id: UUID
	): Promise<Participant | null>;
	static async getParticipant(
		tournament_id: UUID,
		user_id: UUID
	): Promise<Participant | null>;
	static async getParticipant(
		arg1: UUID,
		arg2?: UUID
	): Promise<Participant | null> {
		var query, args;
		if (arg2 === undefined) {
			query = `SELECT ${this.fields}
					FROM ${this.table}
					WHERE participant_id = $1`;
			args = [arg1];
		} else {
			query = `SELECT ${this.fields}
					FROM ${this.table}
					WHERE tournament_id = $1 AND user_id = $2`;
			args = [arg1, arg2];
		}
		const result = await db.pool.query<Participant>(query, args);
		if (!result.rowCount) return null;
		return ParticipantSchema.parse(result.rows[0]);
	}

	static async getTournamentParticipants(
		tournament_id: UUID
	): Promise<Participant[]> {
		const result = await db.pool.query<Participant>(
			`SELECT	${this.fields}
			FROM ${this.table}
			WHERE tournament_id = $1`,
			[tournament_id]
		);
		return z.array(ParticipantSchema).parse(result.rows);
	}

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
			RETURNING ${this.fields};`,
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

	static async updateParticipant(
		participant_id: UUID,
		upd: UpdateParticipant
	) {
		const result = await db.pool.query(
			`UPDATE ${this.table}
			SET status = $1
			WHERE id = $2
			RETURNING ${this.fields}`,
			[upd.status, participant_id]
		);
		if (result.rowCount == 0)
			throw new DatabaseError('Failed to update match');
		return ParticipantSchema.parse(result.rows[0]);
	}
}
