import { FastifyReply, FastifyRequest } from 'fastify';
import {
	ERROR_INVALID_TOKEN,
	ERROR_MALFORMED_TOKEN,
	ERROR_NO_TOKEN,
} from '../../shared/constants.js';
import { AuthenticationFailedError } from '../../shared/exceptions.js';
import UserService from '../services/user_service.js';

export async function authenticateRequest(request: FastifyRequest) {
	try {
		const authHeader = request.headers['authorization'];
		if (!authHeader) throw new AuthenticationFailedError(ERROR_NO_TOKEN);

		// Expect header like "Bearer <token>"
		const token = authHeader.split(' ')[1];
		if (!token) throw new AuthenticationFailedError(ERROR_MALFORMED_TOKEN);

		request.user = UserService.verifyToken(token);
	} catch (error) {
		throw request.server.httpErrors.unauthorized(error.message);
	}
}
