import { FastifyInstance, FastifyRequest } from 'fastify';
import {
	addConnection,
	handleClose,
	handleMessage,
} from '../connection_manager/connection_manager.js';
import { GameSocket } from '../types/interfaces.js';

function handleIncomingConnection(
	webSocket: WebSocket,
	request: FastifyRequest
) {
	const socket = webSocket as GameSocket;
	socket.addEventListener('message', handleMessage);
	socket.addEventListener('close', handleClose);
	addConnection(socket);
}

export default async function websocketRoutes(
	fastify: FastifyInstance,
	opts: Record<string, any>
) {
	fastify.get('/', { websocket: true }, handleIncomingConnection);
}
