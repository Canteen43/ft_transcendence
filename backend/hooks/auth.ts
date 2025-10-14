import { FastifyRequest } from 'fastify';
import { FastifyReply } from 'fastify/types/reply.js';
import {
	ERROR_AUTHENTICATION_FAILED,
	ERROR_INVALID_TOKEN,
	ERROR_MALFORMED_TOKEN,
	ERROR_NO_TOKEN,
} from '../../shared/constants.js';
import { Token } from '../../shared/enums.js';
import { AuthenticationFailedError } from '../../shared/exceptions.js';
import UserService from '../services/user_service.js';

export function authenticateRequest(
	request: FastifyRequest,
	twoFactor?: boolean
) {
	try {
		const authHeader = request.headers['authorization'];
		if (!authHeader) throw new AuthenticationFailedError(ERROR_NO_TOKEN);

		// Expect header like "Bearer <token>"
		const parts = authHeader.split(' ');
		if (parts[0] !== 'Bearer' || !parts[1])
			throw new AuthenticationFailedError(ERROR_MALFORMED_TOKEN);

		const token = parts[1];
		request.token = UserService.verifyToken(token);
		if (!twoFactor && request.token.type == Token.TwoFactor)
			throw new AuthenticationFailedError(ERROR_INVALID_TOKEN);
	} catch (error) {
		if (error instanceof AuthenticationFailedError)
			throw request.server.httpErrors.unauthorized(error.message);
		console.error('Unexpected auth error:', error);
		throw request.server.httpErrors.unauthorized(
			ERROR_AUTHENTICATION_FAILED
		);
	}
}

export const authHook = (
	request: FastifyRequest,
	reply: FastifyReply,
	done: Function
) => {
	if (
		request.routeOptions?.config?.secure !== false &&
		!request.url?.startsWith('/docs')
	)
		authenticateRequest(request);
	done();
};
