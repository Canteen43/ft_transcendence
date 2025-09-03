import { FastifyInstance, FastifyRequest } from 'fastify';
import { AuthenticationError } from '../../shared/exceptions.js';
import { UUID } from '../../shared/types.js';
import {
	addConnection,
	handleClose,
	handleMessage,
} from '../connection_manager/connection_manager.js';
import { GameSocket } from '../types/interfaces.js';
import { authenticateRequest, authHook } from '../hooks/auth.js';
import { routeConfig } from '../utils/http_utils.js';
import z from 'zod';

function handleIncomingConnection(
	webSocket: WebSocket,
	request: FastifyRequest<{ Querystring: { token: string } }>
) {
	request.headers['authorization'] = `Bearer ${request.query.token}`;
	authenticateRequest(request);

	if (!request.user) throw new AuthenticationError('User not authenticated');
	const socket = webSocket as GameSocket;
	socket.addEventListener('message', handleMessage);
	socket.addEventListener('close', handleClose);
	addConnection(request.user.userId, socket);
}

export default async function websocketRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get('/', {
		...routeConfig({
			querystring: z.object({ token: z.string() }),
			secure: false
		}),
		websocket: true
	}, handleIncomingConnection);
}
