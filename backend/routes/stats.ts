import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as constants from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';
import { Ranking } from '../../shared/schemas/stats.js';
import { UUID } from '../../shared/types.js';
import { StatsRepository } from '../repositories/stats_repository.js';

async function getRanking(
	request: FastifyRequest<{ Params: { id: UUID } }>
): Promise<Ranking> {
	var result: Ranking | null;
	try {
		result = StatsRepository.getRanking();
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
	return result;
}

export default async function statsRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get('/ranking', getRanking);
}
