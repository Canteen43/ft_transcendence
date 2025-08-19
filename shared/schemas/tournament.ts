import * as z from 'zod';
import {
	ALLOWED_TOURNAMENT_SIZES,
	ERROR_INVALID_TOURNAMENT_SIZE,
} from '../constants.js';
import { TournamentStatus } from '../enums.js';
import { zUUID } from '../types.js';
import { MatchSchema } from './match.js';
import { ParticipantSchema } from './participant.js';

export const TournamentSchema = z.object({
	id: zUUID,
	size: z.number().int(),
	current_round: z.number().int(),
	settings: zUUID,
	status: z.enum(TournamentStatus),
});

export const FullTournamentSchema = TournamentSchema.extend({
	participants: z.array(ParticipantSchema),
	matches: z.array(MatchSchema),
});

export const CreateTournamentSchema = TournamentSchema.omit({ id: true });

export const CreateTournamentApiSchema = z.object({
	creator: zUUID,
	participants: z.array(zUUID).refine(
		// Check if tournament size is valid
		arr => ALLOWED_TOURNAMENT_SIZES.includes(arr.length),
		{ message: ERROR_INVALID_TOURNAMENT_SIZE }
	),
});

export type Tournament = z.infer<typeof TournamentSchema>;
export type FullTournament = z.infer<typeof FullTournamentSchema>;
export type CreateTournamentApi = z.infer<typeof CreateTournamentApiSchema>;
export type CreateTournament = z.infer<typeof CreateTournamentSchema>;
