import * as z from 'zod';
import { MatchStatus } from '../enums.js';
import { zUUID } from '../types.js';

export const MatchSchema = z.object({
	id: zUUID,
	tournament_id: zUUID,
	tournament_round: z.number().int(),
	participant_1_id: zUUID.nullable(),
	participant_2_id: zUUID.nullable(),
	participant_1_score: z.number().int(),
	participant_2_score: z.number().int(),
	status: z.enum(MatchStatus),
});

export const CreateMatchSchema = MatchSchema.omit({
	id: true,
	tournament_id: true,
}).extend({
	participant_1_score: z.number().int().default(0),
	participant_2_score: z.number().int().default(0),
	status: z.enum(MatchStatus).default(MatchStatus.Pending),
});

export type Match = z.infer<typeof MatchSchema>;
export type CreateMatch = z.infer<typeof CreateMatchSchema>;
