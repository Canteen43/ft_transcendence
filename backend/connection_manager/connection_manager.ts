import { randomUUID } from 'crypto';
import { UUID } from '../../shared/types.js';
import { GameService } from '../services/game_service.js';
import { GameSocket } from '../types/interfaces.js';

const connections: Map<UUID, GameSocket> = new Map();

function generateId(): UUID {
	let id: UUID;
	do {
		id = randomUUID() as UUID;
	} while (connections.has(id)); // Collision check
	return id;
}

export function addConnection(socket: GameSocket): UUID {
	const id = generateId();
	socket.socketId = id;
	connections.set(id, socket);
	return id;
}

export function handleClose(event: CloseEvent) {
	const socket = event.target as GameSocket;
	connections.delete(socket.socketId);
}

export function handleMessage(event: MessageEvent) {
	const socket = event.target as GameSocket;
	GameService.getInstance().handleMessage(socket.socketId, event.data);
}
