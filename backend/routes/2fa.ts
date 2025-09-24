import { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import { AuthResponse, AuthResponseSchema } from '../../shared/schemas/user.js';
import { authenticateRequest } from '../hooks/auth.js';
import UserRepository from '../repositories/user_repository.js';
import UserService from '../services/user_service.js';
import { routeConfig } from '../utils/http_utils.js';
import { getAuthData } from '../utils/utils.js';

async function enable(request: FastifyRequest): Promise<string> {
	const authRequest = getAuthData(request);
	return UserService.getQRForEnableTwoFactor(authRequest.token.userId);
}

async function verifyEnable(
	request: FastifyRequest<{ Body: string }>
): Promise<void> {
	const authRequest = getAuthData(request);
	UserService.verifyEnableTwoFactor(authRequest.token.userId, request.body);
}

async function validate(
	request: FastifyRequest<{ Body: string }>
): Promise<AuthResponse> {
	authenticateRequest(request, true); // Authenticate two factor token
	const authRequest = getAuthData(request);
	return UserService.validateTwoFactor(
		authRequest.token.userId,
		request.body
	);
}

async function disable(request: FastifyRequest): Promise<void> {
	const authRequest = getAuthData(request);
	UserRepository.setTwoFactor(authRequest.token.userId, {
		two_factor_enabled: false,
		two_factor_temp_secret: null,
		two_factor_secret: null,
	});
}

export default async function twoFactorRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.post(
		'/enable',
		routeConfig({
			response: z.string(),
		}),
		enable
	);
	fastify.post(
		'/enable/verify',
		routeConfig({
			body: z.string(),
		}),
		verifyEnable
	);
	fastify.post(
		'/validate',
		routeConfig({
			body: z.string(),
			response: AuthResponseSchema,
			secure: false,
		}),
		validate
	);
	fastify.post('/disable', routeConfig({}), disable);
}
