import * as zod from "zod";
import { TournamentStatus } from '../enums.js'
import { ALLOWED_TOURNAMENT_SIZES, ERROR_INVALID_TOURNAMENT_SIZE } from '../constants.js'

export const TournamentSchema = zod.object({
	id: 			zod.uuid(),
	size:			zod.number().int(),
	current_round:	zod.number().int(),
	settings:		zod.uuid(),
	status:			zod.enum(TournamentStatus),
});

export const CreateTournamentSchema = zod.object({
	creator:		zod.uuid(),
	participants:	zod.array(zod.uuid()).refine( // Check if tournament size is valid
		(arr) => ALLOWED_TOURNAMENT_SIZES.includes(arr.length),
		{message: ERROR_INVALID_TOURNAMENT_SIZE}
	),
});

export type Tournament = zod.infer<typeof TournamentSchema>
export type CreateTournament = zod.infer<typeof CreateTournamentSchema>
