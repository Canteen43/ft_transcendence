import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as zod from 'zod';
import TournamentService from '../services/tournament_service.js';
import {
	CreateTournamentApi,
	CreateTournamentApiSchema,
} from '../../shared/schemas/tournament.js';
import * as constants from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';

async function createTournament(
	request: FastifyRequest<{ Body: CreateTournamentApi }>
) {
	try {
		const parsedBody = CreateTournamentApiSchema.parse(request.body);
		const tournament = TournamentService.createTournament(
			parsedBody.creator,
			parsedBody.participants
		);
		return tournament;
	} catch (error) {
		logger.error(error);
		if (error instanceof zod.ZodError)
			throw request.server.httpErrors.badRequest(error.message);
		throw request.server.httpErrors.internalServerError(
			constants.TOURNAMENT_CREATION_FAILED
		);
	}
}

export default async function (
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.post<{ Body: CreateTournamentApi }>(
		'/tournaments',
		createTournament
	);
}
