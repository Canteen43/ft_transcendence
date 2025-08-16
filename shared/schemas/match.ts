import * as zod from 'zod';
import { MatchStatus } from '../enums.js';
import { zUUID } from '../types.js';

export const MatchSchema = zod.object({
	id: zUUID,
	tournament_id: zUUID,
	tournament_round: zod.number().int(),
	participant_1_id: zUUID.nullable(),
	participant_2_id: zUUID.nullable(),
	participant_1_score: zod.number().int(),
	participant_2_score: zod.number().int(),
	status: zod.enum(MatchStatus),
});

export const CreateMatchSchema = MatchSchema.omit({
	id: true,
	tournament_id: true,
}).extend({
	participant_1_score: zod.number().int().default(0),
	participant_2_score: zod.number().int().default(0),
	status: zod.enum(MatchStatus).default(MatchStatus.Pending),
});

export type Match = zod.infer<typeof MatchSchema>;
export type CreateMatch = zod.infer<typeof CreateMatchSchema>;
