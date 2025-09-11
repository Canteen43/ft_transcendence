import { FastifyRequest, RouteGenericInterface } from 'fastify';
import { JwtPayload } from 'jsonwebtoken';
import { ParticipantStatus } from '../../shared/enums.js';
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
	paddlePos: number;
	status: ParticipantStatus;
}

export interface AuthenticatedRequest<
	T extends RouteGenericInterface = RouteGenericInterface,
> extends FastifyRequest<T> {
	user: {
		userId: UUID;
	};
}
