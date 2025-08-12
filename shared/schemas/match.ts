import * as zod from "zod";
import { MatchStatus } from '../enums.js'

export const MatchSchema = zod.object({
	id: 					zod.uuid(),
	tournament_id:			zod.uuid(),
	participant_1_id:		zod.uuid(),
	participant_2_id:		zod.uuid(),
	participant_1_score:	zod.number().int(),
	participant_2_score:	zod.number().int(),
	tournament_round:		zod.number().int(),
	status:					zod.enum(MatchStatus),
});

export const CreateMatchSchema = MatchSchema.omit({
	 id: true,
	 participant_1_score: true,
	 participant_2_score: true,
	 tournament_round: true,
	 status: true,
});

export type Match = zod.infer<typeof MatchSchema>
export type CreateMatch = zod.infer<typeof CreateMatchSchema>
