import * as zod from "zod";
import { ParticipantStatus } from '../enums.js'
import { zUUID } from '../types.js'

export const ParticipantSchema = zod.object({
	id: 					zUUID,
	tournament_id:			zUUID,
	user_id:				zUUID,
	status:					zod.enum(ParticipantStatus),
});

export const CreateParticipantSchema = ParticipantSchema.omit({ id: true });

export type Participant = zod.infer<typeof ParticipantSchema>
export type CreateParticipant = zod.infer<typeof CreateParticipantSchema>
