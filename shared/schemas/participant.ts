import * as z from 'zod';
import { zUUID } from '../types.js';

export const ParticipantSchema = z.object({
	id: zUUID,
	tournament_id: zUUID,
	user_id: zUUID,
	alias: z.string(),
});

export const CreateParticipantSchema = ParticipantSchema.omit({
	id: true,
	tournament_id: true,
});

export type Participant = z.infer<typeof ParticipantSchema>;
export type CreateParticipant = z.infer<typeof CreateParticipantSchema>;
