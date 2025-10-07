import { WebSocket } from '@fastify/websocket';
import { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import {
	ERROR_AUTHENTICATION_FAILED,
	ERROR_TOKEN_EXPIRED,
	ERROR_USER_ALREADY_CONNECTED,
	WS_ALREADY_CONNECTED,
	WS_AUTHENTICATION_FAILED,
	WS_TOKEN_EXPIRED,
} from '../../shared/constants.js';
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
	const socket: GameSocket = webSocket as unknown as GameSocket;

	try {
		authenticateRequest(request);
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: ERROR_AUTHENTICATION_FAILED;
		if (message == ERROR_TOKEN_EXPIRED)
			socket.close(WS_TOKEN_EXPIRED, message);
		else socket.close(WS_AUTHENTICATION_FAILED, message);
		return;
	}
	const authRequest = getAuthData(request);

	try {
		await LockService.withLock(LockType.Auth, async () =>
			addConnection(authRequest.token.userId, socket as GameSocket)
		);
	} catch (error) {
		socket.close(WS_ALREADY_CONNECTED, ERROR_USER_ALREADY_CONNECTED);
	}
}

export default async function websocketRoutes(fastify: FastifyInstance) {
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
