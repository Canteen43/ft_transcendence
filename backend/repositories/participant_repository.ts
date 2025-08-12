import pg from 'pg'
import * as zod from "zod";
import * as db from '../utils/db.js';
import * as participantsSchemas from '../../shared/schemas/participant.js'
import * as user from '../../shared/schemas/user.js'
import type { UUID } from '../../shared/types.js'

export default class ParticipantRepository {
	static async createParticipant(
		createParticipant: participantsSchemas.CreateParticipant
	): Promise<participantsSchemas.Participant | null> {
		return null;
	}
}
