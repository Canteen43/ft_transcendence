import type { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import * as constants from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';
import { MatchWithUserId } from '../../shared/schemas/match.js';
import { UUID, zUUID } from '../../shared/types.js';
import MatchRepository from '../repositories/match_repository.js';
import { routeConfig } from '../utils/http_utils.js';

async function getMatch(
	request: FastifyRequest<{ Params: { id: UUID } }>
): Promise<MatchWithUserId> {
	var result: MatchWithUserId | null;
	try {
		result = MatchRepository.getMatch(request.params.id);
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
	if (!result)
		throw request.server.httpErrors.notFound(
			constants.ERROR_MATCH_NOT_FOUND
		);
	return result;
}

export default async function matchRoutes(fastify: FastifyInstance) {
	fastify.get(
		'/:id',
		routeConfig({
			params: z.object({ id: zUUID }),
		}),
		getMatch
	);
}
