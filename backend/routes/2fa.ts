import { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import { AuthResponse, AuthResponseSchema } from '../../shared/schemas/user.js';
import UserService from '../services/user_service.js';
import { routeConfig } from '../utils/http_utils.js';
import { getAuthData } from '../utils/utils.js';

async function enable(request: FastifyRequest): Promise<string> {
	const authRequest = getAuthData(request);
	return UserService.getQRForEnableTwoFactor(authRequest.user.userId);
}

async function verifyEnable(
	request: FastifyRequest<{ Body: string }>
): Promise<void> {
	const authRequest = getAuthData(request);
	UserService.verifyEnableTwoFactor(authRequest.user.userId, request.body);
}

async function validate(
	request: FastifyRequest<{ Body: string }>
): Promise<AuthResponse> {
	const authRequest = getAuthData(request);
	return UserService.validateTwoFactor(authRequest.user.userId, request.body);
}

async function disable(request: FastifyRequest): Promise<void> {}

export default async function twoFactorRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.post(
		'/enable',
		routeConfig({
			response: z.string(),
			secure: false,
		}),
		enable
	);
	fastify.post(
		'/enable/verify',
		routeConfig({
			body: z.string(),
			secure: false,
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
	fastify.post('/disable', routeConfig({ secure: false }), disable);
}
