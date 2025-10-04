'use strict';

import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as z from 'zod';
import * as constants from '../../shared/constants.js';
import {
	AuthenticationFailedError,
	UserAlreadyExistsError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import {
	AuthRequest,
	AuthRequestSchema,
	AuthResponse,
	AuthResponseSchema,
	CreateUser,
	CreateUserSchema,
	User,
	UserSchema,
} from '../../shared/schemas/user.js';
import { UUID, zUUID } from '../../shared/types.js';
import { getOnlineUsers } from '../connection_manager/connection_manager.js';
import UserRepository from '../repositories/user_repository.js';
import UserService from '../services/user_service.js';
import { routeConfig } from '../utils/http_utils.js';

async function getUserByLogin(
	request: FastifyRequest<{ Params: { login: string } }>
): Promise<User> {
	var user: User | null;
	try {
		user = UserRepository.getUserByLogin(request.params.login);
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
	if (!user) {
		throw request.server.httpErrors.notFound(
			constants.ERROR_USER_NOT_FOUND
		);
	}
	return user;
}

function getUserById(request: FastifyRequest<{ Params: { id: UUID } }>): User {
	var user: User | null;
	try {
		user = UserRepository.getUser(request.params.id);
	} catch (error) {
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
	if (!user) {
		throw request.server.httpErrors.notFound(
			constants.ERROR_USER_NOT_FOUND
		);
	}
	return user;
}

async function getOnlineUsersHandler(request: FastifyRequest): Promise<User[]> {
	try {
		const users = getOnlineUsers()
			.map(uuid => UserRepository.getUser(uuid))
			.filter((u): u is User => u !== null);
		return users;
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
	logger.debug('Create user request received');
	try {
		const user: User = await UserRepository.createUser(request.body);
		return user;
	} catch (error: any) {
		if (error instanceof UserAlreadyExistsError)
			throw request.server.httpErrors.conflict(error.message);
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

async function authenticate(
	request: FastifyRequest<{ Body: AuthRequest }>
): Promise<AuthResponse> {
	logger.debug('Authenticate request received');
	try {
		const authResponse = await UserService.authenticate(request.body);
		return authResponse;
	} catch (error) {
		if (error instanceof AuthenticationFailedError)
			throw request.server.httpErrors.unauthorized(
				constants.ERROR_INVALID_CREDENTIALS
			);
		logger.error(error);
		throw request.server.httpErrors.internalServerError(
			constants.ERROR_REQUEST_FAILED
		);
	}
}

export default async function userRoutes(fastify: FastifyInstance) {
	fastify.get(
		'/login/:login',
		routeConfig({
			params: z.object({ login: z.string() }),
			response: UserSchema,
		}),
		getUserByLogin
	);
	fastify.get(
		'/:id',
		routeConfig({
			params: z.object({ id: zUUID }),
			response: UserSchema,
		}),
		getUserById
	);
	fastify.get(
		'/online',
		routeConfig({
			response: z.array(UserSchema),
		}),
		getOnlineUsersHandler
	);
	fastify.post<{ Body: CreateUser }>(
		'/',
		routeConfig({
			body: CreateUserSchema,
			response: UserSchema,
			secure: false,
		}),
		createUser
	);
	fastify.post<{ Body: AuthRequest }>(
		'/auth',
		routeConfig({
			body: AuthRequestSchema,
			response: AuthResponseSchema,
			secure: false,
		}),
		authenticate
	);
}
