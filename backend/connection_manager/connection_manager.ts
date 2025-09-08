import { randomUUID } from 'crypto';
import { UUID } from '../../shared/types.js';
import { GameService } from '../game/game_protocol.js';
import { GameSocket } from '../types/interfaces.js';
import { logger } from '../../shared/logger.js';

export const connections: Map<UUID, GameSocket> = new Map(); // Links connectionId to socket
export const userIdToConnectionMap: Map<UUID, GameSocket> = new Map(); // Links userId to socket

function generateId(): UUID {
	let id: UUID;
	do {
		id = randomUUID() as UUID;
	} while (connections.has(id)); // Collision check
	return id;
}

export function addConnection(user_id: UUID, socket: GameSocket): UUID {
	const id = generateId();
	socket.socketId = id;
	socket.userId = user_id;
	connections.set(id, socket);
	connections.set(user_id, socket);
	return id;
}

export function handleClose(event: CloseEvent) {
	const socket = event.target as GameSocket;
	connections.delete(socket.socketId);
}

export function handleMessage(event: MessageEvent) {
	logger.debug("Received WebSocket message");
	const socket = event.target as GameSocket;
	GameService.getInstance().handleMessage(socket.socketId, event.data);
}
