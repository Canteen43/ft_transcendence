import { FastifyInstance, FastifyRequest } from 'fastify';
import z from 'zod';
import { AuthenticationError } from '../../shared/exceptions.js';
import { UUID } from '../../shared/types.js';
import {
	addConnection,
	handleClose,
	handleMessage,
} from '../connection_manager/connection_manager.js';
import { authenticateRequest } from '../hooks/auth.js';
import { GameSocket } from '../types/interfaces.js';
import { routeConfig } from '../utils/http_utils.js';
import { getAuthData } from '../utils/utils.js';

function handleIncomingConnection(
	webSocket: WebSocket,
	request: FastifyRequest<{ Querystring: { token: string } }>
) {
	request.headers['authorization'] = `Bearer ${request.query.token}`;
	authenticateRequest(request);

	const authRequest = getAuthData(request);
	const socket = webSocket as GameSocket;
	socket.addEventListener('message', handleMessage);
	socket.addEventListener('close', handleClose);
	addConnection(authRequest.user.userId, socket);
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
