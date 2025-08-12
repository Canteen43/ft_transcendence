import pg from 'pg'
import * as zod from "zod";
import * as db from '../utils/db.js';
import * as matchSchemas from '../../shared/schemas/match.js'
import * as user from '../../shared/schemas/user.js'
import type { UUID } from '../../shared/types.js'

export default class ParticipantRepository {
	static async createMatches(
		tournament: UUID,
		participants: UUID[]
	): Promise<matchSchemas.Match[] | null> {
		return null;
	}
}
