import * as zod from "zod";
import { ParticipantStatus } from '../enums.js'

export const ParticipantSchema = zod.object({
	id: 					zod.uuid(),
	tournament_id:			zod.uuid(),
	user_id:				zod.uuid(),
	status:					zod.enum(ParticipantStatus),
});

export const CreateParticipantSchema = ParticipantSchema.omit({
	 id: true,
	 status: true,
});

export type Participant = zod.infer<typeof ParticipantSchema>
export type CreateParticipant = zod.infer<typeof CreateParticipantSchema>
