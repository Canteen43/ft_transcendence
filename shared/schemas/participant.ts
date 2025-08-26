import * as z from 'zod';
import { ParticipantStatus } from '../enums.js';
import { zUUID } from '../types.js';

export const ParticipantSchema = z.object({
	id: zUUID,
	tournament_id: zUUID,
	user_id: zUUID,
	status: z.enum(ParticipantStatus),
});

export const CreateParticipantSchema = ParticipantSchema.omit({
	id: true,
	tournament_id: true,
});

export const UpdateParticipantSchema = ParticipantSchema.pick({
	status: true,
});

export type Participant = z.infer<typeof ParticipantSchema>;
export type CreateParticipant = z.infer<typeof CreateParticipantSchema>;
export type UpdateParticipant = z.infer<typeof UpdateParticipantSchema>;
