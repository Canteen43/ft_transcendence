import { JwtPayload } from 'jsonwebtoken';
import { UUID } from '../../shared/types.js';

export interface AuthPayload extends JwtPayload {
	userId: string;
}

export interface GameSocket extends WebSocket {
	socketId: UUID;
}
