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
	settings: zUUID,
	status: z.enum(TournamentStatus),
});

export const FullTournamentSchema = TournamentSchema.extend({
	players: z.array(ParticipantSchema),
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

export const UpdateTournamentSchema = TournamentSchema.pick({
	status: true,
});

export const JoinTournamentSchema = z.object({
	size: z.number().int(),
});

export const TournamentQueueSchema = z.object({
	queue: z.array(zUUID),
});

export type Tournament = z.infer<typeof TournamentSchema>;
export type FullTournament = z.infer<typeof FullTournamentSchema>;
export type CreateTournamentApi = z.infer<typeof CreateTournamentApiSchema>;
export type CreateTournament = z.infer<typeof CreateTournamentSchema>;
export type UpdateTournament = z.infer<typeof UpdateTournamentSchema>;
export type JoinTournament = z.infer<typeof JoinTournamentSchema>;
export type TournamentQueue = z.infer<typeof TournamentQueueSchema>;
