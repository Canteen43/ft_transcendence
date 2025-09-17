import { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import { addConnection } from '../connection_manager/connection_manager.js';
import { authenticateRequest } from '../hooks/auth.js';
import { LockService, LockType } from '../services/lock_service.js';
import { GameSocket } from '../types/interfaces.js';
import { routeConfig } from '../utils/http_utils.js';
import { getAuthData } from '../utils/utils.js';

async function handleIncomingConnection(
	webSocket: WebSocket,
	request: FastifyRequest<{ Querystring: { token: string } }>
) {
	request.headers['authorization'] = `Bearer ${request.query.token}`;
	authenticateRequest(request);
	const authRequest = getAuthData(request);

	await LockService.withLock(LockType.Auth, async () =>
		addConnection(authRequest.user.userId, webSocket as GameSocket)
	);
}

export default async function websocketRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get(
		'/',
		{
			...routeConfig({
				querystring: z.object({ token: z.string() }),
				secure: false,
			}),
			websocket: true,
		},
		handleIncomingConnection
	);
}
