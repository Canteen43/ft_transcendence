import { FastifyRequest, RouteGenericInterface } from 'fastify';
import {
	ERROR_AUTHENTICATION_FAILED,
	ERROR_MALFORMED_TOKEN,
	ERROR_NO_TOKEN,
} from '../../shared/constants.js';
import { AuthenticationFailedError } from '../../shared/exceptions.js';
import UserService from '../services/user_service.js';

async function authenticateRequest(request: FastifyRequest) {
	try {
		const authHeader = request.headers['authorization'];
		if (!authHeader) throw new AuthenticationFailedError(ERROR_NO_TOKEN);

		// Expect header like "Bearer <token>"
		const token = authHeader.split(' ')[1];
		if (!token) throw new AuthenticationFailedError(ERROR_MALFORMED_TOKEN);

		request.user = UserService.verifyToken(token);
	} catch (error) {
		if (error instanceof AuthenticationFailedError)
			throw request.server.httpErrors.unauthorized(error.message);
		console.error('Unexpected auth error:', error);
		throw request.server.httpErrors.unauthorized(
			ERROR_AUTHENTICATION_FAILED
		);
	}
}

export function authWrapper<RouteGeneric extends RouteGenericInterface = {}>(
	handler: (request: FastifyRequest<RouteGeneric>) => any | Promise<any>
) {
	return async (request: FastifyRequest<RouteGeneric>) => {
		//await authenticateRequest(request);
		return handler(request);
	};
}
