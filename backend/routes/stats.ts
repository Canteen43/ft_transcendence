import type { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import * as constants from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';
import {
	PercentageWinsHistory,
	PercentageWinsHistorySchema,
	Ranking,
	RankingItem,
	RankingItemSchema,
	RankingSchema,
	TournamentStats,
	TournamentStatsSchema,
} from '../../shared/schemas/stats.js';
import { UUID, zUUID } from '../../shared/types.js';
import { StatsRepository } from '../repositories/stats_repository.js';
import { routeConfig } from '../utils/http_utils.js';

async function getRanking(request: FastifyRequest): Promise<Ranking> {
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

async function getUserRankingItem(
	request: FastifyRequest<{ Params: { user_id: UUID } }>
): Promise<RankingItem> {
	var result: RankingItem | null;
	try {
		result = StatsRepository.getUserRankingItem(request.params.user_id);
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

async function getTournamentStats(
	request: FastifyRequest<{ Params: { user_id: UUID } }>
): Promise<TournamentStats> {
	var result: TournamentStats | null;
	try {
		result = StatsRepository.getTournamentStats(request.params.user_id);
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

async function getPercentageWinsHistory(
	request: FastifyRequest<{ Params: { user_id: UUID } }>
): Promise<PercentageWinsHistory> {
	var result: PercentageWinsHistory | null;
	try {
		result = StatsRepository.getPercentageWinsHistory(
			request.params.user_id
		);
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
	return result;
}

export default async function statsRoutes(fastify: FastifyInstance) {
	fastify.get(
		'/ranking',
		routeConfig({
			response: RankingSchema,
		}),
		getRanking
	);
	fastify.get(
		'/ranking/:user_id',
		routeConfig({
			params: z.object({ user_id: zUUID }),
			response: RankingItemSchema,
		}),
		getUserRankingItem
	);
	fastify.get(
		'/tournament/:user_id',
		routeConfig({
			params: z.object({ user_id: zUUID }),
			response: TournamentStatsSchema,
		}),
		getTournamentStats
	);
	fastify.get(
		'/wins_history/:user_id',
		routeConfig({
			params: z.object({ user_id: zUUID }),
			response: PercentageWinsHistorySchema,
		}),
		getPercentageWinsHistory
	);
}
