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
	status: ParticipantStatus;
}
