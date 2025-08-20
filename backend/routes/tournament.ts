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
import { zodError } from '../../shared/utils.js';
import TournamentService from '../services/tournament_service.js';
import { getHttpResponse } from '../utils/http_utils.js';

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
		if (error instanceof z.ZodError)
			throw request.server.httpErrors.badRequest(zodError(error));
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

async function getTournament(
	request: FastifyRequest<{ Params: { id: UUID } }>
): Promise<FullTournament> {
	try {
		const result = await TournamentService.getFullTournament(
			request.params.id
		);
		if (!result)
			throw request.server.httpErrors.notFound(
				constants.ERROR_USER_NOT_FOUND
			);
		return result;
	} catch (error) {
		if (error instanceof z.ZodError)
			throw request.server.httpErrors.badRequest(zodError(error));
		if (error instanceof TournamentNotFoundError)
			throw request.server.httpErrors.notFound(error.message);
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

export default async function tournamentRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get(
		'/:id',
		getHttpResponse({
			params: z.object({ id: zUUID }),
			response: FullTournamentSchema,
		}),
		getTournament
	);

	fastify.post(
		'/',
		getHttpResponse({
			body: CreateTournamentApiSchema,
			response: TournamentSchema,
		}),
		createTournament
	);
}
