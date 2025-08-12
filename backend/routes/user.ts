import UserRepository from '../repositories/user_repository.js'
import * as user from '../../shared/schemas/user.js'
import * as constants from '../../shared/constants.js'
import type { FastifyInstance, FastifyRequest } from 'fastify';

async function getUser(
	fastify: FastifyInstance,
	request: FastifyRequest<{ Params: { login: string } }>,
): Promise<user.User> {
	const user: user.User | null = await UserRepository.getUserByLogin(request.params.login);
	if (!user) {
		throw fastify.httpErrors.notFound(constants.ERROR_USER_NOT_FOUND);
	}
	return user;
}

async function createUser(
	fastify: FastifyInstance,
	request: FastifyRequest<{ Body: user.CreateUser }>,
): Promise<user.User> {
	try {
		const user: user.User | null = await UserRepository.createUser(request.body);
		return user;
	} catch (error) {
		console.log(error);
		throw fastify.httpErrors.internalServerError(constants.ERROR_CREATE_USER_FAILED)
	}
}

async function authenticateUser(
	fastify: FastifyInstance,
	request: FastifyRequest<{ Body: user.AuthenticateUser }>,
): Promise<user.User> {
	const authenticatedUser: user.User | null = await UserRepository.authenticateUser(
		request.body.login,
		request.body.password_hash
	);

	if (!authenticatedUser)
		throw fastify.httpErrors.unauthorized(constants.ERROR_INVALID_CREDENTIALS);
	return authenticatedUser;
}

export default async function (fastify: FastifyInstance, opts: Record<string, any>) {
	fastify.get<{ Params: { login: string } }>(
		'/users/:login',
		(request) => getUser(fastify, request)
	);
	fastify.post<{ Body: user.CreateUser }>(
		'/users', (request) => createUser(fastify, request)
	);
	fastify.post<{ Body: user.AuthenticateUser }>(
		'/users/authenticate',
		(request) => authenticateUser(fastify, request)
	);
}
