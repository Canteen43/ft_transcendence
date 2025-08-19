'use strict';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ZodTypeProvider } from 'fastify-type-provider-zod';
import * as z from 'zod';
import * as constants from '../../shared/constants.js';
import { logger } from '../../shared/logger.js';
import {
	AuthenticateUser,
	AuthenticateUserSchema,
	CreateUser,
	CreateUserSchema,
	User,
	UserSchema,
} from '../../shared/schemas/user.js';
import { zodError } from '../../shared/utils.js';
import UserRepository from '../repositories/user_repository.js';
import { getHttpResponse } from '../utils/http_utils.js';

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
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

async function createUser(
	request: FastifyRequest<{ Body: CreateUser }>
): Promise<User> {
	try {
		const user: User = await UserRepository.createUser(request.body);
		return user;
	} catch (error) {
		if (error instanceof z.ZodError)
			throw request.server.httpErrors.badRequest(zodError(error));
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

async function authenticate(
	request: FastifyRequest<{ Body: AuthenticateUser }>
): Promise<User> {
	try {
		const authenticatedUser: User | null =
			await UserRepository.authenticateUser(
				request.body.login,
				request.body.password_hash
			);
		if (!authenticatedUser)
			throw request.server.httpErrors.unauthorized(
				constants.ERROR_INVALID_CREDENTIALS
			);
		return authenticatedUser;
	} catch (error) {
		if (error instanceof z.ZodError)
			throw request.server.httpErrors.badRequest(error.message);
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

export default async function user(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	const app = fastify.withTypeProvider<ZodTypeProvider>();

	app.get(
		'/:login',
		getHttpResponse({
			params: z.object({ login: z.string() }),
			response: UserSchema,
		}),
		getUser
	);
	app.post<{ Body: CreateUser }>(
		'/',
		getHttpResponse({ body: CreateUserSchema, response: UserSchema }),
		createUser
	);
	app.post<{ Body: AuthenticateUser }>(
		'/auth',
		getHttpResponse({ body: AuthenticateUserSchema, response: UserSchema }),
		authenticate
	);
}
