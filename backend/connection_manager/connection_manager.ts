import { randomUUID } from 'crypto';
import {
	ERROR_USER_ALREADY_CONNECTED,
	ERROR_USER_CONNECTION_NOT_FOUND,
	WS_ALREADY_CONNECTED,
	WS_CLOSE_POLICY_VIOLATION,
} from '../../shared/constants.js';
import {
	ConnectionError,
	UserAlreadyConnectedError,
} from '../../shared/exceptions.js';
import { logger } from '../../shared/logger.js';
import { UUID } from '../../shared/types.js';
import { GameProtocol } from '../game/game_protocol.js';
import TournamentService from '../services/tournament_service.js';
import { GameSocket } from '../types/interfaces.js';

const connections: Map<UUID, GameSocket> = new Map(); // Links connectionId to socket
const userIdToConnectionMap: Map<UUID, GameSocket> = new Map(); // Links userId to socket

function generateId(): UUID {
	let id: UUID;
	do {
		id = randomUUID() as UUID;
	} while (connections.has(id)); // Collision check
	return id;
}

export function getConnection(connectionId: UUID) {
	return connections.get(connectionId);
}

export function getConnectionByUserId(userId: UUID) {
	return userIdToConnectionMap.get(userId);
}

export function addConnection(userId: UUID, socket: GameSocket): UUID {
	if (userIdToConnectionMap.get(userId)) {
		throw new UserAlreadyConnectedError(userId);
	}

	logger.debug('websocket: Incoming connection');

	socket.addEventListener('message', handleMessage);
	socket.addEventListener('close', handleClose);

	const id = generateId();
	socket.socketId = id;
	socket.userId = userId;
	connections.set(id, socket);
	userIdToConnectionMap.set(userId, socket);
	return id;
}

export function handleClose(event: CloseEvent) {
	logger.debug('websocket: close event received.');
	const socket = event.target as GameSocket;
	TournamentService.leaveQueue(socket.userId);
	GameProtocol.getInstance().handleClose(socket.socketId);
	connections.delete(socket.socketId);
	userIdToConnectionMap.delete(socket.userId);
}

export function handleMessage(event: MessageEvent) {
	const socket = event.target as GameSocket;
	GameProtocol.getInstance().handleMessage(socket.socketId, event.data);
}

export function getOnlineUsers(): UUID[] {
	return Array.from(userIdToConnectionMap.keys());
}
