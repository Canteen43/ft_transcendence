import { FastifyRequest, RouteGenericInterface } from 'fastify';
import { AuthenticationError } from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import { AuthenticatedRequest } from '../types/interfaces.js';

export function formatError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

export function getAuthData<T extends RouteGenericInterface>(
	request: FastifyRequest<T>
): AuthenticatedRequest<T> {
	if (!request.user) throw new AuthenticationError('User not authenticated');
	return request as AuthenticatedRequest<T>;
}
