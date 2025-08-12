import TournamentRepository from '../repositories/user_repository.js'
import UserRepository from '../repositories/user_repository.js'
import * as user from '../../shared/schemas/user.js'
import * as tournament from '../../shared/schemas/tournament.js'
import * as constants from '../../shared/constants.js'
import type { FastifyInstance, FastifyRequest } from 'fastify';

async function createTournament(
	fastify: FastifyInstance,
	request: FastifyRequest<{ Body: tournament.CreateTournament }>,
) {

}

export default async function (fastify: FastifyInstance, opts: Record<string, any>) {
	fastify.post<{ Body: tournament.CreateTournament }>(
		'/tournaments', (request) => createTournament(fastify, request)
	);
}
