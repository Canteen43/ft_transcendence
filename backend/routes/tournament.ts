import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as z from 'zod';
import * as constants from '../../shared/constants.js';
import { ERROR_USER_ALREADY_QUEUED } from '../../shared/constants.js';
import { UserAlreadyQueuedError } from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	CreateTournamentApi,
	CreateTournamentApiSchema,
	FullTournament,
	FullTournamentSchema,
	JoinTournament,
	JoinTournamentSchema,
	Tournament,
	TournamentQueue,
	TournamentQueueSchema,
	TournamentSchema,
} from '../../shared/schemas/tournament.js';
import { UUID, zUUID } from '../../shared/types.js';
import TournamentService from '../services/tournament_service.js';
import { QueuedUser } from '../types/interfaces.js';
import { routeConfig } from '../utils/http_utils.js';
import { getAuthData } from '../utils/utils.js';

async function createTournament(
	request: FastifyRequest<{ Body: CreateTournamentApi }>
): Promise<Tournament> {
	logger.debug('Create tournament request received');
	try {
		const tournament = TournamentService.createTournamentFromQueue(
			request.body.type,
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

async function createTournamentReplay(
	request: FastifyRequest<{ Body: CreateTournamentApi }>
): Promise<Tournament> {
	logger.debug('Create tournament request received');
	try {
		const tournament = TournamentService.createTournamentForReplay(
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
			constants.ERROR_TOURNAMENT_NOT_FOUND
		);
	return result;
}

async function joinTournament(
	request: FastifyRequest<{ Body: JoinTournament }>
): Promise<TournamentQueue> {
	logger.debug('Join tournament request received');
	const authRequest = getAuthData(request);

	try {
		await TournamentService.joinQueue(
			request.body.size,
			request.body.type,
			authRequest.token.userId,
			request.body.alias
		);
	} catch (error: any) {
		if (error instanceof UserAlreadyQueuedError)
			throw request.server.httpErrors.conflict(ERROR_USER_ALREADY_QUEUED);
		logger.error(error);
		throw error;
	}

	const queue = await TournamentService.getQueueWithLock(request.body.size);
	return { queue: Array.from(queue).map(user => user.userId) };
}

async function leaveQueue(request: FastifyRequest) {
	const authRequest = getAuthData(request);
	logger.debug('Leave queue request received');
	TournamentService.leaveQueue(authRequest.token.userId);
	//TournamentService.quitCurrentTournament(authRequest.user.userId);
}

export default async function tournamentRoutes(fastify: FastifyInstance) {
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
	fastify.post(
		'/replay',
		routeConfig({
			body: CreateTournamentApiSchema,
			response: TournamentSchema,
		}),
		createTournamentReplay
	);
	fastify.post(
		'/join',
		routeConfig({
			body: JoinTournamentSchema,
			response: TournamentQueueSchema,
		}),
		joinTournament
	);
	fastify.post('/leave', leaveQueue);
}
