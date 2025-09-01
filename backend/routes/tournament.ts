'use strict';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as z from 'zod';
import * as constants from '../../shared/constants.js';
import { TournamentNotFoundError } from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	CreateTournamentApi,
	CreateTournamentApiSchema,
	FullTournament,
	FullTournamentSchema,
	Tournament,
	TournamentSchema,
} from '../../shared/schemas/tournament.js';
import { UUID, zUUID } from '../../shared/types.js';
import TournamentService from '../services/tournament_service.js';
import { routeConfig } from '../utils/http_utils.js';

async function createTournament(
	request: FastifyRequest<{ Body: CreateTournamentApi }>
): Promise<Tournament> {
	try {
		const tournament = TournamentService.createTournament(
			request.body.creator,
			request.body.participants
		);
		return tournament;
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

async function getTournament(
	request: FastifyRequest<{ Params: { id: UUID } }>
): Promise<FullTournament> {
	var result: FullTournament | null;
	try {
		result = TournamentService.getFullTournament(request.params.id);
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
	if (!result)
		throw request.server.httpErrors.notFound(
			constants.ERROR_USER_NOT_FOUND
		);
	return result;
}

export default async function tournamentRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get(
		'/:id',
		routeConfig({
			params: z.object({ id: zUUID }),
			response: FullTournamentSchema,
		}),
		getTournament
	);

	fastify.post(
		'/',
		routeConfig({
			body: CreateTournamentApiSchema,
			response: TournamentSchema,
		}),
		createTournament
	);
}
