import { FastifyRequest, RouteGenericInterface } from 'fastify';
import { JwtPayload } from 'jsonwebtoken';
import { PlayerStatus } from '../../shared/enums.js';
import { UUID } from '../../shared/types.js';

export interface AuthPayload extends JwtPayload {
	userId: string;
}

export interface GameSocket extends WebSocket {
	socketId: UUID;
	userId: UUID;
}

export interface Player {
	userId: UUID;
	score: number;
	status: PlayerStatus;
}

export interface QueuedUser {
	userId: UUID;
	alias: string;
}

export interface AuthenticatedRequest<
	T extends RouteGenericInterface = RouteGenericInterface,
> extends FastifyRequest<T> {
	user: {
		userId: UUID;
	};
}
