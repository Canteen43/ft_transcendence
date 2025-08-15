import UserRepository from '../repositories/user_repository.js';
import * as constants from '../../shared/constants.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
	AuthenticateUser,
	AuthenticateUserSchema,
	CreateUser,
	CreateUserSchema,
	User,
} from '../../shared/schemas/user.js';
import * as zod from 'zod';

async function getUser(
	request: FastifyRequest<{ Params: { login: string } }>
): Promise<User> {
	try {
		const user: User | null = await UserRepository.getUserByLogin(
			request.params.login
		);
		if (!user) {
			throw request.server.httpErrors.notFound(
				constants.ERROR_USER_NOT_FOUND
			);
		}
		return user;
	} catch (error) {
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

async function createUser(
	request: FastifyRequest<{ Body: CreateUser }>
): Promise<User> {
	try {
		const parsedBody = CreateUserSchema.parse(request.body);
		const user: User = await UserRepository.createUser(parsedBody);
		return user;
	} catch (error) {
		if (error instanceof zod.ZodError)
			throw request.server.httpErrors.badRequest(error.message);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_CREATE_USER_FAILED
		);
	}
}

async function authenticate(
	request: FastifyRequest<{ Body: AuthenticateUser }>
): Promise<User> {
	const parsedBody = AuthenticateUserSchema.parse(request.body);
	try {
		const authenticatedUser: User | null =
			await UserRepository.authenticateUser(
				parsedBody.login,
				parsedBody.password_hash
			);
		if (!authenticatedUser)
			throw request.server.httpErrors.unauthorized(
				constants.ERROR_INVALID_CREDENTIALS
			);
		return authenticatedUser;
	} catch (error) {
		if (error instanceof zod.ZodError)
			throw request.server.httpErrors.badRequest(error.message);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

export default async function (
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get<{ Params: { login: string } }>('/users/:login', getUser);
	fastify.post<{ Body: CreateUser }>('/users', createUser);
	fastify.post<{ Body: AuthenticateUser }>('/users/auth', authenticate);
}
