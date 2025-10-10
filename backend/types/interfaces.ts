import { FastifyRequest, RouteGenericInterface } from 'fastify';
import { JwtPayload } from 'jsonwebtoken';
import { PlayerStatus, Token, TournamentType } from '../../shared/enums.js';
import { UUID } from '../../shared/types.js';

export interface UserAuth {
	id: UUID;
	password_hash: string;
}

export interface AuthPayload extends JwtPayload {
	type: Token;
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
	alias: string | null;
}

export interface AuthenticatedRequest<
	T extends RouteGenericInterface = RouteGenericInterface,
> extends FastifyRequest<T> {
	token: {
		userId: UUID;
		type: Token;
	};
}

export interface TwoFactorSecret {
	secret: string;
	otpauthUrl: string;
	qrCodeDataUrl: string;
}
