import * as zod from "zod";
import { ALLOWED_TOURNAMENT_SIZES, ERROR_INVALID_TOURNAMENT_SIZE } from '../constants.js'
import { TournamentStatus } from '../enums.js'
import { zUUID } from '../types.js'

export const TournamentSchema = zod.object({
	id: 			zUUID,
	size:			zod.number().int(),
	current_round:	zod.number().int(),
	settings:		zUUID,
	status:			zod.enum(TournamentStatus),
});

export const CreateTournamentSchema = zod.object({
	creator:		zUUID,
	participants:	zod.array(zUUID).refine( // Check if tournament size is valid
		(arr) => ALLOWED_TOURNAMENT_SIZES.includes(arr.length),
		{message: ERROR_INVALID_TOURNAMENT_SIZE}
	),
});

export const CreateDbTournamentSchema = TournamentSchema.omit({ id: true});

export type Tournament = zod.infer<typeof TournamentSchema>
export type CreateTournament = zod.infer<typeof CreateTournamentSchema>
export type CreateDbTournament = zod.infer<typeof CreateDbTournamentSchema>
